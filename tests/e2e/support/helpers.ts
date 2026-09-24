/**
 * Shared helpers for the end-to-end suite: the mentor fixtures the checklist names, unique test
 * data, the public application API, organizer sign-in/export, and form helpers.
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
  /** Verified role, or null when it must NOT be shown (Vik's title is unverified). */
  role: string | null;
  company: string;
  /** The single availability window a "window" CTA preselects, or null while scheduling. */
  windowId: string | null;
  /** CTA label on cards/panels. */
  cta: string;
}

export const PATRICK: MentorFixture = {
  id: "patrick-haddox",
  name: "Patrick Haddox",
  firstName: "Patrick",
  role: "CEO & Co-Founder",
  company: "Samara Aerospace",
  windowId: "patrick-haddox-2026-10-01-am",
  cta: "Apply to meet Patrick",
};
export const ARNAV: MentorFixture = {
  id: "arnav-mishra",
  name: "Arnav Mishra",
  firstName: "Arnav",
  role: "Co-Founder & CTO",
  company: "Doss",
  windowId: "arnav-mishra-2026-10-02-am",
  cta: "Apply to meet Arnav",
};
export const VIK: MentorFixture = {
  id: "vikram-lakhwara",
  name: "Vikram “Vik” Lakhwara",
  firstName: "Vik",
  role: null,
  company: "Stakehouse",
  windowId: null,
  cta: "Express interest",
};
export const RON: MentorFixture = {
  id: "ron-lewis",
  name: "Ron Lewis",
  firstName: "Ron",
  role: "Co-Founder",
  company: "Auctus Advisory",
  windowId: null,
  cta: "Express interest",
};

/** The four real mentors, in the published order. */
export const MENTORS: MentorFixture[] = [PATRICK, ARNAV, VIK, RON];

/** The capacity-1 demo slot used by the organizer capacity test (content/demo.ts). */
export const DEMO_SLOT_ID = "demo-avery-slot-1400";

/** Copy that must never be public: Ron's draft topics and organizer-only notes. */
export const DRAFT_TOPICS = ["Revenue strategy", "Startup financial planning", "Communicating business progress to stakeholders"];
export const ORGANIZER_ONLY = /commitments|Wednesday through Saturday|Willing to help|Verify title/i;

/** The canceled afterparty must not appear anywhere. */
export const AFTERPARTY = /after-?party|HERE Apartments/i;

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/** Marker shared by every email this suite creates (for scoped cleanup/searches). */
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
  workingOn?: string;
  question?: string;
}

export function applicationPayload(input: ApplicationInput) {
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
    availability: input.availability ?? [],
    availabilityNotes: "",
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
// Pages
// ---------------------------------------------------------------------------

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

/** The office-hours application form (the #apply section on /office-hours). */
export function applicationForm(page: Page): Locator {
  return page.getByRole("form", { name: "Apply for Office Hours" });
}

/** A mentor's checkbox in the application. */
export function mentorCheckbox(page: Page, mentor: Pick<MentorFixture, "name">): Locator {
  return applicationForm(page).getByRole("checkbox", { name: new RegExp(`^${escapeRegExp(mentor.name)}\\b`) });
}

/** The time checkboxes shown once a mentor with availability is selected. */
export function mentorTimes(page: Page, mentor: Pick<MentorFixture, "firstName">): Locator {
  return applicationForm(page)
    .getByRole("group", { name: new RegExp(`^When could you meet ${escapeRegExp(mentor.firstName)}\\?`) })
    .getByRole("checkbox");
}

export interface AboutYou {
  fullName: string;
  email: string;
  year?: string;
  major?: string;
}

export async function fillAboutYou(page: Page, about: AboutYou): Promise<void> {
  const form = applicationForm(page);
  await form.getByRole("textbox", { name: "Full name" }).fill(about.fullName);
  await form.getByRole("textbox", { name: "Illinois email" }).fill(about.email);
  await form.getByRole("combobox", { name: "Year" }).selectOption({ label: about.year ?? "Junior" });
  await form.getByRole("textbox", { name: "Major" }).fill(about.major ?? "Computer Engineering");
}

export const WORKING_ON = "A marketplace that helps student organizations split event costs.";
export const QUESTION = "How do I know whether anyone will pay for this before I build more?";

export async function fillProject(page: Page): Promise<void> {
  const form = applicationForm(page);
  await tick(form.getByRole("radio", { name: /^Building\b/ }));
  await form.getByRole("textbox", { name: "What are you working on or interested in exploring?" }).fill(WORKING_ON);
  await form.getByRole("textbox", { name: "What specific question or challenge would you like help with?" }).fill(QUESTION);
}

export async function fillConsents(page: Page): Promise<void> {
  const form = applicationForm(page);
  await tick(form.getByRole("checkbox", { name: /^I understand that applying doesn’t guarantee an appointment/ }));
  await tick(form.getByRole("checkbox", { name: /^I agree that Founders may share my relevant answers/ }));
}

/** Patrick (with his Thursday window) + Ron (interest only), Ron as first choice. */
export async function choosePatrickAndRonFirst(page: Page): Promise<void> {
  const form = applicationForm(page);
  await tick(mentorCheckbox(page, PATRICK));
  await tick(mentorTimes(page, PATRICK).first());
  await tick(mentorCheckbox(page, RON));
  await tick(form.getByRole("radio", { name: `${RON.name}: First choice` }));
}

export function submitButton(page: Page): Locator {
  return applicationForm(page).getByRole("button", { name: "Submit application" });
}

/** The public header's primary CTA — accessible name "Apply for Office Hours" at every width. */
export function headerApplyLink(page: Page): Locator {
  return page.getByRole("banner").getByRole("link", { name: "Apply for Office Hours", exact: true });
}

// ---------------------------------------------------------------------------
// Information-only guard (Dan Caruso)
// ---------------------------------------------------------------------------

/** Words that would signal an application/booking flow. Dan Caruso's event must have none. */
export const CTA_WORDS = /\b(apply|application|express interest|interest form|wait-?list|book(ing)?|reserve|screening)\b/i;

/** No link or button that starts an application/interest/booking flow, and no such wording. */
export async function expectInformationOnly(scope: Locator) {
  for (const control of await scope.getByRole("link").all()) {
    const href = (await control.getAttribute("href")) ?? "";
    expect(href, "no link into the application").not.toMatch(/#apply|\/apply\b|[?&]mentor=/);
    expect((await control.innerText()).trim()).not.toMatch(CTA_WORDS);
  }
  for (const control of await scope.getByRole("button").all()) {
    expect((await control.innerText()).trim()).not.toMatch(CTA_WORDS);
  }
  expect(await scope.innerText()).not.toMatch(CTA_WORDS);
}
