/**
 * Checklist 6 — the organizer view (/organizers) and /api/health.
 *   - Signed out: /organizers → the sign-in page, with the setup checklist visible;
 *     /api/organizer/export without a session cookie → 401.
 *   - Sign in; the application shaped like spec 4's (Elliott first — schedule pending — plus
 *     Patrick's window, with broad availability) is visible with its mentor preferences, the window
 *     and the broad availability.
 *   - Filters: mentor, first choice, status, "Interest only".
 *   - Capacity: the demo slot "demo-avery-slot-1400" (capacity 1) takes one appointment; a second is
 *     refused as full; the same student can't also hold an overlapping session (Rishab's 2:00 PM);
 *     confirming makes the application Confirmed.
 *   - Every exact window is split into 25-minute sessions (5-minute breaks) on the Sessions board and
 *     in the assignment picker: Patrick 3, Arnav 3, Ron 4, Rishab 10; Vik and Elliott have none yet.
 *   - Sessions: students apply to Patrick's window (Thu, Oct 1, 10:00–11:30 AM); organizers see it
 *     split into three 25-minute sessions (10:00, 10:30, 11:00) with his "one or two sessions" note,
 *     assign one application to 10:00–10:25 AM CT (capacity 1: the next applicant can't have it),
 *     and the session shows on the dashboard, in the CSV and on the student's status page.
 *   - CSV export (with the session) neutralizes a formula in an applicant's answer.
 *   - /api/health: JSON readiness checks, no applicant data or secrets.
 *
 * This spec creates its own applications through the public API (unique e2e-… emails), so it runs
 * on its own and against a non-empty database. Slot seats it takes are released afterwards.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_ORGANIZER_PASSWORD } from "./support/env";
import {
  ARNAV,
  ARNAV_SESSIONS,
  createApplication,
  DEMO_SLOT_ID,
  E2E_EMAIL_MARKER,
  ELLIOTT,
  escapeRegExp,
  exportApplications,
  INTEREST_ONLY_LABEL,
  MENTORS,
  organizerLogin,
  ORGANIZER_NAME,
  PATRICK,
  PATRICK_SESSION_NOTE,
  PATRICK_SESSIONS,
  RISHAB,
  RISHAB_SESSIONS,
  RON,
  RON_SESSIONS,
  SESSION_RULE,
  setApplicationStatus,
  storedApplicationsFor,
  uniqueEmail,
  VIK,
  waitForHydration,
  type CreatedApplication,
  type MentorFixture,
  type SessionFixture,
} from "./support/helpers";

test.describe.configure({ mode: "serial" });

/** Shared by this spec's applications, so a search finds exactly them. */
const MAJOR_TAG = `Organizer Studies ${Date.now().toString(36)}`;
const BROAD = "Thursdays after 3 PM; Friday mornings work too.";

/** Rishab's generated 2:00–2:25 PM session: the same time as the demo slot, so it overlaps it. */
const RISHAB_1400_SESSION = RISHAB_SESSIONS[4].id;

/** CSV "appointments" text of an active hold on Patrick's first session (to release it after an interrupted run). */
const PATRICK_FIRST_SESSION_CSV = `${PATRICK.name}: ${PATRICK_SESSIONS[0].label}`;

let api: APIRequestContext;
let elliottAndPatrick: CreatedApplication; // Elliott first (pending) + Patrick's window + broad availability
let ronOnly: CreatedApplication; // Ron only, broad availability only (no time ticked)
let seatHolder: CreatedApplication;
let seatSeeker: CreatedApplication;
let patrickHolder: CreatedApplication; // Patrick's window → assigned his 10:00–10:25 AM session
let patrickSeeker: CreatedApplication; // Patrick's window → that session is full for them

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  await organizerLogin(api);

  // Against a reused database: release the seats this spec takes (the demo slot, Patrick's first
  // session) from any earlier, interrupted e2e run. Only e2e-… applications are touched.
  const { records } = await exportApplications(api, { q: E2E_EMAIL_MARKER });
  for (const r of records) {
    const holdsSeat = /Avery Sample/.test(r.appointments) || r.appointments.includes(PATRICK_FIRST_SESSION_CSV);
    if (r.email.startsWith(E2E_EMAIL_MARKER) && holdsSeat && r.status !== "Canceled") {
      await setApplicationStatus(api, r.id, "canceled");
    }
  }

  elliottAndPatrick = await createApplication(api, {
    fullName: "Morgan Organizer-Test",
    email: uniqueEmail("org-ep"),
    major: MAJOR_TAG,
    mentorIds: [ELLIOTT.id, PATRICK.id],
    firstChoiceMentorId: ELLIOTT.id,
    availability: [`window:${PATRICK.windowId}`],
    availabilityNotes: BROAD,
  });
  ronOnly = await createApplication(api, {
    fullName: "Quinn Broad-Only",
    email: uniqueEmail("org-ron"),
    major: MAJOR_TAG,
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
    availabilityNotes: BROAD,
  });
  seatHolder = await createApplication(api, {
    fullName: "Taylor Seat-Holder",
    email: uniqueEmail("org-seat-a"),
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
  });
  seatSeeker = await createApplication(api, {
    fullName: "Jamie Seat-Seeker",
    email: uniqueEmail("org-seat-b"),
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
  });
  // Students apply to Patrick's window, never to a session.
  patrickHolder = await createApplication(api, {
    fullName: "Avery Session-Holder",
    email: uniqueEmail("org-patrick-a"),
    mentorIds: [PATRICK.id],
    firstChoiceMentorId: PATRICK.id,
    availability: [`window:${PATRICK.windowId}`],
  });
  patrickSeeker = await createApplication(api, {
    fullName: "Blake Session-Seeker",
    email: uniqueEmail("org-patrick-b"),
    mentorIds: [PATRICK.id],
    firstChoiceMentorId: PATRICK.id,
    availability: [`window:${PATRICK.windowId}`],
  });
});

test.afterAll(async () => {
  // Free the capacity-1 seats for the next run (canceling cancels active appointments).
  for (const app of [seatHolder, seatSeeker, patrickHolder, patrickSeeker]) {
    if (app) await setApplicationStatus(api, app.id, "canceled");
  }
  await api?.dispose();
});

/** The organizer's session picker on an application page. */
function sessionPicker(page: Page) {
  return page.getByRole("combobox", { name: "Time slot", exact: true });
}

async function signIn(page: Page) {
  await organizerLogin(page.request);
}

async function applyFilters(
  page: Page,
  filters: { q?: string; mentor?: string; status?: string; availability?: string; firstChoiceOnly?: boolean },
) {
  const form = page.getByRole("search", { name: "Filter applications" });
  await form.getByRole("searchbox", { name: "Search" }).fill(filters.q ?? "");
  await form.getByRole("combobox", { name: "Mentor" }).selectOption({ label: filters.mentor ?? "All mentors" });
  await form.getByRole("combobox", { name: "Status" }).selectOption({ label: filters.status ?? "Any status" });
  await form.getByRole("combobox", { name: "Availability" }).selectOption({ label: filters.availability ?? "Any availability" });
  await form.getByRole("radio", { name: filters.firstChoiceOnly ? "First choice only" : "Any preference" }).check({ force: true });
  await form.getByRole("button", { name: "Apply filters" }).click();
  // The GET form navigates (then canonicalizes the query); wait until the URL carries these filters.
  await expect(page).toHaveURL((url) => {
    const sp = url.searchParams;
    return (
      url.pathname === "/organizers" &&
      (sp.get("q") ?? "") === (filters.q ?? "") &&
      (sp.get("status") ?? "") === (filters.status ? filters.status.toLowerCase().replace(/ /g, "_") : "") &&
      (sp.get("choice") === "first") === Boolean(filters.firstChoiceOnly && filters.mentor) &&
      sp.has("mentor") === Boolean(filters.mentor) &&
      sp.has("availability") === Boolean(filters.availability)
    );
  });
  await page.waitForLoadState("load");
}

/** Result rows (desktop table) for an email. */
function resultRow(page: Page, email: string) {
  return page.getByRole("table").getByRole("row").filter({ hasText: email });
}

test("signed out: /organizers → sign-in with the setup checklist; the export API refuses without a cookie", async ({
  page,
  playwright,
}) => {
  await page.goto("/organizers");
  await expect(page).toHaveURL(/\/organizers\/login(\?.*)?$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organizer sign-in");
  await expect(page.getByRole("region", { name: "Sign in", exact: true })).toBeVisible();

  // Deployment readiness is visible before sign-in (setting names and ok/not ok — never values).
  const setup = page.getByRole("region", { name: "Setup", exact: true });
  await expect(setup).toBeVisible();
  await expect(setup.getByRole("listitem")).toHaveCount(4);
  for (const title of ["Signing secret", "Application database", "Organizer password", "Applications switch"]) {
    await expect(setup).toContainText(title);
  }
  await expect(setup).toContainText("All 4 checks pass");
  await expect(page.locator("body")).not.toContainText(E2E_ORGANIZER_PASSWORD);

  await page.goto(`/organizers/applications/${elliottAndPatrick.id}`);
  await expect(page).toHaveURL(/\/organizers\/login\?next=/);

  const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  const exportRes = await anonymous.get("/api/organizer/export");
  expect(exportRes.status()).toBe(401);
  expect(exportRes.headers()["content-type"] ?? "").not.toContain("text/csv");
  expect(await exportRes.text()).not.toContain(elliottAndPatrick.email);
  const mutation = await anonymous.patch(`/api/organizer/applications/${elliottAndPatrick.id}`, {
    data: { status: "confirmed" },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(mutation.status()).toBe(401);
  await anonymous.dispose();
});

test("/api/health returns JSON readiness checks with no applicant data or secrets", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  const res = await anonymous.get("/api/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(res.headers()["cache-control"] ?? "").toContain("no-store");
  const raw = await res.text();
  const body = JSON.parse(raw) as {
    applications: string;
    build: string | null;
    checks: { key: string; ok: boolean; status: string; fix: string | null }[];
  };

  // Exactly these keys: readiness, which deployment answered (a public commit, null locally) and the checks.
  expect(Object.keys(body).sort()).toEqual(["applications", "build", "checks"]);
  expect(body.build === null || /^[0-9a-f]{7}$/.test(body.build), `build: ${body.build}`).toBe(true);
  expect(body.applications).toBe("open");
  expect(body.checks.map((c) => c.key).sort()).toEqual(["app-secret", "applications-switch", "database", "organizer-password"]);
  for (const check of body.checks) {
    expect(Object.keys(check).sort()).toEqual(["fix", "key", "ok", "status"]);
    expect(check.ok, `${check.key}: ${check.status}`).toBe(true);
  }

  // Nothing about applicants, and no secret values or connection details.
  for (const app of [elliottAndPatrick, ronOnly, seatHolder]) {
    expect(raw).not.toContain(app.email);
    expect(raw).not.toContain(app.fullName);
    expect(raw).not.toContain(app.id);
  }
  expect(raw).not.toMatch(/@illinois\.edu/i);
  expect(raw).not.toContain(MAJOR_TAG);
  expect(raw).not.toContain(BROAD);
  expect(raw).not.toContain(E2E_ORGANIZER_PASSWORD);
  expect(raw).not.toContain("e2e-only-app-secret");
  expect(raw).not.toMatch(/postgres(ql)?:\/\/|pglite:|\.data[\\/]/i);
  await anonymous.dispose();
});

test("sign in; the application shows its mentor preferences, the window and the broad availability", async ({ page }) => {
  await page.goto("/organizers/login");
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await waitForHydration(signInButton);
  await page.getByRole("textbox", { name: "Your name" }).fill(ORGANIZER_NAME);

  // A wrong password is refused.
  await page.getByRole("textbox", { name: "Organizer password" }).fill("not-the-password");
  await signInButton.click();
  await expect(page.getByRole("region", { name: "Sign in" }).getByRole("alert")).toContainText("That password isn’t right.");

  await page.getByRole("textbox", { name: "Organizer password" }).fill(E2E_ORGANIZER_PASSWORD);
  await signInButton.click();
  await expect(page).toHaveURL(/\/organizers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Applications");

  await applyFilters(page, { q: elliottAndPatrick.email });
  const row = resultRow(page, elliottAndPatrick.email);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(elliottAndPatrick.fullName);

  const cells = row.getByRole("cell");
  const preferences = cells.nth(1).getByRole("listitem");
  await expect(preferences).toHaveCount(2);
  await expect(preferences.nth(0)).toContainText(ELLIOTT.name);
  await expect(preferences.nth(0)).toContainText("1st choice");
  await expect(preferences.nth(1)).toContainText(PATRICK.name);
  await expect(cells.nth(2)).toContainText(PATRICK.name);
  await expect(cells.nth(2)).toContainText("10:00–11:30");
  await expect(cells.nth(3)).toContainText("Submitted");

  // The detail page tells the whole story, broad availability included.
  await row.getByRole("link", { name: elliottAndPatrick.fullName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(elliottAndPatrick.fullName);
  const prefs = page.getByRole("region", { name: /Mentors & availability/ });
  const first = prefs.getByRole("listitem").first();
  await expect(first).toContainText(ELLIOTT.name);
  await expect(first).toContainText("First choice");
  await expect(first).toContainText("Interest only");
  await expect(prefs.getByRole("listitem").filter({ hasText: PATRICK.name }).first()).toContainText("10:00–11:30");
  await expect(prefs).toContainText("Availability notes");
  await expect(prefs).toContainText(BROAD);
});

test("filters: mentor, first choice, status and Interest only", async ({ page }) => {
  await signIn(page);
  await page.goto("/organizers");

  // Elliott, first choice only → the Elliott + Patrick application (Ron is first on the other).
  await applyFilters(page, { q: MAJOR_TAG, mentor: ELLIOTT.name, firstChoiceOnly: true, status: "Submitted" });
  await expect(page).toHaveURL(/mentor=elliott-notrica/);
  await expect(page).toHaveURL(/choice=first/);
  await expect(page).toHaveURL(/status=submitted/);
  await expect(resultRow(page, elliottAndPatrick.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(0);

  // Patrick, first choice only → none; any preference → the Elliott + Patrick application.
  await applyFilters(page, { q: MAJOR_TAG, mentor: PATRICK.name, firstChoiceOnly: true });
  await expect(page.getByText("No applications match these filters")).toBeVisible();
  await applyFilters(page, { q: MAJOR_TAG, mentor: PATRICK.name });
  await expect(resultRow(page, elliottAndPatrick.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(0);

  // Status: Confirmed → none of them.
  await applyFilters(page, { q: MAJOR_TAG, status: "Confirmed" });
  await expect(page.getByText("No applications match these filters")).toBeVisible();

  // Interest only (no time selected) → the broad-availability-only application.
  await applyFilters(page, { q: MAJOR_TAG, availability: INTEREST_ONLY_LABEL });
  await expect(page).toHaveURL(/availability=none/);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toContainText("Interest only");
  await expect(resultRow(page, elliottAndPatrick.email)).toHaveCount(0);

  // Every real mentor is a filter option, in the published order; Dan Caruso's event never is.
  const mentorOptions = (await page.getByRole("combobox", { name: "Mentor" }).locator("option").allTextContents()).map((t) =>
    t.trim(),
  );
  expect(mentorOptions.slice(0, MENTORS.length + 1)).toEqual(["All mentors", ...MENTORS.map((m) => m.name)]);
  expect(mentorOptions.join(" ")).not.toMatch(/Caruso/);
});

test("demo slot capacity: one seat assigned, the next is blocked as full; no overlapping session; confirming → Confirmed", async ({
  page,
}) => {
  await signIn(page);

  // Seat holder: propose the capacity-1 demo slot (an explicit content slot, so it says Confirmed).
  await page.goto(`/organizers/applications/${seatHolder.id}`);
  const slot = sessionPicker(page);
  await waitForHydration(slot);
  await expect(slot.locator(`option[value="${DEMO_SLOT_ID}"]`)).toHaveText("Thu, Oct 1 · 2:00–2:25 PM CT · Confirmed · 1 of 1 open");
  await slot.selectOption(DEMO_SLOT_ID);
  await page.getByRole("button", { name: "Propose appointment" }).click();
  const appointments = page.getByRole("region", { name: "Appointments", exact: true });
  await expect(appointments).toContainText("Proposed, awaiting confirmation");
  await expect(appointments).toContainText("Avery Sample");
  await expect(appointments).toContainText("Thu, Oct 1 · 2:00–2:25 PM CT");

  // The same student can't hold an overlapping session: Rishab's 2:00–2:25 PM is off for them…
  await page.goto(`/organizers/applications/${seatHolder.id}`);
  const overlapping = sessionPicker(page).locator(`option[value="${RISHAB_1400_SESSION}"]`);
  await expect(overlapping).toBeDisabled();
  await expect(overlapping).toHaveText("Thu, Oct 1 · 2:00–2:25 PM CT · Overlaps another appointment");
  await expect(sessionPicker(page).locator(`option[value="${DEMO_SLOT_ID}"]`)).toContainText("Already assigned");
  // …and the API refuses it too.
  const clash = await page.request.post("/api/organizer/appointments", {
    data: { applicationId: seatHolder.id, slotId: RISHAB_1400_SESSION },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(clash.status()).toBe(409);
  expect((await clash.json()).message).toBe(
    `${seatHolder.fullName} already has an appointment at an overlapping time (Thu, Oct 1 · 2:00–2:25 PM CT with Avery Sample).`,
  );

  // Seat seeker: the slot is full, so it's disabled in the form and refused by the API.
  await page.goto(`/organizers/applications/${seatSeeker.id}`);
  const fullOption = sessionPicker(page).locator(`option[value="${DEMO_SLOT_ID}"]`);
  await expect(fullOption).toBeDisabled();
  await expect(fullOption).toContainText("Full (1/1)");
  const refused = await page.request.post("/api/organizer/appointments", {
    data: { applicationId: seatSeeker.id, slotId: DEMO_SLOT_ID },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).message).toMatch(/full/i);

  // Confirm the seat holder's appointment → application Confirmed.
  await page.goto(`/organizers/applications/${seatHolder.id}`);
  const confirm = page.getByRole("region", { name: "Appointments", exact: true }).getByRole("button", { name: "Confirm" });
  await waitForHydration(confirm);
  await confirm.click();
  await expect(page.getByRole("combobox", { name: "Application status" })).toHaveValue("confirmed");
  await expect(page.getByRole("region", { name: "Appointments", exact: true }).getByText("Confirmed", { exact: true })).toBeVisible();

  // The student's private status page shows it too.
  await page.goto(seatHolder.statusUrl);
  await expect(page.getByRole("region", { name: "Current status" })).toContainText("Confirmed");
  await expect(page.getByRole("region", { name: "Appointments" })).toContainText("with Avery Sample");
  await expect(page.getByRole("region", { name: "Appointments" })).toContainText("2:00–2:25 PM CT");
});

test("every window as 25-minute sessions: Patrick 3, Rishab 10, Ron 4, Arnav 3; Vik and Elliott have none yet", async ({
  page,
}) => {
  await signIn(page);
  const grids: { mentor: MentorFixture; window: string; sessions: SessionFixture[] }[] = [
    { mentor: PATRICK, window: "Thu, Oct 1 · 10:00–11:30 AM CT", sessions: PATRICK_SESSIONS },
    { mentor: ARNAV, window: "Fri, Oct 2 · 10:00–11:30 AM CT", sessions: ARNAV_SESSIONS },
    { mentor: RON, window: "Thu, Oct 1 · 2:30–4:30 PM CT", sessions: RON_SESSIONS },
    { mentor: RISHAB, window: "Thu, Oct 1 · 12:00–5:00 PM CT", sessions: RISHAB_SESSIONS },
  ];
  expect(grids.map((g) => g.sessions.length)).toEqual([3, 3, 4, 10]);

  // The dashboard's Sessions board: the rule, then each mentor's window split on the 25 + 5 grid.
  await page.goto("/organizers");
  const board = page.getByRole("region", { name: "Sessions", exact: true });
  await expect(board).toContainText(`${SESSION_RULE} One application (a student or a team) per session.`);
  for (const { mentor, window, sessions } of grids) {
    const section = board.getByRole("region", { name: mentor.name, exact: true });
    await expect(section).toHaveCount(1);
    await expect(section).toContainText(new RegExp(`(?<!\\d)\\d+ of ${sessions.length} sessions booked`));
    await expect(section).toContainText(`${window} window · ${sessions.length} sessions`);
    const rows = section.getByRole("listitem").filter({ hasText: /^(Thu, Oct 1|Fri, Oct 2) · / });
    expect(
      await rows.evaluateAll((els) => els.map((el) => (el.querySelector("p") as HTMLElement | null)?.innerText.trim() ?? "")),
      `${mentor.name}: sessions in time order`,
    ).toEqual(sessions.map((s) => s.label));
    // One application per session.
    for (const row of await rows.all()) await expect(row).toContainText(/(?<!\d)[01]\/1 seat\b/);
    // Only Patrick agreed to fewer sessions than his window fits.
    if (mentor === PATRICK) await expect(section).toContainText(PATRICK_SESSION_NOTE);
    else await expect(section).not.toContainText("Only book as many as");
  }
  for (const mentor of [VIK, ELLIOTT]) await expect(board.getByRole("region", { name: mentor.name, exact: true })).toHaveCount(0);

  // An application for Ron (broad availability only): his four sessions come first, as his
  // first choice, and the first one is preselected. Vik and Elliott have nothing to assign yet.
  await page.goto(`/organizers/applications/${ronOnly.id}`);
  const picker = sessionPicker(page);
  await waitForHydration(picker);
  const groupLabels = await picker.locator("optgroup").evaluateAll((gs) => gs.map((g) => g.getAttribute("label") ?? ""));
  expect(groupLabels.slice(0, 4)).toEqual([
    `${RON.name} · 1st choice`,
    `${PATRICK.name} · not requested`,
    `${ARNAV.name} · not requested`,
    `${RISHAB.name} · not requested`,
  ]);
  expect(groupLabels.join(" | ")).not.toMatch(new RegExp(`${escapeRegExp(VIK.firstName)}|${escapeRegExp(ELLIOTT.name)}`));
  const ronGroup = picker.locator("optgroup").first();
  expect(await ronGroup.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(
    RON_SESSIONS.map((s) => s.id),
  );
  await expect(ronGroup.locator("option")).toHaveText(RON_SESSIONS.map((s) => `${s.label} · 1 of 1 open`));
  await expect(picker).toHaveValue(RON_SESSIONS[0].id);
  await expect(page.getByRole("region", { name: "Appointments", exact: true })).not.toContainText("Only book as many as");
});

test("Patrick's window as 25-minute sessions: 10:00–10:25 AM CT goes to one application (capacity 1); confirming → Confirmed", async ({
  page,
}) => {
  await signIn(page);
  const [first, second, third] = PATRICK_SESSIONS;

  // The application page: the session rule, then Patrick's window split into exactly three
  // 25-minute sessions with a 5-minute break, each seating one application.
  await page.goto(`/organizers/applications/${patrickHolder.id}`);
  const picker = sessionPicker(page);
  await waitForHydration(picker);
  await expect(picker).toHaveAccessibleDescription(new RegExp(`^${SESSION_RULE.replace(/[.]/g, "\\.")} One application \\(a student or a team\\) per session\\.`));
  const patrickGroup = picker.locator("optgroup").filter({ has: page.locator(`option[value="${first.id}"]`) });
  await expect(patrickGroup).toHaveAttribute("label", `${PATRICK.name} · 1st choice`);
  await expect(patrickGroup.locator("option")).toHaveText(PATRICK_SESSIONS.map((s) => `${s.label} · 1 of 1 open`));
  expect(await patrickGroup.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(
    PATRICK_SESSIONS.map((s) => s.id),
  );
  // Nothing is scheduled yet, so the first open session of the student's first choice is preselected,
  // with Patrick's "one or two sessions" note for organizers.
  await expect(picker).toHaveValue(first.id);
  const assign = page.getByRole("region", { name: "Appointments", exact: true });
  await expect(assign).toContainText(`${PATRICK_SESSION_NOTE} Booked so far: 0.`);

  await picker.selectOption(first.id);
  await assign.getByRole("button", { name: "Propose appointment" }).click();
  await expect(assign).toContainText(`Proposed ${first.label}.`);
  await expect(assign).toContainText("Proposed, awaiting confirmation");
  await expect(assign).toContainText(PATRICK.name);
  await expect(assign).toContainText(first.label);

  // Stored as a 25-minute appointment inside the window.
  const [held] = await storedApplicationsFor(page.request, patrickHolder.email);
  expect(held.appointments).toBe(`${PATRICK.name}: ${first.label} (proposed)`);
  // Proposing moves a new application to "Selected".
  expect(held.status).toBe("Selected, awaiting confirmation");

  // Next applicant: 10:00 is full (capacity 1), in the form and in the API; 10:30 is the first open
  // session now, and the note counts the booked one.
  await page.goto(`/organizers/applications/${patrickSeeker.id}`);
  const seekerPicker = sessionPicker(page);
  await waitForHydration(seekerPicker);
  const seekerGroup = seekerPicker.locator("optgroup").filter({ has: page.locator(`option[value="${first.id}"]`) });
  await expect(seekerGroup.locator("option")).toHaveText([
    `${first.label} · Full (1/1)`,
    `${second.label} · 1 of 1 open`,
    `${third.label} · 1 of 1 open`,
  ]);
  await expect(seekerPicker.locator(`option[value="${first.id}"]`)).toBeDisabled();
  await expect(seekerPicker).toHaveValue(second.id);
  await expect(page.getByRole("region", { name: "Appointments", exact: true })).toContainText(
    `${PATRICK_SESSION_NOTE} Booked so far: 1.`,
  );
  const refused = await page.request.post("/api/organizer/appointments", {
    data: { applicationId: patrickSeeker.id, slotId: first.id },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).message).toBe("This slot is full (1/1).");
  expect((await storedApplicationsFor(page.request, patrickSeeker.email))[0].appointments).toBe("");

  // The dashboard's Sessions board: Patrick's three sessions, the note, and who holds 10:00.
  await page.goto("/organizers");
  const board = page.getByRole("region", { name: "Sessions", exact: true });
  const patrickBoard = board.getByRole("region", { name: PATRICK.name, exact: true });
  await expect(patrickBoard).toContainText(`${PATRICK_SESSION_NOTE} Booked so far:`);
  await expect(patrickBoard).toContainText("Thu, Oct 1 · 10:00–11:30 AM CT window · 3 sessions");
  const rows = patrickBoard.getByRole("listitem").filter({ hasText: /^Thu, Oct 1 · / });
  await expect(rows).toHaveCount(3);
  const firstRow = rows.filter({ hasText: first.label });
  await expect(firstRow.getByRole("link", { name: patrickHolder.fullName })).toHaveAttribute(
    "href",
    `/organizers/applications/${patrickHolder.id}`,
  );
  await expect(firstRow).toContainText("1/1 seat");
  await expect(firstRow).toContainText("Full");

  // Confirm it: the application is Confirmed, and the student's status page shows the session.
  await page.goto(`/organizers/applications/${patrickHolder.id}`);
  const confirm = page.getByRole("region", { name: "Appointments", exact: true }).getByRole("button", { name: "Confirm" });
  await waitForHydration(confirm);
  await confirm.click();
  await expect(page.getByRole("combobox", { name: "Application status" })).toHaveValue("confirmed");
  const [confirmed] = await storedApplicationsFor(page.request, patrickHolder.email);
  expect(confirmed.status).toBe("Confirmed");
  expect(confirmed.appointments).toBe(`${PATRICK.name}: ${first.label} (confirmed)`);

  await page.goto(patrickHolder.statusUrl);
  await expect(page.getByRole("region", { name: "Current status" })).toContainText("Confirmed");
  const studentView = page.getByRole("region", { name: "Appointments" });
  await expect(studentView).toContainText(`with ${PATRICK.name}`);
  await expect(studentView).toContainText(first.time);
});

test("CSV export (signed in) neutralizes a formula in an applicant's major", async ({ page, playwright }) => {
  const email = uniqueEmail("org-csv");
  await createApplication(api, {
    fullName: "Formula Tester",
    email,
    major: "=1+2",
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
    availabilityNotes: "=HYPERLINK(\"https://evil.example\")",
  });

  // A cross-site Origin is refused by the public API.
  const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  const crossSite = await anonymous.post("/api/applications", {
    data: { email: uniqueEmail("org-csrf") },
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
  });
  expect(crossSite.status()).toBe(403);
  await anonymous.dispose();

  await signIn(page);
  const res = await page.request.get(`/api/organizer/export?q=${encodeURIComponent(email)}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="founders-week-applications-\d{4}-\d{2}-\d{2}\.csv"/);
  const raw = await res.text();
  expect(raw).toContain(",'=1+2,");
  expect(raw).not.toMatch(/(^|,)=1\+2(,|\r?$)/m);
  expect(raw).not.toMatch(/(^|,)"?=HYPERLINK/m);

  const [record] = await storedApplicationsFor(page.request, email);
  expect(record.major).toBe("'=1+2");
  expect(record.availability_notes.startsWith("'=HYPERLINK")).toBe(true);
  expect(record.full_name).toBe("Formula Tester");
});
