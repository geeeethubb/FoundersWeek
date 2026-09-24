/**
 * Checklist 1 — Office Hours dominates.
 *   - Primary navigation: Office Hours, then Calendar.
 *   - "Apply for Office Hours" in the header of every public page, landing on the application.
 *   - Home: the first screen holds the CTA and all four mentors (desktop); on phones the mentor
 *     lineup starts within the first two screens.
 *   - Home order: Office Hours → Dan Caruso → the Sep 29 panel → the calendar preview.
 */
import { expect, test, type Locator } from "@playwright/test";
import { headerApplyLink, MENTORS } from "./support/helpers";
import { DAN_TITLE, PANEL_TITLE, PUBLIC_PAGES } from "./support/pages";

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, "element should be rendered").not.toBeNull();
  return box!.y;
}

test.describe("Office Hours is the primary experience", () => {
  test("primary navigation lists Office Hours first, then Calendar", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    const items = (await nav.getByRole("listitem").getByRole("link").allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t !== "Home");
    expect(items).toEqual(["Office Hours", "Calendar"]);
    await expect(nav.getByRole("link", { name: "Office Hours", exact: true })).toHaveAttribute("href", "/office-hours");
    await expect(nav.getByRole("link", { name: "Calendar", exact: true })).toHaveAttribute("href", "/schedule");
  });

  test("the header's Apply for Office Hours CTA is on every public page", async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      const cta = headerApplyLink(page);
      await expect(cta, `header CTA on ${path}`).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/office-hours#apply");
      // Phones show the short visible label "Apply", but the accessible name is the full CTA everywhere.
      await expect(cta, `header CTA label on ${path}`).toHaveAccessibleName("Apply for Office Hours");
    }
  });

  test("the header CTA opens the application", async ({ page }) => {
    await page.goto("/schedule");
    await headerApplyLink(page).click();
    await expect(page).toHaveURL(/\/office-hours#apply$/);
    const application = page.getByRole("region", { name: "Apply for Office Hours" });
    await expect(application.getByRole("heading", { level: 2, name: "Apply for Office Hours" })).toBeInViewport();
    await expect(page.getByRole("form", { name: "Apply for Office Hours" })).toBeVisible();
  });

  test("home: the first screen holds the CTA and all four mentors", async ({ page }, testInfo) => {
    await page.goto("/");
    const main = page.getByRole("main");
    const heroCta = main.getByRole("link", { name: "Apply for Office Hours" }).first();
    const roster = page.getByRole("region", { name: /Founders Office Hours/ }).first();

    if (testInfo.project.name === "mobile") {
      // Phones: headline → CTA on the first screen; the mentor lineup starts within two screens.
      const screen = page.viewportSize()!.height;
      await expect(heroCta).toBeInViewport({ ratio: 1 });
      const first = roster.getByRole("heading", { level: 3, name: MENTORS[0].name });
      expect(await top(roster)).toBeLessThan(2 * screen);
      expect(await top(first)).toBeLessThan(2 * screen);
      // Every mentor is listed right there — no carousel, nothing to expand.
      for (const mentor of MENTORS) {
        await expect(roster.getByRole("heading", { level: 3, name: mentor.name })).toBeVisible();
      }
      return;
    }

    await expect(heroCta).toBeInViewport({ ratio: 1 });
    for (const mentor of MENTORS) {
      await expect(roster.getByRole("heading", { level: 3, name: mentor.name }), `${mentor.name} above the fold`).toBeInViewport({
        ratio: 1,
      });
    }
  });

  test("home: Office Hours, then Dan Caruso, then the Sep 29 panel, then the calendar", async ({ page }) => {
    await page.goto("/");
    const officeHours = page.getByRole("region", { name: /Founders Office Hours/ }).first();
    const dan = page.getByRole("heading", { level: 2, name: DAN_TITLE });
    const panel = page.getByRole("heading", { level: 2, name: PANEL_TITLE });
    const calendar = page.getByRole("heading", { level: 2, name: "The whole week, in order." });

    const [yOfficeHours, yDan, yPanel, yCalendar] = await Promise.all([top(officeHours), top(dan), top(panel), top(calendar)]);
    expect(yOfficeHours).toBeLessThan(yDan);
    expect(yDan).toBeLessThan(yPanel);
    expect(yPanel).toBeLessThan(yCalendar);

    // Each featured event carries its Founders label.
    await expect(page.getByRole("region", { name: DAN_TITLE })).toContainText("Supported by Founders");
    await expect(page.getByRole("region", { name: PANEL_TITLE })).toContainText("Co-hosted by Founders");
  });
});
