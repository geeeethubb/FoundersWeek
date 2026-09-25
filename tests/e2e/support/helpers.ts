/**
 * Shared helpers for the end-to-end suite: the mentor fixtures the checklist names, unique test
 * data, the public application API, organizer sign-in/export, and application-form helpers.
 *
 * Everything the suite creates uses e2e-… Illinois emails that are unique per run, so specs work
 * against a fresh PGlite database and against a real, non-empty Postgres (E2E_DATABASE_URL).
 */
import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_ORGANIZER_PASSWORD } from "./env";

// ---------------------------------------------------------------------------
// Content the checklist names (kept literal on purpose: the tests assert the published facts)
// ---------------------------------------------------------------------------

export interface MentorFixture {
  id: string;
  name: string;
  firstName: string;
  /** Verified role and company ("role · company" on cards). */
  role: string;
  company: string;
  /** The single availability window the mentor's Select/Apply action preselects, or null while scheduling. */
  windowId: string | null;
  /**
   * True when the mentor's times aren't set yet (no window: Vik, Elliott), so the application
   * requires broad availability. A published window (Patrick, Arnav, Ron, Rishab) is enough on its own.
   */
  timesPending: boolean;
  /** The one availability line on the Office Hours card. */
  cardLine: string;
  linkedin: string;
  /** A distinctive phrase from the approved bio (profile page). */
  bioFragment: string;
  /** Approved "Can help with" labels (public). Empty when there's no approved topic list (Rishab). */
  helpsWith: string[];
  /** Office Hours card without help labels: the first sentence of the approved bio instead. */
  cardIntro?: string;
  /** Profile "Background" chips (Rishab). */
  background?: string[];
  /** Profile "Good fit for" paragraph (a sentence-style approved item). */
  goodFitFor?: string;
}

export const PATRICK: MentorFixture = {
  id: "patrick-haddox",
  name: "Patrick Haddox",
  firstName: "Patrick",
  role: "CEO & Co-Founder",
  company: "Samara Aerospace",
  windowId: "patrick-haddox-2026-10-01-am",
  timesPending: false,
  cardLine: "Thu, Oct 1 · 10:00–11:30 AM CT",
  linkedin: "https://www.linkedin.com/in/patrick-haddox/",
  bioFragment: "building the Hummingbird satellite bus",
  helpsWith: ["Turning university research into a startup", "Raising a seed round for deep-tech hardware"],
};
export const ARNAV: MentorFixture = {
  id: "arnav-mishra",
  name: "Arnav Mishra",
  firstName: "Arnav",
  role: "Co-Founder & CTO",
  company: "Doss",
  windowId: "arnav-mishra-2026-10-02-am",
  timesPending: false,
  cardLine: "Fri, Oct 2 · 10:00–11:30 AM CT",
  linkedin: "https://www.linkedin.com/in/arnav-mishra/",
  bioFragment: "AI-native alternative to legacy ERP software",
  helpsWith: ["Going from engineer to technical co-founder", "Building B2B and enterprise software"],
};
export const VIK: MentorFixture = {
  id: "vikram-lakhwara",
  name: "Vikram “Vik” Lakhwara",
  firstName: "Vik",
  role: "Founder & Managing Member",
  company: "Stakehouse",
  windowId: null,
  timesPending: true,
  cardLine: "Scheduling in progress",
  linkedin: "https://www.linkedin.com/in/viklakhwara/",
  bioFragment: "a St. Louis venture fund that backs early-stage founders",
  helpsWith: ["Raising a pre-seed round", "What early-stage investors look for"],
};
export const ELLIOTT: MentorFixture = {
  id: "elliott-notrica",
  name: "Elliott Notrica",
  firstName: "Elliott",
  role: "Founder & CEO",
  company: "Symbio Bioculinary",
  windowId: null,
  timesPending: true,
  cardLine: "Scheduling in progress",
  linkedin: "https://www.linkedin.com/in/elliottnotrica/",
  bioFragment: "engineers microorganisms to turn companies’ food waste into new ingredients",
  helpsWith: ["Starting a company as an undergrad", "Biotech and food-tech startups"],
};
export const RON: MentorFixture = {
  id: "ron-lewis",
  name: "Ron Lewis",
  firstName: "Ron",
  role: "Co-Founder",
  company: "Auctus Advisory",
  windowId: "ron-lewis-2026-10-01-pm",
  timesPending: false,
  cardLine: "Thu, Oct 1 · 2:30–4:30 PM CT",
  linkedin: "https://www.linkedin.com/in/ronlewis20/",
  bioFragment: "repeat entrepreneur and co-founder of Auctus Advisory",
  helpsWith: ["Revenue strategy and optimization", "Financial forecasting and planning"],
};

/**
 * The sixth mentor: a confirmed window on Thu, Oct 1, anytime from noon to 5 PM (never Friday), so
 * his "Apply to meet Rishab" preselects that window and, like Patrick's, it's enough on its own.
 * Organizers split it into ten 25-minute sessions (12:00 to 4:30).
 * No approved topic list: his card shows the first sentence of his bio; his profile shows
 * "Background" chips and a "Good fit for" paragraph instead of "Can help with".
 */
export const RISHAB: MentorFixture = {
  id: "rishab-veldur",
  name: "Rishab Veldur",
  firstName: "Rishab",
  role: "Co-Founder & CEO",
  company: "Auvi Labs",
  windowId: "rishab-veldur-2026-10-01",
  timesPending: false,
  cardLine: "Thu, Oct 1 · 12:00–5:00 PM CT",
  linkedin: "https://www.linkedin.com/in/rishab-veldur",
  bioFragment: "wearable ultrasound technology to help detect problems with dialysis access earlier",
  helpsWith: [],
  cardIntro:
    "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier.",
  background: ["Medtech", "Hardware and software", "University spinouts"],
  goodFitFor: "Interested in turning a technical project into a healthcare startup?",
};

/** Rishab's other public link (besides LinkedIn). */
export const AUVI_LABS_URL = "https://www.auvilabs.com/";
/** Rishab's Founders Week appearance (Friday Showcase panel) — shown on his profile, separate from office hours. */
export const RISHAB_SHOWCASE_SESSION = "Health Innovation: From Therapeutics to Devices";
/** The public note under Rishab's office-hours window on his profile. */
export const RISHAB_WINDOW_NOTE =
  "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.";
/** Claims never made about Auvi's device (investigational). */
export const AUVI_CLAIMS = /FDA[\s-]*(approved|cleared)|\bcleared by the FDA\b|commercially available|clinically proven/i;

/** Patrick's office hours are in person: the venue, then the street address, on his profile. */
export const PATRICK_VENUE = "Espresso Royale at Grainger Library";
export const PATRICK_ADDRESS = "1301 W Springfield Ave, Urbana, IL 61801";
/** The public note under Patrick's office-hours window on his profile. */
export const PATRICK_WINDOW_NOTE =
  "Patrick is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.";

/** Ron's office hours are in person: the building, then the street address, on his profile. */
export const RON_VENUE = "Business Instructional Facility (BIF)";
export const RON_ADDRESS = "515 E. Gregory Drive, Champaign, IL 61820";
/** The public note under Ron's office-hours window on his profile. */
export const RON_WINDOW_NOTE =
  "Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.";
/**
 * Ron is also open to Oct 4, but that's organizer-only: no date, day or hint of it may appear
 * publicly (Founders Week ends Sat, Oct 3).
 */
export const OCT_4 = /\bOct(ober)?\.?\s+4(th)?\b|\b2026-10-04\b|\bSun(day)?,?\s+Oct|open to Oct/i;

/** The six real mentors, in the published order. */
export const MENTORS: MentorFixture[] = [PATRICK, ARNAV, VIK, ELLIOTT, RON, RISHAB];

/** Mentors whose schedule is still pending (no window yet): Vik and Elliott. */
export const PENDING_MENTORS: MentorFixture[] = MENTORS.filter((m) => m.windowId === null);

/** Mentors with a published office-hours window: Patrick, Arnav, Ron and Rishab. */
export const WINDOW_MENTORS: MentorFixture[] = MENTORS.filter((m) => m.windowId !== null);

/**
 * Fictional demo mentors (content/demo.ts). The main e2e server runs with demo content on, so they
 * follow the six real mentors in every lineup; production-content.spec.ts runs without them.
 */
export const DEMO_MENTOR_NAMES = ["Avery Sample", "Jordan Placeholder"];

/** The capacity-1 demo slot used by the organizer capacity test (content/demo.ts, 2:00–2:25 PM). */
export const DEMO_SLOT_ID = "demo-avery-slot-1400";
/** Avery's other demo slot (content/demo.ts, 2:30–2:55 PM, capacity 2). */
export const DEMO_SECOND_SLOT_ID = "demo-avery-slot-1430";

// ---------------------------------------------------------------------------
// Office-hours sessions (site.officeHours: 25 minutes, then a 5-minute break)
// ---------------------------------------------------------------------------

/** The session rule, word for word, wherever it's stated publicly. */
export const SESSION_RULE = "Each session is 25 minutes, with a 5-minute break between sessions.";
/** End of the broad-availability hint when none of the chosen mentors lists a time. */
export const SESSION_LENGTH_HINT = "Sessions are 25 minutes.";

export interface SessionFixture {
  /** Generated id: "<windowId>-<HHMM>" (stored with appointments). */
  id: string;
  /** How organizers and students see it. */
  label: string;
  /** Just the time range, e.g. "10:00–10:25 AM CT". */
  time: string;
}

/** A window's sessions from literal start/time pairs (ids "<windowId>-<HHMM>"). */
function sessionsIn(mentor: MentorFixture, day: string, grid: [start: string, time: string][]): SessionFixture[] {
  return grid.map(([start, time]) => ({ id: `${mentor.windowId}-${start}`, label: `${day} · ${time}`, time }));
}

/**
 * Patrick's window (Thu, Oct 1, 10:00–11:30 AM) split into three 25-minute sessions. He's open to
 * hosting all three, so organizers can book every one and see no session-count warning; the grid
 * itself is never published.
 */
export const PATRICK_SESSIONS: SessionFixture[] = sessionsIn(PATRICK, "Thu, Oct 1", [
  ["1000", "10:00–10:25 AM CT"],
  ["1030", "10:30–10:55 AM CT"],
  ["1100", "11:00–11:25 AM CT"],
]);

/** Rishab's window (Thu, Oct 1, noon to 5 PM): ten sessions, 12:00 to 4:30. */
export const RISHAB_SESSIONS: SessionFixture[] = sessionsIn(RISHAB, "Thu, Oct 1", [
  ["1200", "12:00–12:25 PM CT"],
  ["1230", "12:30–12:55 PM CT"],
  ["1300", "1:00–1:25 PM CT"],
  ["1330", "1:30–1:55 PM CT"],
  ["1400", "2:00–2:25 PM CT"],
  ["1430", "2:30–2:55 PM CT"],
  ["1500", "3:00–3:25 PM CT"],
  ["1530", "3:30–3:55 PM CT"],
  ["1600", "4:00–4:25 PM CT"],
  ["1630", "4:30–4:55 PM CT"],
]);

/** Ron's window (Thu, Oct 1, 2:30–4:30 PM at BIF): four sessions. */
export const RON_SESSIONS: SessionFixture[] = sessionsIn(RON, "Thu, Oct 1", [
  ["1430", "2:30–2:55 PM CT"],
  ["1500", "3:00–3:25 PM CT"],
  ["1530", "3:30–3:55 PM CT"],
  ["1600", "4:00–4:25 PM CT"],
]);

/** Arnav's window (Fri, Oct 2, 10:00–11:30 AM): three sessions. */
export const ARNAV_SESSIONS: SessionFixture[] = sessionsIn(ARNAV, "Fri, Oct 2", [
  ["1000", "10:00–10:25 AM CT"],
  ["1030", "10:30–10:55 AM CT"],
  ["1100", "11:00–11:25 AM CT"],
]);

/**
 * The organizer warning for a mentor who agreed to a set number of sessions (content
 * `session.sessionCount`): "<Name> is hosting <count>, and <n> are listed. Only book as many as
 * <Name> agreed to." then "Booked so far: <n>." This phrase appears in no other copy.
 */
export const SESSION_LIMIT_MARKER = "Only book as many as";

/**
 * No real mentor sets a session count (Patrick is open to all three of his sessions), so the
 * warning is covered with the demo mentor Avery Sample (content/demo.ts: `sessionCount: "Two
 * sessions"`, two explicit slots). Shown to organizers only, never on public pages.
 */
export const DEMO_SESSION_LIMIT_NOTE =
  "Avery is hosting two sessions, and 2 are listed. Only book as many as Avery agreed to.";

/**
 * A session count ("3 sessions", "one or two sessions", "Two sessions"). How many sessions a mentor
 * holds, or how many fit in a window, is for organizers only: public office-hours copy never says.
 */
export const SESSION_COUNT = /\b(\d+|one|two|three|four|five|ten) sessions\b/i;

/** The one sentence explaining how matching works — exactly once on /office-hours. */
export const MATCHING_SENTENCE =
  "Founders will match students by interests and availability and email selected applicants to confirm.";

// ---------------------------------------------------------------------------
// Never public
// ---------------------------------------------------------------------------

/**
 * Internal "basis" annotations of mentor expertise (content/mentors.ts). Labels are public; the basis
 * behind each one never is. These phrases appear nowhere else in public copy.
 */
export const EXPERTISE_BASIS: RegExp[] = [
  /Samara’s SpaceWERX contract/,
  /Founders Showcase talk on building Doss/,
  /Founders Showcase panelist/,
  /Symbio licenses engineered microbes to food companies/,
  /Writes publicly about Chicago venture capital/,
  /Advises on stakeholder communication at Auctus Advisory/,
  /\bBasis\b/,
];

/** Ron's suggested "Ask me about" topics are a DRAFT and must never be public. */
export const DRAFT_TOPICS: RegExp[] = [/Startup financial planning/, /Communicating business progress to stakeholders/];

/** Organizer-only notes (content/mentors.ts `organizerNotes`) — stripped before anything renders. */
export const ORGANIZER_ONLY =
  /Wednesday through Saturday morning|not available slots|Willing to help|Willing to host|Much more available|candidate for extra sessions|Confirm suggested discussion topics|Appointment lengths and location not finalized|invited the Founders community\)|only has time for office hours|meet student teams|not an eligibility rule|Window locked|email signature|phone number|Open to hosting all three|as long as they fit in the window|also open to Oct|send details later/i;

/** Content-maintenance notes on approved fields (`note`) — never public. */
export const CONTENT_NOTES =
  /at the organizers' request|Grounded in (public sources|Ron’s supplied bio)|own topics if (he|she|they) suppl|Suggested topics pending|First sentence supplied by|checked against the sources below|organizers’ suggested fit|Not a syllabus|not medical or regulatory advice|never call it FDA/i;

/** The canceled Saturday afterparty (HERE Apartments) must not appear anywhere. */
export const CANCELED_AFTERPARTY = /HERE Apartments|Founders Week Afterparty|founders-week-afterparty|after[\s-]?party/i;

/** Copy the owner removed: no "one-on-one" promise, no "Founders vs" section. */
export const ONE_ON_ONE = /one[\s-]on[\s-]one/i;
export const FOUNDERS_VS = /Founders\s+vs\.?\b/i;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Unfold RFC 5545 content lines (a CRLF followed by a space/tab continues the previous line). */
export function unfoldIcs(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

/** The VEVENT blocks of an .ics document (unfolded). */
export function icsEvents(text: string): string[] {
  return unfoldIcs(text).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
}

/** Occurrences of `pattern` (made global) in `text`. */
export function countMatches(text: string, pattern: RegExp | string): number {
  const re =
    typeof pattern === "string"
      ? new RegExp(escapeRegExp(pattern), "g")
      : new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return text.match(re)?.length ?? 0;
}

/** Rendered text of a locator (innerText: excludes <script> payloads and display:none content). */
export async function visibleText(locator: Locator): Promise<string> {
  return locator.evaluate((el) => (el as HTMLElement).innerText);
}

/** Horizontal overflow of the document in px (0 when nothing scrolls sideways). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** A headshot is a real, loaded photo from /public/mentors/<id>.jpg (served through next/image). */
export async function expectHeadshot(img: Locator, mentor: Pick<MentorFixture, "id" | "name">): Promise<void> {
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("alt", mentor.name);
  const src = decodeURIComponent((await img.getAttribute("src")) ?? "");
  expect(src, `${mentor.name}'s headshot source`).toContain(`/mentors/${mentor.id}.jpg`);
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), {
      message: `${mentor.name}'s headshot should load`,
    })
    .toBeGreaterThan(0);
}

/** Resolves once React has hydrated `locator` (event handlers attached). */
export async function waitForHydration(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: "attached" });
  await expect
    .poll(() => locator.first().evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps$"))), {
      message: "waiting for React to hydrate",
      timeout: 60_000,
    })
    .toBe(true);
}

// ---------------------------------------------------------------------------
// Site chrome
// ---------------------------------------------------------------------------

/** The header's one "Apply" button — accessible name "Apply for Office Hours" at every width. */
export function headerApplyLink(page: Page): Locator {
  return page.getByRole("banner").getByRole("link", { name: "Apply for Office Hours", exact: true });
}

/** Bottom edge (px from the viewport top) of the sticky site header. */
export async function headerBottom(page: Page): Promise<number> {
  return page.getByRole("banner").evaluate((el) => el.getBoundingClientRect().bottom);
}

/**
 * The element's whole box is on screen and not hidden under the sticky header:
 * top ≥ header bottom, bottom ≤ viewport height. Polls until scrolling has settled.
 */
export async function expectClearOfHeader(page: Page, target: Locator, label: string): Promise<void> {
  await expect(target).toBeVisible();
  await expect
    .poll(
      async () => {
        const [box, bottom] = await Promise.all([
          target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom };
          }),
          headerBottom(page),
        ]);
        const viewport = page.viewportSize()!.height;
        return box.top >= bottom - 0.5 && box.bottom <= viewport + 0.5
          ? "clear"
          : `top ${box.top.toFixed(1)} / header bottom ${bottom.toFixed(1)} / bottom ${box.bottom.toFixed(1)} / viewport ${viewport}`;
      },
      { message: `${label}: fully visible below the sticky header`, timeout: 10_000 },
    )
    .toBe("clear");
}

// ---------------------------------------------------------------------------
// Unique data
// ---------------------------------------------------------------------------

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let sequence = 0;

/** A unique Illinois email for this run, e.g. e2e-apply-lx1k2a9f-3@illinois.edu. */
export function uniqueEmail(tag: string): string {
  sequence += 1;
  return `e2e-${tag}-${RUN_ID}-${sequence}@illinois.edu`;
}

/** Marker shared by every email this suite creates (for scoped searches). */
export const E2E_EMAIL_MARKER = "e2e-";

// ---------------------------------------------------------------------------
// Public application API
// ---------------------------------------------------------------------------

export interface ApplicationInput {
  fullName: string;
  email: string;
  major?: string;
  mentorIds: string[];
  firstChoiceMentorId: string;
  /** Option keys, e.g. "window:patrick-haddox-2026-10-01-am". */
  availability?: string[];
  /** Broad availability. Defaults to a sentence when no window is picked (the schema needs one or the other). */
  availabilityNotes?: string;
  workingOn?: string;
  question?: string;
}

export const DEFAULT_BROAD_AVAILABILITY = "Weekday afternoons after 2 PM; anytime Friday.";

export function applicationPayload(input: ApplicationInput) {
  const availability = input.availability ?? [];
  return {
    idempotencyKey: randomUUID(),
    fullName: input.fullName,
    email: input.email,
    year: "junior",
    major: input.major ?? "Computer Engineering",
    participation: "individual",
    teamName: "",
    teammates: "",
    stage: "building",
    workingOn: input.workingOn ?? "A scheduling tool for student organizations.",
    question: input.question ?? "How do I find my first ten paying customers?",
    mentorIds: input.mentorIds,
    firstChoiceMentorId: input.firstChoiceMentorId,
    availability,
    availabilityNotes: input.availabilityNotes ?? (availability.length ? "" : DEFAULT_BROAD_AVAILABILITY),
    link: "",
    acknowledgeNoGuarantee: true,
    consentToShare: true,
    referrerMentorId: "",
    nickname: "",
    // Above the API's minimum fill time (anti-spam).
    elapsedMs: 8000,
  };
}

export interface CreatedApplication {
  id: string;
  statusUrl: string;
  email: string;
  fullName: string;
}

/** Submit an application through the public API, as the browser form does (same-origin Origin header). */
export async function createApplication(request: APIRequestContext, input: ApplicationInput): Promise<CreatedApplication> {
  const res = await request.post("/api/applications", {
    data: applicationPayload(input),
    headers: { Origin: E2E_BASE_URL, Accept: "application/json" },
  });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(201);
  expect(body.ok).toBe(true);
  return { id: body.id, statusUrl: body.statusUrl, email: input.email, fullName: input.fullName };
}

// ---------------------------------------------------------------------------
// Organizer API
// ---------------------------------------------------------------------------

export const ORGANIZER_NAME = "E2E Organizer";

/** Sign in through the organizer API; the session cookie lands in the request context's jar. */
export async function organizerLogin(request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/organizer/session", {
    data: { name: ORGANIZER_NAME, password: E2E_ORGANIZER_PASSWORD },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(res.status(), await res.text()).toBe(200);
}

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && src[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type CsvRecord = Record<string, string>;

/** GET /api/organizer/export with the given dashboard filters, parsed into records by header. */
export async function exportApplications(
  request: APIRequestContext,
  filters: Record<string, string> = {},
): Promise<{ raw: string; records: CsvRecord[] }> {
  const qs = new URLSearchParams(filters).toString();
  const res = await request.get(`/api/organizer/export${qs ? `?${qs}` : ""}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const raw = await res.text();
  const [header, ...rows] = parseCsv(raw);
  const records = rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as CsvRecord);
  return { raw, records };
}

/** Stored applications for one email (organizer export, searched by email). */
export async function storedApplicationsFor(request: APIRequestContext, email: string): Promise<CsvRecord[]> {
  const { records } = await exportApplications(request, { q: email });
  return records.filter((r) => r.email === email);
}

/** PATCH an application's status as an organizer (used for cleanup). */
export async function setApplicationStatus(request: APIRequestContext, id: string, status: string): Promise<number> {
  const res = await request.patch(`/api/organizer/applications/${id}`, {
    data: { status },
    headers: { Origin: E2E_BASE_URL },
  });
  return res.status();
}

// ---------------------------------------------------------------------------
// The application form (/office-hours#apply)
// ---------------------------------------------------------------------------

/** The office-hours application form (named by its "Apply for Office Hours" heading). */
export function applicationForm(page: Page): Locator {
  return page.getByRole("form", { name: "Apply for Office Hours" });
}

/** The application section (#apply): heading, notices, the form and — after submitting — the confirmation. */
export function applySection(page: Page): Locator {
  return page.getByRole("region", { name: "Apply for Office Hours", exact: true });
}

/**
 * The note that tells a student which mentor a link preselected — "Ron Lewis added to your
 * mentors." or "Ron Lewis is selected below." (the wording depends on whether answers were already
 * in progress).
 */
export function preselectionNotice(page: Page, mentor: Pick<MentorFixture, "name">): Locator {
  return applySection(page).getByText(new RegExp(`${escapeRegExp(mentor.name)} (added to your mentors|is selected below)`));
}

/** The "Apply for Office Hours" heading of the application section. */
export function applicationHeading(page: Page): Locator {
  return page.getByRole("heading", { name: "Apply for Office Hours", exact: true });
}

/** A mentor's checkbox in the application ("Patrick Haddox CEO & Co-Founder · Samara Aerospace"). */
export function mentorCheckbox(page: Page, mentor: Pick<MentorFixture, "name">): Locator {
  return applicationForm(page).getByRole("checkbox", { name: new RegExp(`^${escapeRegExp(mentor.name)}\\b`) });
}

/** "I can make …" checkboxes for a mentor's published window(s) — shown once the mentor is selected. */
export function mentorWindows(page: Page, mentor: Pick<MentorFixture, "firstName">): Locator {
  return applicationForm(page).getByRole("checkbox", {
    name: new RegExp(`^I can make .*${escapeRegExp(mentor.firstName)}’s office-hours (window|time)$`),
  });
}

/** First-choice radio for a mentor (shown once two or more mentors are selected). */
export function firstChoiceRadio(page: Page, mentor: Pick<MentorFixture, "name">): Locator {
  return applicationForm(page).getByRole("group", { name: /^First choice/ }).getByRole("radio", { name: mentor.name, exact: true });
}

export function fullNameField(page: Page): Locator {
  return applicationForm(page).getByRole("textbox", { name: "Full name" });
}
export function emailField(page: Page): Locator {
  return applicationForm(page).getByRole("textbox", { name: "Illinois email" });
}
export function broadAvailabilityField(page: Page): Locator {
  return applicationForm(page).getByRole("textbox", { name: /^Broad availability/ });
}
export function workingOnField(page: Page): Locator {
  return applicationForm(page).getByRole("textbox", { name: /^What are you working on/ });
}
export function questionField(page: Page): Locator {
  return applicationForm(page).getByRole("textbox", { name: /^What question would you like help with/ });
}

/**
 * Tick a checkbox/radio the way a person does — by clicking its label. The application's inputs are
 * visually hidden (sr-only) behind drawn indicators, so the label is what's on screen.
 */
export async function tick(control: Locator): Promise<void> {
  if (await control.isChecked()) return;
  const id = await control.getAttribute("id");
  expect(id, "control needs an id for its <label for>").toBeTruthy();
  await control.page().locator(`label[for="${id}"]`).first().click();
  await expect(control).toBeChecked();
}

/** Clear a checkbox by clicking its label. */
export async function untick(control: Locator): Promise<void> {
  if (!(await control.isChecked())) return;
  const id = await control.getAttribute("id");
  expect(id, "control needs an id for its <label for>").toBeTruthy();
  await control.page().locator(`label[for="${id}"]`).first().click();
  await expect(control).not.toBeChecked();
}

export interface AboutYou {
  fullName: string;
  email: string;
  year?: string;
  major?: string;
}

export async function fillAboutYou(page: Page, about: AboutYou): Promise<void> {
  const form = applicationForm(page);
  await fullNameField(page).fill(about.fullName);
  await emailField(page).fill(about.email);
  await form.getByRole("combobox", { name: "Year" }).selectOption({ label: about.year ?? "Junior" });
  await form.getByRole("textbox", { name: "Major" }).fill(about.major ?? "Computer Engineering");
}

export const WORKING_ON = "A marketplace that helps student organizations split event costs.";
export const QUESTION = "How do I know whether anyone will pay for this before I build more?";
export const BROAD_AVAILABILITY = "Tuesday and Thursday afternoons; anytime Friday.";

export async function fillProject(page: Page): Promise<void> {
  const form = applicationForm(page);
  await tick(form.getByRole("radio", { name: /^Building\b/ }));
  await workingOnField(page).fill(WORKING_ON);
  await questionField(page).fill(QUESTION);
}

export async function fillConsents(page: Page): Promise<void> {
  const form = applicationForm(page);
  await tick(form.getByRole("checkbox", { name: /^I understand that applying doesn’t guarantee an appointment/ }));
  await tick(form.getByRole("checkbox", { name: /^I agree that Founders may share my relevant answers/ }));
}

export function submitButton(page: Page): Locator {
  return applicationForm(page).getByRole("button", { name: "Submit application" });
}

/** The confirmation that replaces the form once the server stored the application. */
export function confirmation(page: Page): Locator {
  return page.getByRole("region", { name: "Application received" });
}

/** The error summary shown after a submit with invalid answers. */
export function errorSummary(page: Page): Locator {
  return page.getByRole("alert").filter({ hasText: "Please fix the highlighted answers" });
}

/** The API's rule when a student gives neither a listed time nor broad availability. */
export const AVAILABILITY_RULE_MESSAGE =
  "Tell us when you’re generally free during Founders Week (or pick one of the listed times).";
/**
 * The first sentences of the "Broad availability" hint. The form adds "Not needed if you tick a time
 * above." when a chosen mentor has a listed time, or "Needed because <names>’s times aren’t set yet."
 * When none of the chosen mentors lists a time, it ends with SESSION_LENGTH_HINT.
 */
export const BROAD_AVAILABILITY_ASK = "When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday.";
/**
 * Shown when a chosen mentor's times aren't set yet (Vik, Elliott; never a mentor with a listed
 * window, like Ron or Rishab): only broad availability helps.
 */
export const pendingAvailabilityMessage = (names: string) =>
  `Tell us when you’re generally free during Founders Week. ${names}’s times aren’t set yet.`;

/** How a stored application with no listed time reads (organizer CSV and the availability filter). */
export const INTEREST_ONLY_LABEL = "Interest only (no time selected)";

// ---------------------------------------------------------------------------
// Information-only guard (Dan Caruso)
// ---------------------------------------------------------------------------

/** Words that would signal an application/booking flow. Dan Caruso's event must have none. */
export const CTA_WORDS =
  /\b(apply|applying|application|applications|express interest|interest form|wait-?list|book(ing)?|reserve|reservation|sign[\s-]?up|register|registration|rsvp|screening)\b/i;

/** No link or button that starts an application/interest/booking flow, and no such wording. */
export async function expectInformationOnly(scope: Locator): Promise<void> {
  for (const control of await scope.getByRole("link").all()) {
    const href = (await control.getAttribute("href")) ?? "";
    expect(href, "no link into the application").not.toMatch(/#apply|\/apply\b|[?&]mentor=/);
    expect((await control.innerText()).trim()).not.toMatch(CTA_WORDS);
  }
  for (const control of await scope.getByRole("button").all()) {
    expect((await control.innerText()).trim()).not.toMatch(CTA_WORDS);
  }
  await expect(scope.getByRole("form")).toHaveCount(0);
  await expect(scope.getByRole("textbox")).toHaveCount(0);
  expect(await visibleText(scope)).not.toMatch(CTA_WORDS);
}
