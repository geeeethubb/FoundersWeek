/**
 * Checklist 5 — the Calendar (/schedule), desktop 1440×900 and phone 390×844.
 *   - Chronological days: Mon Sep 28 … Sat Oct 3.
 *   - Dan Caruso on Monday at 4:00 PM, Beckman Institute, Auditorium (Room 1025), "Supported by
 *     Founders" — information only: no application, interest, waitlist or booking UI on his page.
 *   - The Sept 29 panel: "Co-hosted by Founders", an Event information link, and an .ics that starts
 *     DTSTART;TZID=America/Chicago:20260929T180000.
 *   - "Happy Hour with Arnav Mishra at Legends" on Wednesday: RSVP on Partiful, .ics at 5:00 PM CT.
 *   - "Founder Failure Lab" on Wednesday, 6:30–8:30 PM CT at CIF Room 1038, "Hosted by Founders":
 *     Register on Luma, speakers linked to LinkedIn, and the overlap with the happy hour on both.
 *   - The university's Friday "Founders Evening Showcase and Reception" stays.
 *   - The canceled HERE Apartments afterparty is absent everywhere, and its URL is a 404.
 *   - Filters, search and detail pages still work.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ARNAV,
  applicationForm,
  CANCELED_AFTERPARTY,
  expectInformationOnly,
  horizontalOverflow,
  icsEvents,
  waitForHydration,
} from "./support/helpers";
import {
  CANCELED_AFTERPARTY_PATH,
  DAN_ADDRESS,
  DAN_CALLOUT,
  DAN_CARUSO_PATH,
  DAN_LINKEDIN,
  DAN_ROOM,
  DAN_TITLE,
  DAN_VENUE,
  DAYS,
  EVENING_SHOWCASE_PATH,
  EVENING_SHOWCASE_TITLE,
  FAILURE_LAB_ADDRESS,
  FAILURE_LAB_ID,
  FAILURE_LAB_PATH,
  FAILURE_LAB_REGISTER_LABEL,
  FAILURE_LAB_REGISTER_URL,
  FAILURE_LAB_ROOM,
  FAILURE_LAB_SPEAKERS,
  FAILURE_LAB_TITLE,
  FAILURE_LAB_VENUE,
  HAPPY_HOUR_ID,
  HAPPY_HOUR_PATH,
  HAPPY_HOUR_RSVP_LABEL,
  HAPPY_HOUR_RSVP_URL,
  HAPPY_HOUR_TITLE,
  KICKOFF_TITLE,
  PANEL_INFO_URL,
  PANEL_PATH,
  PANEL_PLACE,
  PANEL_TITLE,
  SHOWCASE_TITLE,
} from "./support/pages";

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

/** Phones keep the view and type filters behind a "Filters" button. */
async function showFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^Filters/ });
  if ((await toggle.isVisible()) && (await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

async function fetchIcs(page: Page, href: string): Promise<string> {
  const res = await page.request.get(href);
  expect(res.status(), href).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  return res.text();
}

test.describe("Calendar agenda", () => {
  test("chronological days, Mon Sep 28 … Sat Oct 3", async ({ page }) => {
    await openCalendar(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Calendar");
    const headings = (await dayRegions(page).getByRole("heading", { level: 2 }).allInnerTexts()).map((h) => h.trim());
    expect(headings).toEqual(DAYS.map((d) => d.heading));

    // Within each day, rows with an exact start run in time order.
    for (const day of DAYS) {
      const times = (
        await dayRegion(page, day.heading)
          .getByRole("article")
          .evaluateAll((rows) => rows.map((r) => r.querySelector("time[datetime]")?.getAttribute("datetime") ?? ""))
      ).filter(Boolean);
      expect(times, `${day.heading} in order`).toEqual([...times].sort());
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("day tabs show one day at a time; “All days” brings the week back", async ({ page }) => {
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
    await tabs.getByRole("link", { name: /^Week/ }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(dayRegions(page)).toHaveCount(DAYS.length);
  });
});

test.describe("Dan Caruso — Monday, information only", () => {
  test("Monday 4:00 PM at the Beckman Institute Auditorium (Room 1025), Supported by Founders", async ({ page }) => {
    await openCalendar(page);
    const monday = dayRegion(page, "Monday, September 28");
    const row = entry(monday, page, DAN_TITLE);
    await expect(row).toBeVisible();
    await expect(row).toContainText("4:00 PM");
    await expect(row).toContainText(`${DAN_VENUE} · ${DAN_ROOM}`);
    await expect(row).toContainText("Supported by Founders");
    await expectInformationOnly(row);

    await row.getByRole("link", { name: DAN_TITLE, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${DAN_CARUSO_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DAN_TITLE);
  });

  test("event page: when, where, label, LinkedIn and the private-session note — no application of any kind", async ({ page }) => {
    await page.goto(DAN_CARUSO_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(DAN_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Supported by Founders");
    await expect(main).toContainText("Monday, September 28");
    await expect(main).toContainText("4:00 PM CT");
    for (const line of [DAN_VENUE, DAN_ROOM, DAN_ADDRESS]) await expect(main).toContainText(line);
    await expect(main).toContainText("Caruso Ventures");
    await expect(main.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", DAN_LINKEDIN);

    // The private session is information, not a call to action.
    const note = main.getByRole("complementary", { name: DAN_CALLOUT });
    await expect(note).toBeVisible();
    await expectInformationOnly(note);
    await expectInformationOnly(main);

    // Not an application option, even when asked for by URL.
    await page.goto("/office-hours?mentor=dan-caruso-fireside-chat#apply");
    const form = applicationForm(page);
    await expect(form).toBeVisible();
    await expect(form).not.toContainText(/Caruso/);
    await expect(form.getByRole("checkbox", { checked: true })).toHaveCount(0);
  });
});

test.describe("Featured related events", () => {
  test("Sept 29 panel: Co-hosted by Founders, Event information link, .ics at 6:00 PM Central", async ({ page }) => {
    await openCalendar(page);
    const row = entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE);
    await expect(row).toContainText("Co-hosted by Founders");
    await expect(row).toContainText(PANEL_PLACE);
    await expect(row).toContainText("6:00 PM");
    await expect(row.getByRole("link", { name: /^Event information/ })).toHaveAttribute("href", PANEL_INFO_URL);

    await page.goto(PANEL_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PANEL_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Co-hosted by Founders");
    await expect(main).toContainText("Tuesday, September 29");
    await expect(main).toContainText("6:00–8:00 PM CT");
    await expect(main).toContainText(PANEL_PLACE);
    const info = main.getByRole("link", { name: /^Event information/ }).first();
    await expect(info).toHaveAttribute("href", PANEL_INFO_URL);
    await expect(info).toHaveAttribute("target", "_blank");
    await expect(info).toHaveAttribute("rel", /\bnoopener\b/);

    const ics = main.getByRole("link", { name: /\.ics/ });
    await expect(ics).toHaveAttribute("href", `${PANEL_PATH}/calendar.ics`);
    const events = icsEvents(await fetchIcs(page, `${PANEL_PATH}/calendar.ics`));
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("DTSTART;TZID=America/Chicago:20260929T180000");
    expect(events[0]).toContain("DTEND;TZID=America/Chicago:20260929T200000");
    expect(events[0]).toMatch(/SUMMARY:How to Make \$10K\/Month in College/);
  });

  test("Wednesday: Happy Hour with Arnav Mishra at Legends — RSVP on Partiful, .ics at 5:00 PM Central", async ({ page }) => {
    await openCalendar(page);
    const wednesday = dayRegion(page, "Wednesday, September 30");
    const titles = (await wednesday.getByRole("article").getByRole("heading").allInnerTexts()).map((t) => t.trim());
    expect(titles).toContain(KICKOFF_TITLE);
    expect(titles).toContain(HAPPY_HOUR_TITLE);
    const row = entry(wednesday, page, HAPPY_HOUR_TITLE);
    await expect(row).toContainText("5:00 PM");
    await expect(row).toContainText("Legends");
    await row.getByRole("link", { name: HAPPY_HOUR_TITLE, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${HAPPY_HOUR_PATH}$`));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HAPPY_HOUR_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Wednesday, September 30");
    await expect(main).toContainText("5:00–7:00 PM CT");
    await expect(main).toContainText("Legends");
    await expect(main).toContainText("6th & Green");

    const rsvp = main.getByRole("link", { name: new RegExp(`^${HAPPY_HOUR_RSVP_LABEL}`) });
    await expect(rsvp.first()).toBeVisible();
    for (const link of await rsvp.all()) {
      await expect(link).toHaveAttribute("href", HAPPY_HOUR_RSVP_URL);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
    }
    expect(new URL(HAPPY_HOUR_RSVP_URL).hostname).toBe("partiful.com");

    // Hosted by Arnav — an office-hours mentor, linked to his profile. An event, not office hours:
    // no application or booking action on the page.
    await expect(main.getByRole("link", { name: ARNAV.name, exact: true }).first()).toHaveAttribute("href", `/office-hours/${ARNAV.id}`);
    await expect(main.getByRole("link", { name: /^(Apply|Express interest|Select mentor)\b/ })).toHaveCount(0);

    const events = icsEvents(await fetchIcs(page, `${HAPPY_HOUR_PATH}/calendar.ics`));
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("DTSTART;TZID=America/Chicago:20260930T170000");
    expect(events[0]).toContain("DTEND;TZID=America/Chicago:20260930T190000");
    expect(events[0]).toContain(`SUMMARY:${HAPPY_HOUR_TITLE}`);

    // The whole-week feed carries it too.
    const feed = icsEvents(await fetchIcs(page, "/schedule/calendar.ics"));
    const inFeed = feed.filter((e) => e.includes(`UID:${HAPPY_HOUR_ID}@`));
    expect(inFeed).toHaveLength(1);
    expect(inFeed[0]).toContain("DTSTART;TZID=America/Chicago:20260930T170000");
  });

  test("Wednesday: Founder Failure Lab — Hosted by Founders at CIF 1038, overlaps the happy hour, Register on Luma, .ics at 6:30 PM Central", async ({
    page,
  }) => {
    await openCalendar(page);
    const wednesday = dayRegion(page, "Wednesday, September 30");
    const row = entry(wednesday, page, FAILURE_LAB_TITLE);
    await expect(row).toContainText("6:30 PM");
    await expect(row).toContainText(`${FAILURE_LAB_VENUE} · ${FAILURE_LAB_ROOM}`);
    await expect(row).toContainText("Hosted by Founders");
    // 6:30–8:30 PM clashes with the 5–7 PM happy hour; both rows say so.
    await expect(row).toContainText(`Overlaps with ${HAPPY_HOUR_TITLE}`);
    await expect(entry(wednesday, page, HAPPY_HOUR_TITLE)).toContainText(`Overlaps with ${FAILURE_LAB_TITLE}`);
    const titles = (await wednesday.getByRole("article").getByRole("heading").allInnerTexts()).map((t) => t.trim());
    expect(titles.indexOf(HAPPY_HOUR_TITLE), "the 5:00 PM happy hour comes before the 6:30 PM lab").toBeLessThan(
      titles.indexOf(FAILURE_LAB_TITLE),
    );

    await row.getByRole("link", { name: FAILURE_LAB_TITLE, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${FAILURE_LAB_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FAILURE_LAB_TITLE);
    const main = page.getByRole("main");
    await expect(main).toContainText("Hosted by Founders");
    await expect(main).toContainText("Wednesday, September 30");
    await expect(main).toContainText("6:30–8:00 PM CT");
    for (const line of [FAILURE_LAB_VENUE, FAILURE_LAB_ROOM, FAILURE_LAB_ADDRESS]) await expect(main).toContainText(line);
    await expect(main).toContainText("Why do startups actually fail?");

    // Registration is external (Luma), in a new tab — never the office-hours application.
    const register = main.getByRole("link", { name: new RegExp(`^${FAILURE_LAB_REGISTER_LABEL}`) });
    await expect(register.first()).toBeVisible();
    for (const link of await register.all()) {
      await expect(link).toHaveAttribute("href", FAILURE_LAB_REGISTER_URL);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
    }
    expect(new URL(FAILURE_LAB_REGISTER_URL).hostname).toBe("luma.com");
    await expect(main.getByRole("link", { name: /^(Apply|Express interest|Select mentor)\b/ })).toHaveCount(0);
    await expect(main.getByRole("form")).toHaveCount(0);

    // The three speakers, each name linked to their LinkedIn profile.
    const speakers = main.getByRole("region", { name: "Speakers", exact: true });
    await expect(speakers.getByRole("listitem")).toHaveCount(FAILURE_LAB_SPEAKERS.length);
    for (const speaker of FAILURE_LAB_SPEAKERS) {
      const link = speakers.getByRole("link", { name: new RegExp(`^${speaker.name}\\b`) });
      await expect(link).toHaveAttribute("href", speaker.linkedin);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
    }

    // The detail page points out the clash too.
    await expect(main.getByRole("region", { name: "Overlaps with", exact: true })).toContainText(HAPPY_HOUR_TITLE);

    const events = icsEvents(await fetchIcs(page, `${FAILURE_LAB_PATH}/calendar.ics`));
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("DTSTART;TZID=America/Chicago:20260930T183000");
    expect(events[0]).toContain("DTEND;TZID=America/Chicago:20260930T200000");
    expect(events[0]).toContain(`SUMMARY:${FAILURE_LAB_TITLE}`);
    const feed = icsEvents(await fetchIcs(page, "/schedule/calendar.ics"));
    expect(feed.filter((e) => e.includes(`UID:${FAILURE_LAB_ID}@`))).toHaveLength(1);

    // And the happy hour's page names the lab as an overlap.
    await page.goto(HAPPY_HOUR_PATH);
    await expect(page.getByRole("main").getByRole("region", { name: "Overlaps with", exact: true })).toContainText(
      FAILURE_LAB_TITLE,
    );
  });

  test("the university's Friday “Founders Evening Showcase and Reception” stays", async ({ page }) => {
    await openCalendar(page, "/schedule?day=2026-10-02");
    const row = entry(dayRegion(page, "Friday, October 2"), page, EVENING_SHOWCASE_TITLE);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Illinois Conference Center");
    await row.getByRole("link", { name: EVENING_SHOWCASE_TITLE, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${EVENING_SHOWCASE_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(EVENING_SHOWCASE_TITLE);
  });
});

test.describe("The canceled HERE Apartments afterparty is gone", () => {
  test("not on any public page, in search, the sitemap or the calendar feed; its URLs are 404", async ({ page }) => {
    for (const path of ["/", "/office-hours", `/office-hours/${ARNAV.id}`, "/schedule", "/schedule?day=2026-10-03", HAPPY_HOUR_PATH]) {
      await page.goto(path);
      // textContent includes the serialized page data, so client props are covered too.
      await expect(page.locator("body"), path).not.toContainText(CANCELED_AFTERPARTY);
    }

    // Saturday still lists its real events — and nothing else.
    await openCalendar(page, "/schedule?day=2026-10-03");
    const saturday = dayRegion(page, "Saturday, October 3");
    await expect(entry(saturday, page, "Tailgate and EnterpriseWorks Tour")).toBeVisible();
    await expect(entry(saturday, page, "Illinois Football Game vs. Purdue")).toBeVisible();

    for (const q of ["HERE Apartments", "afterparty"]) {
      await openCalendar(page, `/schedule?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("heading", { name: /^Nothing matches/ }), `search “${q}”`).toBeVisible();
      await expect(dayRegions(page)).toHaveCount(0);
    }

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).not.toMatch(CANCELED_AFTERPARTY);
    expect(xml).toContain(`/schedule/${HAPPY_HOUR_ID}</loc>`);

    const feed = await fetchIcs(page, "/schedule/calendar.ics");
    expect(feed).not.toMatch(CANCELED_AFTERPARTY);

    for (const path of [CANCELED_AFTERPARTY_PATH, `${CANCELED_AFTERPARTY_PATH}/calendar.ics`]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(404);
    }
    const gone = await page.goto(CANCELED_AFTERPARTY_PATH);
    expect(gone?.status()).toBe(404);
  });
});

test.describe("Filters, search and detail pages still work", () => {
  test("Founders picks and type filters, with shareable URLs", async ({ page }) => {
    await openCalendar(page);
    await showFilters(page);
    const picks = page.getByRole("button", { name: "Founders picks" });
    await picks.click();
    await expect(picks).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]view=picks\b/);
    // Dan Caruso's fireside chat and Arnav's happy hour are picks; the kickoff reception isn't.
    await expect(entry(dayRegion(page, "Monday, September 28"), page, DAN_TITLE)).toBeVisible();
    const wednesday = dayRegion(page, "Wednesday, September 30");
    await expect(entry(wednesday, page, HAPPY_HOUR_TITLE)).toBeVisible();
    await expect(entry(wednesday, page, KICKOFF_TITLE)).toHaveCount(0);

    const panels = page.getByRole("group", { name: "Filter by type" }).getByRole("button", { name: /^Panels/ });
    await panels.click();
    await expect(panels).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/[?&]type=panel\b/);
    // Picks ∩ panels: the Sept 29 panel and Founder Failure Lab stay; the fireside chat (a talk)
    // and the happy hour go.
    await expect(entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE)).toBeVisible();
    await expect(dayRegion(page, "Monday, September 28")).toHaveCount(0);
    const wednesdayPanels = dayRegion(page, "Wednesday, September 30");
    await expect(entry(wednesdayPanels, page, FAILURE_LAB_TITLE)).toBeVisible();
    await expect(entry(wednesdayPanels, page, HAPPY_HOUR_TITLE)).toHaveCount(0);

    // The same view from a shared link.
    const shared = page.url();
    await openCalendar(page, shared.slice(shared.indexOf("/schedule")));
    await expect(entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE)).toBeVisible();
    await expect(dayRegion(page, "Monday, September 28")).toHaveCount(0);
  });

  test("search reaches program sessions; “zzz” shows the empty state and reset brings everything back", async ({ page }) => {
    await openCalendar(page);
    const search = page.getByRole("searchbox", { name: "Search the calendar" });
    await search.fill("Isbell");
    await expect(page).toHaveURL(/[?&]q=Isbell\b/);
    await expect(dayRegions(page)).toHaveCount(1);
    const block = entry(dayRegion(page, "Friday, October 2"), page, SHOWCASE_TITLE);
    await expect(block).toBeVisible();
    await expect(block).toContainText("Fireside Chat with Chancellor Charles Isbell");

    await search.fill("zzz");
    await expect(page.getByRole("heading", { name: "Nothing matches these filters" })).toBeVisible();
    await expect(dayRegions(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Reset all filters" }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(search).toHaveValue("");
    await expect(dayRegions(page)).toHaveCount(DAYS.length);
  });

  test("a row's title opens its detail page; “Calendar” leads back to that day", async ({ page }) => {
    await openCalendar(page);
    await entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE).getByRole("link", { name: PANEL_TITLE, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${PANEL_PATH}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PANEL_TITLE);

    await page.getByRole("main").getByRole("link", { name: /^Calendar/ }).first().click();
    await expect(page).toHaveURL(/\/schedule\?day=2026-09-29$/);
    await expect(dayRegions(page)).toHaveCount(1);
    await expect(entry(dayRegion(page, "Tuesday, September 29"), page, PANEL_TITLE)).toBeVisible();
  });
});
