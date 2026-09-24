/**
 * Checklist 7 — accessibility smoke test on every public page (desktop 1440 and phone 390):
 * exactly one h1, a main landmark, a working skip link as the first tab stop, headings that don't
 * skip levels, no horizontal overflow, and the header's Apply button reachable by keyboard with a
 * visible focus indicator.
 */
import { expect, test } from "@playwright/test";
import { E2E_BASE_URL } from "./support/env";
import { createApplication, headerApplyLink, horizontalOverflow, RON, uniqueEmail } from "./support/helpers";
import { CANCELED_AFTERPARTY_PATH, PUBLIC_PAGES } from "./support/pages";

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
  { label: `404 (${CANCELED_AFTERPARTY_PATH})`, path: () => CANCELED_AFTERPARTY_PATH, status: 404 },
];

for (const { label, path, status } of PAGES) {
  test(`a11y smoke: ${label}`, async ({ page }) => {
    const res = await page.goto(path());
    expect(res?.status()).toBe(status ?? 200);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);

    // Headings never skip a level on the way down (h1 → h3 without an h2, etc.).
    const levels = await page
      .locator("main")
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed")
          .map((el) => Number(el.tagName.slice(1))),
      );
    expect(levels[0], "the first heading in <main> is the h1").toBe(1);
    const skips = levels.flatMap((level, i) => (i > 0 && level > levels[i - 1] + 1 ? [`h${levels[i - 1]} → h${level}`] : []));
    expect(skips, "heading levels skipped").toEqual([]);

    // No horizontal overflow (the page never scrolls sideways).
    expect(await horizontalOverflow(page), "horizontal overflow in px").toBeLessThanOrEqual(0);

    // The skip link is the first tab stop, becomes visible, and targets <main>.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAttribute("href", "#main");

    // The header's Apply button is reachable with Tab and shows a focus indicator.
    const cta = headerApplyLink(page);
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await cta.evaluate((el) => el === document.activeElement).catch(() => false);
    }
    expect(reached, "header Apply reachable within 8 tab stops").toBe(true);
    const outline = await cta.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });
}

test("the skip link moves focus to the main content; Enter on the header Apply opens the application", async ({ page }) => {
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
