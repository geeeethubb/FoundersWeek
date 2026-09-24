/**
 * Checklist 1 — Navigation (desktop 1440×900 and phone 390×844).
 *   - The header carries the Founders logo (alt "Founders – Illinois Entrepreneurs") and a small
 *     "Founders Week 2026" label; primary navigation is Office Hours, then Calendar.
 *   - Every public page has exactly ONE "Apply" link in the header (accessible name "Apply for
 *     Office Hours") → /office-hours#apply.
 *   - Following it lands on the "Apply for Office Hours" heading, fully visible below the sticky
 *     header (heading top ≥ header bottom) — from another page, from /office-hours itself (twice),
 *     and on a direct load of /office-hours#apply.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  applicationHeading,
  expectClearOfHeader,
  headerApplyLink,
  horizontalOverflow,
  waitForHydration,
} from "./support/helpers";
import { PUBLIC_PAGES } from "./support/pages";

const LOGO_ALT = "Founders – Illinois Entrepreneurs";

async function followHeaderApply(page: Page) {
  const apply = headerApplyLink(page);
  await waitForHydration(apply);
  await apply.click();
  await expect(page).toHaveURL(/\/office-hours#apply$/);
}

test.describe("Header", () => {
  test("Founders logo, “Founders Week 2026”, Office Hours · Calendar and one Apply button", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");

    // The supplied Founders logo — a real, loaded image, not a text stand-in.
    const logo = banner.getByAltText(LOGO_ALT, { exact: true });
    await expect(logo).toHaveCount(1);
    await expect(logo).toBeVisible();
    expect(decodeURIComponent((await logo.getAttribute("src")) ?? "")).toContain("/brand/founders-logo.png");
    await expect
      .poll(() => logo.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)), { message: "logo loads" })
      .toBeGreaterThan(0);
    // Never stretched: rendered with the artwork's own proportions.
    const ratio = await logo.evaluate((el: HTMLImageElement) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height / (el.naturalWidth / el.naturalHeight);
    });
    expect(ratio).toBeGreaterThan(0.97);
    expect(ratio).toBeLessThan(1.03);
    // The logo is the home link.
    await expect(banner.getByRole("link").filter({ has: page.getByAltText(LOGO_ALT, { exact: true }) })).toHaveAttribute(
      "href",
      "/",
    );

    await expect(banner).toContainText(/Founders Week\s*2026/);

    // Primary navigation: Office Hours, then Calendar (one nav bar per width).
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    const items = nav.getByRole("link");
    await expect(items).toHaveText(["Office Hours", "Calendar"]);
    await expect(items.nth(0)).toHaveAttribute("href", "/office-hours");
    await expect(items.nth(1)).toHaveAttribute("href", "/schedule");

    // One prominent Apply button: short visible label, full accessible name.
    const applyLinks = banner.getByRole("link", { name: /apply/i });
    await expect(applyLinks).toHaveCount(1);
    const apply = headerApplyLink(page);
    await expect(apply).toBeVisible();
    await expect(apply).toHaveText(/^\s*Apply/);
    await expect(apply).toHaveAttribute("href", "/office-hours#apply");
  });

  test("the current section is marked in the navigation", async ({ page }) => {
    await page.goto("/office-hours/ron-lewis");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Office Hours" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Calendar" })).not.toHaveAttribute("aria-current", "page");

    await page.goto("/schedule");
    await expect(nav.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
  });

  test("every public page has exactly one header Apply link → /office-hours#apply", async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      const banner = page.getByRole("banner");
      await expect(banner.getByAltText(LOGO_ALT, { exact: true }), `logo on ${path}`).toBeVisible();
      await expect(banner.getByRole("link", { name: /apply/i }), `one Apply link on ${path}`).toHaveCount(1);
      const apply = headerApplyLink(page);
      await expect(apply, `Apply on ${path}`).toBeVisible();
      await expect(apply).toHaveAttribute("href", "/office-hours#apply");
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link")).toHaveText(["Office Hours", "Calendar"]);
    }
  });

  test("phones: the header's controls are comfortable touch targets (≥ 44px tall)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "touch targets are checked at phone width");
    await page.goto("/");
    const controls = [
      { label: "Apply", locator: headerApplyLink(page) },
      { label: "Office Hours", locator: page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Office Hours" }) },
      { label: "Calendar", locator: page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Calendar" }) },
    ];
    const sizes: string[] = [];
    for (const { label, locator } of controls) {
      const box = (await locator.boundingBox())!;
      if (box.height < 44 || box.width < 44) sizes.push(`${label}: ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
    }
    expect(sizes, "header touch targets smaller than 44px").toEqual([]);
  });
});

test.describe("Apply lands on the application, clear of the sticky header", () => {
  for (const from of ["/", "/schedule", "/office-hours/elliott-notrica", "/schedule/dan-caruso-fireside-chat"]) {
    test(`from ${from}`, async ({ page }) => {
      await page.goto(from);
      await followHeaderApply(page);
      await expectClearOfHeader(page, applicationHeading(page), `"Apply for Office Hours" heading (from ${from})`);
      await expect(page.getByRole("form", { name: "Apply for Office Hours" })).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("from /office-hours itself — and again after scrolling away", async ({ page }) => {
    await page.goto("/office-hours");
    await followHeaderApply(page);
    await expectClearOfHeader(page, applicationHeading(page), "heading after the first click");

    // Same URL again (the hash doesn't change): the page still brings the heading into view.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await headerApplyLink(page).click();
    await expect(page).toHaveURL(/\/office-hours#apply$/);
    await expectClearOfHeader(page, applicationHeading(page), "heading after clicking Apply again");
  });

  test("a direct link to /office-hours#apply", async ({ page }) => {
    await page.goto("/office-hours#apply");
    await waitForHydration(page.getByRole("button", { name: "Submit application" }));
    await expectClearOfHeader(page, applicationHeading(page), "heading on a direct load");
  });
});
