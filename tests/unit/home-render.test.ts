/**
 * Renders the home page to static HTML with the public (default-env) data and checks what students
 * see, in order: the hero (headline, one sentence, "Apply for Office Hours"), all six mentors
 * (headshot, name, role and company, one availability line, a link to the profile) in a grid sized
 * from the mentor count, the four featured events (Dan Caruso — information only — the Sept 29
 * panel, Arnav’s happy hour, Founder Failure Lab), and the calendar link with the official dates.
 * Also: nothing private, removed or canceled; the metadata; the 404 and error pages.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RouteError from "@/app/error";
import NotFound from "@/app/not-found";
import HomePage, { generateMetadata } from "@/app/page";
import { mentorPreviews } from "@/components/home/home-model";
import { MentorPreviews, previewColumns } from "@/components/home/mentor-previews";
import { getMentors, getSite } from "@/content";

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

/** The HTML of the first <tag … attr="value" …> … </tag> block (same-tag nesting aware). */
function blockHtml(html: string, tag: "section" | "article", attr: string, value: string): string {
  const open = new RegExp(`<${tag}\\b[^>]*\\b${attr}="${value}"[^>]*>`);
  const m = open.exec(html);
  expect(m, `<${tag} ${attr}="${value}">`).not.toBeNull();
  const start = m!.index;
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = start;
  for (let t = re.exec(html); t; t = re.exec(html)) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, t.index + t[0].length);
  }
  throw new Error(`unclosed ${tag}`);
}

const section = (html: string, labelledBy: string) => blockHtml(html, "section", "aria-labelledby", labelledBy);
const card = (html: string, labelledBy: string) => blockHtml(html, "article", "aria-labelledby", labelledBy);

/** No application, interest, waitlist or booking affordance of any kind. */
function expectNoApplication(html: string) {
  expect(text(html)).not.toMatch(/apply|express interest|interest form|waitlist|book(ing)?\b|reserve a|sign up|register|rsvp/i);
  expect(hrefs(html).filter((h) => h.includes("#apply") || h.startsWith("/apply") || h.includes("mentor="))).toEqual([]);
}

/** Every rendered <img>: its alt text and the original src next/image optimizes. */
function images(html: string): { alt: string; src: string }[] {
  return [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({
    alt: tag.match(/\balt="([^"]*)"/)?.[1] ?? "",
    src: decodeURIComponent(tag.match(/\bsrc="[^"]*?url=([^&"]+)/)?.[1] ?? ""),
  }));
}

/** The Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled and must never appear. */
function expectNoCanceledAfterparty(s: string) {
  expect(s).not.toMatch(/HERE Apartments/i);
  expect(s).not.toMatch(/after[\s-]?party/i);
}

/** The class list of the mentor grid (<ul>) and of each of its cards (<li>). */
function gridClasses(html: string): { list: string[]; items: string[][] } {
  const ul = /<ul\b[^>]*\bclass="([^"]*)"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  expect(ul, "mentor grid <ul>").not.toBeNull();
  return {
    list: ul![1].split(/\s+/),
    items: [...ul![2].matchAll(/<li\b[^>]*\bclass="([^"]*)"/g)].map((m) => m[1].split(/\s+/)),
  };
}

/** Responsive column counts only (e.g. "sm:grid-cols-2"), sorted. */
const columnClasses = (classes: string[]) => classes.filter((c) => /grid-cols-/.test(c)).sort();

/** Placement classes that centre an odd last card or reset that centring. */
const placementClasses = (classes: string[]) => classes.filter((c) => /col-span|mx-|:w-/.test(c)).sort();

const MENTOR_IDS = [
  "patrick-haddox",
  "arnav-mishra",
  "vikram-lakhwara",
  "elliott-notrica",
  "ron-lewis",
  "rishab-veldur",
];
const MENTOR_NAMES = [
  "Patrick Haddox",
  "Arnav Mishra",
  "Vikram “Vik” Lakhwara",
  "Elliott Notrica",
  "Ron Lewis",
  "Rishab Veldur",
];

describe("home page (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const page = () => renderToStaticMarkup(createElement(HomePage));

  it("is, in order: hero, mentors, Dan Caruso, the Sept 29 panel, the calendar link", () => {
    const html = page();
    const sections = [...html.matchAll(/<section\b[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(sections).toEqual(["home-title", "mentors-heading", "events-heading"]);

    const t = text(html);
    const order = [
      "Meet the people building what’s next.",
      "Apply for Office Hours",
      ...MENTOR_NAMES,
      "Fireside Chat with Dan Caruso",
      "How to Make $10K/Month in College",
      "See the full calendar",
    ].map((s) => t.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Headings in order: one h1, then h2s, with h3s under them.
    const headings = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(headings[0]).toBe(1);
    expect(headings.filter((h) => h === 1)).toHaveLength(1);
    headings.forEach((h, i) => i > 0 && expect(h - headings[i - 1]).toBeLessThanOrEqual(1));
  });

  it("opens with the headline, one sentence on office hours and the application", () => {
    const hero = section(page(), "home-title");
    const t = text(hero);
    expect(hero).toMatch(/<h1\b[^>]*>Meet the people building what’s next\.<\/h1>/);
    expect(t).toContain(
      "During Founders Week (Sept 30 – Oct 3), Founders – Illinois Entrepreneurs is setting up office hours with startup founders and investors, and one short application covers every mentor.",
    );
    expect(hrefs(hero)).toEqual(["/office-hours#apply", "/office-hours"]);
    expect(t).toMatch(/Apply for Office Hours.*Meet the mentors/);
  });

  it("shows all six mentors: headshot, name, role and company, one availability line, profile link", () => {
    const mentors = section(page(), "mentors-heading");
    const t = text(mentors);
    expect(t).toContain("Who you can meet");

    // Every headshot is a real image with the mentor's name as alt text, loaded eagerly.
    expect(images(mentors)).toEqual(MENTOR_IDS.map((id, i) => ({ alt: MENTOR_NAMES[i], src: `/mentors/${id}.jpg` })));
    expect(mentors).not.toContain('loading="lazy"');

    // Names are h3 links to profiles; the section also links to all profiles.
    const names = [...mentors.matchAll(/<h3\b[^>]*><a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a><\/h3>/g)].map((m) => [m[1], m[2]]);
    expect(names).toEqual(MENTOR_IDS.map((id, i) => [`/office-hours/${id}`, MENTOR_NAMES[i].replace(/&/g, "&amp;")]));
    expect(hrefs(mentors)).toEqual(["/office-hours", ...MENTOR_IDS.map((id) => `/office-hours/${id}`)]);

    // Role and company (with a comma for screen readers where they sit on separate lines).
    expect(t).toMatch(/Patrick Haddox CEO & Co-Founder\s?, Samara Aerospace/);
    expect(t).toMatch(/Arnav Mishra Co-Founder & CTO\s?, Doss/);
    expect(t).toMatch(/Vikram “Vik” Lakhwara Founder & Managing Member\s?, Stakehouse/);
    expect(t).toMatch(/Elliott Notrica Founder & CEO\s?, Symbio Bioculinary/);
    expect(t).toMatch(/Ron Lewis Co-Founder\s?, Auctus Advisory/);
    expect(t).toMatch(/Rishab Veldur Co-Founder & CEO\s?, Auvi Labs/);

    // One availability line each: a window for Patrick, Arnav and Rishab, "Scheduling in progress" otherwise.
    expect(t).toMatch(/Samara Aerospace Thu, Oct 1\W+10:00–11:30 AM CT/);
    expect(t).toMatch(/Doss Fri, Oct 2\W+Morning, before noon CT/);
    expect(t).toMatch(/Stakehouse Scheduling in progress/);
    expect(t).toMatch(/Symbio Bioculinary Scheduling in progress/);
    expect(t).toMatch(/Auctus Advisory Scheduling in progress/);
    expect(t).toMatch(/Auvi Labs Thu, Oct 1\W+Exact time to be confirmed/);
    expect(t.match(/Scheduling in progress/g)).toHaveLength(3);
    expect(t).not.toContain("Time to be announced");
    expect([...mentors.matchAll(/<time dateTime="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-01",
    ]);
  });

  it("shows Rishab last, with his photo and 'Thu, Oct 1 · Exact time to be confirmed', never Oct 2", () => {
    const items = [...section(page(), "mentors-heading").matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(items).toHaveLength(6);
    const rishab = items[5];
    expect(images(rishab)).toEqual([{ alt: "Rishab Veldur", src: "/mentors/rishab-veldur.jpg" }]);
    expect(hrefs(rishab)).toEqual(["/office-hours/rishab-veldur"]);
    expect(text(rishab).trim()).toBe("Rishab Veldur Co-Founder & CEO, Auvi Labs Thu, Oct 1 ·, Exact time to be confirmed");
    // The visible separator is the middle dot; screen readers hear a comma instead.
    expect(rishab).toMatch(
      /<time dateTime="2026-10-01"[^>]*>Thu, Oct 1<\/time><span aria-hidden="true"[^>]*> · <\/span><span class="sr-only">, <\/span><span[^>]*>Exact time to be confirmed<\/span>/,
    );
    // A known date gets the orange dot, like Patrick's and Arnav's windows.
    expect(rishab).toMatch(/rounded-full bg-accent"/);
    expect(text(rishab)).not.toMatch(/Oct 2|Fri|Time to be announced|Scheduling in progress/);
    // Previews stay concise: no bio, background tags or suggested fit.
    expect(text(rishab)).not.toMatch(/dialysis|Cozad|Medtech|Hardware and software|spinout|Good fit|Background/i);
  });

  it("lays six mentors out six across at xl, three per row at lg and two from sm", () => {
    const { list, items } = gridClasses(section(page(), "mentors-heading"));
    expect(list).toContain("grid");
    expect(columnClasses(list)).toEqual(["lg:grid-cols-3", "sm:grid-cols-2", "xl:grid-cols-6"]);
    // Six is even: every card sits in the flow, nothing is centred on its own row.
    expect(items).toHaveLength(6);
    for (const item of items) expect(placementClasses(item)).toEqual([]);
  });

  it("sizes the mentor grid from the mentor count (three per row at lg only when it divides by three)", () => {
    const grid = (n: number) => {
      const previews = mentorPreviews(getMentors()).slice(0, n);
      expect(previews).toHaveLength(n);
      return gridClasses(renderToStaticMarkup(createElement(MentorPreviews, { mentors: previews })));
    };
    const centred = ["sm:col-span-2", "sm:mx-auto", "sm:w-[calc(50%-0.5rem)]", "xl:col-span-1", "xl:mx-0", "xl:w-auto"];

    // Six: one row at xl, two rows of three at lg.
    expect(columnClasses(grid(6).list)).toEqual(["lg:grid-cols-3", "sm:grid-cols-2", "xl:grid-cols-6"]);

    // Five: one row at xl, two columns below (no ragged three-column rows); the odd last card is
    // centred under the two-column rows.
    const five = grid(5);
    expect(columnClasses(five.list)).toEqual(["sm:grid-cols-2", "xl:grid-cols-5"]);
    expect(five.items.map(placementClasses)).toEqual([[], [], [], [], [...centred].sort()]);

    // Four: two by two, then one row at xl.
    const four = grid(4);
    expect(columnClasses(four.list)).toEqual(["sm:grid-cols-2", "xl:grid-cols-4"]);
    expect(four.items.map(placementClasses)).toEqual([[], [], [], []]);

    // Three: one row from lg; the odd last card is centred only in the two-column (sm–md) layout.
    const three = grid(3);
    expect(columnClasses(three.list)).toEqual(["lg:grid-cols-3", "sm:grid-cols-2", "xl:grid-cols-3"]);
    expect(three.items.map(placementClasses)).toEqual([
      [],
      [],
      [...centred, "lg:col-span-1", "lg:mx-0", "lg:w-auto"].sort(),
    ]);

    // No mentors: nothing to show.
    expect(renderToStaticMarkup(createElement(MentorPreviews, { mentors: [] }))).toBe("");

    // Up to six fit on one row at xl.
    expect([1, 2, 3, 4, 5, 6].map(previewColumns)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps mentor previews concise — no bios, expertise bases, badges or numbering", () => {
    const t = text(section(page(), "mentors-heading"));
    // Bios and "can help most with" bases live on the profiles, never here (and bases never publicly).
    expect(t).not.toMatch(/Hummingbird|Siteline|Green Cow|Illinois Wesleyan|repeat entrepreneur/);
    expect(t).not.toMatch(/Former senior spacecraft test engineer|Stakehouse backs founders|basis/i);
    expect(t).not.toMatch(/\b0\d \/ 0\d\b|In priority order|Availability window|Times to be announced/);
    expect(t).not.toMatch(/one-on-one/i);
  });

  it("never shows organizer-only notes or draft topics", () => {
    const t = text(page());
    expect(t).not.toMatch(/commitments|Revenue strategy|Startup financial planning|Wednesday through Saturday/i);
    expect(t).not.toMatch(/much more available|extra sessions|Draft/);
    // Rishab's organizer notes (team preference, phone, Oct 2 presence) and no device claims.
    expect(t).not.toMatch(/student teams|phone number|email signature|Oct 1 and 2/i);
    expect(t).not.toMatch(/FDA|clinically|commercially available/i);
  });

  it("features Dan Caruso as information only — no application, interest, waitlist or booking", () => {
    const dan = card(page(), "featured-dan-caruso-fireside-chat");
    const t = text(dan);
    expect(t).toContain("Supported by Founders");
    expect(t).toContain("Fireside Chat with Dan Caruso");
    expect(t).toContain("Monday, Sept 28 · 4:00 PM CT");
    expect(t).toContain("Beckman Institute, Auditorium (Room 1025)");
    expect(t).toContain("405 N. Mathews Ave., Urbana, IL 61801");
    expect(t).toContain("Event details");
    expect(dan).toContain('<time dateTime="2026-09-28T16:00"');
    expectNoApplication(dan);
    expect(hrefs(dan)).toEqual(["/schedule/dan-caruso-fireside-chat"]);
  });

  it("features the Sept 29 panel as co-hosted, with time, place and a link to its page", () => {
    const panel = card(page(), "featured-how-to-make-10k-a-month-in-college");
    const t = text(panel);
    expect(t).toContain("Co-hosted by Founders");
    expect(t).toContain("How to Make $10K/Month in College");
    expect(t).toContain("Tuesday, Sept 29 · 6:00–8:00 PM CT");
    expect(t).toContain("Materials Science and Engineering Building, Room 100");
    expect(t).toContain("1304 W. Green St., Urbana, IL 61801");
    expect(hrefs(panel)).toEqual(["/schedule/how-to-make-10k-a-month-in-college"]);
    expectNoApplication(panel);
  });

  it("features Arnav's happy hour at Legends with its time, place and a link to its page", () => {
    const hh = card(page(), "featured-happy-hour-at-legends-with-arnav-mishra");
    const t = text(hh);
    expect(t).toContain("Supported by Founders");
    expect(t).toContain("Happy Hour with Arnav Mishra at Legends");
    expect(t).toContain("Wednesday, Sept 30 · 5:00–7:00 PM CT");
    expect(t).toContain("6th & Green");
    expect(hrefs(hh)).toEqual(["/schedule/happy-hour-at-legends-with-arnav-mishra"]);
    expectNoApplication(hh);
  });

  it("features Founder Failure Lab as hosted by Founders, on the light-orange card", () => {
    const html = card(page(), "featured-founder-failure-lab");
    const t = text(html);
    expect(t).toContain("Hosted by Founders");
    expect(t).toContain("Founder Failure Lab");
    expect(t).toContain("Wednesday, Sept 30 · 6:30–8:30 PM CT");
    expect(t).toContain("Campus Instructional Facility (CIF), Room 1038");
    expect(t).toContain("1405 Springfield Ave., Urbana, IL 61801");
    expect(html).toMatch(/^<article\b[^>]*\bbg-accent-soft\b/);
    expect(hrefs(html)).toEqual(["/schedule/founder-failure-lab"]);
    expectNoApplication(html);
    // Only the hosted event gets the orange card.
    expect(card(page(), "featured-dan-caruso-fireside-chat")).not.toMatch(/^<article\b[^>]*\bbg-accent-soft\b/);
  });

  it("features exactly those four events, then links to the calendar with the official dates", () => {
    const events = section(page(), "events-heading");
    const cards = [...events.matchAll(/<article\b[^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
    expect(cards).toEqual([
      "featured-dan-caruso-fireside-chat",
      "featured-how-to-make-10k-a-month-in-college",
      "featured-happy-hour-at-legends-with-arnav-mishra",
      "featured-founder-failure-lab",
    ]);
    expect(text(events)).toContain(
      "The official Founders Week program runs Sept 30 – Oct 3, and related events begin Sept 28. See the full calendar",
    );
    expect(hrefs(events).at(-1)).toBe("/schedule");
    expectNoApplication(events);
  });

  it("has dropped the long explainer, badge glossary, week strip and closing CTA", () => {
    const html = page();
    const t = text(html);
    expect(t).not.toMatch(/Founders vs\. Founders Week|student-curated guide|The whole week|entries across/);
    expect(t).not.toMatch(/Part of Founders Week|Related event|Founders pick/);
    expect(html).not.toMatch(/bg-blueprint|font-serif|font-mono|mono-label|viewBox="0 0 100 125"/);
    // Exactly one "Apply for Office Hours" on the page (the header carries the other).
    expect(t.match(/Apply for Office Hours/g)).toHaveLength(1);
    // Plain punctuation: no em dashes anywhere in the rendered page.
    expect(html).not.toContain("—");
  });

  it("never mentions the canceled afterparty", () => {
    const html = page();
    expectNoCanceledAfterparty(text(html));
    expectNoCanceledAfterparty(html);
  });

  it("says applications are closed instead of offering the form when the switch is off", async () => {
    const content = await import("@/content");
    const site = content.getSite();
    const spy = vi
      .spyOn(content, "getSite")
      .mockReturnValue({ ...site, applications: { ...site.applications, open: false } });
    try {
      const hero = section(page(), "home-title");
      expect(text(hero)).toContain("Applications are closed right now.");
      expect(hrefs(hero)).toEqual(["/office-hours"]);
      expect(text(hero)).not.toContain("Apply for Office Hours");
    } finally {
      spy.mockRestore();
    }
  });

  it("has Office Hours-first metadata without a one-on-one promise", () => {
    const meta = generateMetadata();
    expect(meta.title).toEqual({ absolute: `${getSite().name} · Office Hours & Calendar at UIUC` });
    expect(meta.description).toBe(
      "Apply for Founders Office Hours during Founders Week at UIUC (Sept 30 – Oct 3). The mentors are startup founders and investors: Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara, Elliott Notrica, Ron Lewis and Rishab Veldur. One application covers every mentor.",
    );
    expect(meta.description).not.toMatch(/one-on-one/i);
    expect(JSON.stringify(meta)).not.toContain("—");
    expect(meta.alternates?.canonical).toBe("/");
    expect(meta.openGraph?.title).toBe("Founders Office Hours · Founders Week 2026");
  });

  it("lists all six mentors, in content order, in the description, OpenGraph and Twitter metadata", () => {
    const meta = generateMetadata();
    const description = String(meta.description);
    const listed = /investors: (.+)\. One application/.exec(description)?.[1];
    expect(listed?.replace(/ and /, ", ").split(", ")).toEqual(MENTOR_NAMES);
    expect(meta.openGraph?.description).toBe(description);
    expect(meta.twitter?.description).toBe(description);
    expect(meta.twitter?.title).toBe("Founders Office Hours · Founders Week 2026");
  });

  it("404: calm, branded, and routes to Office Hours and the Calendar", () => {
    const html = renderToStaticMarkup(createElement(NotFound));
    const t = text(html);
    expect(html).toMatch(/<h1\b[^>]*>We couldn’t find that page\.<\/h1>/);
    expect(t).toContain("Apply for Office Hours");
    expect(hrefs(html)).toEqual(["/office-hours#apply", "/schedule", "/"]);
    expect(t).toContain("You’ll find office hours and the application on the Office Hours page, and every event on the Calendar.");
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/bg-blueprint|font-serif|font-mono|mono-label|<svg[^>]*viewBox="0 0 (?!16 16)/);
  });

  it("error boundary offers a retry and a way out, without leaking the error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(
      createElement(RouteError, {
        error: Object.assign(new Error("db password=hunter2"), { digest: "abc123" }),
        retry: () => {},
      }),
    );
    const t = text(html);
    expect(t).toContain("This page didn’t load.");
    expect(t).toContain("Try again");
    expect(t).toContain("Reference abc123");
    expect(t).not.toContain("hunter2");
    expect(hrefs(html)).toEqual(["/office-hours", "/schedule"]);
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/font-serif|font-mono|mono-label/);
  });
});
