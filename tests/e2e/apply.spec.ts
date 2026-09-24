/**
 * Checklist 3 — the office-hours application (/office-hours#apply).
 *   - Validation: empty submit → focused error summary; non-Illinois email; answers over 100 words.
 *   - Patrick + Ron (Ron first choice, Ron has no time) → confirmation that says it's not a
 *     confirmed appointment + a private status link → status page "Submitted".
 *   - A failed submission keeps every answer; the retry succeeds and only ONE application is stored.
 *   - Double-clicking submit stores one application.
 *   - Same-page merge: a mentor CTA on the page adds that mentor without clearing answers.
 *   - /apply?mentor=vikram-lakhwara → /office-hours with Vik preselected.
 *
 * The API rejects submissions made within 3 s of the form loading (anti-spam), so these tests run
 * on a Playwright clock and fast-forward it before submitting — no real waiting.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_BASE_URL } from "./support/env";
import {
  applicationForm,
  choosePatrickAndRonFirst,
  fillAboutYou,
  fillConsents,
  fillProject,
  mentorCheckbox,
  mentorTimes,
  organizerLogin,
  PATRICK,
  QUESTION,
  RON,
  storedApplicationsFor,
  submitButton,
  tick,
  uniqueEmail,
  VIK,
  waitForHydration,
  WORKING_ON,
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

test.describe("Validation", () => {
  test("empty submit shows a focused error summary; each link reaches its field", async ({ page }) => {
    await openApplication(page);
    await submitButton(page).click();

    const summary = page.getByRole("alert").filter({ hasText: "Please fix the highlighted answers" });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    for (const message of [
      "Choose at least one mentor.",
      "Enter your full name.",
      "Enter your Illinois email.",
      "Choose your year.",
      "Tell us what you’re working on or interested in exploring.",
    ]) {
      await expect(summary.getByRole("link", { name: message })).toBeVisible();
    }

    await summary.getByRole("link", { name: "Enter your full name." }).click();
    await expect(applicationForm(page).getByRole("textbox", { name: "Full name" })).toBeFocused();
    await expect(page.getByRole("region", { name: /Application\s*received/ })).toHaveCount(0);
  });

  test("a non-Illinois email is rejected", async ({ page }) => {
    await openApplication(page);
    const email = applicationForm(page).getByRole("textbox", { name: "Illinois email" });
    await email.fill("someone@gmail.com");
    await email.blur();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).toContainText("Use your Illinois email (ending in @illinois.edu).");

    await email.fill("netid@illinois.edu");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });

  test("answers over 100 words are flagged", async ({ page }) => {
    await openApplication(page);
    const answer = applicationForm(page).getByRole("textbox", { name: "What are you working on or interested in exploring?" });
    await answer.fill(Array.from({ length: 101 }, (_, i) => `word${i + 1}`).join(" "));
    await answer.blur();
    await expect(applicationForm(page)).toContainText("101 / 100 words");
    await expect(answer).toHaveAttribute("aria-invalid", "true");
    await expect(applicationForm(page)).toContainText("Keep this to 100 words or fewer.");
  });
});

test.describe("Submitting", () => {
  test("Patrick + Ron (Ron first, no time) → confirmation, private status link, status page", async ({ page }) => {
    const email = uniqueEmail("apply-success");
    await openApplication(page);

    await choosePatrickAndRonFirst(page);
    // Ron is still scheduling: no time to choose — the student is expressing interest.
    await expect(mentorTimes(page, RON)).toHaveCount(0);
    await expect(applicationForm(page)).toContainText("No time to pick yet — you’re expressing interest.");
    await fillAboutYou(page, { fullName: "Riley Tester", email });
    await fillProject(page);
    await fillConsents(page);

    await passMinimumFillTime(page);
    const response = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
    await submitButton(page).click();
    expect((await response).status()).toBe(201);

    const confirmation = page.getByRole("region", { name: /Application\s*received/ });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("This is an application, not a confirmed appointment.");
    await expect(confirmation).toContainText("Submitting an application does not reserve a time slot.");
    await expect(page.getByRole("textbox", { name: "Private status link" })).toHaveValue(/\/apply\/status\/[^/]+$/);

    await page.getByRole("link", { name: "Open your status page" }).click();
    await expect(page).toHaveURL(/\/apply\/status\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Riley.");
    await expect(page.getByRole("region", { name: "Current status" })).toContainText("Submitted");

    const chosen = page.getByRole("region", { name: "Mentors you chose" }).getByRole("listitem");
    await expect(chosen).toHaveCount(2);
    await expect(chosen.nth(0)).toContainText(RON.name);
    await expect(chosen.nth(0)).toContainText("First choice");
    await expect(chosen.nth(0)).toContainText("Scheduling in progress");
    await expect(chosen.nth(1)).toContainText(PATRICK.name);

    // Stored exactly once, with Ron first and Patrick's window.
    const stored = await storedApplicationsFor(organizer, email);
    expect(stored).toHaveLength(1);
    expect(stored[0].first_choice).toBe(RON.name);
    expect(stored[0].availability).toContain("Patrick Haddox");
  });

  test("a failed submission keeps every answer; the retry stores ONE application", async ({ page }) => {
    const email = uniqueEmail("apply-retry");
    await openApplication(page);
    await choosePatrickAndRonFirst(page);
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
    // Focus moves to the message (its focusable wrapper), so keyboard/screen-reader users land on it.
    await expect(page.locator(":focus")).toContainText("Your application wasn’t submitted");
    await expect(page.getByRole("region", { name: /Application\s*received/ })).toHaveCount(0);

    // Every answer is still there.
    const form = applicationForm(page);
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorTimes(page, PATRICK)).toBeChecked();
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(form.getByRole("radio", { name: `${RON.name}: First choice` })).toBeChecked();
    await expect(form.getByRole("textbox", { name: "Full name" })).toHaveValue("Jordan Retry");
    await expect(form.getByRole("textbox", { name: "Illinois email" })).toHaveValue(email);
    await expect(form.getByRole("combobox", { name: "Year" })).toHaveValue("junior");
    await expect(form.getByRole("textbox", { name: "Major" })).toHaveValue("Industrial Engineering");
    await expect(form.getByRole("radio", { name: /^Building\b/ })).toBeChecked();
    await expect(form.getByRole("textbox", { name: "What are you working on or interested in exploring?" })).toHaveValue(WORKING_ON);
    await expect(form.getByRole("textbox", { name: "What specific question or challenge would you like help with?" })).toHaveValue(
      QUESTION,
    );
    await expect(form.getByRole("checkbox", { name: /^I understand that applying/ })).toBeChecked();
    await expect(form.getByRole("checkbox", { name: /^I agree that Founders may share/ })).toBeChecked();

    // Retry: same idempotency key → the stored application is returned, not duplicated.
    const retry = page.waitForRequest((r) => isApplicationPost(r.url(), r.method()));
    const retryResponse = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
    await banner.getByRole("button", { name: "Try again" }).click();
    expect(JSON.parse((await retry).postData() ?? "{}").idempotencyKey).toBe(interceptedKey);
    const body = await (await retryResponse).json();
    expect(body).toMatchObject({ ok: true, replay: true });

    await expect(page.getByRole("region", { name: /Application\s*received/ })).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(1);
  });

  test("a 500 that never reached the server: answers kept, retry stores the application once", async ({ page }) => {
    const email = uniqueEmail("apply-500");
    await openApplication(page);
    await tick(mentorCheckbox(page, RON));
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
    await expect(applicationForm(page).getByRole("textbox", { name: "Full name" })).toHaveValue("Drew Offline");
    await expect(mentorCheckbox(page, RON)).toBeChecked();

    const retryResponse = page.waitForResponse((r) => isApplicationPost(r.url(), r.request().method()));
    await banner.getByRole("button", { name: "Try again" }).click();
    const retry = await retryResponse;
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toMatchObject({ ok: true, replay: false });
    await expect(page.getByRole("region", { name: /Application\s*received/ })).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(1);
  });

  test("double-clicking submit stores one application", async ({ page }) => {
    const email = uniqueEmail("apply-double");
    await openApplication(page);
    await tick(mentorCheckbox(page, RON));
    await fillAboutYou(page, { fullName: "Casey Double", email });
    await fillProject(page);
    await fillConsents(page);
    await passMinimumFillTime(page);

    const keys: string[] = [];
    page.on("request", (r) => {
      if (isApplicationPost(r.url(), r.method())) keys.push(JSON.parse(r.postData() ?? "{}").idempotencyKey);
    });
    await submitButton(page).dblclick();

    await expect(page.getByRole("region", { name: /Application\s*received/ })).toBeVisible();
    expect(await storedApplicationsFor(organizer, email)).toHaveLength(1);
    // However many requests left the browser, they all carried the same idempotency key.
    expect(keys.length).toBeGreaterThanOrEqual(1);
    expect(new Set(keys).size).toBe(1);
  });
});

test.describe("Prefill", () => {
  test("a mentor CTA on the same page adds the mentor and keeps the answers", async ({ page }) => {
    await openApplication(page, "/office-hours");
    const form = applicationForm(page);
    await tick(mentorCheckbox(page, PATRICK));
    await form.getByRole("textbox", { name: "Full name" }).fill("Sam Merge");
    await form.getByRole("textbox", { name: "Illinois email" }).fill("sam.merge@illinois.edu");

    const ronCta = page.getByRole("region", { name: "The lineup" }).getByRole("link", { name: /^Express interest in meeting Ron Lewis/ });
    await ronCta.click();

    await expect(page).toHaveURL(/\/office-hours\?mentor=ron-lewis#apply$/);
    await expect(mentorCheckbox(page, RON)).toBeChecked();
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(form.getByRole("textbox", { name: "Full name" })).toHaveValue("Sam Merge");
    await expect(form.getByRole("textbox", { name: "Illinois email" })).toHaveValue("sam.merge@illinois.edu");
    await expect(form).toContainText("Ron Lewis added to your mentors.");
    // The existing first choice (Patrick) is kept.
    await expect(form.getByRole("radio", { name: `${PATRICK.name}: First choice` })).toBeChecked();
    // Ron's card is brought into view.
    await expect(mentorCheckbox(page, RON)).toBeFocused();

    // The same CTA again (URL unchanged) is acknowledged, not duplicated.
    await ronCta.click();
    await expect(form).toContainText("Ron Lewis is already in your mentors.");
    await expect(form.getByRole("textbox", { name: "Full name" })).toHaveValue("Sam Merge");
  });

  test("/apply?mentor=vikram-lakhwara opens the Office Hours application with Vik preselected", async ({ page }) => {
    await page.goto("/apply?mentor=vikram-lakhwara");
    await expect(page).toHaveURL(/\/office-hours\?mentor=vikram-lakhwara#apply$/);
    await expect(mentorCheckbox(page, VIK)).toBeChecked();
    await expect(mentorTimes(page, VIK)).toHaveCount(0);
    await expect(applicationForm(page)).toContainText("Vikram “Vik” Lakhwara is preselected.");
    await expect(page.getByRole("region", { name: "Apply for Office Hours", exact: true })).toBeInViewport();
  });

  test("/apply keeps a window preference through the redirect", async ({ page }) => {
    await page.goto(`/apply?mentor=${PATRICK.id}&window=${PATRICK.windowId}`);
    await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${PATRICK.id}&window=${PATRICK.windowId}#apply$`));
    await expect(mentorCheckbox(page, PATRICK)).toBeChecked();
    await expect(mentorTimes(page, PATRICK)).toBeChecked();
  });
});
