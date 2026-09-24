import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryDbForTests, type Database } from "@/lib/db/client";
import {
  activeFilterCount,
  applicationFiltersQuery,
  DEFAULT_APPLICATION_FILTERS,
  exportHref,
  parseApplicationFilters,
} from "@/lib/organizer/filters";
import {
  getApplicationDetail,
  getMentorInterest,
  getSlotUsage,
  getStatusCounts,
  listApplications,
} from "@/lib/organizer/queries";
import { assignAppointment } from "@/lib/organizer/service";
import { insertApplication, slotMap } from "./organizer-fixtures";

describe("dashboard filter URLs", () => {
  it("parses and serializes canonically, dropping invalid values", () => {
    const f = parseApplicationFilters(
      new URLSearchParams("mentor=ron-lewis&choice=first&availability=slot:demo-avery-slot-1400&status=selected&q=+aero+&sort=oldest"),
    );
    expect(f).toEqual({
      mentor: "ron-lewis",
      firstChoiceOnly: true,
      availability: "slot:demo-avery-slot-1400",
      status: "selected",
      q: "aero",
      sort: "oldest",
    });
    expect(applicationFiltersQuery(f)).toBe(
      "mentor=ron-lewis&choice=first&availability=slot%3Ademo-avery-slot-1400&status=selected&q=aero&sort=oldest",
    );
    expect(parseApplicationFilters({ mentor: "../etc", status: "accepted", availability: "nope", choice: "first" })).toEqual(
      DEFAULT_APPLICATION_FILTERS,
    );
    expect(parseApplicationFilters({ availability: "none" }).availability).toBe("none");
    expect(applicationFiltersQuery(DEFAULT_APPLICATION_FILTERS)).toBe("");
    expect(exportHref({ status: "confirmed" })).toBe("/api/organizer/export?status=confirmed");
    expect(activeFilterCount({ ...DEFAULT_APPLICATION_FILTERS, sort: "oldest" })).toBe(0);
  });
});

describe("application queries", () => {
  let db: Database;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = await createMemoryDbForTests();
    ids.maya = await insertApplication(db, {
      fullName: "Maya Okafor",
      email: "maya@illinois.edu",
      major: "Aerospace Engineering",
      teamName: "Orbit Relay",
      mentors: ["patrick-haddox", "ron-lewis"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
      createdAt: "2026-09-20T15:00:00Z",
    });
    ids.dan = await insertApplication(db, {
      fullName: "Daniel Reyes",
      email: "dan@illinois.edu",
      major: "Finance",
      mentors: ["ron-lewis", "vikram-lakhwara"],
      createdAt: "2026-09-21T15:00:00Z",
    });
    ids.dan2 = await insertApplication(db, {
      fullName: "Daniel Reyes",
      email: "DAN@illinois.edu",
      major: "Finance",
      mentors: ["vikram-lakhwara"],
      status: "waitlisted",
      createdAt: "2026-09-22T15:00:00Z",
    });
    ids.sofia = await insertApplication(db, {
      fullName: "Sofia 100% Martinez",
      email: "sofia@illinois.edu",
      mentors: ["demo-avery-sample"],
      availability: ["slot:demo-avery-slot-1400"],
      createdAt: "2026-09-23T15:00:00Z",
    });
    await assignAppointment(db, { applicationId: ids.sofia, slotId: "demo-avery-slot-1400" }, { actor: "T", slots: slotMap() });
  });

  const names = (rows: { fullName: string }[]) => rows.map((r) => r.fullName);
  const list = (q: string) => listApplications(db, parseApplicationFilters(new URLSearchParams(q)));

  it("lists newest first by default, oldest first on request", async () => {
    expect(names(await list(""))).toEqual(["Sofia 100% Martinez", "Daniel Reyes", "Daniel Reyes", "Maya Okafor"]);
    expect(names(await list("sort=oldest"))[0]).toBe("Maya Okafor");
  });

  it("filters by mentor preference, optionally first choice only", async () => {
    expect(names(await list("mentor=ron-lewis"))).toEqual(["Daniel Reyes", "Maya Okafor"]);
    expect(names(await list("mentor=ron-lewis&choice=first"))).toEqual(["Daniel Reyes"]);
    expect(await list("mentor=vikram-lakhwara&choice=first")).toHaveLength(1);
  });

  it("filters by availability option or interest only", async () => {
    expect(names(await list("availability=window:patrick-haddox-2026-10-01-am"))).toEqual(["Maya Okafor"]);
    expect(names(await list("availability=slot:demo-avery-slot-1400"))).toEqual(["Sofia 100% Martinez"]);
    expect(names(await list("availability=none"))).toEqual(["Daniel Reyes", "Daniel Reyes"]);
  });

  it("filters by status and free text (name, email, major, team), treating % literally", async () => {
    expect(names(await list("status=waitlisted"))).toEqual(["Daniel Reyes"]);
    expect(names(await list("status=selected"))).toEqual(["Sofia 100% Martinez"]);
    expect(names(await list("q=orbit"))).toEqual(["Maya Okafor"]);
    expect(names(await list("q=FINANCE"))).toHaveLength(2);
    expect(names(await list("q=maya%40illinois"))).toEqual(["Maya Okafor"]);
    expect(names(await list("q=100%25"))).toEqual(["Sofia 100% Martinez"]);
    expect(await list("q=%25")).toHaveLength(1);
  });

  it("returns preferences, availability, appointments and duplicate counts", async () => {
    const [sofia] = await list("availability=slot:demo-avery-slot-1400");
    expect(sofia.mentors).toEqual([{ mentorId: "demo-avery-sample", rank: 1 }]);
    expect(sofia.availability).toEqual([{ mentorId: "demo-avery-sample", kind: "slot", optionId: "demo-avery-slot-1400" }]);
    expect(sofia.appointments).toHaveLength(1);
    expect(sofia.appointments[0]).toMatchObject({ status: "proposed", startsAt: "2026-10-01T19:00:00.000Z" });
    const dans = await list("q=dan%40");
    expect(dans.map((d) => d.duplicateCount)).toEqual([2, 2]);
  });

  it("summarizes status counts, slot usage and mentor interest", async () => {
    expect(await getStatusCounts(db)).toMatchObject({ total: 4, submitted: 2, waitlisted: 1, selected: 1, confirmed: 0 });
    expect((await getSlotUsage(db)).get("demo-avery-slot-1400")).toEqual({ proposed: 1, confirmed: 0 });
    const interest = await getMentorInterest(db);
    expect(interest.get("ron-lewis")).toEqual({ any: 2, first: 1 });
    expect(interest.get("vikram-lakhwara")).toEqual({ any: 2, first: 1 });
  });

  it("loads a detail record with activity and related applications", async () => {
    const detail = await getApplicationDetail(db, ids.dan);
    expect(detail?.application.fullName).toBe("Daniel Reyes");
    expect(detail?.related.map((r) => r.id)).toEqual([ids.dan2]);
    const sofia = await getApplicationDetail(db, ids.sofia);
    expect(sofia?.activity[0]).toMatchObject({ action: "status_changed", actor: "T" });
    expect(sofia?.studentAppointments).toHaveLength(1);
    expect(await getApplicationDetail(db, "not-a-uuid")).toBeNull();
    expect(await getApplicationDetail(db, "5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968")).toBeNull();
  });
});
