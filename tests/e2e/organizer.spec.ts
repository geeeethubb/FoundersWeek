/**
 * Checklist 5 — the organizer view (/organizers).
 *   - Signed out: /organizers → sign-in; /api/organizer/export → 401.
 *   - Sign in, then find an application (Patrick + Ron, Ron first — the shape spec 3 submits) with
 *     its mentor preferences and availability.
 *   - Filters: mentor, first choice, status; "Interest only" shows the Ron-only application.
 *   - Demo slot capacity: "demo-avery-slot-1400" (capacity 1) is assigned to one application; a
 *     second is blocked as full; confirming the appointment makes the application Confirmed.
 *   - CSV export (with the session cookie) neutralizes a major that starts with "=".
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
  exportApplications,
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

let api: APIRequestContext;
let patrickAndRon: CreatedApplication; // Ron first + Patrick's Thursday window
let ronOnly: CreatedApplication; // interest only
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

  patrickAndRon = await createApplication(api, {
    fullName: "Morgan Organizer-Test",
    email: uniqueEmail("org-pr"),
    major: MAJOR_TAG,
    mentorIds: [RON.id, PATRICK.id],
    firstChoiceMentorId: RON.id,
    availability: [`window:${PATRICK.windowId}`],
  });
  ronOnly = await createApplication(api, {
    fullName: "Quinn Interest-Only",
    email: uniqueEmail("org-ron"),
    major: MAJOR_TAG,
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
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

async function applyFilters(page: Page, filters: { q?: string; mentor?: string; status?: string; availability?: string; firstChoiceOnly?: boolean }) {
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

test("signed out: the dashboard redirects to sign-in and the export API refuses", async ({ page, playwright }) => {
  await page.goto("/organizers");
  await expect(page).toHaveURL(/\/organizers\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organizer sign-in");

  await page.goto(`/organizers/applications/${patrickAndRon.id}`);
  await expect(page).toHaveURL(/\/organizers\/login\?next=/);

  const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  const exportRes = await anonymous.get("/api/organizer/export");
  expect(exportRes.status()).toBe(401);
  expect(exportRes.headers()["content-type"]).not.toContain("text/csv");
  const mutation = await anonymous.patch(`/api/organizer/applications/${patrickAndRon.id}`, {
    data: { status: "confirmed" },
    headers: { Origin: E2E_BASE_URL },
  });
  expect(mutation.status()).toBe(401);
  await anonymous.dispose();
});

test("sign in and see the application with mentor preferences and availability", async ({ page }) => {
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

  await applyFilters(page, { q: patrickAndRon.email });
  const row = resultRow(page, patrickAndRon.email);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(patrickAndRon.fullName);

  const cells = row.getByRole("cell");
  const preferences = cells.nth(1).getByRole("listitem");
  await expect(preferences).toHaveCount(2);
  await expect(preferences.nth(0)).toContainText(RON.name);
  await expect(preferences.nth(0)).toContainText("1st choice");
  await expect(preferences.nth(1)).toContainText(PATRICK.name);
  await expect(cells.nth(2)).toContainText(PATRICK.name);
  await expect(cells.nth(2)).toContainText("10:00–11:30");
  await expect(cells.nth(2)).toContainText("Availability window");
  await expect(cells.nth(3)).toContainText("Submitted");

  // The detail page tells the same story.
  await row.getByRole("link", { name: patrickAndRon.fullName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(patrickAndRon.fullName);
  const prefs = page.getByRole("region", { name: /Mentors & availability/ });
  await expect(prefs.getByRole("listitem").first()).toContainText(RON.name);
  await expect(prefs.getByRole("listitem").first()).toContainText("First choice");
  await expect(prefs).toContainText("Interest only");
  await expect(prefs).toContainText("10:00–11:30");
});

test("filter by mentor, first choice and status; Interest only shows the Ron-only application", async ({ page }) => {
  await signIn(page);
  await page.goto("/organizers");

  // Mentor: Ron (first choice only) + Submitted → both of this spec's tagged applications.
  await applyFilters(page, { q: MAJOR_TAG, mentor: RON.name, firstChoiceOnly: true, status: "Submitted" });
  await expect(page).toHaveURL(/mentor=ron-lewis/);
  await expect(page).toHaveURL(/choice=first/);
  await expect(page).toHaveURL(/status=submitted/);
  await expect(resultRow(page, patrickAndRon.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(1);

  // Mentor: Patrick, first choice only → neither (Ron is first choice on both).
  await applyFilters(page, { q: MAJOR_TAG, mentor: PATRICK.name, firstChoiceOnly: true });
  await expect(page.getByText("No applications match these filters")).toBeVisible();

  // Mentor: Patrick, any preference → only the Patrick + Ron application.
  await applyFilters(page, { q: MAJOR_TAG, mentor: PATRICK.name });
  await expect(resultRow(page, patrickAndRon.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(0);

  // Status: Confirmed → none of them.
  await applyFilters(page, { q: MAJOR_TAG, status: "Confirmed" });
  await expect(page.getByText("No applications match these filters")).toBeVisible();

  // Interest only — no time selected → the Ron-only application, not the one with Patrick's window.
  await applyFilters(page, { q: MAJOR_TAG, availability: "Interest only — no time selected" });
  await expect(page).toHaveURL(/availability=none/);
  await expect(resultRow(page, ronOnly.email)).toHaveCount(1);
  await expect(resultRow(page, ronOnly.email)).toContainText("Interest only");
  await expect(resultRow(page, patrickAndRon.email)).toHaveCount(0);

  // Dan Caruso's event is never a mentor filter.
  const mentorOptions = await page.getByRole("combobox", { name: "Mentor" }).locator("option").allInnerTexts();
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
  // Created through the public API with the site's Origin, like the browser form.
  const email = uniqueEmail("org-csv");
  await createApplication(api, {
    fullName: "Formula Tester",
    email,
    major: "=1+2",
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
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

  const [record] = await storedApplicationsFor(page.request, email);
  expect(record.major).toBe("'=1+2");
  expect(record.full_name).toBe("Formula Tester");
});
