import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMemoryDbForTests, type Database } from "@/lib/db/client";
import { APPLICATION_CSV_COLUMNS, applicationsToCsv } from "@/lib/organizer/csv";
import { OrganizerActionError } from "@/lib/organizer/errors";
import { parseApplicationFilters } from "@/lib/organizer/filters";
import { getApplicationDetail, getSlotHolders, getSlotUsage, listApplications } from "@/lib/organizer/queries";
import { assignAppointment, updateApplication, updateAppointment, type ActionContext } from "@/lib/organizer/service";
import { applicationStatus, directory, insertApplication, slotMap } from "./organizer-fixtures";

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

describe("sessions generated from windows (site.officeHours)", () => {
  const RISHAB_1200 = "rishab-veldur-2026-10-01-1200";

  it("assigns an application that chose Rishab's window to his 12:00–12:25 PM CT session", async () => {
    const id = await insertApplication(db, {
      fullName: "Nadia Brooks",
      teamName: "PulseFit",
      mentors: ["rishab-veldur"],
      availability: ["window:rishab-veldur-2026-10-01"],
    });
    const { appointment, applicationStatus: status } = await assignAppointment(db, { applicationId: id, slotId: RISHAB_1200 }, ctx);
    expect(appointment).toMatchObject({
      status: "proposed",
      slotId: RISHAB_1200,
      mentorId: "rishab-veldur",
      // 12:00–12:25 PM CDT (UTC-5) on Thu, Oct 1.
      startsAt: "2026-10-01T17:00:00.000Z",
      endsAt: "2026-10-01T17:25:00.000Z",
    });
    expect(status).toBe("selected");
    const [row] = await db.query<{ starts_at: Date; ends_at: Date; slot_id: string }>(
      `select starts_at, ends_at, slot_id from appointments where id = $1`,
      [appointment.id],
    );
    expect(row.slot_id).toBe(RISHAB_1200);
    expect(new Date(row.starts_at).toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(new Date(row.ends_at).toISOString()).toBe("2026-10-01T17:25:00.000Z");
    // Who holds the seat, for the Sessions board.
    expect((await getSlotHolders(db)).get(RISHAB_1200)).toEqual([
      { appointmentId: appointment.id, applicationId: id, fullName: "Nadia Brooks", teamName: "PulseFit", status: "proposed" },
    ]);
    // Patrick's sessions: 10:00, 10:30 and 11:00 AM CDT.
    const patrick = await insertApplication(db, { mentors: ["patrick-haddox"] });
    const last = await assignAppointment(db, { applicationId: patrick, slotId: "patrick-haddox-2026-10-01-am-1100" }, ctx);
    expect(last.appointment).toMatchObject({ startsAt: "2026-10-01T16:00:00.000Z", endsAt: "2026-10-01T16:25:00.000Z" });
  });

  it("seats one application per session (an individual or a team): the second gets slot_full", async () => {
    const team = await insertApplication(db, { teamName: "Orbit Relay", mentors: ["rishab-veldur"] });
    const individual = await insertApplication(db, { mentors: ["rishab-veldur"] });
    await assignAppointment(db, { applicationId: team, slotId: RISHAB_1200 }, ctx);
    await expectActionError(
      assignAppointment(db, { applicationId: individual, slotId: RISHAB_1200 }, ctx),
      409,
      "slot_full",
      /This slot is full \(1\/1\)/,
    );
    expect(await activeCount(RISHAB_1200)).toBe(1);
    expect(await applicationStatus(db, individual)).toBe("submitted");
    // The next session is free.
    await expect(
      assignAppointment(db, { applicationId: individual, slotId: "rishab-veldur-2026-10-01-1230" }, ctx),
    ).resolves.toBeTruthy();
  });

  it("gives a session to exactly one of two concurrent assignments (advisory lock on the generated id)", async () => {
    const [a, b] = [await insertApplication(db), await insertApplication(db)];
    const results = await Promise.allSettled([
      assignAppointment(db, { applicationId: a, slotId: "patrick-haddox-2026-10-01-am-1000" }, ctx),
      assignAppointment(db, { applicationId: b, slotId: "patrick-haddox-2026-10-01-am-1000" }, ctx),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason).toMatchObject({ code: "slot_full" });
    expect(await activeCount("patrick-haddox-2026-10-01-am-1000")).toBe(1);
  });

  it("blocks the same student from two overlapping sessions, across applications and mentors", async () => {
    // Rishab's 2:00–2:25 PM session and the demo Avery slot at 2:00–2:25 PM are the same time.
    expect(directory.slotsById.get("rishab-veldur-2026-10-01-1400")).toMatchObject({ start: "14:00", end: "14:25", generated: true });
    const first = await insertApplication(db, { email: "overlap.student@illinois.edu", mentors: ["rishab-veldur"] });
    const second = await insertApplication(db, { email: "Overlap.Student@illinois.edu", mentors: ["demo-avery-sample"] });
    await assignAppointment(db, { applicationId: first, slotId: "rishab-veldur-2026-10-01-1400" }, ctx);
    await expectActionError(
      assignAppointment(db, { applicationId: second, slotId: "demo-avery-slot-1400" }, ctx),
      409,
      "student_conflict",
      /overlapping time \(Thu, Oct 1 · 2:00–2:25 PM CT with Rishab Veldur\)/,
    );
    // Back-to-back sessions (2:00 and 2:30, with the break between) are fine for the same student.
    await expect(
      assignAppointment(db, { applicationId: second, slotId: "demo-avery-slot-1430" }, ctx),
    ).resolves.toBeTruthy();
    // Another student can take the overlapping time.
    const other = await insertApplication(db);
    await expect(assignAppointment(db, { applicationId: other, slotId: "demo-avery-slot-1400" }, ctx)).resolves.toBeTruthy();
  });

  it("confirms a session appointment, and the CSV export shows the session time", async () => {
    const id = await insertApplication(db, {
      fullName: "Omar Haddad",
      email: "ohaddad@illinois.edu",
      mentors: ["rishab-veldur", "patrick-haddox"],
      availability: ["window:rishab-veldur-2026-10-01", "window:patrick-haddox-2026-10-01-am"],
    });
    const { appointment } = await assignAppointment(db, { applicationId: id, slotId: RISHAB_1200 }, ctx);
    const confirmed = await updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx);
    expect(confirmed.appointment).toMatchObject({
      status: "confirmed",
      startsAt: "2026-10-01T17:00:00.000Z",
      endsAt: "2026-10-01T17:25:00.000Z",
    });
    expect(confirmed.applicationStatus).toBe("confirmed");
    expect(await getSlotUsage(db)).toEqual(new Map([[RISHAB_1200, { proposed: 0, confirmed: 1 }]]));
    const detail = await getApplicationDetail(db, id);
    expect(detail?.activity.map((a) => a.action)).toEqual([
      "status_changed",
      "appointment_confirmed",
      "status_changed",
      "appointment_proposed",
    ]);
    expect(detail?.activity[1].detail).toMatchObject({ slotId: RISHAB_1200, mentorId: "rishab-veldur" });

    const apps = await listApplications(db, parseApplicationFilters({ q: "ohaddad" }));
    const csv = applicationsToCsv(apps, directory);
    const [header, row] = csv.split("\r\n");
    expect(header.split(",")).toEqual([...APPLICATION_CSV_COLUMNS]);
    expect(row).toContain("Rishab Veldur: Thu, Oct 1 · 12:00–12:25 PM CT (confirmed)");
    // The student still shows as having chosen the windows.
    expect(row).toContain("Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)");
    expect(row).toContain("Confirmed");
  });

  it("releases a session when its appointment is canceled", async () => {
    const [a, b] = [await insertApplication(db), await insertApplication(db)];
    const held = await assignAppointment(db, { applicationId: a, slotId: RISHAB_1200 }, ctx);
    await updateAppointment(db, { id: held.appointment.id, action: "cancel" }, ctx);
    await expect(assignAppointment(db, { applicationId: b, slotId: RISHAB_1200 }, ctx)).resolves.toBeTruthy();
    expect(await activeCount(RISHAB_1200)).toBe(1);
  });

  it("rejects a session time that isn't on the grid (Rishab has no 5:00 PM session)", async () => {
    const id = await insertApplication(db);
    await expectActionError(
      assignAppointment(db, { applicationId: id, slotId: "rishab-veldur-2026-10-01-1700" }, ctx),
      404,
      "slot_not_found",
    );
    await expectActionError(
      assignAppointment(db, { applicationId: id, slotId: "rishab-veldur-2026-10-01-1215" }, ctx),
      404,
      "slot_not_found",
    );
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
