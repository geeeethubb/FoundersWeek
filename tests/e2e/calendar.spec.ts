/**
 * Checklist 4 — the Calendar (/schedule).
 *   - Day tabs Mon Sep 28 … Sat Oct 3; Founders picks and type filters; shareable filtered URLs.
 *   - Search reaches program sub-sessions ("Isbell" → the Friday showcase block); "zzz" → empty
 *     state with reset.
 *   - Program blocks expand to their sub-sessions (Arnav's talk links to his profile).
 *   - Sep 29 panel: "Co-hosted by Founders", official "Event information" link, working .ics.
 *   - Dan Caruso: "Supported by Founders", information only — no application, interest, waitlist
 *     or booking CTA anywhere, and he is not an application option.
 *   - The university's Friday evening showcase stays; the canceled afterparty is gone everywhere.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { AFTERPARTY, applicationForm, escapeRegExp, expectInformationOnly, waitForHydration } from "./support/helpers";
import {
  DAN_CARUSO_PATH,
  DAN_TITLE,
  EVENING_SHOWCASE_TITLE,
  PANEL_INFO_URL,
  PANEL_PATH,
  PANEL_TITLE,
  SHOWCASE_TITLE,
} from "./support/pages";

const DAYS = [
  { tab: /^Mon\s+Sep\s+28\b/, date: "2026-09-28", heading: "Monday, September 28" },
  { tab: /^Tue\s+Sep\s+29\b/, date: "2026-09-29", heading: "Tuesday, September 29" },
  { tab: /^Wed\s+Sep\s+30\b/, date: "2026-09-30", heading: "Wednesday, September 30" },
  { tab: /^Thu\s+Oct\s+1\b/, date: "2026-10-01", heading: "Thursday, October 1" },
  { tab: /^Fri\s+Oct\s+2\b/, date: "2026-10-02", heading: "Friday, October 2" },
  { tab: /^Sat\s+Oct\s+3\b/, date: "2026-10-03", heading: "Saturday, October 3" },
] as const;

function dayRegion(page: Page, heading: string): Locator {
  return page.getByRole("region", { name: heading, exact: true });
}

function dayRegions(page: Page): Locator {
  return page.getByRole("region", { name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), / });
}

function entry(scope: Locator, page: Page, title: string): Locator {
  return scope.getByRole("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

async function openCalendar(page: Page, path = "/schedule") {
  await page.goto(path);
  await waitForHydration(page.getByRole("searchbox", { name: "Search the calendar" }));
}

test.describe("Calendar explorer", () => {
  test("day tabs Mon Sep 28 … Sat Oct 3 each show that day", async ({ page }) => {
    await openCalendar(page);
    const tabs = page.getByRole("navigation", { name: "Calendar days" });
    for (const day of DAYS) {
      const tab = tabs.getByRole("link", { name: day.tab });
      await tab.click();
      await expect(page).toHaveURL(new RegExp(`/schedule\\?day=${day.date}$`));
      await expect(tab).toHaveAttribute("aria-current", "true");
      await expect(dayRegions(page)).toHaveCount(1);
      await expect(dayRegion(page, day.heading)).toBeVisible();
    }
    await tabs.getByRole("link", { name: /^Week\s+All days/ }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(dayRegions(page)).toHaveCount(DAYS.length);
  });

  test("the agenda is chronological, Dan Caruso (Mon) before the Sep 29 panel (Tue)", async ({ page }) => {
    await openCalendar(page);
    const headings = await dayRegions(page).getByRole("heading", { level: 2 }).allInnerTexts();
    expect(headings.map((h) => h.trim())).toEqual(DAYS.map((d) => d.heading));
    await expect(entry(dayRegion(page, "Monday, September 28"), page, DAN_TITLE)).toBeVisible();
    await expect(entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE)).toBeVisible();
  });

  test("Founders picks and type filters", async ({ page }) => {
    await openCalendar(page);
    const picks = page.getByRole("button", { name: /^Founders picks/ });
    await picks.click();
    await expect(picks).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]view=picks\b/);
    // The kickoff reception isn't a pick; Dan Caruso's fireside chat is.
    await expect(dayRegion(page, "Wednesday, September 30")).toHaveCount(0);
    await expect(entry(dayRegion(page, "Monday, September 28"), page, DAN_TITLE)).toBeVisible();

    const panels = page.getByRole("group", { name: "Filter by type" }).getByRole("button", { name: /^Panels/ });
    await panels.click();
    await expect(panels).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]type=panel\b/);
    // Picks ∩ panels: the Sep 29 panel stays; the (talk) fireside chat goes.
    await expect(entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE)).toBeVisible();
    await expect(dayRegion(page, "Monday, September 28")).toHaveCount(0);

    await page.getByRole("button", { name: /^All events/ }).click();
    await expect(page).not.toHaveURL(/view=picks/);
    await expect(page).toHaveURL(/[?&]type=panel\b/);
    // All panels (not only picks): Thursday's pitching panel is back.
    await expect(entry(dayRegion(page, "Thursday, October 1"), page, "The Science and Practice of Pitching")).toBeVisible();
  });

  test("search reaches program sub-sessions: “Isbell” finds the Friday showcase block", async ({ page }) => {
    await openCalendar(page);
    await page.getByRole("searchbox", { name: "Search the calendar" }).fill("Isbell");
    await expect(page).toHaveURL(/[?&]q=Isbell\b/);

    await expect(dayRegions(page)).toHaveCount(1);
    const block = entry(dayRegion(page, "Friday, October 2"), page, SHOWCASE_TITLE);
    await expect(block).toBeVisible();
    // The matching session is opened and marked.
    const toggle = block.getByRole("button", { name: new RegExp(`sessions in ${escapeRegExp(SHOWCASE_TITLE)}`) });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(block).toContainText("Search match");
    await expect(block).toContainText("Fireside Chat with Chancellor Charles Isbell");
  });

  test("“zzz” shows the empty state; reset brings everything back", async ({ page }) => {
    await openCalendar(page);
    await page.getByRole("searchbox", { name: "Search the calendar" }).fill("zzz");
    await expect(page.getByRole("heading", { name: "Nothing matches these filters" })).toBeVisible();
    await expect(dayRegions(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Reset all filters" }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByRole("searchbox", { name: "Search the calendar" })).toHaveValue("");
    await expect(dayRegions(page)).toHaveCount(DAYS.length);
  });

  test("the Founders Showcase Day Sessions block expands to its sessions, with Arnav's talk → his profile", async ({ page }) => {
    await openCalendar(page);
    const block = entry(dayRegion(page, "Friday, October 2"), page, SHOWCASE_TITLE);
    const toggle = block.getByRole("button", { name: new RegExp(`sessions in ${escapeRegExp(SHOWCASE_TITLE)}`) });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const sessions = page.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await expect(sessions).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(sessions).toBeVisible();
    await expect(sessions).toContainText("From Idea to Scale — Building Doss: Lessons from an Illini Founder");
    await expect(sessions).toContainText("Next Generation Industrial, Manufacturing and Space Tech");
    await expect(sessions).toContainText("Funding Start-ups in the Midwest");

    const arnav = sessions.getByRole("link", { name: "Arnav Mishra", exact: true });
    await expect(arnav).toHaveAttribute("href", "/office-hours/arnav-mishra");
    await arnav.click();
    await expect(page).toHaveURL(/\/office-hours\/arnav-mishra$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Arnav Mishra");
  });

  test("a shared filtered URL loads with its filters applied", async ({ page }) => {
    await openCalendar(page, "/schedule?day=2026-10-02&view=picks&type=talk&q=Doss");
    await expect(page.getByRole("navigation", { name: "Calendar days" }).getByRole("link", { name: DAYS[4].tab })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("button", { name: /^Founders picks/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Filter by type" }).getByRole("button", { name: /^Talks/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("searchbox", { name: "Search the calendar" })).toHaveValue("Doss");
    await expect(dayRegions(page)).toHaveCount(1);
    await expect(entry(dayRegion(page, "Friday, October 2"), page, SHOWCASE_TITLE)).toBeVisible();
    await expect(page).toHaveTitle(/Founders picks · Friday, October 2 · Calendar/);

    // /calendar is a friendly alias that keeps the query.
    await openCalendar(page, "/calendar?day=2026-10-01");
    await expect(page).toHaveURL(/\/schedule\?day=2026-10-01$/);
    await expect(dayRegions(page)).toHaveCount(1);
    await expect(dayRegion(page, "Thursday, October 1")).toBeVisible();
  });
});

test.describe("Featured events", () => {
  test("Sep 29 panel: Co-hosted by Founders, official link, working .ics", async ({ page }) => {
    await openCalendar(page);
    const row = entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE);
    await expect(row).toContainText("Co-hosted by Founders");
    await expect(row).toContainText("100 MSEB");

    await page.goto(PANEL_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PANEL_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Co-hosted by Founders");
    await expect(main).toContainText("6:00–8:00 PM CT");
    await expect(main).toContainText("100 MSEB");
    await expect(main).toContainText("Austin Kennedy");
    const info = main.getByRole("link", { name: /^Event information/ }).first();
    await expect(info).toHaveAttribute("href", PANEL_INFO_URL);
    await expect(info).toHaveAttribute("target", "_blank");

    const ics = main.getByRole("link", { name: /Download \.ics/ });
    const href = await ics.getAttribute("href");
    expect(href).toBe(`${PANEL_PATH}/calendar.ics`);
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("DTSTART;TZID=America/Chicago:20260929T180000");
    expect(body).toContain("DTEND;TZID=America/Chicago:20260929T200000");
    expect(body).toMatch(/SUMMARY:How to Make \$10K\/Month in College/);
  });

  test("Dan Caruso: Supported by Founders, information only — no application of any kind", async ({ page }) => {
    await page.goto(DAN_CARUSO_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DAN_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Supported by Founders");
    // The private-session note is information, not a call to action.
    await expect(main.getByRole("complementary", { name: "Private session with Dan Caruso" })).toBeVisible();
    await expectInformationOnly(main);

    // Home featured row and both calendar placements: no CTA either.
    await page.goto("/");
    await expectInformationOnly(page.getByRole("region", { name: DAN_TITLE, exact: true }));
    await openCalendar(page);
    await expectInformationOnly(entry(dayRegion(page, "Monday, September 28"), page, DAN_TITLE));
    await expectInformationOnly(entry(page.getByRole("region", { name: "Featured", exact: true }), page, DAN_TITLE));

    // Not an application option, even when asked for by URL.
    await page.goto("/office-hours?mentor=dan-caruso-fireside-chat#apply");
    const form = applicationForm(page);
    await expect(form).not.toContainText(/Caruso/);
    await expect(form.getByRole("checkbox", { checked: true })).toHaveCount(0);
  });

  test("the Friday evening showcase stays on the calendar", async ({ page }) => {
    await openCalendar(page, "/schedule?day=2026-10-02");
    const row = entry(dayRegion(page, "Friday, October 2"), page, EVENING_SHOWCASE_TITLE);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Illinois Conference Center");
    await row.getByRole("link", { name: EVENING_SHOWCASE_TITLE }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(EVENING_SHOWCASE_TITLE);
  });
});

test.describe("The canceled afterparty is gone", () => {
  test("no mention on home, calendar, office hours, sitemap or calendar feed; its URL is 404", async ({ page }) => {
    for (const path of ["/", "/schedule", "/office-hours"]) {
      await page.goto(path);
      await expect(page.locator("body"), path).not.toContainText(AFTERPARTY);
    }
    for (const path of ["/sitemap.xml", "/schedule/calendar.ics"]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      expect(await res.text(), path).not.toMatch(AFTERPARTY);
    }
    const gone = await page.goto("/schedule/founders-week-afterparty");
    expect(gone?.status()).toBe(404);

    await openCalendar(page, "/schedule?q=afterparty");
    await expect(page.getByRole("heading", { name: "Nothing matches these filters" })).toBeVisible();
  });
});
