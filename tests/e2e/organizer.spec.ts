/**
 * Checklist 6 — the organizer view (/organizers) and /api/health.
 *   - Signed out: /organizers → the sign-in page, with the setup checklist visible;
 *     /api/organizer/export without a session cookie → 401.
 *   - Sign in; the application shaped like spec 4's (Elliott first — schedule pending — plus
 *     Patrick's window, with broad availability) is visible with its mentor preferences, the window
 *     and the broad availability.
 *   - Filters: mentor, first choice, status, "Interest only".
 *   - Capacity: the demo slot "demo-avery-slot-1400" (capacity 1) takes one appointment; a second is
 *     refused as full; confirming makes the application Confirmed.
 *   - CSV export (with the session) neutralizes a formula in an applicant's answer.
 *   - /api/health: JSON readiness checks, no applicant data or secrets.
 *
 * This spec creates its own applications through the public API (unique e2e-… emails), so it runs
 * on its own and against a non-empty database. Slot seats it takes are released afterwards.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_ORGANIZER_PASSWORD } from "./support/env";
import {
  createApplication,
  DEMO_SLOT_ID,
  E2E_EMAIL_MARKER,
  ELLIOTT,
  exportApplications,
  INTEREST_ONLY_LABEL,
  MENTORS,
  organizerLogin,
  ORGANIZER_NAME,
  PATRICK,
  RON,
  setApplicationStatus,
  storedApplicationsFor,
  uniqueEmail,
  waitForHydration,
  type CreatedApplication,
} from "./support/helpers";

test.describe.configure({ mode: "serial" });

/** Shared by this spec's applications, so a search finds exactly them. */
const MAJOR_TAG = `Organizer Studies ${Date.now().toString(36)}`;
const BROAD = "Thursdays after 3 PM; Friday mornings work too.";

let api: APIRequestContext;
let elliottAndPatrick: CreatedApplication; // Elliott first (pending) + Patrick's window + broad availability
let ronOnly: CreatedApplication; // pending mentor only, broad availability only
let seatHolder: CreatedApplication;
let seatSeeker: CreatedApplication;

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  await organizerLogin(api);

  // Against a reused database: release the demo seat from any earlier, interrupted e2e run.
  const { records } = await exportApplications(api, { q: E2E_EMAIL_MARKER });
  for (const r of records) {
    if (r.email.startsWith(E2E_EMAIL_MARKER) && /Avery Sample/.test(r.appointments) && r.status !== "Canceled") {
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
});

test.afterAll(async () => {
  // Free the capacity-1 demo seat for the next run (canceling cancels active appointments).
  for (const app of [seatHolder, seatSeeker]) if (app) await setApplicationStatus(api, app.id, "canceled");
  await api?.dispose();
});

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

test("demo slot capacity: one seat assigned, the next is blocked as full; confirming → Confirmed", async ({ page }) => {
  await signIn(page);

  // Seat holder: propose the capacity-1 demo slot.
  await page.goto(`/organizers/applications/${seatHolder.id}`);
  const slot = page.getByRole("combobox", { name: "Slot" });
  await waitForHydration(slot);
  await expect(slot.locator(`option[value="${DEMO_SLOT_ID}"]`)).toContainText("1 of 1 open");
  await slot.selectOption(DEMO_SLOT_ID);
  await page.getByRole("button", { name: "Propose appointment" }).click();
  const appointments = page.getByRole("region", { name: "Appointments", exact: true });
  await expect(appointments).toContainText("Proposed — awaiting confirmation");
  await expect(appointments).toContainText("Avery Sample");

  // Seat seeker: the slot is full — disabled in the form and refused by the API.
  await page.goto(`/organizers/applications/${seatSeeker.id}`);
  const fullOption = page.getByRole("combobox", { name: "Slot" }).locator(`option[value="${DEMO_SLOT_ID}"]`);
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
