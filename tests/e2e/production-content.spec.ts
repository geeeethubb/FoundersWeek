/**
 * The site exactly as students see it: production content only, no demo mentors or events. Runs on
 * the second e2e server (`scripts/dev/e2e-server.mjs --no-demo`, port 3201). The main server keeps
 * demo content on for the organizer capacity test, so exact counts are checked here.
 *   - /office-hours: exactly six mentor cards, in the published order, each with a loaded photo —
 *     two columns from desktop width, so six make three full rows.
 *   - Home: exactly six mentor previews, in order — one row of six on wide screens.
 *   - Calendar: 16 entries across 6 days (Mon Sep 28 – Sat Oct 3), with office hours for Patrick
 *     (10:00–11:30 AM, Espresso Royale at Grainger Library), Rishab (12:00–5:00 PM) and Ron
 *     (2:30–4:30 PM, BIF) on Thu, Oct 1 and Arnav
 *     (10:00–11:30 AM) on Fri, Oct 2, each sorted by start between the day's program blocks, with
 *     exact overlap lines; the office-hours card covers "all six mentors", three across on desktop,
 *     states the session rule and says only Vik and Elliott are still being scheduled; nothing
 *     marked Demo.
 */
import { expect, test, type Locator } from "@playwright/test";
import { E2E_NODEMO_BASE_URL } from "./support/env";
import {
  ARNAV,
  DEMO_MENTOR_NAMES,
  expectHeadshot,
  horizontalOverflow,
  MENTORS,
  OCT_4,
  PATRICK,
  PATRICK_VENUE,
  RISHAB,
  RON,
  SESSION_RULE,
  waitForHydration,
} from "./support/helpers";
import {
  DAN_TITLE,
  DAYS,
  EVENING_SHOWCASE_TITLE,
  FAILURE_LAB_TITLE,
  HAPPY_HOUR_TITLE,
  LAUNCHING_TITLE,
  PANEL_TITLE,
  PITCHING_TITLE,
  SHOWCASE_TITLE,
  TECHRISE_TITLE,
} from "./support/pages";

test.use({ baseURL: E2E_NODEMO_BASE_URL });

/** Distinct row positions (rounded top edges) of a set of elements. */
async function rowTops(items: Locator): Promise<number[]> {
  const tops = await items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  return [...new Set(tops)];
}

test.describe("Production content (no demo)", () => {
  test("/office-hours: exactly the six mentors, in order, each with a photo", async ({ page }) => {
    await page.goto("/office-hours");
    await expect(page.getByRole("main")).toContainText(
      "Six founders and investors are making time for students during Founders Week.",
    );
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
    // Two columns from desktop width (six → three full rows); one column on phones.
    const width = page.viewportSize()!.width;
    expect((await rowTops(cards)).length, "rows of mentor cards").toBe(width >= 1024 ? 3 : MENTORS.length);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const body = page.locator("body");
    for (const name of DEMO_MENTOR_NAMES) await expect(body).not.toContainText(name);
    await expect(body).not.toContainText(/\bDemo\b/);
  });

  test("home: exactly the six mentors previewed, in order", async ({ page }) => {
    await page.goto("/");
    const mentors = page.getByRole("region", { name: "Who you can meet" });
    await expect(mentors.getByRole("heading", { level: 3 })).toHaveText(MENTORS.map((m) => m.name));
    for (const mentor of MENTORS) await expectHeadshot(mentors.getByAltText(mentor.name, { exact: true }), mentor);
    // One row of six on wide screens (xl), three columns at lg, two from sm; one card per row on phones.
    const width = page.viewportSize()!.width;
    const previews = mentors.getByRole("listitem");
    await expect(previews).toHaveCount(MENTORS.length);
    const expectedRows = width >= 1280 ? 1 : width >= 1024 ? 2 : width >= 640 ? 3 : MENTORS.length;
    expect((await rowTops(previews)).length, "rows of mentor previews").toBe(expectedRows);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
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

  test("calendar: 16 entries across 6 days, Mon Sep 28 – Sat Oct 3; no demo events", async ({ page }) => {
    await page.goto("/schedule");
    await waitForHydration(page.getByRole("searchbox", { name: "Search the calendar" }));
    const days = page.getByRole("region", { name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), / });
    await expect(days.getByRole("heading", { level: 2 })).toHaveText(DAYS.map((d) => d.heading));
    await expect(days.getByRole("article")).toHaveCount(16);
    for (const title of [DAN_TITLE, PANEL_TITLE, HAPPY_HOUR_TITLE, FAILURE_LAB_TITLE, EVENING_SHOWCASE_TITLE]) {
      await expect(days.getByRole("heading", { name: title, exact: true })).toHaveCount(1);
    }
    await expect(page.getByRole("main")).toContainText("16 events over 6 days");

    // Four office-hours listings, one per mentor with a window: three on Thursday, Arnav's on Friday.
    const patrick = `Office hours with ${PATRICK.name}`;
    const rishab = `Office hours with ${RISHAB.name}`;
    const ron = `Office hours with ${RON.name}`;
    const arnav = `Office hours with ${ARNAV.name}`;
    await expect(days.getByRole("heading", { name: /^Office hours with / })).toHaveText([patrick, rishab, ron, arnav]);

    // Thursday, sorted by start: 10:00 AM, 11:45 AM, 12:00 PM, 2:30 PM, 3:00 PM, 5:00 PM.
    const thursday = page.getByRole("region", { name: "Thursday, October 1", exact: true });
    const thursdayRows = thursday.getByRole("article");
    await expect(thursdayRows.getByRole("heading")).toHaveText([
      patrick,
      PITCHING_TITLE,
      rishab,
      ron,
      LAUNCHING_TITLE,
      TECHRISE_TITLE,
    ]);
    const starts = await thursdayRows.evaluateAll((rows) =>
      rows.map((r) => r.querySelector("time[datetime]")?.getAttribute("datetime") ?? ""),
    );
    expect(starts).toEqual([
      "2026-10-01T10:00",
      "2026-10-01T11:45",
      "2026-10-01T12:00",
      "2026-10-01T14:30",
      "2026-10-01T15:00",
      "2026-10-01T17:00",
    ]);
    const row = (scope: Locator, title: string) =>
      scope.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(row(thursday, patrick)).toContainText("to 11:30 AM");
    await expect(row(thursday, patrick)).toContainText(PATRICK_VENUE);
    await expect(row(thursday, patrick)).not.toContainText(/Location to be announced/);
    await expect(row(thursday, rishab)).toContainText("to 5:00 PM");
    await expect(row(thursday, ron)).toContainText("to 4:30 PM");
    await expect(row(thursday, ron)).toContainText("Business Instructional Facility (BIF)");

    // Overlaps, exactly. Rishab (noon–5 PM) covers Pitching (until 2:15 PM), Ron (2:30–4:30 PM) and
    // Launching From Illinois (3:00–5:00 PM); Ron misses Pitching; Patrick's window ends at 11:30 AM
    // and TechRise starts at 5:00 PM, so neither overlaps anything.
    const overlapLine = (scope: Locator, title: string) => row(scope, title).getByText(/^Overlaps with /);
    await expect(overlapLine(thursday, rishab)).toHaveText(`Overlaps with ${PITCHING_TITLE}, ${ron} and ${LAUNCHING_TITLE}`);
    await expect(overlapLine(thursday, ron)).toHaveText(`Overlaps with ${rishab} and ${LAUNCHING_TITLE}`);
    await expect(overlapLine(thursday, PITCHING_TITLE)).toHaveText(`Overlaps with ${rishab}`);
    await expect(overlapLine(thursday, LAUNCHING_TITLE)).toHaveText(`Overlaps with ${rishab} and ${ron}`);
    await expect(overlapLine(thursday, patrick)).toHaveCount(0);
    await expect(overlapLine(thursday, TECHRISE_TITLE)).toHaveCount(0);

    // Friday: the Showcase day (8:00 AM), Arnav's office hours (10:00–11:30 AM), the evening showcase.
    const friday = page.getByRole("region", { name: "Friday, October 2", exact: true });
    await expect(friday.getByRole("article").getByRole("heading")).toHaveText([SHOWCASE_TITLE, arnav, EVENING_SHOWCASE_TITLE]);
    await expect(row(friday, arnav).locator("time[datetime]")).toHaveAttribute("datetime", "2026-10-02T10:00");
    await expect(row(friday, arnav)).toContainText("to 11:30 AM");
    await expect(overlapLine(friday, arnav)).toHaveText(`Overlaps with ${SHOWCASE_TITLE}`);
    await expect(overlapLine(friday, SHOWCASE_TITLE)).toHaveText(`Overlaps with ${arnav}`);
    await expect(overlapLine(friday, EVENING_SHOWCASE_TITLE)).toHaveCount(0);

    // Ron's Oct 4 availability is organizer-only.
    expect(await page.content()).not.toMatch(OCT_4);

    // The office-hours card: one application for all six; the lineup is three across on desktop.
    const card = page.getByRole("region", { name: "Founders Office Hours", exact: true });
    await expect(card).toContainText(
      "One application covers all six mentors. Appointments are limited. Times for Vik and Elliott are still being set.",
    );
    await expect(card).toContainText(SESSION_RULE);
    const width = page.viewportSize()!.width;
    if (width >= 1024) {
      const lineup = card.getByRole("list", { name: "Office-hours mentors" }).getByRole("listitem");
      await expect(lineup).toHaveCount(MENTORS.length);
      expect((await rowTops(lineup)).length, "rows in the office-hours lineup").toBe(2);
    } else if (width < 640) {
      await expect(card).toContainText(`${MENTORS.slice(0, -1).map((m) => m.firstName).join(", ")} and ${RISHAB.firstName}`);
    }

    const body = page.locator("body");
    await expect(body).not.toContainText(/\bDemo: /);
    for (const name of DEMO_MENTOR_NAMES) await expect(body).not.toContainText(name);
  });
});
