/**
 * Checklist 4 — the office-hours application (/office-hours#apply).
 *   - A pending mentor (Vik) can be applied to with broad availability only; the confirmation and
 *     status page say sessions are 25 minutes and nothing is booked yet.
 *   - The availability rule: neither a listed window nor broad availability → an error; either one
 *     is enough, unless a chosen mentor's times aren't set yet (only Vik now): then broad
 *     availability is required, naming only him (never Elliott, Ron or Rishab, whose windows are set).
 *   - Rishab: "I can make Thu, Oct 1, 12:00–5:00 PM CT"; Ron: "I can make Thu, Oct 1, 2:30–4:30 PM
 *     CT". Like Patrick's window, ticking either is enough on its own.
 *   - Elliott: three windows (Wed, Sep 30, 9:00 AM–12:00 PM and 2:00–5:00 PM CT; Thu, Oct 1,
 *     12:00–5:00 PM CT), none preselected; ticking any one of them is enough on its own.
 *   - A retried (replayed) submission confirms "already received" without repeating the answers.
 *   - Unticking what a link preselected clears ?mentor/window from the URL; #apply only scrolls.
 *   - Validation: empty submit → focused error summary; non-Illinois email; answers over 100 words.
 *   - Success → confirmation + private status link → status page "Submitted".
 *   - A forced 500 keeps every answer and the retry stores exactly ONE application (organizer export).
 *   - Double-clicking submit stores one application.
 *   - Mentor selections survive (a) same-page Select actions after typing answers, (b) visiting a
 *     profile and coming back, (c) validation errors.
 *   - /apply?mentor=vikram-lakhwara → the form with Vik checked; /apply?mentor=elliott-notrica → Elliott
 *     checked, his three windows listed and none ticked.
 *
 * The API rejects submissions made within 3 s of the form loading (anti-spam), so these tests run
 * on a Playwright clock and fast-forward it before submitting — no real waiting.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_BASE_URL } from "./support/env";
import {
  applicationForm,
  applicationHeading,
  applySection,
  ARNAV,
  AVAILABILITY_RULE_MESSAGE,
  pendingAvailabilityMessage,
  BROAD_AVAILABILITY,
  BROAD_AVAILABILITY_ASK,
  broadAvailabilityField,
  confirmation,
  ELLIOTT,
  ELLIOTT_WINDOWS,
  emailField,
  errorSummary,
  expectClearOfHeader,
  fillAboutYou,
  fillConsents,
  fillProject,
  firstChoiceRadio,
  fullNameField,
  INTEREST_ONLY_LABEL,
  MENTORS,
  mentorCheckbox,
  mentorWindows,
  organizerLogin,
  PATRICK,
  PENDING_MENTORS,
  preselectionNotice,
  QUESTION,
  questionField,
  RISHAB,
  RON,
  SESSION_LENGTH_HINT,
  storedApplicationsFor,
  submitButton,
  tick,
  untick,
  uniqueEmail,
  VIK,
  waitForHydration,
  WINDOW_MENTORS,
  WORKING_ON,
  workingOnField,
} from "./support/helpers";

let organizer: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  organizer = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  await organizerLogin(organizer);
});

test.afterAll(async () => {
  await organizer?.dispose();
});

/** Open the application on a controllable clock and wait until it's interactive. */
async function openApplication(page: Page, path = "/office-hours#apply") {
  await page.clock.install();
  await page.goto(path);
  await waitForHydration(submitButton(page));
}

/** Move the page clock past the API's minimum fill time. */
async function passMinimumFillTime(page: Page) {
  await page.clock.fastForward(5_000);
}

function isApplicationPost(url: string, method: string) {
  return new URL(url).pathname === "/api/applications" && method === "POST";
}

/** Count application POSTs that leave the browser from now on. */
function countApplicationPosts(page: Page): { readonly count: number } {
  const counter = { count: 0 };
  page.on("request", (r) => {
    if (isApplicationPost(r.url(), r.method())) counter.count += 1;
  });
  return counter;
}

async function submitAndExpect201(page: Page) {
  const response = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
  await submitButton(page).click();
  const res = await response;
  expect(res.status(), await res.text()).toBe(201);
  await expect(confirmation(page)).toBeVisible();
}

/** A mentor's "Select mentor" action on the /office-hours grid. */
function selectMentorAction(page: Page, mentor: Pick<(typeof MENTORS)[number], "name">) {
  return page
    .getByRole("region", { name: "Who you can meet" })
    .getByRole("article", { name: mentor.name, exact: true })
    .getByRole("link", { name: /^Select mentor/ });
}

test.describe("Validation", () => {
  test("empty submit shows a focused error summary; each link reaches its field", async ({ page }) => {
    await openApplication(page);
    const posts = countApplicationPosts(page);
    await submitButton(page).click();

    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    for (const message of [
      "Choose at least one mentor.",
      "Enter your full name.",
      "Enter your Illinois email.",
      "Choose your year.",
      "Tell us what you’re working on or interested in exploring.",
      AVAILABILITY_RULE_MESSAGE,
    ]) {
      await expect(summary.getByRole("link", { name: message })).toBeVisible();
    }

    await summary.getByRole("link", { name: "Enter your full name." }).click();
    await expect(fullNameField(page)).toBeFocused();
    await summary.getByRole("link", { name: AVAILABILITY_RULE_MESSAGE }).click();
    await expect(broadAvailabilityField(page)).toBeFocused();
    await expect(confirmation(page)).toHaveCount(0);
    expect(posts.count, "nothing is sent while answers are invalid").toBe(0);
  });

  test("the availability rule: neither a window nor broad availability is an error; either one is enough", async ({ page }) => {
    await openApplication(page);
    const posts = countApplicationPosts(page);
    await fillAboutYou(page, { fullName: "Avery Rule", email: uniqueEmail("apply-rule") });
    await fillProject(page);
    await fillConsents(page);
    // Patrick has a published window; leave it unticked and say nothing about availability.
    await tick(mentorCheckbox(page, PATRICK));
    await expect(mentorWindows(page, PATRICK)).toHaveCount(1);
    await expect(mentorWindows(page, PATRICK)).not.toBeChecked();
    await passMinimumFillTime(page);
    await submitButton(page).click();

    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText([AVAILABILITY_RULE_MESSAGE]);
    await expect(broadAvailabilityField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).toContainText(AVAILABILITY_RULE_MESSAGE);
    expect(posts.count).toBe(0);

    // A listed window is enough…
    await tick(mentorWindows(page, PATRICK));
    await expect(broadAvailabilityField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);

    // …but not for a mentor whose schedule is pending: adding Vik asks for broad availability,
    // naming him, even with Patrick's window ticked.
    const vikMessage = pendingAvailabilityMessage("Vik");
    await tick(mentorCheckbox(page, VIK));
    await expect(mentorWindows(page, VIK)).toHaveCount(0);
    await expect(applicationForm(page)).toContainText(vikMessage);
    await untick(mentorCheckbox(page, PATRICK));
    await expect(applicationForm(page)).toContainText(vikMessage);
    // Broad availability is enough — the only option for a mentor whose schedule is pending.
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await expect(applicationForm(page)).not.toContainText(vikMessage);
    await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);
    await expect(broadAvailabilityField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("all six mentors: only Vik needs broad availability; Elliott’s, Ron’s and Rishab’s windows count like Patrick’s", async ({
    page,
  }) => {
    await openApplication(page);
    const posts = countApplicationPosts(page);
    await fillAboutYou(page, { fullName: "Dana Everyone", email: uniqueEmail("apply-six") });
    await fillProject(page);
    await fillConsents(page);
    for (const mentor of MENTORS) await tick(mentorCheckbox(page, mentor));
    await tick(firstChoiceRadio(page, RISHAB));
    // Patrick, Arnav, Ron and Rishab each offer one window and Elliott three; Vik has none yet.
    expect(WINDOW_MENTORS.map((m) => m.firstName)).toEqual(["Patrick", "Arnav", "Elliott", "Ron", "Rishab"]);
    for (const mentor of MENTORS) {
      await expect(mentorWindows(page, mentor), `${mentor.name}: listed times`).toHaveCount(mentor.windowIds.length);
    }
    await expect(mentorWindows(page, ELLIOTT)).toHaveCount(3);
    await tick(mentorWindows(page, RISHAB));

    // The hint names only the mentor whose times aren't set yet: Vik (never Elliott, Ron or Rishab).
    const pendingNames = "Vik";
    expect(PENDING_MENTORS.map((m) => m.firstName)).toEqual(["Vik"]);
    const broad = broadAvailabilityField(page);
    await expect(broad).toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Needed because ${pendingNames}’s times aren’t set yet.`);

    await passMinimumFillTime(page);
    await submitButton(page).click();
    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText([pendingAvailabilityMessage(pendingNames)]);
    await expect(broad).toHaveAttribute("aria-invalid", "true");
    await expect(mentorWindows(page, RISHAB)).toBeChecked();
    expect(posts.count, "nothing is sent while broad availability is missing").toBe(0);

    // Without Vik, Rishab's ticked window is enough on its own: the error clears.
    for (const mentor of PENDING_MENTORS) await untick(mentorCheckbox(page, mentor));
    await expect(applicationForm(page)).not.toContainText("times aren’t set yet");
    await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);
    await expect(broad).not.toHaveAttribute("aria-invalid", "true");
    await expect(broad).not.toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Not needed if you tick a time above.`);
    await expect(firstChoiceRadio(page, RISHAB)).toBeChecked();
  });

  test("a non-Illinois email is rejected", async ({ page }) => {
    await openApplication(page);
    const email = emailField(page);
    await email.fill("someone@gmail.com");
    await email.blur();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).toContainText("Use your Illinois email (ending in @illinois.edu).");

    await email.fill("netid@illinois.edu");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("answers over 100 words are flagged", async ({ page }) => {
    await openApplication(page);
    const answer = workingOnField(page);
    await answer.fill(Array.from({ length: 101 }, (_, i) => `word${i + 1}`).join(" "));
    await answer.blur();
    await expect(applicationForm(page)).toContainText("101 / 100 words");
    await expect(answer).toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).toContainText("Keep this to 100 words or fewer.");

    await answer.fill(Array.from({ length: 100 }, (_, i) => `word${i + 1}`).join(" "));
    await expect(applicationForm(page)).toContainText("100 / 100 words");
    await expect(answer).not.toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("Submitting", () => {
  test("a pending mentor (Vik) and Elliott, broad availability only → confirmation, status link, “Submitted”", async ({
    page,
  }) => {
    const email = uniqueEmail("apply-pending");
    await openApplication(page);

    // Vik has no listed times: broad availability is how a student says when they're free, and the
    // hint says how long a session is.
    await tick(mentorCheckbox(page, VIK));
    await expect(mentorWindows(page, VIK)).toHaveCount(0);
    await expect(broadAvailabilityField(page)).toHaveAccessibleDescription(
      `${BROAD_AVAILABILITY_ASK} Needed because Vik’s times aren’t set yet. ${SESSION_LENGTH_HINT}`,
    );
    // Adding Elliott lists his three windows (ticking one is optional); Vik still needs broad availability.
    await tick(mentorCheckbox(page, ELLIOTT));
    await expect(mentorWindows(page, ELLIOTT)).toHaveCount(3);
    await expect(broadAvailabilityField(page)).toHaveAccessibleDescription(
      `${BROAD_AVAILABILITY_ASK} Needed because Vik’s times aren’t set yet.`,
    );
    await tick(firstChoiceRadio(page, ELLIOTT));
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await fillAboutYou(page, { fullName: "Riley Tester", email });
    await fillProject(page);
    await fillConsents(page);

    await passMinimumFillTime(page);
    await submitAndExpect201(page);

    const received = confirmation(page);
    await expect(received).toContainText("This is an application, not a confirmed appointment.");
    await expect(received).toContainText(email);
    await expect(received).toContainText(
      `if you’re matched, Founders will email ${email} with a specific time for a 25-minute session. Nothing is booked until you confirm.`,
    );
    await expect(page.getByRole("textbox", { name: "Private status link" })).toHaveValue(/\/apply\/status\/[^/]+$/);

    await received.getByRole("link", { name: "Open your status page" }).click();
    await expect(page).toHaveURL(/\/apply\/status\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Riley.");
    const current = page.getByRole("region", { name: "Current status" });
    await expect(current).toContainText("Submitted");
    await expect(current).toContainText("No appointment yet. If you’re matched, your 25-minute session will show up here.");
    const chosen = page.getByRole("region", { name: "Mentors you chose" }).getByRole("listitem");
    await expect(chosen).toHaveCount(2);
    await expect(chosen.first()).toContainText(ELLIOTT.name);
    await expect(chosen.first()).toContainText("First choice");

    // Stored exactly once: Elliott first, no listed time, the broad availability kept verbatim.
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("Submitted");
    expect(stored[0].first_choice).toBe(ELLIOTT.name);
    expect(stored[0].preferred_mentors.startsWith(`1. ${ELLIOTT.name}`)).toBe(true);
    for (const mentor of [VIK, ELLIOTT]) expect(stored[0].preferred_mentors).toContain(mentor.name);
    expect(stored[0].availability).toBe(INTEREST_ONLY_LABEL);
    expect(stored[0].availability_notes).toBe(BROAD_AVAILABILITY);
  });

  test("Rishab: his Thu, Oct 1 window (12:00–5:00 PM CT) is enough on its own → stored without broad availability", async ({
    page,
  }) => {
    const email = uniqueEmail("apply-rishab");
    await openApplication(page, `/office-hours?mentor=${RISHAB.id}&window=${RISHAB.windowId}#apply`);
    await expect(mentorCheckbox(page, RISHAB)).toBeChecked();
    // One option, worded like Patrick's: his confirmed window, ticked by the link.
    const rishabWindow = mentorWindows(page, RISHAB);
    await expect(rishabWindow).toHaveCount(1);
    await expect(rishabWindow).toBeChecked();
    await expect(rishabWindow).toHaveAccessibleName("I can make Thu, Oct 1, 12:00–5:00 PM CT Rishab’s office-hours window");
    await expect(applySection(page)).toContainText(
      "Rishab Veldur is selected below, with “I can make Thu, Oct 1, 12:00–5:00 PM CT” ticked. Add anyone else you’d like to meet.",
    );
    await expect(applicationForm(page)).not.toContainText(/Oct 2|to be confirmed/);
    // Broad availability is optional: the ticked window is enough, and the hint doesn't single him out.
    const broad = broadAvailabilityField(page);
    await expect(broad).not.toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Not needed if you tick a time above.`);

    await fillAboutYou(page, { fullName: "Robin Wearable", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    // With the window unticked there's no time at all: the general rule applies, never a
    // "times aren't set yet" message about Rishab.
    const posts = countApplicationPosts(page);
    await untick(rishabWindow);
    await submitButton(page).click();
    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText([AVAILABILITY_RULE_MESSAGE]);
    await expect(broad).toHaveAttribute("aria-invalid", "true");
    expect(posts.count, "nothing is sent without a time or broad availability").toBe(0);

    // Ticking his window again is enough on its own; broad availability stays empty.
    await tick(rishabWindow);
    await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);
    await expect(broad).not.toHaveAttribute("aria-invalid", "true");
    await expect(broad).toHaveValue("");
    await submitAndExpect201(page);
    await expect(confirmation(page)).toContainText("This is an application, not a confirmed appointment.");
    expect(posts.count, "one request").toBe(1);

    // Stored once: Rishab first, his Thu, Oct 1 window (never Oct 2), no broad availability.
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(RISHAB.name);
    expect(stored[0].preferred_mentors).toBe(`1. ${RISHAB.name}`);
    expect(stored[0].availability).toBe(`${RISHAB.name}: Thu, Oct 1 · 12:00–5:00 PM CT (window)`);
    expect(stored[0].availability_notes).toBe("");
  });

  test("Elliott: three windows, none preselected; any one of them is enough on its own → stored without broad availability", async ({
    page,
  }) => {
    const email = uniqueEmail("apply-elliott");
    await openApplication(page, `/office-hours?mentor=${ELLIOTT.id}#apply`);
    await expect(mentorCheckbox(page, ELLIOTT)).toBeChecked();
    await expect(applySection(page)).toContainText("Elliott Notrica is selected below. Add anyone else you’d like to meet.");
    // All three of his windows are listed, in order, and none is ticked: the student picks.
    const windows = mentorWindows(page, ELLIOTT);
    await expect(windows).toHaveCount(ELLIOTT_WINDOWS.length);
    for (const [i, w] of ELLIOTT_WINDOWS.entries()) {
      await expect(windows.nth(i)).toHaveAccessibleName(`I can make ${w.line.replace(" · ", ", ")} Elliott’s office-hours window`);
      await expect(windows.nth(i)).not.toBeChecked();
    }
    await expect(applicationForm(page)).toContainText(
      "Sessions are 25 minutes. If you’re matched, Founders will email you a specific session time inside the window you picked.",
    );
    // His times are set: the hint never says otherwise, and a ticked window would be enough.
    await expect(applicationForm(page)).not.toContainText("times aren’t set yet");
    const broad = broadAvailabilityField(page);
    await expect(broad).toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Not needed if you tick a time above.`);

    await fillAboutYou(page, { fullName: "Jesse Ferment", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    // Nothing ticked and no broad availability: the general rule applies.
    const posts = countApplicationPosts(page);
    await submitButton(page).click();
    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("link")).toHaveText([AVAILABILITY_RULE_MESSAGE]);
    await expect(broad).toHaveAttribute("aria-invalid", "true");
    expect(posts.count, "nothing is sent without a time or broad availability").toBe(0);

    // Any one of his windows is enough on its own.
    for (const w of await windows.all()) {
      await tick(w);
      await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);
      await expect(broad).not.toHaveAttribute("aria-invalid", "true");
      await expect(broad).not.toHaveAttribute("aria-required", "true");
      await untick(w);
      await expect(broad).toHaveAttribute("aria-required", "true");
    }

    // Submit with his Thursday window only; broad availability stays empty.
    await tick(windows.nth(2));
    await expect(broad).toHaveValue("");
    await submitAndExpect201(page);
    expect(posts.count, "one request").toBe(1);

    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(ELLIOTT.name);
    expect(stored[0].preferred_mentors).toBe(`1. ${ELLIOTT.name}`);
    expect(stored[0].availability).toBe(`${ELLIOTT.name}: ${ELLIOTT_WINDOWS[2].line} (window)`);
    expect(stored[0].availability_notes).toBe("");
  });

  test("Ron: his Thu, Oct 1 window (2:30–4:30 PM CT) is enough on its own → stored without broad availability", async ({
    page,
  }) => {
    const email = uniqueEmail("apply-ron");
    await openApplication(page, `/office-hours?mentor=${RON.id}&window=${RON.windowId}#apply`);
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    const ronWindow = mentorWindows(page, RON);
    await expect(ronWindow).toHaveCount(1);
    await expect(ronWindow).toBeChecked();
    await expect(ronWindow).toHaveAccessibleName("I can make Thu, Oct 1, 2:30–4:30 PM CT Ron’s office-hours window");
    await expect(applySection(page)).toContainText(
      "Ron Lewis is selected below, with “I can make Thu, Oct 1, 2:30–4:30 PM CT” ticked. Add anyone else you’d like to meet.",
    );
    // Students apply to the window; the session inside it is picked later.
    await expect(applicationForm(page)).toContainText(
      "Sessions are 25 minutes. If you’re matched, Founders will email you a specific session time inside the window you picked.",
    );
    await expect(applicationForm(page)).not.toContainText("times aren’t set yet");
    const broad = broadAvailabilityField(page);
    await expect(broad).not.toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Not needed if you tick a time above.`);

    await fillAboutYou(page, { fullName: "Sasha Forecast", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);
    const posts = countApplicationPosts(page);
    await submitAndExpect201(page);
    expect(posts.count, "one request").toBe(1);

    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(RON.name);
    expect(stored[0].preferred_mentors).toBe(`1. ${RON.name}`);
    expect(stored[0].availability).toBe(`${RON.name}: Thu, Oct 1 · 2:30–4:30 PM CT (window)`);
    expect(stored[0].availability_notes).toBe("");
  });

  test("a failed submission keeps every answer; the retry stores ONE application", async ({ page }) => {
    const email = uniqueEmail("apply-retry");
    await openApplication(page);
    await tick(mentorCheckbox(page, PATRICK));
    await tick(mentorWindows(page, PATRICK));
    await tick(mentorCheckbox(page, VIK));
    await tick(firstChoiceRadio(page, VIK));
    // Vik's times aren't set yet, so broad availability is required even with Patrick's window
    // ticked: the hint says why up front (the error itself waits until the student tries to submit).
    const broad = broadAvailabilityField(page);
    await expect(broad).toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Needed because Vik’s times aren’t set yet.`);
    await expect(applicationForm(page)).not.toContainText(pendingAvailabilityMessage("Vik"));
    await broad.fill(BROAD_AVAILABILITY);
    await expect(broad).not.toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).not.toContainText(pendingAvailabilityMessage("Vik"));
    await fillAboutYou(page, { fullName: "Jordan Retry", email, major: "Industrial Engineering" });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    // First attempt: the server stores the application, but the student sees a 500 (lost response).
    let interceptedKey: string | null = null;
    await page.route(
      "**/api/applications",
      async (route) => {
        interceptedKey = JSON.parse(route.request().postData() ?? "{}").idempotencyKey ?? null;
        const real = await route.fetch();
        expect(real.status()).toBe(201);
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "server-error", message: "Simulated failure" }),
        });
      },
      { times: 1 },
    );
    await submitButton(page).click();

    const banner = page.getByRole("alert").filter({ hasText: "Your application wasn’t submitted" });
    await expect(banner).toBeVisible();
    // Focus moves to the message, so keyboard/screen-reader users land on it.
    await expect(page.locator(":focus")).toContainText("Your application wasn’t submitted");
    await expect(confirmation(page)).toHaveCount(0);

    // Every answer is still there.
    const form = applicationForm(page);
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();
    await expect(mentorCheckbox(page, VIK)).toBeChecked();
    await expect(firstChoiceRadio(page, VIK)).toBeChecked();
    await expect(broadAvailabilityField(page)).toHaveValue(BROAD_AVAILABILITY);
    await expect(fullNameField(page)).toHaveValue("Jordan Retry");
    await expect(emailField(page)).toHaveValue(email);
    await expect(form.getByRole("combobox", { name: "Year" })).toHaveValue("junior");
    await expect(form.getByRole("textbox", { name: "Major" })).toHaveValue("Industrial Engineering");
    await expect(form.getByRole("radio", { name: /^Building\b/ })).toBeChecked();
    await expect(workingOnField(page)).toHaveValue(WORKING_ON);
    await expect(questionField(page)).toHaveValue(QUESTION);
    await expect(form.getByRole("checkbox", { name: /^I understand that applying/ })).toBeChecked();
    await expect(form.getByRole("checkbox", { name: /^I agree that Founders may share/ })).toBeChecked();

    // Retry: same idempotency key → the stored application is returned, not duplicated.
    const retry = page.waitForRequest((r) => isApplicationPost(r.url(), r.method()));
    const retryResponse = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
    await banner.getByRole("button", { name: "Try again" }).click();
    expect(JSON.parse((await retry).postData() ?? "{}").idempotencyKey).toBe(interceptedKey);
    expect(await (await retryResponse).json()).toMatchObject({ ok: true, replay: true });

    // A replay: "already received" — nothing on screen (mentors, email) is repeated as if just sent.
    const received = confirmation(page);
    await expect(received).toBeVisible();
    await expect(received).toContainText("This application was already received");
    await expect(received).toContainText("This is an application, not a confirmed appointment.");
    for (const mentor of [PATRICK, VIK]) await expect(received).not.toContainText(mentor.name);
    await expect(received).not.toContainText(email);
    await expect(page.getByRole("textbox", { name: "Private status link" })).toHaveValue(/\/apply\/status\/[^/]+$/);
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(VIK.name);
    expect(stored[0].availability).toContain(PATRICK.name);
    expect(stored[0].availability_notes).toBe(BROAD_AVAILABILITY);
  });

  test("a 500 that never reached the server: answers kept, the retry stores the application once", async ({ page }) => {
    const email = uniqueEmail("apply-500");
    await openApplication(page);
    await tick(mentorCheckbox(page, RON));
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await fillAboutYou(page, { fullName: "Drew Offline", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    await page.route(
      "**/api/applications",
      (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "server-error", message: "Simulated failure" }),
        }),
      { times: 1 },
    );
    await submitButton(page).click();
    const banner = page.getByRole("alert").filter({ hasText: "Your application wasn’t submitted" });
    await expect(banner).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(0);
    await expect(fullNameField(page)).toHaveValue("Drew Offline");
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(broadAvailabilityField(page)).toHaveValue(BROAD_AVAILABILITY);

    const retryResponse = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
    await banner.getByRole("button", { name: "Try again" }).click();
    const retry = await retryResponse;
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toMatchObject({ ok: true, replay: false });
    await expect(confirmation(page)).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(1);
  });

  test("double-clicking submit stores one application", async ({ page }) => {
    const email = uniqueEmail("apply-double");
    await openApplication(page);
    await tick(mentorCheckbox(page, VIK));
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await fillAboutYou(page, { fullName: "Casey Double", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    const keys: string[] = [];
    page.on("request", (r) => {
      if (isApplicationPost(r.url(), r.method())) keys.push(JSON.parse(r.postData() ?? "{}").idempotencyKey);
    });
    await submitButton(page).dblclick();

    await expect(confirmation(page)).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(1);
    // However many requests left the browser, they all carried the same idempotency key.
    expect(keys.length).toBeGreaterThanOrEqual(1);
    expect(new Set(keys).size).toBe(1);
  });
});

test.describe("Mentor selections survive", () => {
  test("(a) Select actions on the same page after typing answers", async ({ page }) => {
    await openApplication(page, "/office-hours");
    await tick(mentorCheckbox(page, PATRICK));
    await fullNameField(page).fill("Sam Merge");
    await emailField(page).fill("sam.merge@illinois.edu");
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);

    await selectMentorAction(page, RON).click();
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=ron-lewis&window=${RON.windowId}#apply$`));
    const section = applySection(page);
    await expect(section).toContainText(
      "Ron Lewis added to your mentors. “I can make Thu, Oct 1, 2:30–4:30 PM CT” is ticked.",
    );
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(mentorWindows(page, RON)).toBeChecked();
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    // The existing first choice is kept.
    await expect(firstChoiceRadio(page, PATRICK)).toBeChecked();

    // Arnav, with his one window.
    await selectMentorAction(page, ARNAV).click();
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=arnav-mishra&window=${ARNAV.windowId}#apply$`));
    await expect(mentorCheckbox(page, ARNAV)).toBeChecked();
    await expect(mentorWindows(page, ARNAV)).toBeChecked();

    // Ron again: acknowledged, not duplicated.
    await selectMentorAction(page, RON).click();
    await expect(section).toContainText("Ron Lewis is already in your mentors.");

    for (const mentor of [PATRICK, RON, ARNAV]) await expect(mentorCheckbox(page, mentor)).toBeChecked();
    await expect(fullNameField(page)).toHaveValue("Sam Merge");
    await expect(emailField(page)).toHaveValue("sam.merge@illinois.edu");
    await expect(broadAvailabilityField(page)).toHaveValue(BROAD_AVAILABILITY);
  });

  test("(b) visiting a mentor profile and coming back", async ({ page }) => {
    await openApplication(page, "/office-hours");
    await tick(mentorCheckbox(page, PATRICK));
    await tick(mentorWindows(page, PATRICK));
    await tick(mentorCheckbox(page, ELLIOTT));
    await fullNameField(page).fill("Morgan Roundtrip");

    // Open Ron's profile from his card…
    await page
      .getByRole("region", { name: "Who you can meet" })
      .getByRole("article", { name: RON.name, exact: true })
      .getByRole("link", { name: /^Profile/ })
      .click();
    await expect(page).toHaveURL(/\/office-hours\/ron-lewis$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(RON.name);

    // …come back with the browser's Back button: everything is still selected.
    await page.goBack();
    await expect(page).toHaveURL(/\/office-hours(#[\w-]+)?$/);
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();
    await expect(mentorCheckbox(page, ELLIOTT)).toBeChecked();
    await expect(fullNameField(page)).toHaveValue("Morgan Roundtrip");

    // …and via the profile's own Apply: Ron joins, nothing is lost.
    await page.goForward();
    await expect(page).toHaveURL(/\/office-hours\/ron-lewis$/);
    await page.getByRole("main").getByRole("link", { name: "Apply to meet Ron", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=ron-lewis&window=${RON.windowId}#apply$`));
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(mentorWindows(page, RON)).toBeChecked();
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();
    await expect(mentorCheckbox(page, ELLIOTT)).toBeChecked();
    await expect(fullNameField(page)).toHaveValue("Morgan Roundtrip");
  });

  test("(c) validation errors never clear a selection; fixing them submits", async ({ page }) => {
    const email = uniqueEmail("apply-errors");
    await openApplication(page);
    await tick(mentorCheckbox(page, PATRICK));
    await tick(mentorWindows(page, PATRICK));
    await tick(mentorCheckbox(page, VIK));
    await tick(firstChoiceRadio(page, VIK));
    await passMinimumFillTime(page);
    await submitButton(page).click();

    await expect(errorSummary(page)).toBeVisible();
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();
    await expect(mentorCheckbox(page, VIK)).toBeChecked();
    await expect(firstChoiceRadio(page, VIK)).toBeChecked();

    // Vik's times aren't set yet, so the form asks for broad availability, naming him.
    await expect(applicationForm(page)).toContainText(pendingAvailabilityMessage("Vik"));
    await fillAboutYou(page, { fullName: "Parker Fixit", email });
    await fillProject(page);
    await fillConsents(page);
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await submitAndExpect201(page);

    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(VIK.name);
    expect(stored[0].availability).toContain(PATRICK.name);
  });
});

test.describe("Links into the application", () => {
  test("/apply?mentor=vikram-lakhwara → the form with Vik checked", async ({ page }) => {
    await page.goto(`/apply?mentor=${VIK.id}`);
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${VIK.id}#apply$`));
    await waitForHydration(submitButton(page));
    await expect(mentorCheckbox(page, VIK)).toBeChecked();
    // Only Vik — nothing else is ticked, and he has no times to tick yet.
    await expect(applicationForm(page).getByRole("checkbox", { checked: true })).toHaveCount(1);
    await expect(mentorWindows(page, VIK)).toHaveCount(0);
    await expect(broadAvailabilityField(page)).toBeVisible();
    await expect(preselectionNotice(page, VIK)).toBeVisible();
    await expectClearOfHeader(page, applicationHeading(page), "application heading after /apply redirect");
  });

  test("/apply?mentor=elliott-notrica → the form with Elliott checked and his three windows to pick from", async ({ page }) => {
    await page.goto(`/apply?mentor=${ELLIOTT.id}`);
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${ELLIOTT.id}#apply$`));
    await waitForHydration(submitButton(page));
    await expect(mentorCheckbox(page, ELLIOTT)).toBeChecked();
    // Only Elliott is ticked: all three of his windows are listed, none preselected.
    await expect(applicationForm(page).getByRole("checkbox", { checked: true })).toHaveCount(1);
    await expect(mentorWindows(page, ELLIOTT)).toHaveCount(ELLIOTT_WINDOWS.length);
    await expect(preselectionNotice(page, ELLIOTT)).toBeVisible();
    await expectClearOfHeader(page, applicationHeading(page), "application heading after /apply redirect");
  });

  test("unticking what a link preselected clears it from the address bar; the page's own Apply link never re-adds it", async ({
    page,
  }) => {
    await page.goto(`/office-hours?mentor=${PATRICK.id}&window=${PATRICK.windowId}#apply`);
    await waitForHydration(submitButton(page));
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();

    // Unticking the linked time drops the link's parameters (mentor, window) without navigating.
    await untick(mentorWindows(page, PATRICK));
    await expect(page).toHaveURL(/\/office-hours#apply$/);
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await untick(mentorCheckbox(page, PATRICK));
    await expect(page).toHaveURL(/\/office-hours#apply$/);

    // The hero's "Apply for Office Hours" (#apply) only scrolls to the application.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const hero = page.getByRole("region", { name: "Founders Office Hours", exact: true });
    await hero.getByRole("link", { name: "Apply for Office Hours", exact: true }).click();
    await expect(page).toHaveURL(/\/office-hours#apply$/);
    await expectClearOfHeader(page, applicationHeading(page), "application heading after the hero's Apply");
    await expect(mentorCheckbox(page, PATRICK)).not.toBeChecked();
    await expect(applicationForm(page).getByRole("checkbox", { checked: true })).toHaveCount(0);

    // A reload doesn't bring Patrick back either.
    await page.reload();
    await waitForHydration(submitButton(page));
    await expect(mentorCheckbox(page, PATRICK)).not.toBeChecked();
    await expect(page).toHaveURL(/\/office-hours#apply$/);
  });

  test("/apply keeps a window preference through the redirect", async ({ page }) => {
    await page.goto(`/apply?mentor=${PATRICK.id}&window=${PATRICK.windowId}`);
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${PATRICK.id}&window=${PATRICK.windowId}#apply$`));
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorWindows(page, PATRICK)).toBeChecked();
  });
});
