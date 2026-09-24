/**
 * Checklist 6 — accessibility smoke test on every public page (desktop 1440 and phone 390):
 * exactly one h1, a main landmark, a working skip link as the first tab stop, no horizontal
 * overflow, and the header's "Apply for Office Hours" CTA reachable by keyboard with a visible
 * focus indicator.
 */
import { expect, test } from "@playwright/test";
import { E2E_BASE_URL } from "./support/env";
import { createApplication, headerApplyLink, RON, uniqueEmail } from "./support/helpers";
import { PUBLIC_PAGES } from "./support/pages";

let statusPath = "";

test.beforeAll(async ({ playwright }) => {
  // The private status page is public-by-link: create an application to get one.
  const api = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
  const app = await createApplication(api, {
    fullName: "Alex Access",
    email: uniqueEmail("a11y"),
    mentorIds: [RON.id],
    firstChoiceMentorId: RON.id,
  });
  statusPath = app.statusUrl;
  await api.dispose();
});

const PAGES: { label: string; path: () => string; status?: number }[] = [
  ...PUBLIC_PAGES.map((p) => ({ label: p, path: () => p })),
  { label: "/apply/status/<token>", path: () => statusPath },
  { label: "/organizers/login", path: () => "/organizers/login" },
  { label: "404 (/schedule/founders-week-afterparty)", path: () => "/schedule/founders-week-afterparty", status: 404 },
];

for (const { label, path, status } of PAGES) {
  test(`a11y smoke: ${label}`, async ({ page }) => {
    const res = await page.goto(path());
    expect(res?.status()).toBe(status ?? 200);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);

    // No horizontal overflow (the page never scrolls sideways).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

    // The skip link is the first tab stop, becomes visible, and targets <main>.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAttribute("href", "#main");
    await expect(page.locator("main#main")).toHaveCount(1);

    // The header CTA is reachable with Tab and shows a focus indicator.
    const cta = headerApplyLink(page);
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await cta.evaluate((el) => el === document.activeElement).catch(() => false);
    }
    expect(reached, "header CTA reachable within 8 tab stops").toBe(true);
    await expect(cta).toBeFocused();
    const outline = await cta.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
}

test("skip link moves focus to the main content; Enter on the header CTA opens the application", async ({ page }) => {
  await page.goto("/schedule");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.goto("/");
  const cta = headerApplyLink(page);
  await cta.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/office-hours#apply$/);
  await expect(page.getByRole("form", { name: "Apply for Office Hours" })).toBeVisible();
});
