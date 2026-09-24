/**
 * The site exactly as students see it: production content only, no demo mentors or events. Runs on
 * the second e2e server (`scripts/dev/e2e-server.mjs --no-demo`, port 3201). The main server keeps
 * demo content on for the organizer capacity test, so exact counts are checked here.
 *   - /office-hours: exactly five mentor cards, in the published order, each with a loaded photo.
 *   - Home: exactly five mentor previews, in order.
 *   - Calendar: 14 entries across 6 days (Mon Sep 28 – Sat Oct 3); nothing marked Demo.
 */
import { expect, test } from "@playwright/test";
import { E2E_NODEMO_BASE_URL } from "./support/env";
import { DEMO_MENTOR_NAMES, expectHeadshot, horizontalOverflow, MENTORS, waitForHydration } from "./support/helpers";
import {
  DAN_TITLE,
  DAYS,
  EVENING_SHOWCASE_TITLE,
  FAILURE_LAB_TITLE,
  HAPPY_HOUR_TITLE,
  PANEL_TITLE,
} from "./support/pages";

test.use({ baseURL: E2E_NODEMO_BASE_URL });

test.describe("Production content (no demo)", () => {
  test("/office-hours: exactly the five mentors, in order, each with a photo", async ({ page }) => {
    await page.goto("/office-hours");
    const grid = page.getByRole("region", { name: "Who you can meet" });
    const cards = grid.getByRole("article");
    await expect(cards).toHaveCount(MENTORS.length);
    for (const [i, mentor] of MENTORS.entries()) {
      await expect(cards.nth(i).getByRole("heading")).toHaveText(mentor.name);
      await expect(cards.nth(i)).toContainText(mentor.role);
      await expect(cards.nth(i)).toContainText(mentor.company);
      await expectHeadshot(cards.nth(i).getByAltText(mentor.name, { exact: true }), mentor);
    }
    // Every card the same width; nothing off-screen.
    const boxes = await Promise.all((await cards.all()).map(async (c) => (await c.boundingBox())!));
    for (const box of boxes) {
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThanOrEqual(1);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const body = page.locator("body");
    for (const name of DEMO_MENTOR_NAMES) await expect(body).not.toContainText(name);
    await expect(body).not.toContainText(/\bDemo\b/);
  });

  test("home: exactly the five mentors previewed, in order", async ({ page }) => {
    await page.goto("/");
    const mentors = page.getByRole("region", { name: "Who you can meet" });
    await expect(mentors.getByRole("heading", { level: 3 })).toHaveText(MENTORS.map((m) => m.name));
    for (const mentor of MENTORS) await expectHeadshot(mentors.getByAltText(mentor.name, { exact: true }), mentor);
    // Featured: Dan Caruso, the Sept 29 panel, Arnav's happy hour, then Founder Failure Lab.
    const featured = page.getByRole("region", { name: "Featured events" });
    const titles = (await featured.getByRole("heading", { level: 3 }).allInnerTexts()).map((t) => t.trim());
    expect(titles).toEqual([DAN_TITLE, PANEL_TITLE, HAPPY_HOUR_TITLE, FAILURE_LAB_TITLE]);
    const failureNight = featured.getByRole("article", { name: FAILURE_LAB_TITLE });
    await expect(failureNight).toContainText("Hosted by Founders");
    // The event Founders hosts sits on a light-orange card; the others stay white.
    expect(await failureNight.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 244, 229)");
    expect(
      await featured.getByRole("article", { name: DAN_TITLE }).evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    for (const name of DEMO_MENTOR_NAMES) await expect(page.locator("body")).not.toContainText(name);
  });

  test("calendar: 14 entries across 6 days, Mon Sep 28 – Sat Oct 3; no demo events", async ({ page }) => {
    await page.goto("/schedule");
    await waitForHydration(page.getByRole("searchbox", { name: "Search the calendar" }));
    const days = page.getByRole("region", { name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), / });
    await expect(days.getByRole("heading", { level: 2 })).toHaveText(DAYS.map((d) => d.heading));
    await expect(days.getByRole("article")).toHaveCount(14);
    for (const title of [DAN_TITLE, PANEL_TITLE, HAPPY_HOUR_TITLE, FAILURE_LAB_TITLE, EVENING_SHOWCASE_TITLE]) {
      await expect(days.getByRole("heading", { name: title, exact: true })).toHaveCount(1);
    }
    await expect(page.getByRole("main")).toContainText("14 events over 6 days");
    const body = page.locator("body");
    await expect(body).not.toContainText(/\bDemo: /);
    for (const name of DEMO_MENTOR_NAMES) await expect(body).not.toContainText(name);
  });
});
