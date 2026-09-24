import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The detail page reads the organizer session from cookies and its client forms use the router:
// provide both, so the real page renders against the test database.
const pageSession = vi.hoisted(() => ({ cookie: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "fw_organizer" && pageSession.cookie ? { name, value: pageSession.cookie } : undefined),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {} }),
  usePathname: () => "/organizers/applications",
}));

import ApplicationDetailPage from "@/app/organizers/applications/[id]/page";
import { ApplicationResults } from "@/components/organizer/application-results";
import { getMentorsForOrganizers } from "@/content";
import { __setDbForTests, createMemoryDbForTests, type Database } from "@/lib/db/client";
import { buildOrganizerDirectory, mentorBookability, resolveAvailability } from "@/lib/organizer/directory";
import {
  activeFilterCount,
  applicationFiltersQuery,
  DEFAULT_APPLICATION_FILTERS,
  exportHref,
  parseApplicationFilters,
  restrictToDirectory,
} from "@/lib/organizer/filters";
import {
  getApplicationDetail,
  getMentorInterest,
  getSlotUsage,
  getStatusCounts,
  listApplications,
} from "@/lib/organizer/queries";
import { assignAppointment } from "@/lib/organizer/service";
import { createSessionToken } from "@/lib/organizer/session";
import { insertApplication, slotMap } from "./organizer-fixtures";

/** Text content with the few entities React emits decoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

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

  it("round-trips a Rishab filter (mentor, first choice, his Oct 1 window) for the page and the CSV export", () => {
    const f = parseApplicationFilters(
      new URLSearchParams("mentor=rishab-veldur&choice=first&availability=window:rishab-veldur-2026-10-01"),
    );
    expect(f).toEqual({
      ...DEFAULT_APPLICATION_FILTERS,
      mentor: "rishab-veldur",
      firstChoiceOnly: true,
      availability: "window:rishab-veldur-2026-10-01",
    });
    const query = "mentor=rishab-veldur&choice=first&availability=window%3Arishab-veldur-2026-10-01";
    expect(applicationFiltersQuery(f)).toBe(query);
    expect(exportHref(f)).toBe(`/api/organizer/export?${query}`);
    expect(parseApplicationFilters(new URLSearchParams(query))).toEqual(f);
    expect(activeFilterCount(f)).toBe(2);
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

describe("applications listing Rishab (Thu, Oct 1, exact time to be confirmed)", () => {
  const PASSWORD = "organizer-queries-password";
  const RISHAB_WINDOW = "rishab-veldur-2026-10-01";
  const NOTES = "Thursday Oct 1: free before 11 AM and after 3 PM.";
  const WINDOW_LABEL = "Thu, Oct 1 · Exact time to be confirmed";
  let db: Database;
  const ids: Record<string, string> = {};
  const names = (rows: { fullName: string }[]) => rows.map((r) => r.fullName);
  const list = (q: string) => listApplications(db, parseApplicationFilters(new URLSearchParams(q)));

  beforeAll(async () => {
    db = await createMemoryDbForTests();
    // First choice Rishab, his Oct 1 window, and the broad-availability note his date-only window needs.
    ids.nadia = await insertApplication(db, {
      fullName: "Nadia Brooks",
      email: "nbrooks4@illinois.edu",
      major: "Bioengineering",
      teamName: "PulseFit",
      mentors: ["rishab-veldur", "patrick-haddox"],
      availability: [`window:${RISHAB_WINDOW}`],
      createdAt: "2026-09-24T15:00:00Z",
    });
    await db.query(`update applications set availability_notes = $2 where id = $1`, [ids.nadia, NOTES]);
    // Rishab as a second choice, with both mentors' Oct 1 windows.
    ids.omar = await insertApplication(db, {
      fullName: "Omar Haddad",
      email: "ohaddad@illinois.edu",
      major: "Electrical Engineering",
      mentors: ["patrick-haddox", "rishab-veldur"],
      availability: ["window:patrick-haddox-2026-10-01-am", `window:${RISHAB_WINDOW}`],
      createdAt: "2026-09-24T16:00:00Z",
    });
    ids.lena = await insertApplication(db, {
      fullName: "Lena Ortiz",
      email: "lortiz@illinois.edu",
      mentors: ["ron-lewis"],
      createdAt: "2026-09-24T17:00:00Z",
    });
    ids.canceled = await insertApplication(db, {
      fullName: "Casey Withdrawn",
      email: "cwithdrawn@illinois.edu",
      mentors: ["rishab-veldur"],
      availability: [`window:${RISHAB_WINDOW}`],
      status: "canceled",
      createdAt: "2026-09-24T18:00:00Z",
    });
  });

  it("filters by mentor=rishab-veldur (any preference or first choice) and by his Oct 1 window", async () => {
    expect(names(await list("mentor=rishab-veldur"))).toEqual(["Casey Withdrawn", "Omar Haddad", "Nadia Brooks"]);
    expect(names(await list("mentor=rishab-veldur&choice=first"))).toEqual(["Casey Withdrawn", "Nadia Brooks"]);
    expect(names(await list("mentor=rishab-veldur&status=submitted&sort=oldest"))).toEqual(["Nadia Brooks", "Omar Haddad"]);
    expect(names(await list(`availability=window:${RISHAB_WINDOW}`))).toEqual(["Casey Withdrawn", "Omar Haddad", "Nadia Brooks"]);
    expect(names(await list(`mentor=patrick-haddox&choice=first&availability=window:${RISHAB_WINDOW}`))).toEqual(["Omar Haddad"]);
    expect(names(await list("availability=none"))).toEqual(["Lena Ortiz"]);
    // He has no Oct 2 office hours: nothing was (or can be) chosen for that day.
    expect(await list("availability=window:rishab-veldur-2026-10-02")).toEqual([]);
    expect(await db.query(`select 1 from application_availability where option_id <> $1 and mentor_id = 'rishab-veldur'`, [RISHAB_WINDOW])).toEqual([]);
    // Canceled applications don't count toward demand.
    const interest = await getMentorInterest(db);
    expect(interest.get("rishab-veldur")).toEqual({ any: 2, first: 1 });
    expect(interest.get("patrick-haddox")).toEqual({ any: 2, first: 1 });
    expect(interest.get("ron-lewis")).toEqual({ any: 1, first: 1 });
    expect(await getStatusCounts(db)).toMatchObject({ total: 4, submitted: 3, canceled: 1 });
  });

  it("returns his ranked preference, window selection and availability notes", async () => {
    const [nadia] = await list("q=nbrooks4");
    expect(nadia).toMatchObject({
      id: ids.nadia,
      fullName: "Nadia Brooks",
      participation: "team",
      teamName: "PulseFit",
      firstChoiceMentorId: "rishab-veldur",
      availabilityNotes: NOTES,
      mentors: [
        { mentorId: "rishab-veldur", rank: 1 },
        { mentorId: "patrick-haddox", rank: 2 },
      ],
      availability: [{ mentorId: "rishab-veldur", kind: "window", optionId: RISHAB_WINDOW }],
      appointments: [],
      duplicateCount: 1,
    });
    const [omar] = await list("q=ohaddad");
    expect(omar.availability).toEqual([
      { mentorId: "patrick-haddox", kind: "window", optionId: "patrick-haddox-2026-10-01-am" },
      { mentorId: "rishab-veldur", kind: "window", optionId: RISHAB_WINDOW },
    ]);
  });

  it("loads the detail record and resolves his window to the Oct 1 label (no slots yet)", async () => {
    const detail = await getApplicationDetail(db, ids.nadia);
    expect(detail?.application).toMatchObject({
      fullName: "Nadia Brooks",
      firstChoiceMentorId: "rishab-veldur",
      availabilityNotes: NOTES,
      availability: [{ mentorId: "rishab-veldur", kind: "window", optionId: RISHAB_WINDOW }],
    });
    expect(detail?.related).toEqual([]);
    expect(detail?.studentAppointments).toEqual([]);

    const directory = buildOrganizerDirectory(getMentorsForOrganizers());
    expect(detail!.application.availability.map((a) => resolveAvailability(directory, a))).toEqual([
      {
        key: `window:${RISHAB_WINDOW}`,
        kind: "window",
        optionId: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        mentorName: "Rishab Veldur",
        label: WINDOW_LABEL,
        certainty: "window-approx",
      },
    ]);
    // A window isn't a bookable slot: neither preferred mentor can be confirmed yet.
    const prefs = mentorBookability(directory, detail!.application.mentors.map((m) => m.mentorId));
    expect(prefs.map((p) => [p.firstName, p.slots.length, p.windows.map((w) => w.label)])).toEqual([
      ["Rishab", 0, [WINDOW_LABEL]],
      ["Patrick", 0, ["Thu, Oct 1 · 10:00–11:30 AM CT"]],
    ]);
    expect(restrictToDirectory(parseApplicationFilters({ mentor: "rishab-veldur" }), directory).mentor).toBe("rishab-veldur");
  });

  it("shows his window in the dashboard results", async () => {
    const directory = buildOrganizerDirectory(getMentorsForOrganizers());
    const rows = await list("mentor=rishab-veldur&status=submitted");
    const html = renderToStaticMarkup(createElement(ApplicationResults, { applications: rows, directory }));
    const t = text(html);
    // Desktop table + phone cards, each listing both applications.
    expect(html.match(new RegExp(`href="/organizers/applications/${ids.nadia}"`, "g"))).toHaveLength(2);
    expect(html.match(new RegExp(`href="/organizers/applications/${ids.omar}"`, "g"))).toHaveLength(2);
    expect(t).toContain("1. Rishab Veldur 1st choice 2. Patrick Haddox");
    expect(t).toContain("1. Patrick Haddox 1st choice 2. Rishab Veldur");
    expect(t).toContain(`Rishab Veldur ${WINDOW_LABEL} Exact times TBA`);
    expect(t).toContain(`Patrick Haddox Thu, Oct 1 · 10:00–11:30 AM CT Availability window Rishab Veldur ${WINDOW_LABEL} Exact times TBA`);
    expect(t.match(new RegExp(WINDOW_LABEL, "g"))).toHaveLength(4);
    expect(t).not.toContain("Interest only");
    expect(t).not.toContain("no longer listed");
    expect(t).not.toMatch(/Oct 2/);
  });

  describe("detail page", () => {
    beforeEach(() => {
      vi.stubEnv("ORGANIZER_PASSWORD", PASSWORD);
      vi.stubEnv("APP_SECRET", "organizer-queries-app-secret-0123456789");
      vi.stubEnv("SHOW_DEMO_CONTENT", "");
      vi.stubEnv("SHOW_DRAFT_CONTENT", "");
      pageSession.cookie = createSessionToken({ name: "Detail Tester", password: PASSWORD });
      __setDbForTests(db);
    });

    afterAll(() => {
      __setDbForTests(undefined);
      pageSession.cookie = null;
      vi.unstubAllEnvs();
    });

    async function renderDetail(id: string) {
      const page = await ApplicationDetailPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
      const html = renderToStaticMarkup(page);
      return { html, t: text(html) };
    }

    it("lists Rishab first with his Oct 1 window, the student's availability notes, and why nothing can be booked yet", async () => {
      const { html, t } = await renderDetail(ids.nadia);
      expect(t).toContain("Nadia Brooks");
      expect(t).toContain(
        `Mentors & availability 1. Rishab Veldur Co-Founder & CEO, Auvi Labs First choice ${WINDOW_LABEL} Exact times TBA ` +
          "2. Patrick Haddox CEO & Co-Founder, Samara Aerospace Interest only No time selected " +
          `Availability notes ${NOTES}`,
      );
      // Neither preferred mentor has appointment slots: the page says so and names his window.
      expect(t).toContain(
        `No appointment slots yet for Rishab and Patrick Rishab Veldur ${WINDOW_LABEL} Exact times TBA ` +
          "Patrick Haddox Thu, Oct 1 · 10:00–11:30 AM CT Availability window " +
          "You can still review this application: mark it Under review, Selected or Waitlisted. " +
          "Confirmed and Attended need a confirmed appointment. That’s possible once slots for Rishab and Patrick are added to content/mentors.ts and confirmed with each mentor.",
      );
      expect(t).toContain("No active appointments.");
      expect(t).toContain("No mentor has appointment slots yet, so there’s nothing to propose.");
      expect(t).toContain("Confirmed (needs a confirmed appointment)");
      // His headshot, never an Oct 2 office-hours time, and no one-on-one promise.
      expect(html).toContain('alt="Rishab Veldur"');
      expect(t).not.toMatch(/Oct 2/);
      expect(t).not.toMatch(/one-on-one/i);
    });

    it("shows Rishab as a second choice with his window alongside Patrick's", async () => {
      const { t } = await renderDetail(ids.omar);
      expect(t).toContain(
        "Mentors & availability 1. Patrick Haddox CEO & Co-Founder, Samara Aerospace First choice Thu, Oct 1 · 10:00–11:30 AM CT Availability window " +
          `2. Rishab Veldur Co-Founder & CEO, Auvi Labs ${WINDOW_LABEL} Exact times TBA Availability notes None.`,
      );
      expect(t).toContain("No appointment slots yet for Patrick and Rishab");
    });
  });
});
