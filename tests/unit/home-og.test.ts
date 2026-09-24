/**
 * Social images, sitemap and robots, against the public (default-env) content:
 * - card models say only what the site says (verified role/org, availability state, CTA wording),
 *   and no event card — Dan Caruso's in particular — carries an application CTA;
 * - every character the cards would render exists in the bundled fonts (a missing glyph would make
 *   the image renderer fetch a fallback font over the network);
 * - sitemap lists public pages as absolute URLs; robots keeps organizer/API/status links out.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getMentors, getScheduleDays, getScheduleEntries, getSite } from "@/content";
import { eventCardModel, mentorCardModel, siteCardModel, titleFontSize, weekStamp } from "@/lib/og/model";

const entry = (id: string) => getScheduleEntries().find((e) => e.id === id)!;
const mentorModel = (id: string) => {
  const mentors = getMentors();
  const i = mentors.findIndex((m) => m.id === id);
  return mentorCardModel(mentors[i], i, mentors.length);
};

describe("social image models (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("site card leads with Founders Office Hours and every mentor", () => {
    const m = siteCardModel(getSite(), getMentors(), getScheduleDays());
    expect(m.kicker).toBe("Founders Office Hours");
    expect(m.cta).toBe("Apply for Office Hours");
    expect(m.portraits.map((p) => p.initials)).toEqual(["PH", "AM", "VL", "RL"]);
    expect(m.portraits.map((p) => p.caption)).toEqual(["01 / 04", "02 / 04", "03 / 04", "04 / 04"]);
    expect(m.sub).toBe("Meet Patrick, Arnav, Vik and Ron one-on-one during Founders Week. One application covers every mentor.");
    expect(m.meta).toBe("4 mentors · One application · Mon Sep 28 – Sat Oct 3");
    expect(m.stamp).toBe("Founders Week 2026 · UIUC · Mon Sep 28 – Sat Oct 3");
    expect(m.alt).toContain("Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara and Ron Lewis");
  });

  it("mentor cards show verified role · organization, availability state and the right CTA", () => {
    expect(mentorModel("patrick-haddox")).toMatchObject({
      name: "Patrick Haddox",
      roleLine: "CEO & Co-Founder · Samara Aerospace",
      availability: { kind: "window", label: "Availability window", value: "Thu, Oct 1 · 10:00–11:30 AM CT" },
      cta: "Apply to meet Patrick",
    });
    expect(mentorModel("arnav-mishra")).toMatchObject({
      roleLine: "Co-Founder & CTO · Doss",
      availability: { kind: "window-approx", value: "Fri, Oct 2 · Morning, before noon CT" },
      cta: "Apply to meet Arnav",
    });
    // Vik's title is unverified: organization only.
    expect(mentorModel("vikram-lakhwara")).toMatchObject({
      roleLine: "Stakehouse",
      availability: { kind: "in-progress", label: "Scheduling in progress" },
      cta: "Express interest",
    });
    expect(mentorModel("ron-lewis")).toMatchObject({ roleLine: "Co-Founder · Auctus Advisory", cta: "Express interest" });
    const json = JSON.stringify(getMentors().map((m) => mentorModel(m.id)));
    expect(json).not.toMatch(/commitments|Revenue strategy|Wednesday/i);
  });

  it("event cards carry no application CTA — only office-hours entries do", () => {
    const site = getSite();
    const dan = eventCardModel(entry("dan-caruso-fireside-chat"), site);
    expect(dan).toMatchObject({
      rank: "02 — Featured",
      title: "Dan Caruso — Fireside Chat",
      when: "Time forthcoming",
      where: "Location forthcoming",
      certainty: "dotted",
      people: "Dan Caruso · Founder, Caruso Ventures",
      cta: null,
    });
    expect(dan.badges.map((b) => b.label)).toEqual(["Supported by Founders", "Related event", "Planned"]);
    expect(JSON.stringify(dan)).not.toMatch(/apply|interest|waitlist|book/i);

    const panel = eventCardModel(entry("how-to-make-10k-a-month-in-college"), site);
    expect(panel).toMatchObject({
      rank: "03 — Featured",
      when: "6:00–8:00 PM CT",
      where: "100 MSEB",
      certainty: "solid",
      cta: null,
    });
    expect(panel.badges.map((b) => b.label)).toEqual(["Co-hosted by Founders", "Related event"]);

    const showcase = eventCardModel(entry("founders-showcase-day-sessions"), site);
    expect(showcase).toMatchObject({ rank: null, cta: null, detail: "Talk · Panel · Networking · 11 sessions" });

    const oh = eventCardModel(entry("office-hours-patrick-haddox-2026-10-01-am"), site);
    expect(oh).toMatchObject({ rank: "01 — Featured", cta: "Apply for Office Hours", certainty: "dashed" });
    expect(oh.badges.map((b) => b.label)).toEqual(["Hosted by Founders"]);

    for (const e of getScheduleEntries().filter((x) => x.kind === "event")) {
      expect(eventCardModel(e, site).cta).toBeNull();
    }
  });

  it("sizes long titles down", () => {
    expect(titleFontSize("Dan Caruso — Fireside Chat")).toBe(76);
    expect(titleFontSize("How to Make $10K/Month in College")).toBe(64);
    expect(titleFontSize("TechRise Pitch Competition and Panel Discussion")).toBe(54);
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
  const sans = cmapCodepoints("Archivo-Medium.ttf");
  const wide = cmapCodepoints("Archivo-SemiExpanded-ExtraBold.ttf");
  const mono = cmapCodepoints("JetBrainsMono-Medium.ttf");
  const serif = cmapCodepoints("InstrumentSerif-Italic.ttf");

  it("covers the site, mentor and event cards", () => {
    const site = getSite();
    const mentors = getMentors();
    const days = getScheduleDays();
    const s = siteCardModel(site, mentors, days);
    const wideText = [s.headline, ...s.portraits.map((p) => p.initials), "Founders"];
    const serifText = [s.headlineAccent, "×"];
    const sansText = [s.sub, s.cta, "Founders Week"];
    const monoText = [s.kicker, s.meta, s.stamp, ...s.portraits.map((p) => p.caption), weekStamp(site, days)];

    mentors.forEach((m, i) => {
      const model = mentorCardModel(m, i, mentors.length);
      wideText.push(model.name, model.portrait.initials);
      sansText.push(model.roleLine ?? "", model.cta);
      monoText.push(model.stamp, model.availability.label, model.availability.value);
    });
    for (const e of getScheduleEntries()) {
      const model = eventCardModel(e, site);
      wideText.push(model.title, model.day);
      sansText.push(model.people ?? "", model.cta ?? "");
      monoText.push(model.stamp, model.weekday, model.month, model.rank ?? "", model.when, model.where, model.detail ?? "", "·");
      monoText.push(...model.badges.map((b) => b.label));
    }
    // Mono labels render uppercase.
    const monoAll = monoText.join(" ");
    expect(missing(wideText.join(" "), wide)).toEqual([]);
    expect(missing(serifText.join(" "), serif)).toEqual([]);
    expect(missing(sansText.join(" "), sans)).toEqual([]);
    expect(missing(`${monoAll} ${monoAll.toUpperCase()}`, mono)).toEqual([]);
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
    for (const id of ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"]) {
      expect(urls).toContain(`https://founders.example.edu/office-hours/${id}`);
    }
    for (const e of getScheduleEntries()) expect(urls).toContain(`https://founders.example.edu/schedule/${e.id}`);
    expect(urls).toHaveLength(3 + getMentors().length + getScheduleEntries().length);
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
