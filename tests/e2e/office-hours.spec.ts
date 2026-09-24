/**
 * Checklist 3 — Office Hours (desktop 1440×900 and phone 390×844).
 *   - An introduction, then ONE mentor grid with all five mentors: Patrick Haddox, Arnav Mishra,
 *     Vikram “Vik” Lakhwara, Elliott Notrica and Ron Lewis — each with a photo (alt = name),
 *     role · company and one availability line. No duplicate lineup anywhere on the page.
 *   - The matching sentence appears exactly once.
 *   - Every card's "Select mentor" action prefills that mentor in the form (and Patrick's / Arnav's
 *     window where one is offered); every profile's "Apply to meet …" does the same.
 *   - Profiles: photo, role, LinkedIn, approved bio and "Can help with" labels — never the internal
 *     basis behind them, organizer notes or draft copy.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  applicationForm,
  applicationHeading,
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
  ONE_ON_ONE,
  ORGANIZER_ONLY,
  preselectionNotice,
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
    await expect(applicationForm(page).getByRole("textbox", { name: /^Broad availability/ })).toBeVisible();
  }
}

test.describe("Office Hours page", () => {
  test("introduction, then one grid with all five mentors — photo, role · company, one availability line", async ({ page }) => {
    await page.goto("/office-hours");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("Founders Office Hours");
    const grid = mentorGrid(page);
    const introBox = (await h1.boundingBox())!;
    const gridBox = (await grid.boundingBox())!;
    expect(introBox.y, "introduction comes before the mentor grid").toBeLessThan(gridBox.y);

    // The five real mentors first, in order; on this (demo) server the demo mentors follow.
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
  });

  test("stays simple: no internal basis, numbering, priority labels or one-on-one promises", async ({ page }) => {
    await page.goto("/office-hours");
    const main = page.getByRole("main");
    const text = await visibleText(main);
    for (const basis of EXPERTISE_BASIS) expect(text).not.toMatch(basis);
    expect(text).not.toMatch(/\b0\d\s*[/—–-]\s*0\d\b/); // "01 / 05" style counters
    expect(text).not.toMatch(/In priority order/i);
    expect(text).not.toMatch(ONE_ON_ONE);
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
    test(`${mentor.name}: photo, role, LinkedIn, bio, “Can help with” — and Apply prefills the form`, async ({ page }) => {
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
      for (const label of mentor.helpsWith) await expect(help).toContainText(label);
      await expect(main).toContainText(mentor.cardLine);

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
