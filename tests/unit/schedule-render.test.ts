/**
 * Renders the calendar's building blocks to static HTML with the public (default-env) data and
 * checks what students would see: priority order, program-block disclosure wiring, mentor links
 * and CTAs, and that Dan Caruso's fireside chat never offers any application or booking.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleDays, getScheduleEntries } from "@/content";
import { AgendaPreview } from "@/components/schedule/agenda-preview";
import { AgendaRow } from "@/components/schedule/agenda-row";
import { EventCallout, EventFacts, ProgramTimeline } from "@/components/schedule/event-detail";
import { FeaturedBand } from "@/components/schedule/featured-band";
import { FeaturedEvents } from "@/components/schedule/featured-events";
import { PendingMentors } from "@/components/schedule/pending-mentors";
import { WeekStrip } from "@/components/schedule/week-strip";
import { officeHoursMentorSummaries } from "@/lib/schedule/featured";
import { pendingMentors } from "@/lib/schedule/pending-mentors";

const DAN = "dan-caruso-fireside-chat";
const PANEL = "how-to-make-10k-a-month-in-college";
const SHOWCASE = "founders-showcase-day-sessions";

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

/** No application, interest, waitlist or booking affordance of any kind. */
function expectNoApplication(html: string) {
  expect(text(html)).not.toMatch(/apply|express interest|waitlist|book(ing)?\b|reserve a/i);
  expect(hrefs(html).filter((h) => h.includes("#apply") || h.startsWith("/apply") || h.includes("mentor="))).toEqual([]);
}

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("calendar components (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const entry = (id: string) => getScheduleEntries().find((e) => e.id === id)!;

  it("featured band leads with office hours (all four mentors), then Dan Caruso, then the Sep 29 panel", () => {
    const html = render(
      createElement(FeaturedBand, {
        entries: getScheduleEntries(),
        mentors: officeHoursMentorSummaries(getMentors()),
      }),
    );
    const t = text(html);
    const order = ["Founders Office Hours", "Dan Caruso — Fireside Chat", "How to Make $10K/Month in College"].map((s) =>
      t.indexOf(s),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const name of ["Patrick Haddox", "Arnav Mishra", "Vikram “Vik” Lakhwara", "Ron Lewis"]) expect(t).toContain(name);
    expect(t).toContain("Vik and Ron are still scheduling");
    expect(t.match(/Scheduling in progress/g)).toHaveLength(2);
    expect(t).toContain("Thu, Oct 1 10:00–11:30 AM CT");
    expect(t).toContain("Supported by Founders");
    expect(t).toContain("Co-hosted by Founders");
    const links = hrefs(html);
    expect(links).toContain("/office-hours#apply");
    expect(links).toContain("/office-hours");
    expect(links).toContain("/office-hours/vikram-lakhwara");
    expect(links).toContain("https://www.austnkennedy.com/how-to-make-10k-a-month-in-college");
    expect(t).not.toMatch(/afterparty|HERE Apartments|Wednesday|commitments|Revenue strategy/i);
  });

  it("featured events (home building block) never offer an application", () => {
    const html = render(createElement(FeaturedEvents, { entries: getScheduleEntries() }));
    expect(html.match(/<article/g)).toHaveLength(2);
    const t = text(html);
    expect(t.indexOf("Dan Caruso")).toBeLessThan(t.indexOf("How to Make $10K/Month"));
    expect(t).toContain("Time forthcoming");
    expect(t).toContain("6:00–8:00 PM CT");
    expect(t).toContain("Event information");
    expect(hrefs(html)).toEqual([
      `/schedule/${DAN}`,
      `/schedule/${PANEL}`,
      "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college",
    ]);
    expectNoApplication(html);
  });

  it("Dan Caruso's row and facts are information only", () => {
    const dan = entry(DAN);
    const row = render(createElement(AgendaRow, { entry: dan }));
    expectNoApplication(row);
    const t = text(row);
    expect(t).toContain("02 Featured");
    expect(t).toContain("Time forthcoming");
    expect(t).toContain("Related event");
    expect(t).toContain("Location forthcoming");
    const facts = render(createElement(EventFacts, { entry: dan }));
    expectNoApplication(facts);
    expect(text(facts)).not.toContain("Organizer"); // organizer is null → hidden
  });

  it("the private-session callout is informational — no links or buttons", () => {
    const html = render(createElement(EventCallout, { callout: entry(DAN).callout! }));
    expect(text(html)).toContain("Private session with Dan Caruso");
    expect(html).not.toMatch(/<a |<button/);
    expectNoApplication(html);
  });

  it("the Sep 29 panel row shows its badge and official event information link", () => {
    const html = render(createElement(AgendaRow, { entry: entry(PANEL) }));
    const t = text(html);
    expect(t).toContain("03 Featured");
    expect(t).toContain("Co-hosted by Founders");
    expect(t).toContain("6:00 PM");
    expect(html).toMatch(/href="https:\/\/www\.austnkennedy\.com\/how-to-make-10k-a-month-in-college" target="_blank" rel="noopener noreferrer"/);
    expectNoApplication(html);
  });

  it("office-hours rows name the mentor and apply with the mentor and window preselected", () => {
    const html = render(createElement(AgendaRow, { entry: entry("office-hours-patrick-haddox-2026-10-01-am") }));
    const t = text(html);
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("CEO & Co-Founder, Samara Aerospace");
    expect(hrefs(html)).toEqual([
      "/schedule/office-hours-patrick-haddox-2026-10-01-am",
      "/office-hours/patrick-haddox",
      "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
    ]);
  });

  it("program blocks: collapsed disclosure wired with aria-expanded/aria-controls, mentors on stage", () => {
    const html = render(createElement(AgendaRow, { entry: entry(SHOWCASE), programOpen: false }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`aria-controls="program-${SHOWCASE}"`);
    expect(html).toMatch(new RegExp(`id="program-${SHOWCASE}" hidden=""`));
    const t = text(html);
    expect(t).toContain("11 sessions");
    expect(t).toContain("Office-hours mentors on stage");
    for (const [id, time] of [
      ["arnav-mishra", "1:55 PM"],
      ["patrick-haddox", "2:40 PM"],
      ["vikram-lakhwara", "2:55 PM"],
    ]) {
      expect(hrefs(html)).toContain(`/office-hours/${id}`);
      expect(t).toContain(time);
    }
    // The full timeline is in the (hidden) panel, with each mentor marked.
    expect(t.match(/Office hours mentor\b/g)).toHaveLength(3);
    expect(t).toContain("Moderators Scott Rose and Susan Martinis");
    expect(t).toContain("Fireside Chat with Chancellor Charles Isbell");
  });

  it("program blocks: open state and search matches", () => {
    const html = render(createElement(AgendaRow, { entry: entry(SHOWCASE), programOpen: true, sessionMatches: [3] }));
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toMatch(new RegExp(`id="program-${SHOWCASE}" hidden`));
    expect(text(html)).toContain("1 match");
    expect(text(html).match(/Search match/g)).toHaveLength(1);
  });

  it("the detail timeline lists every session with anchors and per-mentor CTAs", () => {
    const html = render(
      createElement(ProgramTimeline, { entry: entry(SHOWCASE), headingId: "program-heading", mentors: getMentors() }),
    );
    expect(html.match(/<li[^>]*id="session-\d{4}"/g)).toHaveLength(11);
    const t = text(html);
    expect(t).toContain("Three speakers in this program are also office-hours mentors this week.");
    expect(t).toContain("Apply to meet Arnav");
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("Express interest");
    expect(t).toContain("Vikram “Vik” Lakhwara");
    const links = hrefs(html);
    expect(links).toContain("/office-hours?mentor=arnav-mishra#apply");
    expect(links).toContain("/office-hours?mentor=patrick-haddox#apply");
    expect(links).toContain("/office-hours?mentor=vikram-lakhwara#apply");
    expect(links).toContain("#session-1355");
    expect(links).toContain("/office-hours#apply");
  });

  it("the week strip covers Mon–Sat with each day's priorities", () => {
    const html = render(createElement(WeekStrip, { entries: getScheduleEntries(), days: getScheduleDays() }));
    expect(hrefs(html)).toEqual([
      "/schedule?day=2026-09-28",
      "/schedule?day=2026-09-29",
      "/schedule?day=2026-09-30",
      "/schedule?day=2026-10-01",
      "/schedule?day=2026-10-02",
      "/schedule?day=2026-10-03",
    ]);
    const t = text(html);
    expect(t).toContain("02 Dan Caruso — Fireside Chat");
    expect(t).toContain("03 How to Make $10K/Month in College");
    expect(t.match(/01 Office hours/g)).toHaveLength(2);
  });

  it("the agenda preview and pending-mentor block stay public and link correctly", () => {
    const preview = render(createElement(AgendaPreview, { entries: getScheduleEntries().slice(0, 4) }));
    expect(text(preview)).toContain("Dan Caruso — Fireside Chat");
    expect(text(preview)).not.toMatch(/afterparty/i);
    const pending = render(createElement(PendingMentors, { mentors: pendingMentors(getMentors()) }));
    expect(hrefs(pending)).toEqual([
      "/office-hours/vikram-lakhwara",
      "/office-hours?mentor=vikram-lakhwara#apply",
      "/office-hours/ron-lewis",
      "/office-hours?mentor=ron-lewis#apply",
    ]);
    expect(text(pending)).not.toMatch(/Wednesday|commitments|Revenue strategy/i);
  });
});
