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

// Patrick is open to all three sessions in his window, so no production mentor sets a session count
// and the detail page's session-limit warning never shows for real content. To keep that warning
// covered end to end, a test can swap in a fixture copy of Patrick who agreed to fewer sessions
// (content `session.sessionCount`); it's null (production content, unchanged) otherwise.
const patrickFixture = vi.hoisted(() => ({ sessionCount: null as string | null }));
vi.mock("@/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content")>();
  return {
    ...actual,
    getMentorsForOrganizers: () =>
      actual
        .getMentorsForOrganizers()
        .map((m) =>
          m.id === "patrick-haddox" && patrickFixture.sessionCount
            ? { ...m, session: { ...m.session, sessionCount: patrickFixture.sessionCount } }
            : m,
        ),
  };
});

import ApplicationDetailPage from "@/app/organizers/applications/[id]/page";
import { ApplicationResults } from "@/components/organizer/application-results";
import { getMentorsForOrganizers, getSite } from "@/content";
import type { Mentor } from "@/content/types";
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
import { assignAppointment, updateAppointment } from "@/lib/organizer/service";
import { createSessionToken } from "@/lib/organizer/session";
import { sessionRuleText } from "@/lib/schedule/sessions";
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
      mentors: ["patrick-haddox", "elliott-notrica"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
      createdAt: "2026-09-20T15:00:00Z",
    });
    // Interest only (no time ticked): Vik is still scheduling, and Dan gave no time for Elliott either.
    ids.dan = await insertApplication(db, {
      fullName: "Daniel Reyes",
      email: "dan@illinois.edu",
      major: "Finance",
      mentors: ["elliott-notrica", "vikram-lakhwara"],
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
    expect(names(await list("mentor=elliott-notrica"))).toEqual(["Daniel Reyes", "Maya Okafor"]);
    expect(names(await list("mentor=elliott-notrica&choice=first"))).toEqual(["Daniel Reyes"]);
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
    expect(interest.get("elliott-notrica")).toEqual({ any: 2, first: 1 });
    expect(interest.get("vikram-lakhwara")).toEqual({ any: 2, first: 1 });
    expect(interest.has("ron-lewis")).toBe(false);
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

describe("applications listing Rishab (Thu, Oct 1, 12:00–5:00 PM CT)", () => {
  const PASSWORD = "organizer-queries-password";
  const RISHAB_WINDOW = "rishab-veldur-2026-10-01";
  const NOTES = "Thursday Oct 1: free before 11 AM and after 3 PM.";
  const WINDOW_LABEL = "Thu, Oct 1 · 12:00–5:00 PM CT";
  const ELLIOTT_AM_WINDOW = "elliott-notrica-2026-09-30-am";
  const ELLIOTT_AM_LABEL = "Wed, Sep 30 · 9:00 AM–12:00 PM CT";
  /** Elliott's 22 sessions, grouped by window id (6 + 6 + 10). */
  const ELLIOTT_SESSION_WINDOWS = [
    ...Array(6).fill(ELLIOTT_AM_WINDOW),
    ...Array(6).fill("elliott-notrica-2026-09-30-pm"),
    ...Array(10).fill("elliott-notrica-2026-10-01-pm"),
  ];
  let db: Database;
  const ids: Record<string, string> = {};
  const names = (rows: { fullName: string }[]) => rows.map((r) => r.fullName);
  const list = (q: string) => listApplications(db, parseApplicationFilters(new URLSearchParams(q)));

  beforeAll(async () => {
    db = await createMemoryDbForTests();
    // First choice Rishab, his Oct 1 window, and an availability note (optional now that his window is timed).
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
    // Interest only: Vik is still scheduling, so there's no time to choose.
    ids.lena = await insertApplication(db, {
      fullName: "Lena Ortiz",
      email: "lortiz@illinois.edu",
      mentors: ["vikram-lakhwara"],
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
    // First choice Elliott with his Wednesday morning window (one of his three since Sept 25).
    ids.jonah = await insertApplication(db, {
      fullName: "Jonah Park",
      email: "jpark@illinois.edu",
      mentors: ["elliott-notrica"],
      availability: [`window:${ELLIOTT_AM_WINDOW}`],
      createdAt: "2026-09-24T19:00:00Z",
    });
  });

  it("filters by mentor=rishab-veldur (any preference or first choice) and by his Oct 1 window", async () => {
    expect(names(await list("mentor=rishab-veldur"))).toEqual(["Casey Withdrawn", "Omar Haddad", "Nadia Brooks"]);
    expect(names(await list("mentor=rishab-veldur&choice=first"))).toEqual(["Casey Withdrawn", "Nadia Brooks"]);
    expect(names(await list("mentor=rishab-veldur&status=submitted&sort=oldest"))).toEqual(["Nadia Brooks", "Omar Haddad"]);
    expect(names(await list(`availability=window:${RISHAB_WINDOW}`))).toEqual(["Casey Withdrawn", "Omar Haddad", "Nadia Brooks"]);
    expect(names(await list(`mentor=patrick-haddox&choice=first&availability=window:${RISHAB_WINDOW}`))).toEqual(["Omar Haddad"]);
    expect(names(await list("availability=none"))).toEqual(["Lena Ortiz"]);
    expect(names(await list(`availability=window:${ELLIOTT_AM_WINDOW}`))).toEqual(["Jonah Park"]);
    expect(names(await list("mentor=elliott-notrica&choice=first"))).toEqual(["Jonah Park"]);
    // He has no Oct 2 office hours: nothing was (or can be) chosen for that day.
    expect(await list("availability=window:rishab-veldur-2026-10-02")).toEqual([]);
    expect(await db.query(`select 1 from application_availability where option_id <> $1 and mentor_id = 'rishab-veldur'`, [RISHAB_WINDOW])).toEqual([]);
    // Canceled applications don't count toward demand.
    const interest = await getMentorInterest(db);
    expect(interest.get("rishab-veldur")).toEqual({ any: 2, first: 1 });
    expect(interest.get("patrick-haddox")).toEqual({ any: 2, first: 1 });
    expect(interest.get("vikram-lakhwara")).toEqual({ any: 1, first: 1 });
    expect(interest.get("elliott-notrica")).toEqual({ any: 1, first: 1 });
    expect(await getStatusCounts(db)).toMatchObject({ total: 5, submitted: 4, canceled: 1 });
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

  it("loads the detail record and resolves his window to the Oct 1 label (sessions come from it)", async () => {
    const detail = await getApplicationDetail(db, ids.nadia);
    expect(detail?.application).toMatchObject({
      fullName: "Nadia Brooks",
      firstChoiceMentorId: "rishab-veldur",
      availabilityNotes: NOTES,
      availability: [{ mentorId: "rishab-veldur", kind: "window", optionId: RISHAB_WINDOW }],
    });
    expect(detail?.related).toEqual([]);
    expect(detail?.studentAppointments).toEqual([]);

    const directory = buildOrganizerDirectory(getMentorsForOrganizers(), getSite().officeHours);
    expect(detail!.application.availability.map((a) => resolveAvailability(directory, a))).toEqual([
      {
        key: `window:${RISHAB_WINDOW}`,
        kind: "window",
        optionId: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        mentorName: "Rishab Veldur",
        label: WINDOW_LABEL,
        certainty: "window",
      },
    ]);
    // Students chose windows; organizers book one of the window's sessions.
    const prefs = mentorBookability(directory, detail!.application.mentors.map((m) => m.mentorId));
    expect(prefs.map((p) => [p.firstName, p.slots.length, p.windows.map((w) => w.label)])).toEqual([
      ["Rishab", 10, [WINDOW_LABEL]],
      ["Patrick", 3, ["Thu, Oct 1 · 10:00–11:30 AM CT"]],
    ]);
    expect(restrictToDirectory(parseApplicationFilters({ mentor: "rishab-veldur" }), directory).mentor).toBe("rishab-veldur");
    // Ron's Thu, Oct 1 2:30–4:30 PM window (BIF) resolves the same way, with four sessions behind it.
    expect(resolveAvailability(directory, { kind: "window", optionId: "ron-lewis-2026-10-01-pm", mentorId: "ron-lewis" })).toEqual({
      key: "window:ron-lewis-2026-10-01-pm",
      kind: "window",
      optionId: "ron-lewis-2026-10-01-pm",
      mentorId: "ron-lewis",
      mentorName: "Ron Lewis",
      label: "Thu, Oct 1 · 2:30–4:30 PM CT",
      certainty: "window",
    });
    // Elliott's Wed, Sep 30 morning window resolves the same way (one of his three windows).
    expect(resolveAvailability(directory, { kind: "window", optionId: ELLIOTT_AM_WINDOW, mentorId: "elliott-notrica" })).toEqual({
      key: `window:${ELLIOTT_AM_WINDOW}`,
      kind: "window",
      optionId: ELLIOTT_AM_WINDOW,
      mentorId: "elliott-notrica",
      mentorName: "Elliott Notrica",
      label: ELLIOTT_AM_LABEL,
      certainty: "window",
    });
    // Vik is still scheduling: no window and no sessions, so an application can only be reviewed.
    // Elliott's three windows give him 22 sessions.
    expect(
      mentorBookability(directory, ["ron-lewis", "vikram-lakhwara", "elliott-notrica"]).map((p) => [
        p.firstName,
        p.slots.length,
        p.windows.length,
        p.scheduling,
      ]),
    ).toEqual([
      ["Ron", 4, 1, "available"],
      ["Vik", 0, 0, "in-progress"],
      ["Elliott", 22, 3, "available"],
    ]);
  });

  it("shows his window in the dashboard results", async () => {
    const directory = buildOrganizerDirectory(getMentorsForOrganizers(), getSite().officeHours);
    const rows = await list("mentor=rishab-veldur&status=submitted");
    const html = renderToStaticMarkup(createElement(ApplicationResults, { applications: rows, directory }));
    const t = text(html);
    // Desktop table + phone cards, each listing both applications.
    expect(html.match(new RegExp(`href="/organizers/applications/${ids.nadia}"`, "g"))).toHaveLength(2);
    expect(html.match(new RegExp(`href="/organizers/applications/${ids.omar}"`, "g"))).toHaveLength(2);
    expect(t).toContain("1. Rishab Veldur 1st choice 2. Patrick Haddox");
    expect(t).toContain("1. Patrick Haddox 1st choice 2. Rishab Veldur");
    expect(t).toContain(`Rishab Veldur ${WINDOW_LABEL} Availability window`);
    expect(t).toContain(`Patrick Haddox Thu, Oct 1 · 10:00–11:30 AM CT Availability window Rishab Veldur ${WINDOW_LABEL} Availability window`);
    expect(t.match(new RegExp(WINDOW_LABEL, "g"))).toHaveLength(4);
    expect(t).not.toContain("Exact times TBA");
    expect(t).not.toContain("Exact time to be confirmed");
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

    /** The session <select>: optgroup labels and option texts (value, text, selected, disabled). */
    function sessionSelect(html: string) {
      const select = /<select id="[^"]*-slot"[^>]*>([\s\S]*?)<\/select>/.exec(html)![1];
      return {
        groups: [...select.matchAll(/<optgroup label="([^"]*)"/g)].map((m) => m[1]),
        options: [...select.matchAll(/<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g)].map((m) => ({
          value: m[1],
          text: m[3],
          selected: m[2].includes("selected"),
          disabled: m[2].includes("disabled"),
        })),
      };
    }
    const RULE_TEXT = sessionRuleText(getSite().officeHours);

    it("lists Rishab first with his Oct 1 window and offers his and Patrick's sessions first, then everyone else's", async () => {
      const { html, t } = await renderDetail(ids.nadia);
      expect(t).toContain("Nadia Brooks");
      expect(t).toContain(
        `Mentors & availability 1. Rishab Veldur Co-Founder & CEO, Auvi Labs First choice ${WINDOW_LABEL} Availability window ` +
          "2. Patrick Haddox CEO & Co-Founder, Samara Aerospace Interest only No time selected " +
          `Availability notes ${NOTES}`,
      );
      // Both preferred mentors have sessions now, so nothing says "no sessions yet".
      expect(t).not.toContain("No sessions yet");
      expect(t).toContain("No active appointments.");
      expect(t).toContain("Confirmed (needs a confirmed appointment)");
      // The rule, once, above the session picker.
      expect(t).toContain(`Assign a session Time slot ${RULE_TEXT} One application (a student or a team) per session.`);
      expect(t.match(new RegExp(RULE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(1);
      const { groups, options } = sessionSelect(html);
      // Her preferences first (by rank), then the other mentors with sessions (Arnav, Elliott, Ron) in content order.
      expect(groups).toEqual([
        "Rishab Veldur · 1st choice",
        "Patrick Haddox · preference 2",
        "Arnav Mishra · not requested",
        "Elliott Notrica · not requested",
        "Ron Lewis · not requested",
      ]);
      expect(options).toHaveLength(42); // Rishab 10 + Patrick 3 + Arnav 3 + Elliott 22 + Ron 4
      // Her first choice's first open session is preselected, and nothing else.
      expect(options[0]).toEqual({
        value: "rishab-veldur-2026-10-01-1200",
        text: "Thu, Oct 1 · 12:00–12:25 PM CT · 1 of 1 open",
        selected: true,
        disabled: false,
      });
      expect(options.filter((o) => o.selected)).toHaveLength(1);
      expect(options[9].text).toBe("Thu, Oct 1 · 4:30–4:55 PM CT · 1 of 1 open");
      expect(options.slice(0, 10).every((o) => o.value.startsWith(`${RISHAB_WINDOW}-`) && o.text.startsWith("Thu, Oct 1 · "))).toBe(true);
      expect(options.slice(10, 13).map((o) => o.text)).toEqual([
        "Thu, Oct 1 · 10:00–10:25 AM CT · 1 of 1 open",
        "Thu, Oct 1 · 10:30–10:55 AM CT · 1 of 1 open",
        "Thu, Oct 1 · 11:00–11:25 AM CT · 1 of 1 open",
      ]);
      expect(options.slice(13, 16).map((o) => [o.value, o.text])).toEqual([
        ["arnav-mishra-2026-10-02-am-1000", "Fri, Oct 2 · 10:00–10:25 AM CT · 1 of 1 open"],
        ["arnav-mishra-2026-10-02-am-1030", "Fri, Oct 2 · 10:30–10:55 AM CT · 1 of 1 open"],
        ["arnav-mishra-2026-10-02-am-1100", "Fri, Oct 2 · 11:00–11:25 AM CT · 1 of 1 open"],
      ]);
      // Elliott's 22 sessions: Wed, Sep 30 9:00 AM–11:55 AM and 2:00–4:55 PM, Thu, Oct 1 12:00–4:55 PM.
      const elliott = options.slice(16, 38);
      expect(elliott.map((o) => o.value.replace(/-\d{4}$/, ""))).toEqual(ELLIOTT_SESSION_WINDOWS);
      expect([elliott[0], elliott[5], elliott[6], elliott[11], elliott[12], elliott[21]].map((o) => [o.value, o.text])).toEqual([
        ["elliott-notrica-2026-09-30-am-0900", "Wed, Sep 30 · 9:00–9:25 AM CT · 1 of 1 open"],
        ["elliott-notrica-2026-09-30-am-1130", "Wed, Sep 30 · 11:30–11:55 AM CT · 1 of 1 open"],
        ["elliott-notrica-2026-09-30-pm-1400", "Wed, Sep 30 · 2:00–2:25 PM CT · 1 of 1 open"],
        ["elliott-notrica-2026-09-30-pm-1630", "Wed, Sep 30 · 4:30–4:55 PM CT · 1 of 1 open"],
        ["elliott-notrica-2026-10-01-pm-1200", "Thu, Oct 1 · 12:00–12:25 PM CT · 1 of 1 open"],
        ["elliott-notrica-2026-10-01-pm-1630", "Thu, Oct 1 · 4:30–4:55 PM CT · 1 of 1 open"],
      ]);
      expect(elliott.every((o) => !o.selected && !o.disabled)).toBe(true);
      expect(options.slice(38).map((o) => [o.value, o.text])).toEqual([
        ["ron-lewis-2026-10-01-pm-1430", "Thu, Oct 1 · 2:30–2:55 PM CT · 1 of 1 open"],
        ["ron-lewis-2026-10-01-pm-1500", "Thu, Oct 1 · 3:00–3:25 PM CT · 1 of 1 open"],
        ["ron-lewis-2026-10-01-pm-1530", "Thu, Oct 1 · 3:30–3:55 PM CT · 1 of 1 open"],
        ["ron-lewis-2026-10-01-pm-1600", "Thu, Oct 1 · 4:00–4:25 PM CT · 1 of 1 open"],
      ]);
      // Rishab has no session limit in content, so no warning while his session is selected.
      expect(t).not.toContain("Only book as many as");
      // His headshot, never an Oct 2 office-hours time (the only Oct 2 times are Arnav's three
      // sessions, offered as "not requested"), and no one-on-one promise.
      expect(html).toContain('alt="Rishab Veldur"');
      expect(t.match(/Oct 2/g)).toHaveLength(3);
      expect(html).not.toContain("rishab-veldur-2026-10-02");
      expect(t).not.toMatch(/one-on-one/i);
      expect(t).not.toContain("Exact times TBA");
      expect(t).not.toContain("—");
    });

    it("shows Rishab as a second choice, with no session limit on Patrick (open to all three sessions)", async () => {
      const { html, t } = await renderDetail(ids.omar);
      expect(t).toContain(
        "Mentors & availability 1. Patrick Haddox CEO & Co-Founder, Samara Aerospace First choice Thu, Oct 1 · 10:00–11:30 AM CT Availability window " +
          `2. Rishab Veldur Co-Founder & CEO, Auvi Labs ${WINDOW_LABEL} Availability window Availability notes None.`,
      );
      expect(t).not.toContain("No sessions yet");
      const { groups, options } = sessionSelect(html);
      expect(groups).toEqual([
        "Patrick Haddox · 1st choice",
        "Rishab Veldur · preference 2",
        "Arnav Mishra · not requested",
        "Elliott Notrica · not requested",
        "Ron Lewis · not requested",
      ]);
      expect(options.map((o) => o.value.replace(/-\d{4}$/, ""))).toEqual([
        ...Array(3).fill("patrick-haddox-2026-10-01-am"),
        ...Array(10).fill(RISHAB_WINDOW),
        ...Array(3).fill("arnav-mishra-2026-10-02-am"),
        ...ELLIOTT_SESSION_WINDOWS,
        ...Array(4).fill("ron-lewis-2026-10-01-pm"),
      ]);
      expect(options[0]).toMatchObject({ value: "patrick-haddox-2026-10-01-am-1000", selected: true });
      expect(options.filter((o) => o.selected)).toHaveLength(1);
      // Patrick's session is selected, but he sets no session count: all three are bookable, no warning.
      expect(options.slice(0, 3).map((o) => [o.text, o.disabled])).toEqual([
        ["Thu, Oct 1 · 10:00–10:25 AM CT · 1 of 1 open", false],
        ["Thu, Oct 1 · 10:30–10:55 AM CT · 1 of 1 open", false],
        ["Thu, Oct 1 · 11:00–11:25 AM CT · 1 of 1 open", false],
      ]);
      expect(t).not.toContain("Only book as many as");
      expect(t).not.toContain("Booked so far");
      expect(t).not.toMatch(/\bhosting\b/i);
    });

    it("warns under the picker when the selected mentor agreed to fewer sessions (fixture Patrick: one or two)", async () => {
      patrickFixture.sessionCount = "One or two sessions";
      try {
        const { html, t } = await renderDetail(ids.omar);
        const { options } = sessionSelect(html);
        // The count doesn't change which sessions are offered; it only adds the warning.
        expect(options).toHaveLength(42);
        expect(options[0]).toMatchObject({ value: "patrick-haddox-2026-10-01-am-1000", selected: true });
        expect(t).toContain(
          "Patrick is hosting one or two sessions, and 3 are listed. Only book as many as Patrick agreed to. Booked so far: 0.",
        );
        expect(t.match(/Only book as many as/g)).toHaveLength(1);
      } finally {
        patrickFixture.sessionCount = null;
      }
    });

    it("explains that Vik (still scheduling) has no sessions yet, and offers other mentors' sessions without preselecting one", async () => {
      const { html, t } = await renderDetail(ids.lena);
      expect(t).toContain(
        "Mentors & availability 1. Vikram “Vik” Lakhwara Founder & Managing Member, Stakehouse First choice Interest only No time selected Scheduling in progress Availability notes None.",
      );
      expect(t).toContain(
        "No sessions yet for Vik Vikram “Vik” Lakhwara Scheduling in progress You can still review this application: mark it Under review, Selected or Waitlisted. " +
          "Confirmed and Attended need a confirmed appointment. That’s possible once Vik has a window with exact start and end times in content/mentors.ts . " +
          "It’s split into sessions automatically.",
      );
      expect(t).toContain("Confirmed (needs a confirmed appointment)");
      const { groups, options } = sessionSelect(html);
      // Nobody she asked for has sessions: every group is "not requested", in content order.
      expect(groups).toEqual([
        "Patrick Haddox · not requested",
        "Arnav Mishra · not requested",
        "Elliott Notrica · not requested",
        "Ron Lewis · not requested",
        "Rishab Veldur · not requested",
      ]);
      expect(options).toHaveLength(42);
      expect(options.filter((o) => o.selected)).toEqual([]);
      expect(options.some((o) => o.value.startsWith("vikram-lakhwara"))).toBe(false);
      expect(t).not.toContain("Only book as many as");
      expect(t).not.toContain("—");
    });

    it("lists Elliott first with his Wed, Sep 30 morning window and offers his 22 sessions first, the first one preselected", async () => {
      const { html, t } = await renderDetail(ids.jonah);
      expect(t).toContain(
        `Mentors & availability 1. Elliott Notrica Founder & CEO, Symbio Bioculinary First choice ${ELLIOTT_AM_LABEL} Availability window Availability notes None.`,
      );
      expect(t).not.toContain("No sessions yet");
      expect(t).not.toContain("Scheduling in progress");
      const { groups, options } = sessionSelect(html);
      expect(groups).toEqual([
        "Elliott Notrica · 1st choice",
        "Patrick Haddox · not requested",
        "Arnav Mishra · not requested",
        "Ron Lewis · not requested",
        "Rishab Veldur · not requested",
      ]);
      expect(options).toHaveLength(42);
      expect(options.slice(0, 22).map((o) => o.value.replace(/-\d{4}$/, ""))).toEqual(ELLIOTT_SESSION_WINDOWS);
      // His first open session (the first one in the window Jonah chose) is preselected, and nothing else.
      expect(options[0]).toEqual({
        value: "elliott-notrica-2026-09-30-am-0900",
        text: "Wed, Sep 30 · 9:00–9:25 AM CT · 1 of 1 open",
        selected: true,
        disabled: false,
      });
      expect(options.filter((o) => o.selected)).toHaveLength(1);
      // He sets no session count: no warning.
      expect(t).not.toContain("Only book as many as");
      expect(t).not.toMatch(/\bhosting\b/i);
      expect(t).not.toContain("—");
    });

    it("preselects a session inside the window the student ticked, not the mentor's first window", async () => {
      // Elliott has three windows; this student ticked only his Thursday one.
      const id = await insertApplication(db, {
        fullName: "Thursday Only",
        email: "thursonly@illinois.edu",
        mentors: ["elliott-notrica"],
        availability: ["window:elliott-notrica-2026-10-01-pm"],
        createdAt: "2026-09-24T19:30:00Z",
      });
      try {
        const { html } = await renderDetail(id);
        const { options } = sessionSelect(html);
        const selected = options.filter((o) => o.selected);
        expect(selected).toEqual([
          {
            value: "elliott-notrica-2026-10-01-pm-1200",
            text: "Thu, Oct 1 · 12:00–12:25 PM CT · 1 of 1 open",
            selected: true,
            disabled: false,
          },
        ]);
        // His Wednesday sessions are still offered, just not preselected.
        expect(options.some((o) => o.value === "elliott-notrica-2026-09-30-am-0900" && !o.selected)).toBe(true);
      } finally {
        await db.query(`delete from applications where id = $1`, [id]);
      }
    });

    it("books one application per session: assigned, then full for everyone else, then confirmed", async () => {
      const slots = buildOrganizerDirectory(getMentorsForOrganizers(), getSite().officeHours).slotsById;
      const ctx = { actor: "Detail Tester", slots };
      const { appointment } = await assignAppointment(db, { applicationId: ids.nadia, slotId: "rishab-veldur-2026-10-01-1200" }, ctx);
      await assignAppointment(db, { applicationId: ids.omar, slotId: "patrick-haddox-2026-10-01-am-1030" }, ctx);

      const nadia = await renderDetail(ids.nadia);
      expect(nadia.t).toContain(
        "Appointments Proposed, awaiting confirmation Confirmed slot Rishab Veldur Thu, Oct 1 · 12:00–12:25 PM CT Proposed by Detail Tester",
      );
      expect(sessionSelect(nadia.html).options[0]).toMatchObject({
        value: "rishab-veldur-2026-10-01-1200",
        text: "Thu, Oct 1 · 12:00–12:25 PM CT · Already assigned",
        disabled: true,
        selected: false,
      });
      expect(nadia.t).toContain("Propose another appointment");

      const omar = await renderDetail(ids.omar);
      const omarOptions = sessionSelect(omar.html).options;
      expect(omarOptions.find((o) => o.value === "rishab-veldur-2026-10-01-1200")).toMatchObject({
        text: "Thu, Oct 1 · 12:00–12:25 PM CT · Full (1/1)",
        disabled: true,
      });
      expect(omarOptions.find((o) => o.value === "patrick-haddox-2026-10-01-am-1030")).toMatchObject({ disabled: true });
      expect(omar.t).toContain("Thu, Oct 1 · 10:30–10:55 AM CT");

      // Sessions are confirmed times (the mentor confirmed the window), so the appointment can be confirmed.
      await updateAppointment(db, { id: appointment.id, action: "confirm" }, ctx);
      const confirmed = await renderDetail(ids.nadia);
      expect(confirmed.t).toContain("Appointments Confirmed Confirmed slot Rishab Veldur Thu, Oct 1 · 12:00–12:25 PM CT");
      expect(await getSlotUsage(db)).toEqual(
        new Map([
          ["rishab-veldur-2026-10-01-1200", { proposed: 0, confirmed: 1 }],
          ["patrick-haddox-2026-10-01-am-1030", { proposed: 1, confirmed: 0 }],
        ]),
      );
    });
  });
});

describe("applications listing a date-only window (fixture mentor: date set, time not)", () => {
  // No production mentor has a date-only window now that Rishab's 12–5 PM window is locked; this
  // keeps the organizer view of that path (approximate certainty, "Exact times TBA") covered.
  const DATE_ONLY_WINDOW = "fixture-date-only-2026-10-01";
  const DATE_ONLY_LABEL = "Thu, Oct 1 · Exact time to be confirmed";
  const dateOnlyMentor: Mentor = {
    id: "fixture-date-only",
    name: "Dana Fixture",
    firstName: "Dana",
    role: "Founder",
    company: "Fixture Labs",
    headshot: null,
    bio: null,
    expertise: null,
    askMeAbout: null,
    goodFitFor: null,
    session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
    availability: [{ id: DATE_ONLY_WINDOW, date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" }],
    slots: [],
    links: [],
    acceptingApplications: true,
    sources: [],
  };
  let db: Database;
  let id: string;

  beforeAll(async () => {
    db = await createMemoryDbForTests();
    id = await insertApplication(db, {
      fullName: "Priya Natarajan",
      email: "pnatara2@illinois.edu",
      mentors: ["fixture-date-only", "rishab-veldur"],
      availability: [`window:${DATE_ONLY_WINDOW}`, "window:rishab-veldur-2026-10-01"],
      createdAt: "2026-09-24T15:00:00Z",
    });
  });

  it("resolves the date-only window as approximate and shows the \"Exact times TBA\" badge next to Rishab's timed window", async () => {
    const directory = buildOrganizerDirectory([...getMentorsForOrganizers(), dateOnlyMentor], getSite().officeHours);
    const rows = await listApplications(db, parseApplicationFilters({ mentor: "fixture-date-only" }));
    expect(rows.map((r) => r.id)).toEqual([id]);
    expect(rows[0].availability.map((a) => resolveAvailability(directory, a))).toEqual([
      {
        key: `window:${DATE_ONLY_WINDOW}`,
        kind: "window",
        optionId: DATE_ONLY_WINDOW,
        mentorId: "fixture-date-only",
        mentorName: "Dana Fixture",
        label: DATE_ONLY_LABEL,
        certainty: "window-approx",
      },
      {
        key: "window:rishab-veldur-2026-10-01",
        kind: "window",
        optionId: "rishab-veldur-2026-10-01",
        mentorId: "rishab-veldur",
        mentorName: "Rishab Veldur",
        label: "Thu, Oct 1 · 12:00–5:00 PM CT",
        certainty: "window",
      },
    ]);
    const t = text(renderToStaticMarkup(createElement(ApplicationResults, { applications: rows, directory })));
    expect(t).toContain("1. Dana Fixture 1st choice 2. Rishab Veldur");
    expect(t).toContain(
      `Dana Fixture ${DATE_ONLY_LABEL} Exact times TBA Rishab Veldur Thu, Oct 1 · 12:00–5:00 PM CT Availability window`,
    );
    // Desktop table + phone card.
    expect(t.match(/Exact times TBA/g)).toHaveLength(2);
  });
});
