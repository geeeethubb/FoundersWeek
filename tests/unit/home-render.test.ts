/**
 * Renders the home page to static HTML with the public (default-env) data and checks what students
 * see: Office Hours first (every mentor, prefilled CTAs), then Dan Caruso (information only — no
 * application of any kind), then the Sep 29 panel, then the calendar and the Founders vs. Founders
 * Week explainer. Also checks the page metadata.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteError from "@/app/error";
import NotFound from "@/app/not-found";
import HomePage, { generateMetadata } from "@/app/page";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import { MentorRoster } from "@/components/home/mentor-roster";
import { appearancesByMentor } from "@/lib/mentors-view";

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/ ([,:;.])/g, "$1");
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

/** The HTML of the <section aria-labelledby="<id>"> … </section> block. */
function sectionHtml(html: string, labelledBy: string): string {
  const start = html.indexOf(`<section aria-labelledby="${labelledBy}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  const re = /<(\/?)section\b[^>]*>/g;
  re.lastIndex = start;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error("unclosed section");
}

/** No application, interest, waitlist or booking affordance of any kind. */
function expectNoApplication(html: string) {
  expect(text(html)).not.toMatch(/apply|express interest|interest form|waitlist|book(ing)?\b|reserve a|sign up|register/i);
  expect(hrefs(html).filter((h) => h.includes("#apply") || h.startsWith("/apply") || h.includes("mentor="))).toEqual([]);
}

const MENTOR_NAMES = ["Patrick Haddox", "Arnav Mishra", "Vikram “Vik” Lakhwara", "Ron Lewis"];

describe("home page (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const page = () => renderToStaticMarkup(createElement(HomePage));

  it("leads with Office Hours, then Dan Caruso, then the Sep 29 panel, then the calendar and the explainer", () => {
    const t = text(page());
    const order = [
      "Office hours with founders",
      "Apply for Office Hours",
      "Patrick Haddox",
      "Ron Lewis",
      "Dan Caruso — Fireside Chat",
      "How to Make $10K/Month in College",
      "The whole week",
      "Founders vs. Founders Week",
    ].map((s) => t.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(t).toContain("Find your people. Build what’s next.");
  });

  it("shows all four mentors in the hero with portraits, verified roles and prefilled CTAs", () => {
    const hero = sectionHtml(page(), "home-title");
    const t = text(hero);
    for (const name of MENTOR_NAMES) expect(t).toContain(name);
    // Role and organization (a visual "·" plus a screen-reader comma between them).
    expect(t).toMatch(/Patrick Haddox CEO & Co-Founder \W+ Samara Aerospace/);
    expect(t).toMatch(/Arnav Mishra Co-Founder & CTO \W+ Doss/);
    expect(t).toMatch(/Ron Lewis Co-Founder \W+ Auctus Advisory/);
    expect(t).toMatch(/Thu, Oct 1\W+10:00–11:30 AM CT/);
    expect(t.match(/Scheduling in progress/g)).toHaveLength(2);
    expect(t).toContain("Vik and Ron are still scheduling");
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("Apply to meet Arnav");
    expect(t.match(/Express interest/g)).toHaveLength(2);
    // Portraits: the orbit art (four of them) — the old Monogram is not used.
    expect(hero.match(/viewBox="0 0 100 125"/g)).toHaveLength(4);

    const links = hrefs(hero);
    expect(links).toContain("/office-hours#apply");
    expect(links).toContain("/office-hours");
    expect(links).toContain("/schedule");
    expect(links).toContain("/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply");
    expect(links).toContain("/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply");
    expect(links).toContain("/office-hours?mentor=vikram-lakhwara#apply");
    expect(links).toContain("/office-hours?mentor=ron-lewis#apply");
    expect(links).toContain("/office-hours/ron-lewis");
    expect(links.some((h) => h.startsWith("/apply"))).toBe(false);
  });

  it("never shows organizer-only notes, draft topics or an unverified title", () => {
    const t = text(page());
    expect(t).not.toMatch(/commitments|Revenue strategy|Startup financial planning|Wednesday through Saturday/i);
    // Vik's title is unverified: only his organization is shown.
    const roster = text(
      renderToStaticMarkup(
        createElement(MentorRoster, { mentors: getMentors(), appearances: appearancesByMentor(getScheduleEntries(), getMentors()) }),
      ),
    );
    expect(roster).toMatch(/Vikram “Vik” Lakhwara Stakehouse/);
  });

  it("features Dan Caruso as information only — no application, interest, waitlist or booking", () => {
    const dan = sectionHtml(page(), "featured-dan-caruso-fireside-chat");
    const t = text(dan);
    expect(t).toContain("Supported by Founders");
    expect(t).toContain("Related event");
    expect(t).toContain("Time forthcoming");
    expect(t).toContain("Location forthcoming");
    expect(t).toContain("Founders is supporting student participation in a separate private session with Dan Caruso.");
    expectNoApplication(dan);
    expect(hrefs(dan)).toEqual(["/schedule/dan-caruso-fireside-chat", "/schedule/dan-caruso-fireside-chat"]);
  });

  it("features the Sep 29 panel as co-hosted, with time, place, host and the official link", () => {
    const panel = sectionHtml(page(), "featured-how-to-make-10k-a-month-in-college");
    const t = text(panel);
    expect(t).toContain("Co-hosted by Founders");
    expect(t).toContain("How to Make $10K/Month in College");
    expect(t).toContain("6:00–8:00 PM CT");
    expect(t).toContain("100 MSEB");
    expect(t).toContain("Austin Kennedy");
    expect(t).toContain("recent Illinois alumni");
    expect(hrefs(panel)).toContain("https://www.austnkennedy.com/how-to-make-10k-a-month-in-college");
    expect(hrefs(panel)).toContain("/schedule/how-to-make-10k-a-month-in-college/calendar.ics");
    expectNoApplication(panel);
  });

  it("previews the calendar with the week strip and a short agenda, and explains the labels with counts", () => {
    const html = page();
    const week = text(sectionHtml(html, "week-heading"));
    expect(week).toContain("12 entries across 6 days");
    for (const day of ["28", "29", "30", "01", "02", "03"]) expect(week).toContain(day);
    expect(week).toContain("Founders Showcase Day Sessions");
    expect(hrefs(sectionHtml(html, "week-heading"))).toContain("/schedule?day=2026-10-01");

    const guide = text(sectionHtml(html, "guide-heading"));
    expect(guide).toContain("student-curated guide");
    expect(guide).toContain("Hosted by Founders");
    expect(guide).toContain("Co-hosted by Founders");
    expect(guide).toContain("Supported by Founders");
    expect(guide).toContain("Part of Founders Week");
    expect(guide).toContain("4 of the 12 listings here are hosted, co-hosted or supported by Founders");
    expect(guide).toContain("8 of the 12 listings here are part of the wider program");
  });

  it("never mentions the canceled afterparty", () => {
    expect(text(page())).not.toMatch(/afterparty|HERE Apartments/i);
  });

  it("has Office Hours-first metadata", () => {
    const meta = generateMetadata();
    expect(meta.title).toEqual({ absolute: `${getSite().name} — Office Hours & Calendar · UIUC` });
    expect(meta.description).toMatch(/^Apply for Founders Office Hours: meet Patrick Haddox, Arnav Mishra/);
    expect(meta.description).toContain("(Mon Sep 28 – Sat Oct 3)");
    expect(meta.alternates?.canonical).toBe("/");
  });

  it("404 routes to Office Hours first, then the Calendar, with every mentor one click away", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    const links = hrefs(html);
    expect(links.slice(0, 2)).toEqual(["/office-hours#apply", "/schedule"]);
    expect(links.indexOf("/office-hours")).toBeLessThan(links.indexOf("/"));
    for (const id of ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"]) {
      expect(links).toContain(`/office-hours/${id}`);
    }
    expect(text(html)).toContain("Apply for Office Hours");
  });

  it("error boundary offers a retry and a way out, without leaking the error message", () => {
    const html = renderToStaticMarkup(
      createElement(RouteError, { error: Object.assign(new Error("db password=hunter2"), { digest: "abc123" }), retry: () => {} }),
    );
    const t = text(html);
    expect(t).toContain("Try again");
    expect(t).toContain("Reference abc123");
    expect(t).not.toContain("hunter2");
    expect(hrefs(html)).toEqual(["/office-hours", "/schedule"]);
  });
});
