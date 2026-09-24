/**
 * Application persistence. All SQL for the public application flow lives here:
 * - `insertApplication` writes an application and its mentors, availability and first activity
 *   row in ONE transaction, idempotently (keyed by the client's idempotency key).
 * - `getApplicationStatusView` returns only what the student's private status page may show —
 *   never email, answers or organizer notes.
 */
import "server-only";
import type { Database, Queryable } from "@/lib/db/client";
import {
  APPLICATION_STATUSES,
  APPOINTMENT_STATUSES,
  type ApplicationStatus,
  type AppointmentStatus,
} from "./constants";
import type { AvailabilityOptionKind } from "./catalog";

export interface NewApplicationRecord {
  idempotencyKey: string;
  fullName: string;
  email: string;
  year: string;
  major: string;
  participation: string;
  teamName: string | null;
  teammates: string | null;
  stage: string;
  workingOn: string;
  question: string;
  linkUrl: string | null;
  availabilityNotes: string | null;
  referrerMentorId: string | null;
  /** HMAC of the submitter IP — never the raw IP. */
  submittedIpHash: string | null;
  userAgent: string | null;
  /** Preferred mentors in rank order; index 0 is the first choice. */
  mentorIds: string[];
  availability: { mentorId: string; kind: AvailabilityOptionKind; optionId: string }[];
}

export interface InsertResult {
  id: string;
  /** True when an application with this idempotency key already existed. */
  replay: boolean;
}

export async function findApplicationIdByIdempotencyKey(db: Queryable, idempotencyKey: string): Promise<string | null> {
  const rows = await db.query<{ id: string }>(`select id from applications where idempotency_key = $1`, [
    idempotencyKey,
  ]);
  return rows[0]?.id ?? null;
}

/** Saved applications from one student (normalized email) within the last `windowSeconds`. */
export async function countRecentApplications(
  db: Queryable,
  email: string,
  windowSeconds: number,
): Promise<{ count: number; oldest: Date | string | null }> {
  const [row] = await db.query<{ n: number; oldest: Date | string | null }>(
    `select count(*)::int as n, min(created_at) as oldest
       from applications
      where email_normalized = $1 and created_at > now() - ($2::int * interval '1 second')`,
    [email.trim().toLowerCase(), windowSeconds],
  );
  return { count: row?.n ?? 0, oldest: row?.oldest ?? null };
}

export async function insertApplication(db: Database, record: NewApplicationRecord): Promise<InsertResult> {
  if (record.mentorIds.length === 0) throw new Error("An application needs at least one mentor.");
  return db.transaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `insert into applications (
         idempotency_key, full_name, email, email_normalized, year, major, participation, team_name,
         teammates, stage, working_on, question, link_url, availability_notes, first_choice_mentor_id,
         acknowledged_no_guarantee, consent_to_share, referrer_mentor_id, submitted_ip_hash, user_agent
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, true, $16, $17, $18)
       on conflict (idempotency_key) do nothing
       returning id`,
      [
        record.idempotencyKey,
        record.fullName,
        record.email,
        record.email.trim().toLowerCase(),
        record.year,
        record.major,
        record.participation,
        record.teamName,
        record.teammates,
        record.stage,
        record.workingOn,
        record.question,
        record.linkUrl,
        record.availabilityNotes,
        record.mentorIds[0],
        record.referrerMentorId,
        record.submittedIpHash,
        record.userAgent,
      ],
    );

    if (inserted.length === 0) {
      // A concurrent request with the same key committed first (double-click, retry race).
      const existing = await findApplicationIdByIdempotencyKey(tx, record.idempotencyKey);
      if (!existing) throw new Error("Idempotency conflict, but no existing application was found.");
      return { id: existing, replay: true };
    }

    const id = inserted[0].id;
    for (const [index, mentorId] of record.mentorIds.entries()) {
      await tx.query(`insert into application_mentors (application_id, mentor_id, rank) values ($1, $2, $3)`, [
        id,
        mentorId,
        index + 1,
      ]);
    }
    for (const option of record.availability) {
      await tx.query(
        `insert into application_availability (application_id, mentor_id, option_kind, option_id)
         values ($1, $2, $3, $4)`,
        [id, option.mentorId, option.kind, option.optionId],
      );
    }
    await tx.query(
      `insert into application_activity (application_id, actor, action, detail) values ($1, 'applicant', 'submitted', $2::jsonb)`,
      [id, JSON.stringify({ mentors: record.mentorIds.length, availability: record.availability.length })],
    );
    return { id, replay: false };
  });
}

// ---------------------------------------------------------------------------
// Student status page
// ---------------------------------------------------------------------------

export interface StatusAppointment {
  id: string;
  mentorId: string;
  slotId: string;
  status: AppointmentStatus;
  /** UTC ISO timestamps (snapshot of the slot time when the appointment was made). */
  startsAt: string;
  endsAt: string;
}

/** Deliberately minimal: no email, no answers, no organizer notes, no surname. */
export interface ApplicationStatusView {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  firstName: string;
  mentors: { mentorId: string; rank: number }[];
  /** Active (not canceled) appointments, soonest first. */
  appointments: StatusAppointment[];
}

function toIso(value: unknown): string {
  return new Date(value as string | Date).toISOString();
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/u)[0] ?? "";
}

export async function getApplicationStatusView(db: Queryable, id: string): Promise<ApplicationStatusView | null> {
  const [app] = await db.query<{ id: string; status: string; created_at: unknown; full_name: string }>(
    `select id, status, created_at, full_name from applications where id = $1`,
    [id],
  );
  if (!app) return null;

  const mentors = await db.query<{ mentor_id: string; rank: number }>(
    `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
    [id],
  );
  const appointments = await db.query<{
    id: string;
    mentor_id: string;
    slot_id: string;
    status: string;
    starts_at: unknown;
    ends_at: unknown;
  }>(
    `select id, mentor_id, slot_id, status, starts_at, ends_at
       from appointments
      where application_id = $1 and status <> 'canceled'
      order by starts_at`,
    [id],
  );

  const status = (APPLICATION_STATUSES as readonly string[]).includes(app.status)
    ? (app.status as ApplicationStatus)
    : "submitted";

  return {
    id: app.id,
    status,
    createdAt: toIso(app.created_at),
    firstName: firstNameOf(app.full_name),
    mentors: mentors.map((m) => ({ mentorId: m.mentor_id, rank: Number(m.rank) })),
    appointments: appointments
      .filter((a) => (APPOINTMENT_STATUSES as readonly string[]).includes(a.status))
      .map((a) => ({
        id: a.id,
        mentorId: a.mentor_id,
        slotId: a.slot_id,
        status: a.status as AppointmentStatus,
        startsAt: toIso(a.starts_at),
        endsAt: toIso(a.ends_at),
      })),
  };
}
