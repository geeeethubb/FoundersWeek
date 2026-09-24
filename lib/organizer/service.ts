/**
 * Organizer actions: status changes, notes, appointment assignment/confirmation/cancellation.
 *
 * Every function takes (db, input, context) — the context carries the acting organizer and the
 * content slot lookup — so the rules are unit-testable without env or Next. Route handlers are
 * thin wrappers that authorize, validate and map errors.
 *
 * Concurrency: assignment and confirmation take transaction-scoped advisory locks — first on the
 * slot, then on the student (normalized email) — always in that order, so two organizers can't
 * both fill the last seat, and one student can't be double-booked across applications.
 */
import "server-only";
import { z } from "zod";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type AppointmentStatus,
} from "@/lib/applications/constants";
import type { Database, Queryable } from "@/lib/db/client";
import { zonedTimeToUtc } from "@/lib/time";
import { intervalLabel, type SlotInfo } from "./directory";
import { OrganizerActionError } from "./errors";
import { mapAppointment, type AppointmentRecord } from "./queries";

export interface ActionContext {
  /** Organizer display name from the session; recorded in the activity log. */
  actor: string;
  /** Appointment slots currently in content, by id. */
  slots: ReadonlyMap<string, SlotInfo>;
}

export const ORGANIZER_NOTES_MAX = 5000;

const uuid = z.uuid("Invalid id.");

export const updateApplicationSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    organizerNotes: z.string().max(ORGANIZER_NOTES_MAX, `Keep notes under ${ORGANIZER_NOTES_MAX} characters.`).optional(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.organizerNotes !== undefined, { message: "Nothing to update." });
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const assignAppointmentSchema = z
  .object({
    applicationId: uuid,
    slotId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slot id.").max(120),
  })
  .strict();
export type AssignAppointmentInput = z.infer<typeof assignAppointmentSchema>;

export const updateAppointmentSchema = z.object({ action: z.enum(["confirm", "cancel"]) }).strict();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Statuses that require at least one confirmed appointment. */
const NEEDS_CONFIRMED_APPOINTMENT: ApplicationStatus[] = ["confirmed", "attended"];
/** Assigning a slot moves these to "selected". */
const PROMOTE_ON_ASSIGN: ApplicationStatus[] = ["submitted", "under_review", "waitlisted"];
/** No new appointments for these. */
const CLOSED_STATUSES: ApplicationStatus[] = ["canceled", "attended"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lockSlot(tx: Queryable, slotId: string) {
  await tx.query(`select pg_advisory_xact_lock(hashtextextended('slot:' || $1, 0))`, [slotId]);
}

async function lockStudent(tx: Queryable, emailNormalized: string) {
  await tx.query(`select pg_advisory_xact_lock(hashtextextended('student:' || $1, 0))`, [emailNormalized]);
}

export async function logActivity(
  tx: Queryable,
  applicationId: string,
  actor: string,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await tx.query(
    `insert into application_activity (application_id, actor, action, detail) values ($1, $2, $3, $4::jsonb)`,
    [applicationId, actor, action, JSON.stringify(detail)],
  );
}

type LockedApplication = { id: string; status: ApplicationStatus; email_normalized: string; full_name: string };

async function lockApplication(tx: Queryable, id: string): Promise<LockedApplication> {
  const [app] = await tx.query<LockedApplication>(
    `select id, status, email_normalized, full_name from applications where id = $1 for update`,
    [id],
  );
  if (!app) throw new OrganizerActionError(404, "application_not_found", "That application doesn’t exist.");
  return app;
}

async function setApplicationStatus(
  tx: Queryable,
  app: LockedApplication,
  to: ApplicationStatus,
  ctx: ActionContext,
  reason?: string,
) {
  if (app.status === to) return;
  await tx.query(`update applications set status = $2, updated_at = now() where id = $1`, [app.id, to]);
  await logActivity(tx, app.id, ctx.actor, "status_changed", { from: app.status, to, ...(reason ? { reason } : {}) });
  app.status = to;
}

async function findStudentConflict(
  tx: Queryable,
  emailNormalized: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId: string | null,
): Promise<{ id: string; mentor_id: string; slot_id: string; starts_at: Date | string; ends_at: Date | string } | null> {
  const [row] = await tx.query<{ id: string; mentor_id: string; slot_id: string; starts_at: Date | string; ends_at: Date | string }>(
    `select ap.id, ap.mentor_id, ap.slot_id, ap.starts_at, ap.ends_at
       from appointments ap join applications a on a.id = ap.application_id
      where a.email_normalized = $1
        and ap.status <> 'canceled'
        and ($4::uuid is null or ap.id <> $4::uuid)
        and tstzrange(ap.starts_at, ap.ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
      order by ap.starts_at
      limit 1`,
    [emailNormalized, startsAt.toISOString(), endsAt.toISOString(), excludeAppointmentId],
  );
  return row ?? null;
}

function conflictError(
  studentName: string,
  conflict: { mentor_id: string; slot_id: string; starts_at: Date | string; ends_at: Date | string },
  ctx: ActionContext,
) {
  const when = intervalLabel(conflict.starts_at, conflict.ends_at);
  const other = ctx.slots.get(conflict.slot_id);
  const withWhom = other ? ` with ${other.mentorName}` : "";
  return new OrganizerActionError(
    409,
    "student_conflict",
    `${studentName} already has an appointment at an overlapping time (${when}${withWhom}).`,
    { conflictingTime: when },
  );
}

function slotInterval(slot: SlotInfo) {
  return { startsAt: zonedTimeToUtc(slot.date, slot.start), endsAt: zonedTimeToUtc(slot.date, slot.end) };
}

// ---------------------------------------------------------------------------
// Application status / notes
// ---------------------------------------------------------------------------

export async function updateApplication(
  db: Database,
  input: { id: string } & UpdateApplicationInput,
  ctx: ActionContext,
): Promise<{ status: ApplicationStatus; organizerNotes: string; canceledAppointments: number }> {
  return db.transaction(async (tx) => {
    const app = await lockApplication(tx, input.id);
    let canceledAppointments = 0;

    if (input.status && input.status !== app.status) {
      if (NEEDS_CONFIRMED_APPOINTMENT.includes(input.status)) {
        const [{ n }] = await tx.query<{ n: number }>(
          `select count(*)::int as n from appointments where application_id = $1 and status = 'confirmed'`,
          [app.id],
        );
        if (Number(n) === 0) {
          throw new OrganizerActionError(
            409,
            "needs_confirmed_appointment",
            `“${APPLICATION_STATUS_LABELS[input.status]}” needs at least one confirmed appointment. Confirm an appointment first.`,
          );
        }
      }
      if (input.status === "canceled") {
        const canceled = await tx.query<{ id: string; slot_id: string }>(
          `update appointments set status = 'canceled', updated_at = now()
            where application_id = $1 and status <> 'canceled' returning id, slot_id`,
          [app.id],
        );
        canceledAppointments = canceled.length;
        for (const a of canceled) {
          await logActivity(tx, app.id, ctx.actor, "appointment_canceled", {
            appointmentId: a.id,
            slotId: a.slot_id,
            reason: "application_canceled",
          });
        }
      }
      await setApplicationStatus(tx, app, input.status, ctx);
    }

    const [current] = await tx.query<{ organizer_notes: string }>(
      `select organizer_notes from applications where id = $1`,
      [app.id],
    );
    let organizerNotes = current.organizer_notes;
    if (input.organizerNotes !== undefined) {
      const next = input.organizerNotes.replace(/\s+$/, "");
      if (next !== organizerNotes) {
        await tx.query(`update applications set organizer_notes = $2, updated_at = now() where id = $1`, [app.id, next]);
        await logActivity(tx, app.id, ctx.actor, "notes_updated", { characters: next.length });
        organizerNotes = next;
      }
    }
    return { status: app.status, organizerNotes, canceledAppointments };
  });
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export async function assignAppointment(
  db: Database,
  input: AssignAppointmentInput,
  ctx: ActionContext,
): Promise<{ appointment: AppointmentRecord; applicationStatus: ApplicationStatus }> {
  const slot = ctx.slots.get(input.slotId);
  if (!slot) {
    throw new OrganizerActionError(404, "slot_not_found", "That appointment slot isn’t in the schedule.");
  }
  const { startsAt, endsAt } = slotInterval(slot);

  return db.transaction(async (tx) => {
    await lockSlot(tx, slot.id);
    const app = await lockApplication(tx, input.applicationId);
    if (CLOSED_STATUSES.includes(app.status)) {
      throw new OrganizerActionError(
        409,
        "application_closed",
        `This application is ${APPLICATION_STATUS_LABELS[app.status].toLowerCase()}. Change its status before assigning an appointment.`,
      );
    }
    await lockStudent(tx, app.email_normalized);

    const existing = await tx.query<{ id: string }>(
      `select id from appointments where application_id = $1 and slot_id = $2 and status <> 'canceled'`,
      [app.id, slot.id],
    );
    if (existing.length) {
      throw new OrganizerActionError(409, "already_assigned", "This application already has this slot.");
    }

    const [{ n }] = await tx.query<{ n: number }>(
      `select count(*)::int as n from appointments where slot_id = $1 and status <> 'canceled'`,
      [slot.id],
    );
    if (Number(n) >= slot.capacity) {
      throw new OrganizerActionError(
        409,
        "slot_full",
        `This slot is full (${Number(n)}/${slot.capacity}).`,
        { used: Number(n), capacity: slot.capacity },
      );
    }

    const conflict = await findStudentConflict(tx, app.email_normalized, startsAt, endsAt, null);
    if (conflict) throw conflictError(app.full_name, conflict, ctx);

    const [row] = await tx.query<Record<string, unknown>>(
      `insert into appointments (application_id, mentor_id, slot_id, starts_at, ends_at, status, created_by)
       values ($1, $2, $3, $4::timestamptz, $5::timestamptz, 'proposed', $6)
       returning *`,
      [app.id, slot.mentorId, slot.id, startsAt.toISOString(), endsAt.toISOString(), ctx.actor],
    );
    const appointment = mapAppointment(row as never);
    await logActivity(tx, app.id, ctx.actor, "appointment_proposed", {
      appointmentId: appointment.id,
      slotId: slot.id,
      mentorId: slot.mentorId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
    });
    if (PROMOTE_ON_ASSIGN.includes(app.status)) await setApplicationStatus(tx, app, "selected", ctx);
    return { appointment, applicationStatus: app.status };
  });
}

export async function updateAppointment(
  db: Database,
  input: { id: string } & UpdateAppointmentInput,
  ctx: ActionContext,
): Promise<{ appointment: AppointmentRecord; applicationStatus: ApplicationStatus }> {
  return db.transaction(async (tx) => {
    const [found] = await tx.query<{ slot_id: string; application_id: string }>(
      `select slot_id, application_id from appointments where id = $1`,
      [input.id],
    );
    if (!found) throw new OrganizerActionError(404, "appointment_not_found", "That appointment doesn’t exist.");

    // Same lock order as assignment: slot → application row → student.
    await lockSlot(tx, found.slot_id);
    const app = await lockApplication(tx, found.application_id);
    await lockStudent(tx, app.email_normalized);
    const [current] = await tx.query<{ status: AppointmentStatus }>(
      `select status from appointments where id = $1 for update`,
      [input.id],
    );
    const status = current.status;

    if (input.action === "confirm") {
      if (status === "confirmed") {
        throw new OrganizerActionError(409, "already_confirmed", "This appointment is already confirmed.");
      }
      if (status === "canceled") {
        throw new OrganizerActionError(
          409,
          "appointment_canceled",
          "Canceled appointments can’t be confirmed. Assign the slot again instead.",
        );
      }
      if (CLOSED_STATUSES.includes(app.status)) {
        throw new OrganizerActionError(
          409,
          "application_closed",
          `This application is ${APPLICATION_STATUS_LABELS[app.status].toLowerCase()}.`,
        );
      }
      const slot = ctx.slots.get(found.slot_id);
      if (!slot) {
        throw new OrganizerActionError(409, "slot_missing", "This slot isn’t in the schedule anymore.");
      }
      if (slot.status !== "confirmed") {
        throw new OrganizerActionError(
          409,
          "slot_not_confirmed",
          `This time isn’t confirmed with the mentor (${slot.mentorName}) yet. Mark the slot as confirmed in content before confirming appointments.`,
        );
      }
      // Re-snapshot the time from content in case it was edited after the proposal.
      const { startsAt, endsAt } = slotInterval(slot);
      const conflict = await findStudentConflict(tx, app.email_normalized, startsAt, endsAt, input.id);
      if (conflict) throw conflictError(app.full_name, conflict, ctx);
      const [{ n }] = await tx.query<{ n: number }>(
        `select count(*)::int as n from appointments where slot_id = $1 and status = 'confirmed' and id <> $2`,
        [slot.id, input.id],
      );
      if (Number(n) >= slot.capacity) {
        throw new OrganizerActionError(409, "slot_full", `This slot is full (${Number(n)}/${slot.capacity}).`);
      }
      const [row] = await tx.query<Record<string, unknown>>(
        `update appointments set status = 'confirmed', starts_at = $2::timestamptz, ends_at = $3::timestamptz, updated_at = now()
          where id = $1 returning *`,
        [input.id, startsAt.toISOString(), endsAt.toISOString()],
      );
      const appointment = mapAppointment(row as never);
      await logActivity(tx, app.id, ctx.actor, "appointment_confirmed", {
        appointmentId: appointment.id,
        slotId: slot.id,
        mentorId: slot.mentorId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
      });
      if (app.status !== "attended") await setApplicationStatus(tx, app, "confirmed", ctx);
      return { appointment, applicationStatus: app.status };
    }

    // cancel
    if (status === "canceled") {
      throw new OrganizerActionError(409, "already_canceled", "This appointment is already canceled.");
    }
    const [row] = await tx.query<Record<string, unknown>>(
      `update appointments set status = 'canceled', updated_at = now() where id = $1 returning *`,
      [input.id],
    );
    const appointment = mapAppointment(row as never);
    await logActivity(tx, app.id, ctx.actor, "appointment_canceled", {
      appointmentId: appointment.id,
      slotId: appointment.slotId,
      mentorId: appointment.mentorId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      previousStatus: status,
    });
    if (app.status === "confirmed") {
      const [remaining] = await tx.query<{ confirmed: number; proposed: number }>(
        `select (count(*) filter (where status = 'confirmed'))::int as confirmed,
                (count(*) filter (where status = 'proposed'))::int as proposed
           from appointments where application_id = $1`,
        [app.id],
      );
      if (Number(remaining.confirmed) === 0) {
        await setApplicationStatus(
          tx,
          app,
          Number(remaining.proposed) > 0 ? "selected" : "under_review",
          ctx,
          "no_confirmed_appointments",
        );
      }
    }
    return { appointment, applicationStatus: app.status };
  });
}
