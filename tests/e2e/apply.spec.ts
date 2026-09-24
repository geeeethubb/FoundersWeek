/**
 * Checklist 4 — the office-hours application (/office-hours#apply).
 *   - Pending mentors (Vik, Elliott, Ron) can be applied to with broad availability only.
 *   - The availability rule: neither a listed window nor broad availability → an error; either one
 *     is enough — unless a chosen mentor's times aren't set yet (Vik, Elliott, Ron): then broad
 *     availability is required, naming them.
 *   - A retried (replayed) submission confirms "already received" without repeating the answers.
 *   - Unticking what a link preselected clears ?mentor/window from the URL; #apply only scrolls.
 *   - Validation: empty submit → focused error summary; non-Illinois email; answers over 100 words.
 *   - Success → confirmation + private status link → status page "Submitted".
 *   - A forced 500 keeps every answer and the retry stores exactly ONE application (organizer export).
 *   - Double-clicking submit stores one application.
 *   - Mentor selections survive (a) same-page Select actions after typing answers, (b) visiting a
 *     profile and coming back, (c) validation errors.
 *   - /apply?mentor=elliott-notrica → the form with Elliott checked.
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
  broadAvailabilityField,
  confirmation,
  ELLIOTT,
  emailField,
  errorSummary,
  expectClearOfHeader,
  fillAboutYou,
  fillConsents,
  fillProject,
  firstChoiceRadio,
  fullNameField,
  MENTORS,
  mentorCheckbox,
  mentorWindows,
  organizerLogin,
  PATRICK,
  PENDING_MENTORS,
  preselectionNotice,
  QUESTION,
  questionField,
  RON,
  storedApplicationsFor,
  submitButton,
  tick,
  untick,
  uniqueEmail,
  VIK,
  waitForHydration,
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

    // …but not for a mentor whose schedule is pending: adding Elliott asks for broad availability,
    // naming him, even with Patrick's window ticked.
    const elliottMessage = pendingAvailabilityMessage("Elliott");
    await tick(mentorCheckbox(page, ELLIOTT));
    await expect(mentorWindows(page, ELLIOTT)).toHaveCount(0);
    await expect(applicationForm(page)).toContainText(elliottMessage);
    await untick(mentorCheckbox(page, PATRICK));
    await expect(applicationForm(page)).toContainText(elliottMessage);
    // Broad availability is enough — the only option for a mentor whose schedule is pending.
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await expect(applicationForm(page)).not.toContainText(elliottMessage);
    await expect(applicationForm(page)).not.toContainText(AVAILABILITY_RULE_MESSAGE);
    await expect(broadAvailabilityField(page)).not.toHaveAttribute("aria-invalid", "true");
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
  test("pending mentors (Vik, Elliott, Ron) with broad availability only → confirmation, status link, “Submitted”", async ({
    page,
  }) => {
    const email = uniqueEmail("apply-pending");
    await openApplication(page);

    for (const mentor of PENDING_MENTORS) await tick(mentorCheckbox(page, mentor));
    // No listed times for any of them — broad availability is how a student says when they're free.
    for (const mentor of PENDING_MENTORS) await expect(mentorWindows(page, mentor)).toHaveCount(0);
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
    await expect(page.getByRole("textbox", { name: "Private status link" })).toHaveValue(/\/apply\/status\/[^/]+$/);

    await received.getByRole("link", { name: "Open your status page" }).click();
    await expect(page).toHaveURL(/\/apply\/status\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Riley.");
    await expect(page.getByRole("region", { name: "Current status" })).toContainText("Submitted");
    const chosen = page.getByRole("region", { name: "Mentors you chose" }).getByRole("listitem");
    await expect(chosen).toHaveCount(3);
    await expect(chosen.first()).toContainText(ELLIOTT.name);
    await expect(chosen.first()).toContainText("First choice");

    // Stored exactly once: Elliott first, no listed time, the broad availability kept verbatim.
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("Submitted");
    expect(stored[0].first_choice).toBe(ELLIOTT.name);
    expect(stored[0].preferred_mentors.startsWith(`1. ${ELLIOTT.name}`)).toBe(true);
    for (const mentor of PENDING_MENTORS) expect(stored[0].preferred_mentors).toContain(mentor.name);
    expect(stored[0].availability).toBe("Interest only — no time selected");
    expect(stored[0].availability_notes).toBe(BROAD_AVAILABILITY);
  });

  test("a failed submission keeps every answer; the retry stores ONE application", async ({ page }) => {
    const email = uniqueEmail("apply-retry");
    await openApplication(page);
    await tick(mentorCheckbox(page, PATRICK));
    await tick(mentorWindows(page, PATRICK));
    await tick(mentorCheckbox(page, RON));
    await tick(firstChoiceRadio(page, RON));
    // Ron's times aren't set yet, so broad availability is required even with Patrick's window ticked.
    await expect(applicationForm(page)).toContainText(pendingAvailabilityMessage("Ron"));
    await broadAvailabilityField(page).fill(BROAD_AVAILABILITY);
    await expect(applicationForm(page)).not.toContainText(pendingAvailabilityMessage("Ron"));
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
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(firstChoiceRadio(page, RON)).toBeChecked();
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
    for (const mentor of [PATRICK, RON]) await expect(received).not.toContainText(mentor.name);
    await expect(received).not.toContainText(email);
    await expect(page.getByRole("textbox", { name: "Private status link" })).toHaveValue(/\/apply\/status\/[^/]+$/);
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(RON.name);
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
    await expect(page).toHaveURL(/\/office-hours\?mentor=ron-lewis#apply$/);
    const section = applySection(page);
    await expect(section).toContainText("Ron Lewis added to your mentors.");
    await expect(mentorCheckbox(page, RON)).toBeChecked();
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
    await expect(page).toHaveURL(/\/office-hours\?mentor=ron-lewis#apply$/);
    await expect(mentorCheckbox(page, RON)).toBeChecked();
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
  test("/apply?mentor=elliott-notrica → the form with Elliott checked", async ({ page }) => {
    await page.goto("/apply?mentor=elliott-notrica");
    await expect(page).toHaveURL(/\/office-hours\?mentor=elliott-notrica#apply$/);
    await waitForHydration(submitButton(page));
    await expect(mentorCheckbox(page, ELLIOTT)).toBeChecked();
    // Only Elliott — nothing else is ticked.
    await expect(applicationForm(page).getByRole("checkbox", { checked: true })).toHaveCount(1);
    await expect(mentorWindows(page, ELLIOTT)).toHaveCount(0);
    await expect(broadAvailabilityField(page)).toBeVisible();
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
