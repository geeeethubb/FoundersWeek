/**
 * Checklist 2 — the four mentors.
 *   - /office-hours shows Patrick, Arnav, Vik and Ron with their verified roles, always visible
 *     (desktop and phone): no carousel, nothing hidden behind a click.
 *   - Availability: Patrick Thu Oct 1 10:00–11:30 AM CT; Arnav Friday before noon; Vik and Ron
 *     "Scheduling in progress".
 *   - Profiles: verified identity, background, expertise with its basis, availability, Founders Week
 *     sessions, and the CTA.
 *   - EVERY mentor CTA (office hours lineup + sections, each profile, home) lands on the
 *     application with that mentor checked — and Patrick's window checked from his window CTA.
 *   - Never public: draft topics ("Revenue strategy") and organizer notes ("commitments").
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ARNAV,
  DRAFT_TOPICS,
  escapeRegExp,
  MENTORS,
  mentorCheckbox,
  mentorTimes,
  ORGANIZER_ONLY,
  PATRICK,
  RON,
  VIK,
  type MentorFixture,
} from "./support/helpers";

const CTA_NAME = /^(Apply to meet|Express interest)\b/;
const SHOWCASE_PATH = "/schedule/founders-showcase-day-sessions";

/** The card/row for `mentor` inside `scope`: the list item that holds their name as a heading. */
function mentorItem(page: Page, scope: Locator, mentor: MentorFixture): Locator {
  return scope
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: mentor.name, exact: true }) })
    .first();
}

/** After following a mentor CTA: the application is on screen with that mentor preselected. */
async function expectApplicationFor(page: Page, mentor: MentorFixture) {
  await expect(page).toHaveURL(new RegExp(`/office-hours\\?mentor=${escapeRegExp(mentor.id)}(&(window|slot)=[a-z0-9-]+)?#apply$`));
  await expect(page.getByRole("region", { name: "Apply for Office Hours", exact: true })).toBeInViewport();
  await expect(mentorCheckbox(page, mentor)).toBeChecked();
  const windowId = new URL(page.url()).searchParams.get("window");
  if (mentor.windowId) {
    // Mentors with one published window: their CTA preselects it.
    expect(windowId, `${mentor.name}'s CTA should preselect the window`).toBe(mentor.windowId);
    await expect(mentorTimes(page, mentor)).toHaveCount(1);
    await expect(mentorTimes(page, mentor)).toBeChecked();
  } else {
    // Scheduling in progress: interest only, nothing to pick.
    expect(windowId).toBeNull();
    await expect(mentorTimes(page, mentor)).toHaveCount(0);
  }
}

/** Click the CTA for `mentor` found by `find` on `path`, then check the application. */
async function followCta(page: Page, path: string, mentor: MentorFixture, find: (page: Page) => Locator) {
  await page.goto(path);
  const cta = find(page).filter({ visible: true }).first();
  await expect(cta, `${mentor.name} CTA on ${path}`).toHaveText(new RegExp(`^${escapeRegExp(mentor.cta)}`));
  await cta.click();
  await expectApplicationFor(page, mentor);
}

test.describe("Mentors on /office-hours", () => {
  test("all four mentors are listed with their verified roles, all visible at once", async ({ page }) => {
    await page.goto("/office-hours");
    const lineup = page.getByRole("region", { name: "The lineup" });
    const width = page.viewportSize()!.width;

    for (const mentor of MENTORS) {
      const card = mentorItem(page, lineup, mentor);
      await expect(card.getByRole("heading", { name: mentor.name, exact: true })).toBeVisible();
      if (mentor.role) await expect(card).toContainText(mentor.role);
      await expect(card).toContainText(mentor.company);
      // Not hidden in a scroller or carousel: the whole card sits inside the page width.
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      await expect(card.getByRole("link", { name: CTA_NAME })).toBeVisible();
    }

    // Vik's title is unverified: the card names only his organization.
    await expect(mentorItem(page, lineup, VIK).getByText("Stakehouse", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Meet founders/);
  });

  test("availability: Patrick Thu Oct 1 10:00–11:30 AM CT, Arnav Friday before noon, Vik and Ron scheduling", async ({ page }) => {
    await page.goto("/office-hours");
    const lineup = page.getByRole("region", { name: "The lineup" });

    const patrick = mentorItem(page, lineup, PATRICK);
    await expect(patrick).toContainText("Thu, Oct 1");
    await expect(patrick).toContainText("10:00–11:30 AM CT");

    const arnav = mentorItem(page, lineup, ARNAV);
    await expect(arnav).toContainText("Fri, Oct 2");
    await expect(arnav).toContainText(/before noon/i);

    for (const mentor of [VIK, RON]) {
      await expect(mentorItem(page, lineup, mentor)).toContainText("Scheduling in progress");
    }

    // The full mentor sections say the same, in words.
    const sections = page.getByRole("region", { name: "Who you can meet" });
    await expect(sections.getByRole("article", { name: PATRICK.name })).toContainText("10:00–11:30 AM CT");
    await expect(sections.getByRole("article", { name: ARNAV.name })).toContainText(/Friday before noon/);
    for (const mentor of [VIK, RON]) {
      await expect(sections.getByRole("article", { name: mentor.name })).toContainText("Scheduling in progress");
    }
  });

  for (const mentor of MENTORS) {
    test(`profile: ${mentor.name}`, async ({ page }) => {
      await page.goto(`/office-hours/${mentor.id}`);
      const main = page.getByRole("main");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(mentor.name);
      if (mentor.role) await expect(main).toContainText(mentor.role);
      await expect(main).toContainText(mentor.company);

      await expect(page.getByRole("region", { name: "Background", exact: true }).getByRole("paragraph").first()).not.toBeEmpty();
      const expertise = page.getByRole("region", { name: "Expertise", exact: true });
      await expect(expertise.getByRole("listitem").first()).toBeVisible();
      await expect(expertise).toContainText("Basis");

      const officeHours = page.getByRole("region", { name: "Office hours", exact: true });
      if (mentor.windowId) {
        await expect(officeHours).toContainText(mentor === PATRICK ? "10:00–11:30 AM CT" : /before noon/i);
      } else {
        await expect(officeHours).toContainText("Scheduling in progress");
      }

      // Patrick, Arnav and Vik speak at the Friday Founders Showcase; Ron has no listed session.
      const atFoundersWeek = page.getByRole("region", { name: "At Founders Week", exact: true });
      if (mentor === RON) {
        await expect(atFoundersWeek).toHaveCount(0);
      } else {
        await expect(atFoundersWeek.getByRole("link").first()).toHaveAttribute("href", SHOWCASE_PATH);
      }

      await expect(main.getByRole("link", { name: mentor.cta, exact: true }).filter({ visible: true })).toHaveCount(1);
    });
  }
});

test.describe("Every mentor CTA opens the application with that mentor preselected", () => {
  test("from the /office-hours lineup", async ({ page }) => {
    for (const mentor of MENTORS) {
      await followCta(page, "/office-hours", mentor, (p) =>
        mentorItem(p, p.getByRole("region", { name: "The lineup" }), mentor).getByRole("link", { name: CTA_NAME }),
      );
    }
  });

  test("from the /office-hours mentor sections", async ({ page }) => {
    for (const mentor of MENTORS) {
      await followCta(page, "/office-hours", mentor, (p) =>
        p
          .getByRole("region", { name: "Who you can meet" })
          .getByRole("article", { name: mentor.name })
          .getByRole("link", { name: CTA_NAME }),
      );
    }
  });

  for (const profile of MENTORS) {
    test(`from ${profile.name}'s profile (own CTA and the other mentors')`, async ({ page }) => {
      const path = `/office-hours/${profile.id}`;
      // The profile's own CTA (side panel on desktop, bottom action bar on phones).
      // (Exact name: the other mentors' cards carry longer names, e.g. "Express interest in meeting …".)
      await followCta(page, path, profile, (p) => p.getByRole("main").getByRole("link", { name: profile.cta, exact: true }));
      // "More Founders Office Hours": every other mentor's CTA.
      for (const other of MENTORS.filter((m) => m !== profile)) {
        await followCta(page, path, other, (p) =>
          mentorItem(p, p.getByRole("region", { name: "More Founders Office Hours" }), other).getByRole("link", {
            name: CTA_NAME,
          }),
        );
      }
    });
  }

  test("from the home page roster", async ({ page }) => {
    for (const mentor of MENTORS) {
      await followCta(page, "/", mentor, (p) =>
        mentorItem(p, p.getByRole("region", { name: /Founders Office Hours/ }).first(), mentor).getByRole("link", {
          name: CTA_NAME,
        }),
      );
    }
  });
});

test.describe("Unapproved and organizer-only copy stays private", () => {
  for (const path of ["/", "/office-hours", `/office-hours/${RON.id}`, `/office-hours/${VIK.id}`, "/schedule"]) {
    test(`nothing private on ${path}`, async ({ page }) => {
      await page.goto(path);
      const body = page.locator("body");
      for (const topic of DRAFT_TOPICS) await expect(body).not.toContainText(topic);
      await expect(body).not.toContainText(ORGANIZER_ONLY);
      await expect(body).not.toContainText(/\bDraft\b/);
      if (path === `/office-hours/${RON.id}`) {
        // Ron's suggested topics are a draft: no "Ask me about" section at all.
        await expect(page.getByRole("region", { name: "Ask me about", exact: true })).toHaveCount(0);
      }
    });
  }
});
