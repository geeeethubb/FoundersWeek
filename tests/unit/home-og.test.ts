/**
 * Social images, sitemap and robots, against the public (default-env) content:
 * - card models say only what the site says (verified role and company, one availability line,
 *   Founders involvement), and no event card — Dan Caruso's in particular — carries an
 *   application CTA; nothing private or canceled appears;
 * - the site card shows all six mentors (headshots in content order, first names, alt text);
 * - the cards render to PNG with the network disabled (logo and headshots come from /public on
 *   disk, fonts from lib/og/fonts), and every character they draw exists in the bundled fonts;
 * - sitemap lists public pages as absolute URLs; robots keeps organizer/API/status links out.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getMentor, getMentors, getScheduleEntries, getSite } from "@/content";
import type { Mentor, SiteSettings } from "@/content/types";
import { publicImageDataUrl } from "@/lib/og/assets";
import { renderEventCard, renderMentorCard, renderSiteCard } from "@/lib/og/cards";
import { OG_FONT_FILES } from "@/lib/og/fonts";
import { eventCardModel, mentorCardModel, siteCardModel, titleFontSize } from "@/lib/og/model";
import { officeHoursToEntries } from "@/lib/schedule/entries";

/**
 * A synthetic mentor, not in /content, with one date-only window (the date is set, the time
 * isn't). No real mentor has one right now; the path stays for future mentors.
 */
const DATE_ONLY_MENTOR: Mentor = {
  id: "fixture-date-only",
  name: "Fixture Mentor",
  firstName: "Fixture",
  role: "Founder",
  company: "Fixture Co",
  headshot: null,
  bio: null,
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
  availability: [{ id: "fixture-date-only-2026-10-01", date: "2026-10-01", time: { kind: "tba" } }],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [],
};
/** The fixture mentor's generated office-hours calendar entry. */
const dateOnlyEntry = () => {
  const entries = officeHoursToEntries(DATE_ONLY_MENTOR, getSite());
  expect(entries.map((e) => e.id)).toEqual(["office-hours-fixture-date-only-2026-10-01"]);
  return entries[0];
};

const entry = (id: string) => getScheduleEntries().find((e) => e.id === id)!;
const mentorModel = (id: string, site: SiteSettings = getSite()) => mentorCardModel(getMentor(id)!, site);
const closed = (): SiteSettings => ({ ...getSite(), applications: { ...getSite().applications, open: false } });

const MENTOR_IDS = [
  "patrick-haddox",
  "arnav-mishra",
  "vikram-lakhwara",
  "elliott-notrica",
  "ron-lewis",
  "rishab-veldur",
];
const SIX_NAMES =
  "Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara, Elliott Notrica, Ron Lewis and Rishab Veldur";
const SITE_ALT = `Founders Office Hours during Founders Week (Sept 30 – Oct 3) at UIUC: meet ${SIX_NAMES}. Apply for Office Hours.`;
const PRIVATE =
  /commitments|much more available|extra sessions|Wednesday through Saturday|Revenue strategy|Startup financial planning|basis|student teams|phone number|email signature|Oct 1 and 2/i;

describe("social image models (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("site card: the home headline, the official dates and every mentor", () => {
    const m = siteCardModel(getSite(), getMentors());
    expect(m).toMatchObject({
      label: "Founders Week 2026",
      kicker: "Founders Office Hours",
      headline: "Meet the people building what’s next.",
      sub: "Sept 30 – Oct 3 · University of Illinois Urbana-Champaign",
      peopleLine: "Patrick, Arnav, Vik, Elliott, Ron and Rishab",
      cta: "Apply for Office Hours",
    });
    expect(m.people.map((p) => p.id)).toEqual(MENTOR_IDS);
    expect(m.people.map((p) => p.initials)).toEqual(["PH", "AM", "VL", "EN", "RL", "RV"]);
    expect(m.people.map((p) => p.headshot)).toEqual(MENTOR_IDS.map((id) => `/mentors/${id}.jpg`));
    expect(m.alt).toBe(SITE_ALT);
    expect(JSON.stringify(m)).not.toMatch(/one-on-one/i);
    // No CTA while the application is switched off.
    expect(siteCardModel(closed(), getMentors()).cta).toBeNull();
    expect(siteCardModel(closed(), getMentors()).alt).not.toMatch(/apply/i);
  });

  it("site card: six people, Rishab last, with the same alt on the site, Twitter and Office Hours images", async () => {
    const m = siteCardModel(getSite(), getMentors());
    expect(m.people).toHaveLength(6);
    expect(m.people.at(-1)).toEqual({
      id: "rishab-veldur",
      name: "Rishab Veldur",
      initials: "RV",
      headshot: "/mentors/rishab-veldur.jpg",
    });
    expect(m.people.every((p) => p.headshot)).toBe(true);
    expect(siteCardModel(closed(), getMentors()).alt).toBe(
      `Founders Office Hours during Founders Week (Sept 30 – Oct 3) at UIUC: meet ${SIX_NAMES}.`,
    );
    // The route modules compute their alt text at import time: load them fresh under this env.
    vi.resetModules();
    const [site, twitter, officeHours] = await Promise.all([
      import("@/app/opengraph-image"),
      import("@/app/twitter-image"),
      import("@/app/office-hours/opengraph-image"),
    ]);
    expect([site.alt, twitter.alt, officeHours.alt]).toEqual([SITE_ALT, SITE_ALT, SITE_ALT]);
  });

  it("mentor cards: verified role and company, one availability line, the primary CTA", () => {
    expect(mentorModel("patrick-haddox")).toEqual({
      label: "Founders Week 2026 · Office Hours",
      person: { id: "patrick-haddox", name: "Patrick Haddox", initials: "PH", headshot: "/mentors/patrick-haddox.jpg" },
      name: "Patrick Haddox",
      role: "CEO & Co-Founder",
      company: "Samara Aerospace",
      availability: { known: true, text: "Thu, Oct 1 · 10:00–11:30 AM CT" },
      cta: "Apply for Office Hours",
      alt: "Founders Office Hours with Patrick Haddox, CEO & Co-Founder, Samara Aerospace. Available Thu, Oct 1, 10:00–11:30 AM CT.",
    });
    expect(mentorModel("arnav-mishra").availability).toEqual({ known: true, text: "Fri, Oct 2 · Morning, before noon CT" });
    for (const id of ["vikram-lakhwara", "elliott-notrica", "ron-lewis"]) {
      expect(mentorModel(id).availability).toEqual({ known: false, text: "Scheduling in progress" });
      expect(mentorModel(id).alt).toMatch(/\. Scheduling in progress\.$/);
    }
    expect(mentorModel("vikram-lakhwara")).toMatchObject({ role: "Founder & Managing Member", company: "Stakehouse" });
    expect(mentorModel("elliott-notrica")).toMatchObject({ role: "Founder & CEO", company: "Symbio Bioculinary" });
    expect(mentorModel("ron-lewis")).toMatchObject({ role: "Co-Founder", company: "Auctus Advisory" });
    expect(mentorModel("ron-lewis", closed()).cta).toBeNull();

    const json = JSON.stringify(MENTOR_IDS.map((id) => mentorModel(id)));
    expect(json).not.toMatch(PRIVATE);
    expect(json).not.toMatch(/one-on-one/i);
  });

  it("Rishab's card: Thu, Oct 1 · 12:00–5:00 PM CT, never Oct 2, no device claims", () => {
    const rishab = mentorModel("rishab-veldur");
    expect(rishab).toEqual({
      label: "Founders Week 2026 · Office Hours",
      person: { id: "rishab-veldur", name: "Rishab Veldur", initials: "RV", headshot: "/mentors/rishab-veldur.jpg" },
      name: "Rishab Veldur",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      availability: { known: true, text: "Thu, Oct 1 · 12:00–5:00 PM CT" },
      cta: "Apply for Office Hours",
      alt: "Founders Office Hours with Rishab Veldur, Co-Founder & CEO, Auvi Labs. Available Thu, Oct 1, 12:00–5:00 PM CT.",
    });
    const json = JSON.stringify(rishab);
    expect(json).not.toMatch(/Oct 2|Fri|Time to be announced|Scheduling in progress/);
    expect(json).not.toMatch(/to be confirmed/i);
    expect(json).not.toMatch(/FDA|clinically|commercially available|one-on-one/i);
    expect(json).not.toMatch(PRIVATE);
    expect(mentorModel("rishab-veldur", closed()).cta).toBeNull();
  });

  it("a date-only window (fixture mentor): 'Thu, Oct 1 · Exact time to be confirmed'", () => {
    const site = getSite();
    expect(mentorCardModel(DATE_ONLY_MENTOR, site)).toEqual({
      label: "Founders Week 2026 · Office Hours",
      person: { id: "fixture-date-only", name: "Fixture Mentor", initials: "FM", headshot: null },
      name: "Fixture Mentor",
      role: "Founder",
      company: "Fixture Co",
      availability: { known: true, text: "Thu, Oct 1 · Exact time to be confirmed" },
      cta: "Apply for Office Hours",
      alt: "Founders Office Hours with Fixture Mentor, Founder, Fixture Co. Available Thu, Oct 1, Exact time to be confirmed.",
    });
    // Same wording when the window carries the display label.
    const labelled: Mentor = {
      ...DATE_ONLY_MENTOR,
      availability: [{ ...DATE_ONLY_MENTOR.availability[0], label: "Exact time to be confirmed" }],
    };
    expect(mentorCardModel(labelled, site).availability).toEqual({
      known: true,
      text: "Thu, Oct 1 · Exact time to be confirmed",
    });
    expect(JSON.stringify(mentorCardModel(DATE_ONLY_MENTOR, site))).not.toMatch(/Time to be announced|Scheduling in progress/);
    expect(mentorCardModel(DATE_ONLY_MENTOR, closed()).cta).toBeNull();
  });

  it("event cards carry no application CTA — only office-hours entries do", () => {
    const site = getSite();
    const dan = eventCardModel(entry("dan-caruso-fireside-chat"), site);
    expect(dan).toEqual({
      label: "Founders Week 2026 · Calendar",
      weekday: "Monday",
      day: "28",
      month: "September",
      involvement: { label: "Supported by Founders", tone: "soft" },
      status: null,
      title: "Fireside Chat with Dan Caruso",
      people: [{ name: "Dan Caruso", title: "Founder, Caruso Ventures · Founding CEO, Zayo Group" }],
      morePeople: 0,
      when: "4:00 PM CT",
      where: "Beckman Institute, Auditorium (Room 1025)",
      cta: null,
      alt: "Fireside Chat with Dan Caruso: Monday, Sept 28, 4:00 PM CT, Beckman Institute, Auditorium (Room 1025). Founders × Founders Week.",
    });
    expect(JSON.stringify(dan)).not.toMatch(/apply|interest|waitlist|book|private session/i);

    const panel = eventCardModel(entry("how-to-make-10k-a-month-in-college"), site);
    expect(panel).toMatchObject({
      involvement: { label: "Co-hosted by Founders", tone: "soft" },
      when: "6:00–8:00 PM CT",
      where: "Materials Science and Engineering Building, Room 100",
      cta: null,
    });

    const oh = eventCardModel(entry("office-hours-patrick-haddox-2026-10-01-am"), site);
    expect(oh).toMatchObject({
      involvement: { label: "Hosted by Founders", tone: "solid" },
      status: null,
      when: "10:00–11:30 AM CT",
      where: "Location to be announced",
      cta: "Apply for Office Hours",
    });
    expect(eventCardModel(entry("office-hours-patrick-haddox-2026-10-01-am"), closed()).cta).toBeNull();

    // Arnav's happy hour: supported by Founders, not an application.
    const happyHour = eventCardModel(entry("happy-hour-at-legends-with-arnav-mishra"), site);
    expect(happyHour).toMatchObject({
      weekday: "Wednesday",
      day: "30",
      month: "September",
      involvement: { label: "Supported by Founders" },
      title: "Happy Hour with Arnav Mishra at Legends",
      when: "5:00–7:00 PM CT",
      where: "Legends",
      cta: null,
    });

    for (const e of getScheduleEntries().filter((x) => x.kind === "event")) {
      const model = eventCardModel(e, site);
      expect(model.cta).toBeNull();
      expect(JSON.stringify(model)).not.toMatch(/HERE Apartments|after[\s-]?party/i);
    }
  });

  it("Rishab's office-hours calendar entry: Thu, Oct 1, 12:00–5:00 PM CT, place to be announced, hosted by Founders", () => {
    const site = getSite();
    expect(eventCardModel(entry("office-hours-rishab-veldur-2026-10-01"), site)).toEqual({
      label: "Founders Week 2026 · Calendar",
      weekday: "Thursday",
      day: "1",
      month: "October",
      involvement: { label: "Hosted by Founders", tone: "solid" },
      status: null,
      title: "Office hours with Rishab Veldur",
      people: [],
      morePeople: 0,
      when: "12:00–5:00 PM CT",
      where: "Location to be announced",
      cta: "Apply for Office Hours",
      alt: "Office hours with Rishab Veldur: Thursday, Oct 1, 12:00–5:00 PM CT, Location to be announced. Founders × Founders Week.",
    });
    expect(eventCardModel(entry("office-hours-rishab-veldur-2026-10-01"), closed()).cta).toBeNull();
    // Office-hours cards on the calendar: Patrick and Rishab on Oct 1, Arnav on Oct 2; none for Rishab on Oct 2.
    expect(getScheduleEntries().filter((e) => e.kind === "office-hours").map((e) => e.id)).toEqual([
      "office-hours-patrick-haddox-2026-10-01-am",
      "office-hours-rishab-veldur-2026-10-01",
      "office-hours-arnav-mishra-2026-10-02-am",
    ]);
    // Thursday in start-time order: Rishab's noon window sits between the 11:45 and 3:00 PM program blocks.
    expect(
      getScheduleEntries()
        .filter((e) => e.date === "2026-10-01")
        .map((e) => [e.id, eventCardModel(e, site).when]),
    ).toEqual([
      ["office-hours-patrick-haddox-2026-10-01-am", "10:00–11:30 AM CT"],
      ["science-and-practice-of-pitching", "11:45 AM–2:15 PM CT"],
      ["office-hours-rishab-veldur-2026-10-01", "12:00–5:00 PM CT"],
      ["entrepreneurial-impact-launching-from-illinois", "3:00–5:00 PM CT"],
      ["techrise-pitch-competition", "5:00–7:00 PM CT"],
    ]);
  });

  it("a date-only office-hours entry (fixture mentor): Thursday, Oct 1, time and place to be announced", () => {
    const site = getSite();
    expect(eventCardModel(dateOnlyEntry(), site)).toEqual({
      label: "Founders Week 2026 · Calendar",
      weekday: "Thursday",
      day: "1",
      month: "October",
      involvement: { label: "Hosted by Founders", tone: "solid" },
      status: null,
      title: "Office hours with Fixture Mentor",
      people: [],
      morePeople: 0,
      when: "Time to be announced",
      where: "Location to be announced",
      cta: "Apply for Office Hours",
      alt: "Office hours with Fixture Mentor: Thursday, Oct 1, Time to be announced, Location to be announced. Founders × Founders Week.",
    });
    expect(eventCardModel(dateOnlyEntry(), closed()).cta).toBeNull();
  });

  it("sizes long titles down", () => {
    expect(titleFontSize("Fireside Chat with Dan Caruso")).toBe(62);
    expect(titleFontSize("How to Make $10K/Month in College")).toBe(62);
    expect(titleFontSize("TechRise Pitch Competition and Panel Discussion")).toBe(52);
    expect(titleFontSize("Tailgate")).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// Assets and rendering — offline.
// ---------------------------------------------------------------------------

describe("social image assets and rendering", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
    // Any network access (e.g. a fallback-font download for a missing glyph) fails the test.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network access is not allowed in image generation")));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads the Founders logo and approved headshots from /public as data URLs", async () => {
    const logo = await publicImageDataUrl(getSite().brand.foundersLogo!.src);
    expect(logo).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    for (const m of getMentors()) {
      expect(await publicImageDataUrl(m.headshot!.src)).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    }
  });

  it("refuses anything outside public/brand and public/mentors", async () => {
    for (const src of [
      "/../package.json",
      "/brand/../../.env.local",
      "/mentors/../../lib/og/fonts/Archivo-Medium.ttf",
      "/brand/.hidden.png",
      "/brand/missing-logo.png",
      "https://example.com/logo.png",
      "/favicon.ico",
      "",
      null,
    ]) {
      expect(await publicImageDataUrl(src)).toBeNull();
    }
  });

  const isPng = async (res: Response) => {
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.length).toBeGreaterThan(10_000);
  };

  it("renders the site, mentor and event cards to PNG without the network", async () => {
    const site = getSite();
    await isPng(await renderSiteCard(siteCardModel(site, getMentors())));
    await isPng(await renderMentorCard(mentorCardModel(getMentor("vikram-lakhwara")!, site)));
    await isPng(await renderEventCard(eventCardModel(entry("dan-caruso-fireside-chat"), site)));
    await isPng(await renderEventCard(eventCardModel(entry("office-hours-patrick-haddox-2026-10-01-am"), site)));
    await isPng(await renderMentorCard(mentorCardModel(getMentor("rishab-veldur")!, site)));
    await isPng(await renderEventCard(eventCardModel(entry("office-hours-rishab-veldur-2026-10-01"), site)));
    // A date-only window, and a mentor without a headshot (initials are drawn).
    await isPng(await renderMentorCard(mentorCardModel(DATE_ONLY_MENTOR, site)));
    await isPng(await renderEventCard(eventCardModel(dateOnlyEntry(), site)));
  }, 60_000);
});

// ---------------------------------------------------------------------------
// What the site card draws — the element tree handed to ImageResponse, as markup.
// ---------------------------------------------------------------------------

describe("site social card drawing", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
    vi.stubGlobal("fetch", () => Promise.reject(new Error("network access is not allowed in image generation")));
  });
  afterEach(() => {
    vi.doUnmock("next/og");
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows six people: every mentor's headshot in content order, beside their first names", async () => {
    const drawn: ReactElement[] = [];
    vi.resetModules();
    vi.doMock("next/og", () => ({
      ImageResponse: class {
        constructor(node: ReactElement) {
          drawn.push(node);
        }
      },
    }));
    const [cards, model, content, assets] = await Promise.all([
      import("@/lib/og/cards"),
      import("@/lib/og/model"),
      import("@/content"),
      import("@/lib/og/assets"),
    ]);
    await cards.renderSiteCard(model.siteCardModel(content.getSite(), content.getMentors()));
    expect(drawn).toHaveLength(1);
    const html = renderToStaticMarkup(drawn[0]);

    const srcs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
    const photos = await Promise.all(MENTOR_IDS.map((id) => assets.publicImageDataUrl(`/mentors/${id}.jpg`)));
    expect(photos.every((p) => p?.startsWith("data:image/jpeg;base64,"))).toBe(true);
    // The logo first, then one photo per mentor, in content order (indexes into `photos`).
    expect(srcs).toHaveLength(7);
    expect(srcs[0]).toMatch(/^data:image\/png;base64,/);
    expect(srcs.slice(1).map((s) => photos.indexOf(s))).toEqual([0, 1, 2, 3, 4, 5]);
    // Photos, not initials, for all six.
    expect(html).not.toMatch(/>(PH|AM|VL|EN|RL|RV)</);

    const t = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    expect(t).toContain("Patrick, Arnav, Vik, Elliott, Ron and Rishab");
    expect(t).toContain("Apply for Office Hours");
    expect(t).not.toMatch(/one-on-one/i);
  });
});

// ---------------------------------------------------------------------------
// Glyph coverage — parse each font's cmap and check every rendered character.
// ---------------------------------------------------------------------------

function cmapCodepoints(file: string): Set<number> {
  const buf = readFileSync(join(process.cwd(), "lib", "og", "fonts", file));
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString("latin1", rec, rec + 4) === "cmap") cmap = buf.readUInt32BE(rec + 8);
  }
  if (cmap < 0) throw new Error(`no cmap in ${file}`);
  const out = new Set<number>();
  const count = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < count; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = buf.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) out.add(c);
      }
    } else if (format === 12) {
      const groups = buf.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = buf.readUInt32BE(sub + 16 + g * 12);
        const end = buf.readUInt32BE(sub + 20 + g * 12);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

function missing(text: string, font: Set<number>): string[] {
  return [...new Set([...text].filter((ch) => !/\s/.test(ch) && !font.has(ch.codePointAt(0)!)))];
}

describe("social image fonts cover every rendered character", () => {
  beforeEach(() => vi.stubEnv("SHOW_DEMO_CONTENT", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("uses Archivo only", () => {
    expect(Object.values(OG_FONT_FILES)).toEqual(["Archivo-Medium.ttf", "Archivo-SemiExpanded-Bold.ttf"]);
  });

  it("covers the site, mentor and event cards in both weights", () => {
    const site = getSite();
    const s = siteCardModel(site, getMentors());
    const text: string[] = [s.label, s.kicker, s.headline, s.sub, s.peopleLine, s.cta ?? "", "Founders"];
    text.push(...s.people.map((p) => p.initials));
    // The fixture mentor keeps the date-only wording ("Exact time to be confirmed") covered.
    for (const m of [...getMentors(), DATE_ONLY_MENTOR]) {
      const model = mentorCardModel(m, site);
      text.push(model.label, model.name, model.role ?? "", model.company ?? "", model.availability.text, model.cta ?? "");
    }
    for (const e of [...getScheduleEntries(), dateOnlyEntry()]) {
      const model = eventCardModel(e, site);
      text.push(model.label, model.weekday, model.day, model.month, model.title, model.when, model.where);
      text.push(model.involvement?.label ?? "", model.status ?? "", `and ${model.morePeople} more`, model.cta ?? "");
      for (const p of model.people) text.push(p.name, p.title ?? "");
    }
    const all = text.join(" ");
    for (const file of Object.values(OG_FONT_FILES)) {
      expect(missing(all, cmapCodepoints(file)), file).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// sitemap.xml and robots.txt
// ---------------------------------------------------------------------------

describe("sitemap and robots", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://founders.example.edu/");
    vi.stubEnv("VERCEL_ENV", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists public pages, every mentor and every calendar entry as absolute URLs", () => {
    const urls = sitemap().map((u) => u.url);
    expect(urls.slice(0, 3)).toEqual([
      "https://founders.example.edu",
      "https://founders.example.edu/office-hours",
      "https://founders.example.edu/schedule",
    ]);
    for (const id of MENTOR_IDS) expect(urls).toContain(`https://founders.example.edu/office-hours/${id}`);
    for (const e of getScheduleEntries()) expect(urls).toContain(`https://founders.example.edu/schedule/${e.id}`);
    expect(urls).toContain("https://founders.example.edu/schedule/happy-hour-at-legends-with-arnav-mishra");
    expect(urls).toContain("https://founders.example.edu/office-hours/rishab-veldur");
    expect(urls).toContain("https://founders.example.edu/schedule/office-hours-rishab-veldur-2026-10-01");
    expect(urls).toHaveLength(3 + getMentors().length + getScheduleEntries().length);
    // Three public pages, six mentor profiles and fifteen calendar entries.
    expect([getMentors().length, getScheduleEntries().length, urls.length]).toEqual([6, 15, 24]);
    expect(urls.every((u) => u.startsWith("https://founders.example.edu"))).toBe(true);
    expect(urls.join(" ")).not.toMatch(/organizers|\/api\/|\/apply|afterparty|demo/);
  });

  it("keeps organizer pages, the API and applicant status links out of search", () => {
    const r = robots();
    expect(r.sitemap).toBe("https://founders.example.edu/sitemap.xml");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/organizers", "/api/", "/apply/status/"]);
  });

  it("keeps Vercel preview deployments out of search entirely", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toBe("/");
    expect(r.sitemap).toBeUndefined();
  });
});
