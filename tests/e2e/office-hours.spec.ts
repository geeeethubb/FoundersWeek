/**
 * Checklist 3 — Office Hours (desktop 1440×900 and phone 390×844).
 *   - An introduction, then ONE mentor grid with all six mentors: Patrick Haddox, Arnav Mishra,
 *     Vikram “Vik” Lakhwara, Elliott Notrica, Ron Lewis and Rishab Veldur — each with a photo
 *     (alt = name), role · company, "Can help with" labels (or, for Rishab, the first sentence of
 *     his bio) and one availability line. No duplicate lineup anywhere on the page.
 *   - The matching sentence appears exactly once, and so does the session rule ("Each session is 25
 *     minutes, with a 5-minute break between sessions.").
 *   - Every card's "Select mentor" action prefills that mentor in the form (and Patrick's / Arnav's /
 *     Ron's / Rishab's window); every profile's "Apply to meet …" does the same. A preselected window
 *     is enough on its own; mentors whose times aren't set yet (Vik, Elliott) need broad
 *     availability, and the form says so.
 *   - Profiles: photo, role, LinkedIn, approved bio and "Can help with" labels, never the internal
 *     basis behind them, organizer notes or draft copy. Mentors with a window state the session
 *     rule under it. Rishab: "Background" chips and a "Good fit for" paragraph instead of "Can help
 *     with", his Showcase panel as a separate appearance, and office hours on Thu, Oct 1 only,
 *     12:00–5:00 PM CT. Patrick: in person at Espresso Royale at Grainger Library, 1301 W
 *     Springfield Ave. Ron: Thu, Oct 1, 2:30–4:30 PM CT in person at the Business Instructional
 *     Facility (BIF), 515 E. Gregory Drive, and nothing about his organizer-only Oct 4 availability.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  applicationForm,
  applicationHeading,
  AUVI_CLAIMS,
  AUVI_LABS_URL,
  BROAD_AVAILABILITY_ASK,
  broadAvailabilityField,
  CONTENT_NOTES,
  countMatches,
  DEMO_MENTOR_NAMES,
  DRAFT_TOPICS,
  escapeRegExp,
  expectClearOfHeader,
  expectHeadshot,
  EXPERTISE_BASIS,
  horizontalOverflow,
  MATCHING_SENTENCE,
  MENTORS,
  mentorCheckbox,
  mentorWindows,
  OCT_4,
  ONE_ON_ONE,
  ORGANIZER_ONLY,
  PATRICK,
  PATRICK_ADDRESS,
  PATRICK_VENUE,
  PATRICK_WINDOW_NOTE,
  preselectionNotice,
  RISHAB,
  RISHAB_SHOWCASE_SESSION,
  RISHAB_WINDOW_NOTE,
  RON,
  RON_ADDRESS,
  RON_VENUE,
  RON_WINDOW_NOTE,
  SESSION_COUNT,
  SESSION_LENGTH_HINT,
  SESSION_RULE,
  visibleText,
  waitForHydration,
  type MentorFixture,
} from "./support/helpers";

function mentorGrid(page: Page) {
  return page.getByRole("region", { name: "Who you can meet" });
}

function mentorCard(page: Page, mentor: Pick<MentorFixture, "name">) {
  return mentorGrid(page).getByRole("article", { name: mentor.name, exact: true });
}

async function openOfficeHours(page: Page, path = "/office-hours") {
  await page.goto(path);
  await waitForHydration(applicationForm(page).getByRole("button", { name: "Submit application" }));
}

/** After a mentor action: the application with that mentor (and their one window) selected — nobody else. */
async function expectPrefilled(page: Page, mentor: MentorFixture) {
  const window = mentor.windowId ? `&window=${escapeRegExp(mentor.windowId)}` : "";
  await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${escapeRegExp(mentor.id)}${window}#apply$`));
  await expect(mentorCheckbox(page, mentor)).toBeChecked();
  for (const other of MENTORS.filter((m) => m !== mentor)) await expect(mentorCheckbox(page, other)).not.toBeChecked();
  if (mentor.windowId) {
    await expect(mentorWindows(page, mentor)).toHaveCount(1);
    await expect(mentorWindows(page, mentor)).toBeChecked();
  } else {
    // Schedule pending: nothing to pick; broad availability is the way to say when you're free.
    await expect(mentorWindows(page, mentor)).toHaveCount(0);
    await expect(broadAvailabilityField(page)).toBeVisible();
  }
  const broad = broadAvailabilityField(page);
  if (mentor.timesPending) {
    // Times not set yet: broad availability is required, and the hint says why (and, with no
    // listed time to tick, how long a session is).
    await expect(broad).toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(
      `${BROAD_AVAILABILITY_ASK} Needed because ${mentor.firstName}’s times aren’t set yet. ${SESSION_LENGTH_HINT}`,
    );
  } else {
    // The preselected window (Patrick's, Arnav's, Ron's or Rishab's) is enough on its own.
    await expect(broad).not.toHaveAttribute("aria-required", "true");
    await expect(broad).toHaveAccessibleDescription(`${BROAD_AVAILABILITY_ASK} Not needed if you tick a time above.`);
  }
}

test.describe("Office Hours page", () => {
  test("introduction, then one grid with all six mentors — photo, role · company, one availability line", async ({ page }) => {
    await page.goto("/office-hours");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("Founders Office Hours");
    await expect(page.getByRole("main")).toContainText("Choose who you’d like to meet and apply once.");
    const grid = mentorGrid(page);
    const introBox = (await h1.boundingBox())!;
    const gridBox = (await grid.boundingBox())!;
    expect(introBox.y, "introduction comes before the mentor grid").toBeLessThan(gridBox.y);

    // The six real mentors first, in order; on this (demo) server the demo mentors follow.
    const names = (await grid.getByRole("article").getByRole("heading").allInnerTexts()).map((t) => t.trim());
    expect(names.slice(0, MENTORS.length)).toEqual(MENTORS.map((m) => m.name));
    for (const extra of names.slice(MENTORS.length)) expect(DEMO_MENTOR_NAMES).toContain(extra);

    const width = page.viewportSize()!.width;
    for (const mentor of MENTORS) {
      const card = mentorCard(page, mentor);
      await expect(card).toHaveCount(1);
      await expectHeadshot(card.getByAltText(mentor.name, { exact: true }), mentor);
      await expect(card).toContainText(mentor.role);
      await expect(card).toContainText(mentor.company);
      // Exactly one availability line.
      const text = (await card.textContent()) ?? "";
      expect(countMatches(text, "Office hours:"), `${mentor.name}: one availability line`).toBe(1);
      expect(countMatches(text, mentor.cardLine), `${mentor.name}: "${mentor.cardLine}"`).toBe(1);
      // What they can help with (labels only) — or, without an approved list, the bio's first sentence.
      if (mentor.helpsWith.length) {
        await expect(card).toContainText("Can help with");
        for (const label of mentor.helpsWith) await expect(card).toContainText(label);
      } else {
        await expect(card).not.toContainText("Can help with");
        await expect(card).toContainText(mentor.cardIntro!);
      }
      // One action to select the mentor, one quiet link to the profile.
      await expect(card.getByRole("link", { name: new RegExp(`^Select mentor\\W*${escapeRegExp(mentor.name)}$`) })).toBeVisible();
      await expect(card.getByRole("link", { name: new RegExp(`^Profile\\W*${escapeRegExp(mentor.name)}$`) })).toHaveAttribute(
        "href",
        `/office-hours/${mentor.id}`,
      );
      // Always visible — no carousel or sideways scroller.
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("no duplicate lineup; the matching sentence appears exactly once", async ({ page }) => {
    await page.goto("/office-hours");
    const main = page.getByRole("main");
    for (const mentor of MENTORS) {
      // One card per mentor on the whole page: a single heading and a single named photo. (The
      // application's mentor checkboxes use decorative photos and no headings.)
      await expect(main.getByRole("heading", { name: mentor.name, exact: true }), `${mentor.name} heading`).toHaveCount(1);
      await expect(main.getByAltText(mentor.name, { exact: true }), `${mentor.name} photo`).toHaveCount(1);
    }
    await expect(main.getByRole("region", { name: "Who you can meet" })).toHaveCount(1);

    const text = await visibleText(main);
    expect(countMatches(text, MATCHING_SENTENCE), "the matching sentence").toBe(1);
    expect(countMatches(text, /Founders will match/g), "any matching explanation").toBe(1);
    // The session rule is stated once, under "How matching works", next to "applying doesn't reserve a time".
    expect(countMatches(text, SESSION_RULE), "the session rule").toBe(1);
    const matching = main.getByRole("region", { name: "How matching works", exact: true });
    await expect(matching).toContainText(
      `${SESSION_RULE} Appointments are limited, and applying doesn’t reserve a time.`,
    );
  });

  test("stays simple: no internal basis, numbering, priority labels or one-on-one promises", async ({ page }) => {
    await page.goto("/office-hours");
    const main = page.getByRole("main");
    const text = await visibleText(main);
    for (const basis of EXPERTISE_BASIS) expect(text).not.toMatch(basis);
    expect(text).not.toMatch(/\b0\d\s*[/—–-]\s*0\d\b/); // "01 / 05" style counters
    expect(text).not.toMatch(/In priority order/i);
    expect(text).not.toMatch(ONE_ON_ONE);
    // How many sessions fit in a window is for organizers; the public page never counts them.
    expect(text).not.toMatch(SESSION_COUNT);
    // Nothing private in the page or its serialized data either.
    const body = page.locator("body");
    for (const topic of DRAFT_TOPICS) await expect(body).not.toContainText(topic);
    await expect(body).not.toContainText(ORGANIZER_ONLY);
    await expect(body).not.toContainText(CONTENT_NOTES);
  });
});

test.describe("Every mentor card's Select action prefills the application", () => {
  for (const mentor of MENTORS) {
    test(`Select mentor — ${mentor.name}`, async ({ page }) => {
      await openOfficeHours(page);
      await mentorCard(page, mentor).getByRole("link", { name: /^Select mentor/ }).click();
      await expectPrefilled(page, mentor);
      // The application is on screen, saying who was just selected.
      await expect(preselectionNotice(page, mentor)).toBeInViewport();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("Mentor profiles", () => {
  for (const mentor of MENTORS) {
    const topics = mentor.helpsWith.length ? "“Can help with”" : "“Background”, “Good fit for”";
    test(`${mentor.name}: photo, role, LinkedIn, bio, ${topics} — and Apply prefills the form`, async ({ page }) => {
      await page.goto(`/office-hours/${mentor.id}`);
      const main = page.getByRole("main");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(mentor.name);
      await expect(main).toContainText(mentor.role);
      await expect(main).toContainText(mentor.company);
      await expectHeadshot(main.getByAltText(mentor.name, { exact: true }).first(), mentor);

      const linkedin = main.getByRole("link", { name: /^LinkedIn\b/ });
      await expect(linkedin).toHaveAttribute("href", mentor.linkedin);
      await expect(linkedin).toHaveAttribute("target", "_blank");
      await expect(linkedin).toHaveAttribute("rel", /\bnoopener\b/);

      await expect(main).toContainText(mentor.bioFragment);
      const help = page.getByRole("region", { name: "Can help with", exact: true });
      if (mentor.helpsWith.length) {
        for (const label of mentor.helpsWith) await expect(help).toContainText(label);
      } else {
        // No approved topic list, but an approved "Good fit for": the fit says it better.
        await expect(help).toHaveCount(0);
      }
      if (mentor.background) {
        await expect(page.getByRole("region", { name: "Background", exact: true }).getByRole("listitem")).toHaveText(
          mentor.background,
        );
      }
      if (mentor.goodFitFor) {
        // One full-sentence item reads as prose under "Good fit for" (never as a "Useful for" list).
        const fit = page.getByRole("region", { name: "Good fit for", exact: true });
        await expect(fit).toContainText(mentor.goodFitFor);
        await expect(fit.getByRole("listitem")).toHaveCount(0);
        await expect(page.getByRole("region", { name: "Useful for", exact: true })).toHaveCount(0);
      }
      await expect(main).toContainText(mentor.cardLine);
      // The office-hours block: the window (or "Scheduling in progress"), then the session rule once.
      const officeHoursBlock = main.locator("header");
      await expect(officeHoursBlock).toContainText(mentor.cardLine);
      expect(countMatches(await visibleText(officeHoursBlock), SESSION_RULE), "the session rule, once").toBe(1);
      expect(await visibleText(main)).not.toMatch(SESSION_COUNT);

      if (mentor === PATRICK) {
        // In person at Espresso Royale in Grainger Library, under his Thursday window, with the
        // window's own note (and never how many sessions he's hosting).
        await expect(officeHoursBlock).toContainText(`${PATRICK_VENUE}, ${PATRICK_ADDRESS}`);
        await expect(officeHoursBlock).toContainText(PATRICK_WINDOW_NOTE);
        await expect(officeHoursBlock).not.toContainText(/to be confirmed|to be announced/i);
      }
      if (mentor === RON) {
        // In person at BIF: the building, then the street address, under his Thursday window.
        await expect(officeHoursBlock.locator("time")).toHaveText("Thu, Oct 1");
        await expect(officeHoursBlock.locator("time")).toHaveAttribute("datetime", "2026-10-01");
        await expect(officeHoursBlock).toContainText(`${RON_VENUE}, ${RON_ADDRESS}`);
        await expect(officeHoursBlock).toContainText(RON_WINDOW_NOTE);
        await expect(officeHoursBlock).not.toContainText(/Scheduling in progress|to be confirmed|to be announced/i);
        // Every "Apply to meet Ron" preselects his one window.
        const applyLinks = main.getByRole("link", { name: `Apply to meet ${RON.firstName}`, exact: true });
        expect(await applyLinks.count()).toBeGreaterThanOrEqual(1);
        for (const link of await applyLinks.all()) {
          await expect(link).toHaveAttribute("href", `/office-hours?mentor=${RON.id}&window=${RON.windowId}#apply`);
        }
        // His share card and description carry the same window.
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Thu, Oct 1 · 2:30–4:30 PM CT/);
      }
      // Ron's Oct 4 availability is organizer-only: nowhere on any profile, not even in page data.
      await expect(page.locator("body")).not.toContainText(OCT_4);
      expect(await page.content()).not.toMatch(OCT_4);

      if (mentor === RISHAB) {
        await expect(main.getByRole("link", { name: /^Auvi Labs\b/ })).toHaveAttribute("href", AUVI_LABS_URL);
        // Office hours only on Thu, Oct 1, noon to 5 PM, with the window's own note; his Friday
        // Showcase panel is a separate appearance.
        const officeHours = main.locator("header");
        await expect(officeHours).toContainText(mentor.cardLine);
        await expect(officeHours).toContainText(RISHAB_WINDOW_NOTE);
        await expect(officeHours).not.toContainText(/Oct 2|Friday|to be confirmed|to be announced/);
        const appearances = page.getByRole("region", { name: `${mentor.firstName} at Founders Week`, exact: true });
        await expect(appearances.getByRole("link", { name: new RegExp(escapeRegExp(RISHAB_SHOWCASE_SESSION)) })).toHaveAttribute(
          "href",
          "/schedule/founders-showcase-day-sessions",
        );
        // The panel's full time, as on the Showcase program (1:20–1:55 PM).
        await expect(appearances).toContainText("Speaking Fri, Oct 2 · 1:20–1:55 PM CT");
        await expect(page.locator("body")).not.toContainText(AUVI_CLAIMS);
      }

      // Labels only — never the internal basis, drafts or organizer notes.
      const text = await visibleText(main);
      for (const basis of EXPERTISE_BASIS) expect(text).not.toMatch(basis);
      const body = page.locator("body");
      for (const topic of DRAFT_TOPICS) await expect(body).not.toContainText(topic);
      await expect(body).not.toContainText(ORGANIZER_ONLY);
      await expect(body).not.toContainText(CONTENT_NOTES);
      await expect(body).not.toContainText(ONE_ON_ONE);

      const apply = main.getByRole("link", { name: `Apply to meet ${mentor.firstName}`, exact: true }).first();
      await waitForHydration(apply);
      await apply.click();
      await expectPrefilled(page, mentor);
      await expectClearOfHeader(page, applicationHeading(page), "application heading after a profile's Apply");
    });
  }
});
