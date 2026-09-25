/**
 * Checklist 2 — Home (desktop 1440×900 and phone 390×844).
 *   - H1 "Meet the people building what’s next." and the primary "Apply for Office Hours" on the
 *     first screen.
 *   - All six mentors previewed (photo, name, role and company, one availability line): Patrick
 *     "Thu, Oct 1 · 10:00–11:30 AM CT", Arnav "Fri, Oct 2 · 10:00–11:30 AM CT", Ron "Thu, Oct 1 ·
 *     2:30–4:30 PM CT", Rishab "Thu, Oct 1 · 12:00–5:00 PM CT", Elliott his first window "Wed, Sept 30 ·
 *     9:00 AM–12:00 PM CT" plus "+ 2 more"; only Vik "Scheduling in progress".
 *   - Featured events (a 2×2 grid): Dan Caruso's fireside chat, the Sept 29 panel, Arnav's happy
 *     hour, then Founder Failure Lab (Hosted by Founders) — each with its Founders label.
 *   - A link to the full calendar.
 *   - Gone for good: the "Founders vs" section, any "one-on-one" promise, HERE Apartments.
 */
import { expect, test, type Locator } from "@playwright/test";
import {
  CANCELED_AFTERPARTY,
  expectHeadshot,
  expectInformationOnly,
  FOUNDERS_VS,
  horizontalOverflow,
  MENTORS,
  ONE_ON_ONE,
  PATRICK,
  ARNAV,
  ELLIOTT,
  PENDING_MENTORS,
  RISHAB,
  RON,
} from "./support/helpers";
import {
  DAN_TITLE,
  FAILURE_LAB_ADDRESS,
  FAILURE_LAB_PATH,
  FAILURE_LAB_ROOM,
  FAILURE_LAB_TIME,
  FAILURE_LAB_TITLE,
  FAILURE_LAB_VENUE,
  HAPPY_HOUR_PATH,
  HAPPY_HOUR_TITLE,
  PANEL_PLACE,
  PANEL_TITLE,
} from "./support/pages";

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box, "element should be rendered").not.toBeNull();
  return box!.y;
}

test.describe("Home", () => {
  test("headline and the primary Apply for Office Hours on the first screen", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meet the people building what’s next.");

    const cta = main.getByRole("link", { name: "Apply for Office Hours", exact: true }).first();
    await expect(cta).toHaveAttribute("href", "/office-hours#apply");
    await expect(cta).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({ ratio: 1 });

    await cta.click();
    await expect(page).toHaveURL(/\/office-hours#apply$/);
    await expect(page.getByRole("form", { name: "Apply for Office Hours" })).toBeVisible();
  });

  test("all six mentors are previewed with photo, role and company, and one availability line", async ({ page }) => {
    await page.goto("/");
    const mentors = page.getByRole("region", { name: "Who you can meet" });
    await expect(mentors).toBeVisible();

    // The six real mentors, first and in order (the demo server may list demo mentors after them).
    const names = (await mentors.getByRole("heading", { level: 3 }).allInnerTexts()).map((t) => t.trim());
    expect(names.slice(0, MENTORS.length)).toEqual(MENTORS.map((m) => m.name));

    for (const mentor of MENTORS) {
      const card = mentors.getByRole("listitem").filter({ has: page.getByRole("heading", { name: mentor.name, exact: true }) });
      await expect(card).toHaveCount(1);
      await expectHeadshot(card.getByAltText(mentor.name, { exact: true }), mentor);
      await expect(card).toContainText(mentor.role);
      await expect(card).toContainText(mentor.company);
      await expect(card.getByRole("link", { name: mentor.name, exact: true })).toHaveAttribute("href", `/office-hours/${mentor.id}`);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }

    // One availability line each: the published window, or "Scheduling in progress".
    const card = (name: string) =>
      mentors.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card(PATRICK.name)).toContainText("Thu, Oct 1");
    await expect(card(PATRICK.name)).toContainText("10:00–11:30 AM CT");
    // Arnav: his exact Friday window (no longer "Morning, exact window pending").
    await expect(card(ARNAV.name).locator("time")).toHaveText("Fri, Oct 2");
    await expect(card(ARNAV.name).locator("time")).toHaveAttribute("datetime", "2026-10-02");
    await expect(card(ARNAV.name)).toContainText("10:00–11:30 AM CT");
    await expect(card(ARNAV.name)).not.toContainText(/Morning|pending|to be confirmed/i);
    // Ron: Thu, Oct 1, 2:30–4:30 PM (and nothing about any other day).
    await expect(card(RON.name).locator("time")).toHaveText("Thu, Oct 1");
    await expect(card(RON.name).locator("time")).toHaveAttribute("datetime", "2026-10-01");
    await expect(card(RON.name)).toContainText("2:30–4:30 PM CT");
    await expect(card(RON.name)).not.toContainText(/Scheduling in progress|Oct 4/);
    // Rishab: his confirmed window, Thu, Oct 1 from noon to 5 PM (never Oct 2).
    await expect(card(RISHAB.name).locator("time")).toHaveText("Thu, Oct 1");
    await expect(card(RISHAB.name).locator("time")).toHaveAttribute("datetime", "2026-10-01");
    await expect(card(RISHAB.name)).toContainText("12:00–5:00 PM CT");
    await expect(card(RISHAB.name)).not.toContainText(/to be confirmed|to be announced|TBA/i);
    await expect(card(RISHAB.name)).not.toContainText("Oct 2");
    // Elliott: the first of his three windows (Wed, Sept 30 morning), then "+ 2 more".
    await expect(card(ELLIOTT.name).locator("time")).toHaveText("Wed, Sept 30");
    await expect(card(ELLIOTT.name).locator("time")).toHaveAttribute("datetime", "2026-09-30");
    await expect(card(ELLIOTT.name)).toContainText("9:00 AM–12:00 PM CT");
    await expect(card(ELLIOTT.name)).toContainText("+ 2 more");
    await expect(card(ELLIOTT.name)).not.toContainText(/Scheduling in progress|to be confirmed|to be announced/i);
    // Only Vik's times aren't set yet.
    expect(PENDING_MENTORS.map((m) => m.firstName)).toEqual(["Vik"]);
    for (const mentor of PENDING_MENTORS) await expect(card(mentor.name)).toContainText("Scheduling in progress");
  });

  test("featured events: Dan Caruso before the Sept 29 panel, each with its Founders label; then the calendar link", async ({ page }) => {
    await page.goto("/");
    const featured = page.getByRole("region", { name: "Featured events" });
    const titles = (await featured.getByRole("heading", { level: 3 }).allInnerTexts()).map((t) => t.trim());
    expect(titles).toContain(DAN_TITLE);
    expect(titles).toContain(PANEL_TITLE);
    expect(titles.indexOf(DAN_TITLE), "Dan Caruso is featured before the Sept 29 panel").toBeLessThan(titles.indexOf(PANEL_TITLE));

    const dan = featured.getByRole("article", { name: DAN_TITLE });
    await expect(dan).toContainText("Supported by Founders");
    await expect(dan).toContainText("Sept 28");
    await expect(dan).toContainText("4:00 PM CT");
    await expect(dan).toContainText("Beckman Institute, Auditorium (Room 1025)");
    await expect(dan.getByRole("link", { name: DAN_TITLE })).toHaveAttribute("href", "/schedule/dan-caruso-fireside-chat");
    // Information only — no application, interest, waitlist or booking affordance.
    await expectInformationOnly(dan);

    const panel = featured.getByRole("article", { name: PANEL_TITLE });
    await expect(panel).toContainText("Co-hosted by Founders");
    await expect(panel).toContainText("Sept 29");
    await expect(panel).toContainText("6:00–8:00 PM CT");
    await expect(panel).toContainText(PANEL_PLACE);

    // Then Arnav's happy hour and Founder Failure Lab — four cards in all, in this order.
    expect(titles).toEqual([DAN_TITLE, PANEL_TITLE, HAPPY_HOUR_TITLE, FAILURE_LAB_TITLE]);
    const happyHour = featured.getByRole("article", { name: HAPPY_HOUR_TITLE });
    await expect(happyHour).toContainText("Supported by Founders");
    await expect(happyHour).toContainText("Sept 30");
    await expect(happyHour).toContainText("5:00–7:00 PM CT");
    await expect(happyHour.getByRole("link", { name: HAPPY_HOUR_TITLE })).toHaveAttribute("href", HAPPY_HOUR_PATH);

    const lab = featured.getByRole("article", { name: FAILURE_LAB_TITLE });
    await expect(lab).toContainText("Hosted by Founders");
    await expect(lab).toContainText("Sept 30");
    await expect(lab).toContainText(FAILURE_LAB_TIME);
    await expect(lab).toContainText(`${FAILURE_LAB_VENUE}, ${FAILURE_LAB_ROOM}`);
    await expect(lab).toContainText(FAILURE_LAB_ADDRESS);
    await expect(lab.getByRole("link", { name: FAILURE_LAB_TITLE })).toHaveAttribute("href", FAILURE_LAB_PATH);

    // Two columns from tablet width up (a 2×2 grid); one column on phones.
    const tops = await Promise.all(
      [DAN_TITLE, PANEL_TITLE, HAPPY_HOUR_TITLE, FAILURE_LAB_TITLE].map((name) => top(featured.getByRole("article", { name }))),
    );
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      expect(Math.abs(tops[0] - tops[1]), "Dan and the panel share the first row").toBeLessThanOrEqual(1);
      expect(Math.abs(tops[2] - tops[3]), "the happy hour and the lab share the second row").toBeLessThanOrEqual(1);
      expect(tops[2]).toBeGreaterThan(tops[0]);
    } else {
      for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1]);
    }

    // The full calendar is one click away.
    const calendar = page.getByRole("main").getByRole("link", { name: /full calendar/i });
    await expect(calendar).toHaveAttribute("href", "/schedule");
    await expect(page.getByRole("main")).toContainText("related events begin Sept 28");
    await calendar.click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Calendar");
  });

  test("order: headline → mentors → featured events → calendar link", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    const [yHero, yMentors, yFeatured, yCalendar] = await Promise.all([
      top(page.getByRole("heading", { level: 1 })),
      top(page.getByRole("region", { name: "Who you can meet" })),
      top(page.getByRole("region", { name: "Featured events" })),
      top(main.getByRole("link", { name: /full calendar/i })),
    ]);
    expect(yHero).toBeLessThan(yMentors);
    expect(yMentors).toBeLessThan(yFeatured);
    expect(yFeatured).toBeLessThan(yCalendar);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("removed for good: “Founders vs”, “one-on-one” and HERE Apartments", async ({ page }) => {
    await page.goto("/");
    // textContent of <body> includes the serialized page data, so client props are covered too.
    const body = page.locator("body");
    await expect(body).not.toContainText(FOUNDERS_VS);
    await expect(body).not.toContainText(ONE_ON_ONE);
    await expect(body).not.toContainText(CANCELED_AFTERPARTY);
    await expect(page.getByRole("heading", { name: FOUNDERS_VS })).toHaveCount(0);
  });
});
