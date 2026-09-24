import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryDbForTests, type Database } from "@/lib/db/client";
import { OrganizerActionError } from "@/lib/organizer/errors";
import { assignAppointment, updateApplication, updateAppointment, type ActionContext } from "@/lib/organizer/service";
import { applicationStatus, insertApplication, slotMap } from "./organizer-fixtures";

let db: Database;
let ctx: ActionContext;

beforeAll(async () => {
  db = await createMemoryDbForTests();
});

beforeEach(async () => {
  await db.query("truncate applications cascade");
  ctx = { actor: "Test Organizer", slots: slotMap() };
});

async function expectActionError(promise: Promise<unknown>, status: number, code: string, message?: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(OrganizerActionError);
  expect((error as OrganizerActionError).status).toBe(status);
  expect((error as OrganizerActionError).code).toBe(code);
  if (message) expect((error as OrganizerActionError).message).toMatch(message);
}

async function activeCount(slotId: string) {
  const [{ n }] = await db.query<{ n: number }>(
    `select count(*)::int as n from appointments where slot_id = $1 and status <> 'canceled'`,
    [slotId],
  );
  return n;
}

describe("assigning appointments", () => {
  it("proposes an appointment with the slot's Central Time interval and promotes the application", async () => {
    const id = await insertApplication(db);
    const { appointment, applicationStatus: status } = await assignAppointment(
      db,
      { applicationId: id, slotId: "demo-avery-slot-1400" },
      ctx,
    );
    expect(appointment).toMatchObject({
      status: "proposed",
      slotId: "demo-avery-slot-1400",
      mentorId: "demo-avery-sample",
      createdBy: "Test Organizer",
      // 2:00–2:25 PM CDT = 19:00–19:25 UTC
      startsAt: "2026-10-01T19:00:00.000Z",
      endsAt: "2026-10-01T19:25:00.000Z",
    });
    expect(status).toBe("selected");
    const log = await db.query<{ action: string; actor: string }>(
      `select action, actor from application_activity where application_id = $1 order by id`,
      [id],
    );
    expect(log.map((l) => l.action)).toEqual(["appointment_proposed", "status_changed"]);
    expect(log.every((l) => l.actor === "Test Organizer")).toBe(true);
  });

  it("enforces capacity 1 (demo-avery-slot-1400)", async () => {
    const a = await insertApplication(db);
    const b = await insertApplication(db);
    await assignAppointment(db, { applicationId: a, slotId: "demo-avery-slot-1400" }, ctx);
    await expectActionError(
      assignAppointment(db, { applicationId: b, slotId: "demo-avery-slot-1400" }, ctx),
      409,
      "slot_full",
      /This slot is full \(1\/1\)/,
    );
    expect(await activeCount("demo-avery-slot-1400")).toBe(1);
    // Nothing leaked from the rolled-back attempt.
    expect(await applicationStatus(db, b)).toBe("submitted");
  });

  it("enforces capacity 2 (demo-avery-slot-1430) and frees a seat on cancel", async () => {
    const [a, b, c] = [await insertApplication(db), await insertApplication(db), await insertApplication(db)];
    const first = await assignAppointment(db, { applicationId: a, slotId: "demo-avery-slot-1430" }, ctx);
    await assignAppointment(db, { applicationId: b, slotId: "demo-avery-slot-1430" }, ctx);
    await expectActionError(
      assignAppointment(db, { applicationId: c, slotId: "demo-avery-slot-1430" }, ctx),
      409,
      "slot_full",
      /\(2\/2\)/,
    );
    await updateAppointment(db, { id: first.appointment.id, action: "cancel" }, ctx);
    await expect(assignAppointment(db, { applicationId: c, slotId: "demo-avery-slot-1430" }, ctx)).resolves.toBeTruthy();
    expect(await activeCount("demo-avery-slot-1430")).toBe(2);
  });

  it("gives the last seat to exactly one of two concurrent assignments", async () => {
    const a = await insertApplication(db);
    const b = await insertApplication(db);
    const results = await Promise.allSettled([
      assignAppointment(db, { applicationId: a, slotId: "demo-avery-slot-1400" }, ctx),
      assignAppointment(db, { applicationId: b, slotId: "demo-avery-slot-1400" }, ctx),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ status: 409, code: "slot_full" });
    expect(await activeCount("demo-avery-slot-1400")).toBe(1);
  });

  it("fills a capacity-2 slot exactly under a burst of concurrent assignments", async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => insertApplication(db)));
    const results = await Promise.allSettled(
      ids.map((id) => assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1430" }, ctx)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await activeCount("demo-avery-slot-1430")).toBe(2);
  });

  it("blocks overlapping appointments for the same student across applications", async () => {
    const ctxWithOverlap: ActionContext = {
      ...ctx,
      slots: slotMap([
        // Overlaps demo-avery-slot-1400 (14:00–14:25) by 15 minutes.
        { id: "test-overlap-1410", mentorId: "demo-jordan-placeholder", mentorName: "Jordan Placeholder", start: "14:10", end: "14:40", capacity: 3 },
        // Starts exactly when demo-avery-slot-1400 ends: not a conflict.
        { id: "test-adjacent-1425", mentorId: "demo-jordan-placeholder", mentorName: "Jordan Placeholder", start: "14:25", end: "14:50", capacity: 3 },
      ]),
    };
    const first = await insertApplication(db, { email: "same.student@illinois.edu" });
    const second = await insertApplication(db, { email: "Same.Student@illinois.edu " });
    await assignAppointment(db, { applicationId: first, slotId: "demo-avery-slot-1400" }, ctxWithOverlap);
    await expectActionError(
      assignAppointment(db, { applicationId: second, slotId: "test-overlap-1410" }, ctxWithOverlap),
      409,
      "student_conflict",
      /overlapping time \(Thu, Oct 1 · 2:00–2:25 PM CT with Avery Sample\)/,
    );
    // Same application, overlapping slot: also blocked.
    await expectActionError(
      assignAppointment(db, { applicationId: first, slotId: "test-overlap-1410" }, ctxWithOverlap),
      409,
      "student_conflict",
    );
    // A different student can take the overlapping slot; adjacency is fine for the same student.
    const other = await insertApplication(db);
    await expect(
      assignAppointment(db, { applicationId: other, slotId: "test-overlap-1410" }, ctxWithOverlap),
    ).resolves.toBeTruthy();
    await expect(
      assignAppointment(db, { applicationId: second, slotId: "test-adjacent-1425" }, ctxWithOverlap),
    ).resolves.toBeTruthy();
  });

  it("rejects unknown slots and applications, duplicates, and closed applications", async () => {
    const id = await insertApplication(db);
    await expectActionError(assignAppointment(db, { applicationId: id, slotId: "no-such-slot" }, ctx), 404, "slot_not_found");
    await expectActionError(
      assignAppointment(db, { applicationId: "5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968", slotId: "demo-avery-slot-1430" }, ctx),
      404,
      "application_not_found",
    );
    await assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1430" }, ctx);
    await expectActionError(
      assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1430" }, ctx),
      409,
      "already_assigned",
    );
    const canceled = await insertApplication(db, { status: "canceled" });
    await expectActionError(
      assignAppointment(db, { applicationId: canceled, slotId: "demo-avery-slot-1400" }, ctx),
      409,
      "application_closed",
    );
  });

  it("only promotes submitted / under review / waitlisted applications", async () => {
    const waitlisted = await insertApplication(db, { status: "waitlisted" });
    await assignAppointment(db, { applicationId: waitlisted, slotId: "demo-avery-slot-1430" }, ctx);
    expect(await applicationStatus(db, waitlisted)).toBe("selected");

    const confirmed = await insertApplication(db);
    const { appointment } = await assignAppointment(db, { applicationId: confirmed, slotId: "demo-avery-slot-1400" }, ctx);
    await updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx);
    expect(await applicationStatus(db, confirmed)).toBe("confirmed");
    await assignAppointment(db, { applicationId: confirmed, slotId: "demo-jordan-slot-1500" }, ctx);
    expect(await applicationStatus(db, confirmed)).toBe("confirmed");
  });
});

describe("confirming and canceling appointments", () => {
  it("refuses to confirm on a slot whose time isn't confirmed with the mentor (demo-jordan-slot-1500)", async () => {
    const id = await insertApplication(db, { mentors: ["demo-jordan-placeholder"] });
    const { appointment } = await assignAppointment(db, { applicationId: id, slotId: "demo-jordan-slot-1500" }, ctx);
    await expectActionError(
      updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx),
      409,
      "slot_not_confirmed",
      /isn’t confirmed with the mentor/,
    );
    expect(await applicationStatus(db, id)).toBe("selected");
  });

  it("confirms on a confirmed slot and sets the application to confirmed", async () => {
    const id = await insertApplication(db);
    const { appointment } = await assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1400" }, ctx);
    const result = await updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx);
    expect(result.appointment.status).toBe("confirmed");
    expect(result.applicationStatus).toBe("confirmed");
    await expectActionError(updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx), 409, "already_confirmed");
  });

  it("re-checks student conflicts when confirming", async () => {
    // A proposed appointment can predate a conflicting one if content times were edited later.
    const overlapCtx: ActionContext = {
      ...ctx,
      slots: slotMap([{ id: "test-overlap-1410", start: "14:10", end: "14:40", capacity: 3 }]),
    };
    const a = await insertApplication(db, { email: "twice@illinois.edu" });
    const b = await insertApplication(db, { email: "twice@illinois.edu" });
    const first = await assignAppointment(db, { applicationId: a, slotId: "demo-avery-slot-1430" }, overlapCtx);
    // Insert an overlapping proposed appointment directly (simulating legacy data).
    await db.query(
      `insert into appointments (application_id, mentor_id, slot_id, starts_at, ends_at, status, created_by)
       values ($1, 'demo-avery-sample', 'test-overlap-1410', '2026-10-01T19:10:00Z', '2026-10-01T19:40:00Z', 'proposed', 'legacy')`,
      [b],
    );
    await expectActionError(
      updateAppointment(db, { id: first.appointment.id, action: "confirm" }, overlapCtx),
      409,
      "student_conflict",
    );
  });

  it("canceling the last confirmed appointment moves a confirmed application back", async () => {
    const id = await insertApplication(db, { mentors: ["demo-avery-sample", "demo-jordan-placeholder"] });
    const confirmed = await assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1400" }, ctx);
    await updateAppointment(db, { id: confirmed.appointment.id, action: "confirm" }, ctx);
    const proposed = await assignAppointment(db, { applicationId: id, slotId: "demo-jordan-slot-1500" }, ctx);
    expect(await applicationStatus(db, id)).toBe("confirmed");

    const r1 = await updateAppointment(db, { id: confirmed.appointment.id, action: "cancel" }, ctx);
    expect(r1.applicationStatus).toBe("selected"); // a proposed appointment remains
    await expectActionError(updateAppointment(db, { id: confirmed.appointment.id, action: "cancel" }, ctx), 409, "already_canceled");

    // Confirm → cancel with nothing else left falls back to under review.
    const id2 = await insertApplication(db);
    const only = await assignAppointment(db, { applicationId: id2, slotId: "demo-avery-slot-1400" }, ctx);
    await updateAppointment(db, { id: only.appointment.id, action: "confirm" }, ctx);
    const r2 = await updateAppointment(db, { id: only.appointment.id, action: "cancel" }, ctx);
    expect(r2.applicationStatus).toBe("under_review");
    expect(proposed.appointment.status).toBe("proposed");
  });

  it("404s for unknown appointments", async () => {
    await expectActionError(
      updateAppointment(db, { id: "5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968", action: "confirm" }, ctx),
      404,
      "appointment_not_found",
    );
  });
});

describe("application status and notes", () => {
  it("requires a confirmed appointment for confirmed/attended", async () => {
    const id = await insertApplication(db);
    await expectActionError(updateApplication(db, { id, status: "confirmed" }, ctx), 409, "needs_confirmed_appointment");
    await expectActionError(updateApplication(db, { id, status: "attended" }, ctx), 409, "needs_confirmed_appointment");
    const { appointment } = await assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1400" }, ctx);
    // A proposed appointment isn't enough.
    await expectActionError(updateApplication(db, { id, status: "attended" }, ctx), 409, "needs_confirmed_appointment");
    await updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx);
    await expect(updateApplication(db, { id, status: "attended" }, ctx)).resolves.toMatchObject({ status: "attended" });
  });

  it("canceling an application cancels its active appointments in the same transaction", async () => {
    const id = await insertApplication(db);
    await assignAppointment(db, { applicationId: id, slotId: "demo-avery-slot-1400" }, ctx);
    await assignAppointment(db, { applicationId: id, slotId: "demo-jordan-slot-1500" }, ctx);
    const result = await updateApplication(db, { id, status: "canceled" }, ctx);
    expect(result).toMatchObject({ status: "canceled", canceledAppointments: 2 });
    expect(await activeCount("demo-avery-slot-1400")).toBe(0);
    // The freed seat can be used by someone else.
    const other = await insertApplication(db);
    await expect(assignAppointment(db, { applicationId: other, slotId: "demo-avery-slot-1400" }, ctx)).resolves.toBeTruthy();
  });

  it("updates notes and logs status changes with the organizer's name", async () => {
    const id = await insertApplication(db);
    const r = await updateApplication(db, { id, status: "under_review", organizerNotes: "Strong fit.\nFollow up.  \n" }, ctx);
    expect(r).toMatchObject({ status: "under_review", organizerNotes: "Strong fit.\nFollow up." });
    const log = await db.query<{ action: string; actor: string; detail: Record<string, unknown> }>(
      `select action, actor, detail from application_activity where application_id = $1 order by id`,
      [id],
    );
    expect(log).toEqual([
      { action: "status_changed", actor: "Test Organizer", detail: { from: "submitted", to: "under_review" } },
      { action: "notes_updated", actor: "Test Organizer", detail: { characters: 22 } },
    ]);
    // No-op updates don't log.
    await updateApplication(db, { id, status: "under_review", organizerNotes: "Strong fit.\nFollow up." }, ctx);
    const [{ n }] = await db.query<{ n: number }>(
      `select count(*)::int as n from application_activity where application_id = $1`,
      [id],
    );
    expect(n).toBe(2);
    await expectActionError(
      updateApplication(db, { id: "5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968", status: "selected" }, ctx),
      404,
      "application_not_found",
    );
  });
});
