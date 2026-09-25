import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleEntries } from "@/content";
import { demoMentors } from "@/content/demo";
import { mentors as productionMentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor } from "@/content/types";
import { buildApplicationCatalog, mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { officeHoursEntryId } from "@/lib/schedule/entries";
import {
  applyToMeetLabel,
  appearanceLabel,
  appearancesByMentor,
  appearanceView,
  availabilityHeadline,
  availabilityItems,
  availabilityLine,
  availabilityLines,
  availabilityNote,
  availabilityOneLiner,
  availabilityView,
  bioFirstSentence,
  excerpt,
  expertiseSummary,
  factualOneLiner,
  helpLabels,
  mentorAction,
  mentorAppearanceViews,
  mentorCardView,
  mentorCta,
  mentorIndexCaption,
  mentorMetaDescription,
  mentorProfileHref,
  mentorSectionId,
  preselectedOption,
  SELECT_MENTOR_LABEL,
  sessionDetails,
  sessionRuleLine,
  sessionSummary,
  strongestAvailabilityKind,
  visibleExpertise,
  visibleField,
  windowKind,
} from "@/lib/mentors-view";

const byId = (list: Mentor[], id: string) => {
  const m = list.find((x) => x.id === id);
  if (!m) throw new Error(`missing mentor ${id}`);
  return m;
};

const patrick = byId(productionMentors, "patrick-haddox");
const arnav = byId(productionMentors, "arnav-mishra");
const ron = byId(productionMentors, "ron-lewis");
const vik = byId(productionMentors, "vikram-lakhwara");
const elliott = byId(productionMentors, "elliott-notrica");
const rishab = byId(productionMentors, "rishab-veldur");
const avery = byId(demoMentors, "demo-avery-sample");
const jordan = byId(demoMentors, "demo-jordan-placeholder");

/** Display order students see (content order). */
const MENTOR_IDS = [
  "patrick-haddox",
  "arnav-mishra",
  "vikram-lakhwara",
  "elliott-notrica",
  "ron-lewis",
  "rishab-veldur",
];
/** Mentors with an approved "Can help with" list (Rishab has background tags and a good fit instead). */
const EXPERTISE_IDS = MENTOR_IDS.filter((id) => id !== "rishab-veldur");

/** Each mentor's public links, as supplied by the organizers (in order). */
const LINKS: Record<string, { label: string; url: string }[]> = {
  "patrick-haddox": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/patrick-haddox/" }],
  "arnav-mishra": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/arnav-mishra/" }],
  "vikram-lakhwara": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/viklakhwara/" }],
  "elliott-notrica": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/elliottnotrica/" }],
  "ron-lewis": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }],
  "rishab-veldur": [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/rishab-veldur" },
    { label: "Auvi Labs", url: "https://www.auvilabs.com/" },
  ],
};

const RISHAB_BIO =
  "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier. With a background in engineering at Illinois, he helped build a company that placed second in the 2024 Cozad New Venture Challenge.";
const RISHAB_BIO_FIRST =
  "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier.";
const RISHAB_GOOD_FIT =
  "Interested in turning a technical project into a healthcare startup? Rishab’s experience spans engineering, medical-device development, and building a company through Illinois’ entrepreneurship ecosystem.";
const RISHAB_WINDOW_ID = "rishab-veldur-2026-10-01";
const RISHAB_WINDOW_NOTE =
  "Rishab is free anytime from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside this window.";
/** Session length is policy now (site.officeHours), so only the location is still being set. */
const RISHAB_SESSION_NOTE =
  "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting the location.";
/** Rishab's window reads like Patrick's ("Thu, Oct 1 · 10:00–11:30 AM CT"). */
const RISHAB_TIME = "12:00–5:00 PM CT";
const RISHAB_LINE = "Thu, Oct 1 · 12:00–5:00 PM CT";
const RISHAB_APPLY_HREF = "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply";
// Ron: exact window Thu Oct 1, 2:30–4:30 PM CT, in person at BIF (organizer update, Sept 24).
const RON_WINDOW_ID = "ron-lewis-2026-10-01-pm";
const RON_TIME = "2:30–4:30 PM CT";
const RON_LINE = "Thu, Oct 1 · 2:30–4:30 PM CT";

/**
 * A synthetic mentor with one date-only window (the date is set, the time isn't), so the
 * "Exact time to be confirmed" path stays covered now that every real mentor with a date has a time.
 * Shaped like a real content entry: the window carries the same label and kind of note content uses.
 */
const TBA_WINDOW_ID = "fixture-tba-2026-10-01";
const TBA_WINDOW_NOTE = "Sam has time on Thursday, October 1. We’ll share the exact time once it’s set, and you can apply now.";
const TBA_LINE = "Thu, Oct 1 · Exact time to be confirmed";
const TBA_APPLY_HREF = "/office-hours?mentor=fixture-tba-mentor&window=fixture-tba-2026-10-01#apply";
const tbaMentor: Mentor = {
  id: "fixture-tba-mentor",
  name: "Sam Fixture",
  firstName: "Sam",
  role: "Founder",
  company: "Fixture Co",
  headshot: null,
  bio: { status: "approved", value: "Sam is a fictional founder used only in tests. Nothing here is real." },
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
  availability: [
    {
      id: TBA_WINDOW_ID,
      date: "2026-10-01",
      time: { kind: "tba" },
      label: "Exact time to be confirmed",
      note: TBA_WINDOW_NOTE,
    },
  ],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [],
};

/**
 * A synthetic mentor with one part-of-day window ("Friday morning, before noon"), so the rough-window
 * path stays covered now that every real mentor with a window has exact times (Arnav's Friday
 * window became 10:00–11:30 AM on Sept 24). Shaped like Arnav's old content entry.
 */
const ROUGH_WINDOW_ID = "fixture-rough-2026-10-02-am";
const ROUGH_WINDOW_NOTE = "Riley has time Friday morning. We’ll share the exact window once it’s confirmed.";
const roughMentor: Mentor = {
  ...tbaMentor,
  id: "fixture-rough-mentor",
  name: "Riley Fixture",
  firstName: "Riley",
  availability: [
    {
      id: ROUGH_WINDOW_ID,
      date: "2026-10-02",
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
      label: "Friday morning, before noon · Exact window pending",
      note: ROUGH_WINDOW_NOTE,
    },
  ],
};

/**
 * Words that only exist in organizer notes / unapproved drafts for the production mentors.
 * (Ron's approved expertise legitimately says "Revenue strategy and optimization", so his draft
 * "Revenue strategy" topic is checked as an exact JSON string below.)
 */
const PRIVATE_FRAGMENTS = [
  "Wednesday through Saturday",
  "Saturday morning",
  "commitments",
  "not available slots",
  '"Revenue strategy"',
  "Startup financial planning",
  "Communicating business progress",
  "Verify title",
  "Much more available",
  "extra sessions",
  // From Rishab's email to the organizers.
  "student teams",
  "eligibility rule",
  "Oct 1 and 2",
  "email signature",
  "phone number",
];

/**
 * Auvi's device is investigational: public copy never calls it FDA-approved or cleared,
 * commercially available or clinically proven, and never promises one-on-one meetings.
 */
const FORBIDDEN_CLAIMS = [
  /FDA/i,
  /\bclear(ed|ance)\b/i,
  /commercially/i,
  /clinically/i,
  /on the market/i,
  /\bapproved\b/i,
  /investigational/i,
  /Beacon/,
  /one[- ]on[- ]one/i,
];

/** Sentences in a bio ("St. Louis" is not a sentence break). */
function sentences(text: string): string[] {
  return text
    .replace(/\bSt\./g, "St")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(Boolean);
}

describe("public mentor data (content loader, default env)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
    vi.stubEnv("VERCEL_ENV", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists the six mentors in order, without organizer notes or drafts", () => {
    const mentors = getMentors();
    expect(mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    for (const m of mentors) {
      expect(m).not.toHaveProperty("organizerNotes");
      for (const field of [m.bio, m.expertise, m.askMeAbout, m.goodFitFor]) {
        if (field) expect(field.status).toBe("approved");
      }
    }
    const publicRon = byId(mentors, "ron-lewis");
    expect(publicRon.askMeAbout).toBeNull(); // suggested topics pending Ron's confirmation
    expect(publicRon.bio?.status).toBe("approved");
    const publicVik = byId(mentors, "vikram-lakhwara");
    // Title now verified from stakehouse.fund; his bio is approved.
    expect(publicVik).toMatchObject({
      firstName: "Vik",
      role: "Founder & Managing Member",
      company: "Stakehouse",
      askMeAbout: null,
    });
    expect(publicVik.bio).toMatchObject({ status: "approved" });
    expect(publicVik.bio?.value).toContain("Stakehouse");
    const publicElliott = byId(mentors, "elliott-notrica");
    expect(publicElliott).toMatchObject({
      name: "Elliott Notrica",
      firstName: "Elliott",
      role: "Founder & CEO",
      company: "Symbio Bioculinary",
      acceptingApplications: true,
      availability: [],
      slots: [],
      askMeAbout: null,
    });
  });

  it("gives every mentor a headshot, their supplied links and an approved bio", () => {
    for (const m of getMentors()) {
      // Headshot supplied by the organizers, alt text = the mentor's name.
      expect(m.headshot, m.id).toMatchObject({ src: `/mentors/${m.id}.jpg`, alt: m.name });
      expect(m.headshot!.width).toBeGreaterThan(0);
      expect(m.headshot!.height).toBeGreaterThan(0);
      expect(existsSync(path.join(process.cwd(), "public", m.headshot!.src)), m.headshot!.src).toBe(true);
      // Exactly the links the organizers supplied, in order.
      expect(m.links, m.id).toEqual(LINKS[m.id]);
      expect(m.bio?.status, m.id).toBe("approved");
    }
  });

  it("gives the five topic mentors a three-sentence bio and 3–5 approved highlights", () => {
    const mentors = getMentors().filter((m) => EXPERTISE_IDS.includes(m.id));
    expect(mentors.map((m) => m.id)).toEqual(EXPERTISE_IDS);
    for (const m of mentors) {
      // Approved three-sentence introduction.
      expect(sentences(m.bio!.value), m.id).toHaveLength(3);
      // "Can help most with": 3–5 approved highlights, each with its basis.
      const items = visibleExpertise(m);
      expect(items?.draft, m.id).toBe(false);
      expect(items!.value.length, m.id).toBeGreaterThanOrEqual(3);
      expect(items!.value.length, m.id).toBeLessThanOrEqual(5);
      for (const item of items!.value) {
        expect(item.label.trim(), m.id).not.toBe("");
        expect(item.basis.trim(), m.id).not.toBe("");
      }
    }
  });

  it("publishes Rishab with his approved bio, background tags and good fit, but no topic list", () => {
    const publicRishab = byId(getMentors(), "rishab-veldur");
    expect(publicRishab).toMatchObject({
      name: "Rishab Veldur",
      firstName: "Rishab",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur" },
      backgroundTags: ["Medtech", "Hardware and software", "University spinouts"],
      expertise: null,
      askMeAbout: null,
      acceptingApplications: true,
      slots: [],
    });
    expect(publicRishab.bio).toMatchObject({ status: "approved", value: RISHAB_BIO });
    expect(sentences(publicRishab.bio!.value)).toHaveLength(2);
    expect(publicRishab.goodFitFor).toMatchObject({ status: "approved", value: [RISHAB_GOOD_FIT] });
    // One exact window on Thu, Oct 1, noon to 5 PM (id kept from the date-only days); nothing on Fri, Oct 2.
    expect(publicRishab.availability).toEqual([
      {
        id: RISHAB_WINDOW_ID,
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        note: RISHAB_WINDOW_NOTE,
      },
    ]);
    // No display override: the time itself is the label now.
    expect(publicRishab.availability[0]).not.toHaveProperty("label");
    expect(publicRishab.availability.map((w) => w.date)).not.toContain("2026-10-02");
    expect(publicRishab.session).toEqual({
      format: null,
      durationMinutes: site.officeHours.sessionMinutes,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: RISHAB_SESSION_NOTE,
    });
    // Nothing to show under "Can help with".
    expect(visibleExpertise(publicRishab)).toBeNull();
    expect(helpLabels(publicRishab)).toEqual([]);
    expect(expertiseSummary(publicRishab)).toBeNull();
  });

  it("uses the verified roles", () => {
    const mentors = getMentors();
    expect(byId(mentors, "patrick-haddox")).toMatchObject({ role: "CEO & Co-Founder", company: "Samara Aerospace" });
    expect(byId(mentors, "arnav-mishra")).toMatchObject({ role: "Co-Founder & CTO", company: "Doss" });
    expect(byId(mentors, "vikram-lakhwara")).toMatchObject({ role: "Founder & Managing Member", company: "Stakehouse" });
    expect(byId(mentors, "elliott-notrica")).toMatchObject({ role: "Founder & CEO", company: "Symbio Bioculinary" });
    expect(byId(mentors, "ron-lewis")).toMatchObject({ role: "Co-Founder", company: "Auctus Advisory" });
    expect(byId(mentors, "rishab-veldur")).toMatchObject({ role: "Co-Founder & CEO", company: "Auvi Labs" });
  });

  it("never serializes organizer-only constraints or draft topics", () => {
    const json = JSON.stringify(getMentors());
    for (const fragment of PRIVATE_FRAGMENTS) expect(json, fragment).not.toContain(fragment);
    // Every organizer note, verbatim, stays out.
    for (const m of productionMentors) {
      expect(m.organizerNotes, m.id).toBeTruthy();
      expect(json).not.toContain(m.organizerNotes!);
    }
    // Nothing about the canceled Saturday Founders Week Afterparty (HERE Apartments).
    expect(json).not.toMatch(/HERE Apartments|Founders Week Afterparty|founders-week-afterparty/i);
  });

  it("keeps em dashes out of mentor copy, including organizer notes and source labels", () => {
    expect(JSON.stringify(getMentors())).not.toContain("—");
    expect(JSON.stringify(productionMentors)).not.toContain("—");
  });

  it("never lists Vik as available (his existing commitments are not slots)", () => {
    const publicVik = byId(getMentors(), "vikram-lakhwara");
    const view = availabilityView(publicVik);
    expect(view.status).toBe("in-progress");
    expect(view.windows).toEqual([]);
    expect(mentorMetaDescription(publicVik)).not.toMatch(/Wed|Thu|Fri|Sat/);
    expect(availabilityHeadline(publicVik)).toMatchObject({ kind: "in-progress", date: null });
  });

  it("shows Elliott as scheduling in progress: no times, interest only", () => {
    const publicElliott = byId(getMentors(), "elliott-notrica");
    const view = availabilityView(publicElliott);
    expect(view).toEqual({ status: "in-progress", windows: [], slotCount: 0 });
    expect(availabilityItems(view)).toEqual([]);
    expect(availabilityOneLiner(view)).toBe("Scheduling in progress");
    expect(availabilityHeadline(publicElliott)).toEqual({
      kind: "in-progress",
      label: "Scheduling in progress",
      date: null,
      dateTime: null,
      time: "Times to be announced",
      more: 0,
    });
    expect(buildApplicationCatalog([publicElliott]).mentors).toEqual([
      expect.objectContaining({ id: "elliott-notrica", scheduling: "in-progress", options: [] }),
    ]);
  });

  it("never offers Dan Caruso (or anyone outside the lineup) as a mentor", () => {
    const mentors = getMentors();
    expect(JSON.stringify(mentors)).not.toMatch(/Caruso/);
    const catalog = buildApplicationCatalog(mentors);
    expect(catalog.mentors.map((m) => m.id)).toEqual(mentors.map((m) => m.id));
    for (const m of mentors) expect(mentorCta(m).href).toMatch(/^\/office-hours\?mentor=[a-z-]+/);
  });

  it("shows drafts only in draft preview, flagged as drafts", () => {
    vi.stubEnv("SHOW_DRAFT_CONTENT", "true");
    const previewRon = byId(getMentors(), "ron-lewis");
    const topics = visibleField(previewRon.askMeAbout);
    expect(topics?.draft).toBe(true);
    expect(topics?.value).toEqual([
      "Revenue strategy",
      "Startup financial planning",
      "Communicating business progress to stakeholders",
    ]);
    // Organizer notes stay out even in preview.
    expect(previewRon).not.toHaveProperty("organizerNotes");
    expect(byId(getMentors(), "rishab-veldur")).not.toHaveProperty("organizerNotes");
  });

  it("never shows demo mentors on a production deploy, even with the flag", () => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getMentors().some((m) => m.demo)).toBe(false);
  });
});

describe("visibleField", () => {
  it("returns null for missing or empty fields and flags drafts", () => {
    expect(visibleField(null)).toBeNull();
    expect(visibleField({ status: "approved", value: [] as string[] })).toBeNull();
    expect(visibleField({ status: "approved", value: "Bio", note: "internal" })).toEqual({
      value: "Bio",
      draft: false,
      draftNote: null, // approved-field notes never render
    });
    expect(visibleField({ status: "draft", value: ["x"], note: "pending" })).toEqual({
      value: ["x"],
      draft: true,
      draftNote: "pending",
    });
  });

  it("drops the internal notes on Rishab's approved bio and good fit", () => {
    expect(visibleField(rishab.bio)).toEqual({ value: RISHAB_BIO, draft: false, draftNote: null });
    expect(visibleField(rishab.goodFitFor)).toEqual({ value: [RISHAB_GOOD_FIT], draft: false, draftNote: null });
  });
});

describe("expertise (verified, with its basis)", () => {
  it("keeps every item's basis", () => {
    expect(visibleExpertise(patrick)?.value).toEqual([
      { label: "Turning university research into a startup", basis: "Samara commercializes MSAC, invented at Illinois" },
      { label: "Raising a seed round for deep-tech hardware", basis: "Samara’s $10M seed round, 2026" },
      { label: "Spacecraft engineering and testing", basis: "Former senior spacecraft test engineer, Blue Canyon Technologies" },
      { label: "Winning early aerospace and government customers", basis: "Samara’s SpaceWERX contract" },
    ]);
    expect(visibleExpertise(vik)?.value).toEqual([
      { label: "Raising a pre-seed round", basis: "Stakehouse backs founders at the earliest stage" },
      { label: "What early-stage investors look for", basis: "Founder & Managing Member, Stakehouse" },
      {
        label: "Fundraising as a Midwest university founder",
        basis: "Stakehouse invests in founders tied to Missouri-region universities",
      },
      { label: "Funding start-ups in the Midwest", basis: "Founders Showcase panelist" },
      { label: "Silicon Valley vs. Midwest venture", basis: "Former Silicon Valley VC, now in St. Louis" },
    ]);
    expect(visibleExpertise(elliott)?.value.map((e) => e.label)).toEqual([
      "Starting a company as an undergrad",
      "Biotech and food-tech startups",
      "Licensing a technology instead of making the product",
      "Early grants, competitions and fellowships",
      "Setting up a lab and making first hires",
    ]);
    expect(visibleExpertise(rishab)).toBeNull();
  });

  it("summarizes approved expertise in one line and never a draft", () => {
    expect(expertiseSummary(ron)).toBe(
      "Revenue strategy and optimization · Financial forecasting and planning · Communicating progress to investors and stakeholders · Navigating Chicago’s venture capital scene",
    );
    expect(expertiseSummary(arnav)).toBe(
      "Going from engineer to technical co-founder · Building B2B and enterprise software · Early-stage architecture, integrations and automation · Landing engineering roles at startups and big tech · Taking a startup from idea to scale",
    );
    expect(expertiseSummary({ expertise: null })).toBeNull();
    expect(expertiseSummary({ expertise: { status: "draft", value: [{ label: "x", basis: "y" }] } })).toBeNull();
  });
});

describe("Founders Week appearances", () => {
  it("links each Showcase speaker to their session on the calendar", () => {
    const entries = getScheduleEntries();
    const byMentor = appearancesByMentor(entries, getMentors());
    expect(Object.keys(byMentor)).toEqual(MENTOR_IDS);
    expect(byMentor["arnav-mishra"][1]).toEqual(
      expect.objectContaining({
        href: "/schedule/founders-showcase-day-sessions",
        // The session title comes from the calendar (content/events.ts), punctuated either way.
        title: expect.stringMatching(/^From Idea to Scale(?: — |: )Building Doss[:,] Lessons from an Illini Founder$/),
        context: "Founders Showcase Day Sessions",
        dateShort: "Fri, Oct 2",
        timeLabel: "1:55–2:25 PM CT",
        startLabel: "1:55 PM",
        dateTime: "2026-10-02T13:55",
        roleLabel: "Speaking",
        venue: "Illinois Conference Center",
      }),
    );
    expect(byMentor["patrick-haddox"].map((a) => a.title)).toEqual([
      "Next Generation Industrial, Manufacturing and Space Tech",
    ]);
    expect(byMentor["vikram-lakhwara"].map((a) => a.title)).toEqual(["Funding Start-ups in the Midwest"]);
    expect(byMentor["rishab-veldur"].map((a) => a.title)).toEqual(["Health Innovation: From Therapeutics to Devices"]);
    expect(byMentor["ron-lewis"]).toEqual([]);
  });

  it("shows Arnav hosting his Wednesday happy hour first, then his Showcase talk", () => {
    const views = mentorAppearanceViews(getScheduleEntries(), "arnav-mishra");
    expect(views).toHaveLength(2);
    expect(views[0]).toEqual({
      key: "happy-hour-at-legends-with-arnav-mishra::17:00",
      href: "/schedule/happy-hour-at-legends-with-arnav-mishra",
      title: "Happy Hour with Arnav Mishra at Legends",
      context: null,
      date: "2026-09-30",
      dateShort: "Wed, Sep 30",
      timeLabel: "5:00–7:00 PM CT",
      startLabel: "5:00 PM",
      dateTime: "2026-09-30T17:00",
      roleLabel: "Hosting",
      venue: "Legends",
    });
    // Role, date and the full time range, labeled CT.
    expect(views.map(appearanceLabel)).toEqual([
      "Hosting Wed, Sep 30 · 5:00–7:00 PM CT",
      "Speaking Fri, Oct 2 · 1:55–2:25 PM CT",
    ]);
  });

  it("labels an appearance with its time range in CT, the start alone without an end, or just the date", () => {
    const base = {
      entryId: "e",
      entryTitle: "Founders Showcase",
      date: "2026-10-02",
      sessionTitle: null,
      role: "speaker",
      venue: null,
    } as const;
    expect(appearanceLabel(appearanceView({ ...base, start: "13:20", end: "13:55" }))).toBe(
      "Speaking Fri, Oct 2 · 1:20–1:55 PM CT",
    );
    expect(appearanceLabel(appearanceView({ ...base, start: "11:30", end: "12:15", role: "moderator" }))).toBe(
      "Moderating Fri, Oct 2 · 11:30 AM–12:15 PM CT",
    );
    expect(appearanceLabel(appearanceView({ ...base, start: "13:55", end: null }))).toBe("Speaking Fri, Oct 2 · 1:55 PM CT");
    expect(appearanceLabel(appearanceView({ ...base, start: null, end: null, role: "host" }))).toBe("Hosting Fri, Oct 2");
    // Every published appearance of every mentor carries its end time and CT.
    for (const views of Object.values(appearancesByMentor(getScheduleEntries(), getMentors()))) {
      for (const v of views) expect(appearanceLabel(v)).toMatch(/ · \d{1,2}:\d{2}( [AP]M)?–\d{1,2}:\d{2} [AP]M CT$/);
    }
  });

  it("links Elliott to the TechRise Cohort 2 panel", () => {
    const views = mentorAppearanceViews(getScheduleEntries(), "elliott-notrica");
    expect(views).toEqual([
      expect.objectContaining({
        href: "/schedule/techrise-pitch-competition",
        title: "TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?",
        context: "TechRise Pitch Competition and Panel Discussion",
        dateShort: "Thu, Oct 1",
        timeLabel: "6:30–6:50 PM CT",
        dateTime: "2026-10-01T18:30",
        roleLabel: "Speaking",
        venue: "EnterpriseWorks",
      }),
    ]);
    expect(appearanceLabel(views[0])).toBe("Speaking Thu, Oct 1 · 6:30–6:50 PM CT");
  });

  it("links Rishab to the Health Innovation panel, separately from his office hours", () => {
    const entries = getScheduleEntries();
    const views = mentorAppearanceViews(entries, "rishab-veldur");
    expect(views).toEqual([
      {
        key: "founders-showcase-day-sessions:Health Innovation: From Therapeutics to Devices:13:20",
        href: "/schedule/founders-showcase-day-sessions",
        title: "Health Innovation: From Therapeutics to Devices",
        context: "Founders Showcase Day Sessions",
        date: "2026-10-02",
        dateShort: "Fri, Oct 2",
        timeLabel: "1:20–1:55 PM CT",
        startLabel: "1:20 PM",
        dateTime: "2026-10-02T13:20",
        roleLabel: "Speaking",
        venue: "Illinois Conference Center",
      },
    ]);
    expect(appearanceLabel(views[0])).toBe("Speaking Fri, Oct 2 · 1:20–1:55 PM CT");
    // His office hours are a calendar entry of their own (Thu, Oct 1, noon to 5 PM), never an appearance.
    const officeHours = entries.filter((e) => e.kind === "office-hours" && e.title === "Office hours with Rishab Veldur");
    expect(officeHours.map((e) => [e.id, e.date, e.time])).toEqual([
      [officeHoursEntryId({ id: RISHAB_WINDOW_ID }), "2026-10-01", { kind: "exact", start: "12:00", end: "17:00" }],
    ]);
    expect(officeHours[0].registration).toEqual({ url: RISHAB_APPLY_HREF, label: "Apply to meet Rishab", internal: true });
    expect(views.map((v) => v.href)).not.toContain(`/schedule/${officeHours[0].id}`);
  });

  it("names every office-hours mentor on the Showcase stage in the Showcase listing", () => {
    const entries = getScheduleEntries();
    const showcase = entries.find((e) => e.id === "founders-showcase-day-sessions")!;
    const onStage = getMentors().filter((m) =>
      mentorAppearanceViews(entries, m.id).some((a) => a.href === "/schedule/founders-showcase-day-sessions"),
    );
    expect(onStage.map((m) => m.id).sort()).toEqual(["arnav-mishra", "patrick-haddox", "rishab-veldur", "vikram-lakhwara"]);
    const lastName = (m: Mentor) => m.name.split(" ").at(-1)!;
    for (const m of onStage) {
      expect(showcase.summary, `summary names ${m.id}`).toContain(lastName(m));
      expect(showcase.description, `description names ${m.id}`).toContain(lastName(m));
    }
    // The count in the copy matches the data (no stale "Three of this week’s office-hours mentors").
    expect(showcase.description).not.toMatch(/\bThree of this week’s office-hours mentors\b/);
  });

  it("never links anyone to the canceled Saturday afterparty", () => {
    const all = Object.values(appearancesByMentor(getScheduleEntries(), getMentors())).flat();
    for (const a of all) {
      expect(a.href).not.toContain("founders-week-afterparty");
      expect(a.date).not.toBe("2026-10-03");
      expect(a.venue ?? "").not.toMatch(/HERE Apartments/i);
      expect(a.title).not.toMatch(/Founders Week Afterparty/i);
    }
  });
});

describe("availability", () => {
  it("distinguishes exact windows from rough and date-only ones", () => {
    expect(windowKind(patrick.availability[0])).toBe("window");
    expect(windowKind(arnav.availability[0])).toBe("window");
    expect(windowKind(rishab.availability[0])).toBe("window");
    expect(windowKind(roughMentor.availability[0])).toBe("window-approx");
    expect(windowKind(tbaMentor.availability[0])).toBe("window-approx");

    const p = availabilityView(patrick);
    expect(p.status).toBe("available");
    expect(p.windows[0]).toMatchObject({
      dateShort: "Thu, Oct 1",
      dateLong: "Thursday, October 1",
      timeLabel: "10:00–11:30 AM CT",
      slots: [],
    });
    // Arnav's window became exact on Sept 24 (same id, no display label any more).
    expect(availabilityView(arnav).windows[0]).toMatchObject({
      id: "arnav-mishra-2026-10-02-am",
      kind: "window",
      dateShort: "Fri, Oct 2",
      dateLong: "Friday, October 2",
      timeLabel: "10:00–11:30 AM CT",
      label: null,
      slots: [],
    });
    expect(availabilityView(roughMentor).windows[0]).toMatchObject({
      kind: "window-approx",
      dateShort: "Fri, Oct 2",
      timeLabel: "Morning, before noon CT",
      label: "Friday morning, before noon · Exact window pending",
    });
  });

  it("shows Rishab's one window on Thu, Oct 1, noon to 5 PM CT, as an availability window with no slots", () => {
    expect(availabilityView(rishab)).toEqual({
      status: "available",
      windows: [
        {
          id: RISHAB_WINDOW_ID,
          kind: "window",
          date: "2026-10-01",
          dateShort: "Thu, Oct 1",
          dateLong: "Thursday, October 1",
          timeLabel: RISHAB_TIME,
          label: null,
          note: RISHAB_WINDOW_NOTE,
          slots: [],
        },
      ],
      slotCount: 0,
    });
    expect(availabilityItems(availabilityView(rishab))).toEqual([
      {
        key: `window:${RISHAB_WINDOW_ID}`,
        kind: "window",
        date: "2026-10-01",
        dateShort: "Thu, Oct 1",
        timeLabel: RISHAB_TIME,
        dateTime: "2026-10-01",
        capacity: null,
      },
    ]);
    expect(availabilityHeadline(rishab)).toEqual({
      kind: "window",
      label: "Availability window",
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      time: RISHAB_TIME,
      more: 0,
    });
  });

  it("shows a date-only window (fixture mentor) as available with the exact time to be confirmed, and no slots", () => {
    expect(availabilityView(tbaMentor)).toEqual({
      status: "available",
      windows: [
        {
          id: TBA_WINDOW_ID,
          kind: "window-approx",
          date: "2026-10-01",
          dateShort: "Thu, Oct 1",
          dateLong: "Thursday, October 1",
          timeLabel: "Exact time to be confirmed",
          label: "Exact time to be confirmed",
          note: TBA_WINDOW_NOTE,
          slots: [],
        },
      ],
      slotCount: 0,
    });
    expect(availabilityItems(availabilityView(tbaMentor))).toEqual([
      {
        key: `window:${TBA_WINDOW_ID}`,
        kind: "window-approx",
        date: "2026-10-01",
        dateShort: "Thu, Oct 1",
        timeLabel: "Exact time to be confirmed",
        dateTime: "2026-10-01",
        capacity: null,
      },
    ]);
    expect(availabilityHeadline(tbaMentor)).toEqual({
      kind: "window-approx",
      label: "Exact times TBA",
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      time: "Exact time to be confirmed",
      more: 0,
    });
  });

  it("represents a window with slots by its slots, like the application", () => {
    const items = availabilityItems(availabilityView(avery));
    expect(items.map((i) => [i.key, i.kind, i.timeLabel, i.capacity])).toEqual([
      ["slot:demo-avery-slot-1400", "confirmed", "2:00–2:25 PM CT", 1],
      ["slot:demo-avery-slot-1430", "confirmed", "2:30–2:55 PM CT", 2],
    ]);
    expect(items[0].dateTime).toBe("2026-10-01T14:00");
    expect(availabilityItems(availabilityView(patrick))).toEqual([
      expect.objectContaining({ key: "window:patrick-haddox-2026-10-01-am", kind: "window", capacity: null }),
    ]);
  });

  it("nests slots under their window with capacity and place", () => {
    const view = availabilityView(avery);
    expect(view.slotCount).toBe(2);
    expect(view.windows[0].slots[1]).toMatchObject({
      capacityLabel: "Up to 2 students or teams",
      where: "In person · Demo Hall, Room 202",
    });
    expect(availabilityView(jordan).windows[0].slots[0]).toMatchObject({
      kind: "proposed",
      capacityLabel: "1 student or team",
      where: "Virtual",
    });
  });

  it("summarizes the firmest published state", () => {
    expect(strongestAvailabilityKind(availabilityView(avery))).toBe("confirmed");
    expect(strongestAvailabilityKind(availabilityView(jordan))).toBe("proposed");
    expect(strongestAvailabilityKind(availabilityView(patrick))).toBe("window");
    expect(strongestAvailabilityKind(availabilityView(arnav))).toBe("window");
    expect(strongestAvailabilityKind(availabilityView(roughMentor))).toBe("window-approx");
    expect(strongestAvailabilityKind(availabilityView(rishab))).toBe("window");
    expect(strongestAvailabilityKind(availabilityView(tbaMentor))).toBe("window-approx");
    expect(strongestAvailabilityKind(availabilityView(ron))).toBe("window");
    expect(strongestAvailabilityKind(availabilityView(vik))).toBe("in-progress");
    expect(strongestAvailabilityKind(availabilityView(elliott))).toBe("in-progress");
  });

  it("builds plain one-liners and card headlines", () => {
    expect(availabilityOneLiner(availabilityView(patrick))).toBe("Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(availabilityOneLiner(availabilityView(ron))).toBe(RON_LINE);
    expect(availabilityOneLiner(availabilityView(vik))).toBe("Scheduling in progress");
    expect(availabilityOneLiner(availabilityView(rishab))).toBe(RISHAB_LINE);
    expect(availabilityOneLiner(availabilityView(tbaMentor))).toBe(TBA_LINE);
    expect(availabilityHeadline(patrick)).toEqual({
      kind: "window",
      label: "Availability window",
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      time: "10:00–11:30 AM CT",
      more: 0,
    });
    expect(availabilityHeadline(arnav)).toEqual({
      kind: "window",
      label: "Availability window",
      date: "Fri, Oct 2",
      dateTime: "2026-10-02",
      time: "10:00–11:30 AM CT",
      more: 0,
    });
    expect(availabilityOneLiner(availabilityView(arnav))).toBe("Fri, Oct 2 · 10:00–11:30 AM CT");
    expect(availabilityHeadline(roughMentor)).toMatchObject({ kind: "window-approx", label: "Exact times TBA" });
    expect(availabilityHeadline(ron)).toEqual({
      kind: "window",
      label: "Availability window",
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      time: RON_TIME,
      more: 0,
    });
    expect(availabilityHeadline(elliott)).toMatchObject({
      kind: "in-progress",
      label: "Scheduling in progress",
      time: "Times to be announced",
    });
  });
});

describe("availabilityLines for Rishab's exact window", () => {
  it("reads Rishab's window like Patrick's: 'Thu, Oct 1 · 12:00–5:00 PM CT'", () => {
    const line = {
      pending: false,
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      detail: RISHAB_TIME,
      text: RISHAB_LINE,
    };
    expect(availabilityLines(rishab)).toEqual([line]);
    expect(availabilityLine(rishab)).toEqual({ ...line, more: 0 });
    // Same shape as Patrick's exact window, just a different time.
    expect(availabilityLines(patrick)).toEqual([{ ...line, detail: "10:00–11:30 AM CT", text: "Thu, Oct 1 · 10:00–11:30 AM CT" }]);
    // No date-only or retired wording, and his only office-hours day is Thursday.
    const all = JSON.stringify([availabilityLines(rishab), availabilityLine(rishab)]);
    expect(all).not.toMatch(/Exact time to be confirmed|Time to be announced|Time TBA|to be confirmed/i);
    expect(all).not.toMatch(/Oct 2|Fri/);
  });
});

describe("availabilityLines for date-only (tba) windows", () => {
  it("reads a date-only window (fixture mentor) as 'Thu, Oct 1 · Exact time to be confirmed'", () => {
    const line = {
      pending: false,
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      detail: "Exact time to be confirmed",
      text: TBA_LINE,
    };
    expect(availabilityLines(tbaMentor)).toEqual([line]);
    expect(availabilityLine(tbaMentor)).toEqual({ ...line, more: 0 });
    // The retired wording is gone, and the fixture's only office-hours day is Thursday.
    const all = JSON.stringify([availabilityLines(tbaMentor), availabilityLine(tbaMentor)]);
    expect(all).not.toMatch(/Time to be announced|Time TBA/);
    expect(all).not.toMatch(/Oct 2|Fri/);
    // The line doesn't depend on the content label: an unlabeled date-only window reads the same.
    const unlabeled = { availability: [{ id: "t-unlabeled", date: "2026-10-01", time: { kind: "tba" as const } }], slots: [] };
    expect(availabilityLines(unlabeled)).toEqual([line]);
  });

  it("says 'Exact time to be confirmed' for every date-only window and sorts it after timed windows that day", () => {
    const mentor: Pick<Mentor, "availability" | "slots"> = {
      availability: [
        { id: "t-oct1-tba", date: "2026-10-01", time: { kind: "tba" } },
        { id: "t-oct1-am", date: "2026-10-01", time: { kind: "exact", start: "09:00", end: "10:00" } },
        { id: "t-sep30-tba", date: "2026-09-30", time: { kind: "tba" } },
      ],
      slots: [],
    };
    expect(availabilityLines(mentor)).toEqual([
      {
        pending: false,
        date: "Wed, Sep 30",
        dateTime: "2026-09-30",
        detail: "Exact time to be confirmed",
        text: "Wed, Sep 30 · Exact time to be confirmed",
      },
      {
        pending: false,
        date: "Thu, Oct 1",
        dateTime: "2026-10-01",
        detail: "9:00–10:00 AM CT",
        text: "Thu, Oct 1 · 9:00–10:00 AM CT",
      },
      {
        pending: false,
        date: "Thu, Oct 1",
        dateTime: "2026-10-01",
        detail: "Exact time to be confirmed",
        text: "Thu, Oct 1 · Exact time to be confirmed",
      },
    ]);
    expect(availabilityLine(mentor)).toMatchObject({
      detail: "Exact time to be confirmed",
      text: "Wed, Sep 30 · Exact time to be confirmed · +2 more",
      more: 2,
    });
  });

  it("represents a date-only window that has slots by its slots' times", () => {
    const mentor: Pick<Mentor, "availability" | "slots"> = {
      availability: [{ id: "t-tba", date: "2026-10-01", time: { kind: "tba" } }],
      slots: [
        { id: "t-slot-1400", windowId: "t-tba", date: "2026-10-01", start: "14:00", end: "14:25", capacity: 1, status: "proposed" },
      ],
    };
    expect(availabilityLines(mentor)).toEqual([
      {
        pending: false,
        date: "Thu, Oct 1",
        dateTime: "2026-10-01T14:00",
        detail: "2:00–2:25 PM CT",
        text: "Thu, Oct 1 · 2:00–2:25 PM CT",
      },
    ]);
  });
});

describe("calls to action", () => {
  it("preselects the only window or slot", () => {
    expect(preselectedOption(patrick)).toMatchObject({ kind: "window", id: "patrick-haddox-2026-10-01-am" });
    expect(preselectedOption(rishab)).toEqual({
      kind: "window",
      id: RISHAB_WINDOW_ID,
      label: RISHAB_LINE,
    });
    expect(preselectedOption(tbaMentor)).toEqual({
      kind: "window",
      id: TBA_WINDOW_ID,
      label: TBA_LINE,
    });
    expect(preselectedOption(jordan)).toMatchObject({ kind: "slot", id: "demo-jordan-slot-1500" });
    expect(preselectedOption(avery)).toBeNull(); // two slots: let the student choose
    expect(preselectedOption(ron)).toEqual({ kind: "window", id: RON_WINDOW_ID, label: RON_LINE });
    expect(preselectedOption(vik)).toBeNull();
    expect(preselectedOption(elliott)).toBeNull();
  });

  it("links to the application section of /office-hours with the mentor preselected", () => {
    expect(mentorCta(patrick)).toEqual({
      kind: "apply",
      label: "Apply to meet Patrick",
      href: "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
      preselects: "Thu, Oct 1 · 10:00–11:30 AM CT",
    });
    expect(mentorCta(arnav)).toMatchObject({
      label: "Apply to meet Arnav",
      href: "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
      preselects: "Fri, Oct 2 · 10:00–11:30 AM CT",
    });
    expect(mentorCta(roughMentor)).toMatchObject({
      label: "Apply to meet Riley",
      href: `/office-hours?mentor=fixture-rough-mentor&window=${ROUGH_WINDOW_ID}#apply`,
      preselects: "Fri, Oct 2 · Morning, before noon CT",
    });
    expect(mentorCta(avery)).toMatchObject({
      label: "Apply to meet Avery",
      href: "/office-hours?mentor=demo-avery-sample#apply",
      preselects: null,
    });
    expect(mentorCta(jordan).href).toBe("/office-hours?mentor=demo-jordan-placeholder&slot=demo-jordan-slot-1500#apply");
  });

  it("gives Rishab 'Apply to meet Rishab' with his Thursday noon–5 PM window preselected", () => {
    expect(mentorCta(rishab)).toEqual({
      kind: "apply",
      label: "Apply to meet Rishab",
      href: RISHAB_APPLY_HREF,
      preselects: RISHAB_LINE,
    });
    expect(mentorAction(rishab, { applicationsOpen: true })).toEqual({ open: true, href: RISHAB_APPLY_HREF });
    expect(applyToMeetLabel(rishab)).toBe("Apply to meet Rishab");
    // In the application his only option is an exact window, like Patrick's: its time is known, so
    // ticking it is enough and students don't also have to describe when they're free.
    const [catalogRishab] = buildApplicationCatalog([rishab]).mentors;
    expect(catalogRishab).toMatchObject({ id: "rishab-veldur", scheduling: "available" });
    expect(catalogRishab.options).toEqual([
      {
        key: `window:${RISHAB_WINDOW_ID}`,
        kind: "window",
        id: RISHAB_WINDOW_ID,
        mentorId: "rishab-veldur",
        certainty: "window",
        date: "2026-10-01",
        label: RISHAB_LINE,
        detail: "Availability window. Exact appointment times aren’t set yet.",
        timeKnown: true,
      },
    ]);
    expect(mentorNeedsBroadAvailability(catalogRishab)).toBe(false);
    // Only the mentors with no windows yet still need a student's broad availability.
    expect(buildApplicationCatalog(productionMentors).mentors.filter(mentorNeedsBroadAvailability).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "elliott-notrica",
    ]);
  });

  it("gives Ron 'Apply to meet Ron' with his Thursday 2:30–4:30 PM window preselected", () => {
    const href = `/office-hours?mentor=ron-lewis&window=${RON_WINDOW_ID}#apply`;
    expect(mentorCta(ron)).toEqual({ kind: "apply", label: "Apply to meet Ron", href, preselects: RON_LINE });
    expect(mentorAction(ron, { applicationsOpen: true })).toEqual({ open: true, href });
    // His window has exact times, so ticking it is enough (no broad-availability note needed).
    const [catalogRon] = buildApplicationCatalog([ron]).mentors;
    expect(catalogRon).toMatchObject({ id: "ron-lewis", scheduling: "available" });
    expect(catalogRon.options.map((o) => [o.key, o.label, o.timeKnown])).toEqual([[`window:${RON_WINDOW_ID}`, RON_LINE, true]]);
    expect(mentorNeedsBroadAvailability(catalogRon)).toBe(false);
  });

  it("keeps the date-only path for a mentor whose time isn't set (fixture mentor)", () => {
    expect(mentorCta(tbaMentor)).toEqual({
      kind: "apply",
      label: "Apply to meet Sam",
      href: TBA_APPLY_HREF,
      preselects: TBA_LINE,
    });
    expect(mentorAction(tbaMentor, { applicationsOpen: true })).toEqual({ open: true, href: TBA_APPLY_HREF });
    // In the application the only option is date-only, so students still say when they're free.
    const [catalogTba] = buildApplicationCatalog([tbaMentor]).mentors;
    expect(catalogTba).toMatchObject({ id: "fixture-tba-mentor", scheduling: "available" });
    expect(catalogTba.options.map((o) => [o.key, o.label, o.timeKnown])).toEqual([
      [`window:${TBA_WINDOW_ID}`, TBA_LINE, false],
    ]);
    expect(mentorNeedsBroadAvailability(catalogTba)).toBe(true);
    // One exact window among date-only ones is enough to drop the requirement.
    const mixed: Mentor = {
      ...tbaMentor,
      availability: [
        ...tbaMentor.availability,
        { id: "fixture-tba-2026-10-02-pm", date: "2026-10-02", time: { kind: "exact", start: "13:00", end: "14:00" } },
      ],
    };
    const [catalogMixed] = buildApplicationCatalog([mixed]).mentors;
    expect(catalogMixed.options.map((o) => [o.key, o.timeKnown])).toEqual([
      [`window:${TBA_WINDOW_ID}`, false],
      ["window:fixture-tba-2026-10-02-pm", true],
    ]);
    expect(mentorNeedsBroadAvailability(catalogMixed)).toBe(false);
  });

  it("uses 'Express interest' without a time while scheduling is in progress", () => {
    expect(mentorCta(vik)).toEqual({
      kind: "interest",
      label: "Express interest",
      href: "/office-hours?mentor=vikram-lakhwara#apply",
      preselects: null,
    });
    expect(mentorCta(elliott)).toEqual({
      kind: "interest",
      label: "Express interest",
      href: "/office-hours?mentor=elliott-notrica#apply",
      preselects: null,
    });
  });

  it("closes when applications are closed or the mentor isn't accepting", () => {
    expect(mentorCta(patrick, { applicationsOpen: false })).toMatchObject({
      kind: "closed",
      label: "Applications closed",
      href: null,
      reason: "We aren’t taking office-hours applications right now.",
    });
    expect(mentorCta({ ...ron, acceptingApplications: false })).toMatchObject({
      kind: "closed",
      label: "Not accepting applications",
      href: null,
      reason: "Ron isn’t taking office-hours applications right now.",
    });
    expect(mentorCta(rishab, { applicationsOpen: false })).toMatchObject({ kind: "closed", href: null });
  });
});

describe("session details", () => {
  const minutes = site.officeHours.sessionMinutes;

  it("gives every mentor the policy session length (site.officeHours), not a length of their own", () => {
    for (const m of productionMentors) expect(m.session.durationMinutes, m.id).toBe(minutes);
    // No public note still says the length is being worked out.
    for (const m of getMentors()) {
      const notes = [m.session.note, ...m.availability.map((w) => w.note)].filter(Boolean).join(" ");
      expect(notes, m.id).not.toMatch(/\blength\b/i);
    }
  });

  it("says plainly what isn't known yet", () => {
    expect(sessionSummary(patrick.session)).toBe(`${minutes} min · Format to be confirmed`);
    expect(sessionSummary(rishab.session)).toBe(`${minutes} min · Format to be confirmed`);
    expect(sessionSummary(tbaMentor.session)).toBe("Format and length to be confirmed");
    expect(sessionSummary(jordan.session)).toBe("Virtual · Length to be confirmed");
    expect(sessionSummary(avery.session)).toBe("In person · 25 min");
    expect(sessionSummary({ ...patrick.session, durationMinutes: 20 })).toBe("20 min · Format to be confirmed");
  });

  it("fills every unknown row with 'To be confirmed'", () => {
    expect(sessionDetails(patrick.session)).toEqual([
      { label: "Format", value: "To be confirmed", known: false },
      { label: "Length", value: `${minutes} minutes`, known: true },
      { label: "Location", value: "To be confirmed", known: false },
      { label: "Sessions", value: "One or two sessions", known: true },
    ]);
    // Ron's place is confirmed: the Location row gives the building and its street address.
    expect(sessionDetails(ron.session)).toEqual([
      { label: "Format", value: "In person", known: true },
      { label: "Length", value: `${minutes} minutes`, known: true },
      { label: "Location", value: "Business Instructional Facility (BIF), 515 E. Gregory Drive, Champaign, IL 61820", known: true },
      { label: "Sessions", value: "To be confirmed", known: false },
    ]);
    expect(sessionDetails(tbaMentor.session)).toEqual([
      { label: "Format", value: "To be confirmed", known: false },
      { label: "Length", value: "To be confirmed", known: false },
      { label: "Location", value: "To be confirmed", known: false },
      { label: "Sessions", value: "To be confirmed", known: false },
    ]);
    expect(sessionDetails(avery.session).map((r) => r.value)).toEqual([
      "In person",
      "25 minutes",
      "Demo Hall, Room 202",
      "Two sessions",
    ]);
  });
});

describe("identity copy and links", () => {
  it("builds the factual one-liner from verified fields only", () => {
    expect(factualOneLiner(patrick)).toBe("Patrick Haddox · CEO & Co-Founder, Samara Aerospace");
    expect(factualOneLiner(arnav)).toBe("Arnav Mishra · Co-Founder & CTO, Doss");
    expect(factualOneLiner(vik)).toBe("Vikram “Vik” Lakhwara · Founder & Managing Member, Stakehouse");
    expect(factualOneLiner(elliott)).toBe("Elliott Notrica · Founder & CEO, Symbio Bioculinary");
    expect(factualOneLiner(rishab)).toBe("Rishab Veldur · Co-Founder & CEO, Auvi Labs");
    // Unverified fields are simply left out.
    expect(factualOneLiner({ name: "Sam Doe", role: null, company: "Acme" })).toBe("Sam Doe · Acme");
    expect(factualOneLiner({ name: "Sam Doe", role: null, company: null })).toBe("Sam Doe");
  });

  it("builds stable ids, captions and profile links", () => {
    expect(MENTOR_IDS.map((_, i) => mentorIndexCaption(i, MENTOR_IDS.length))).toEqual([
      "01 / 06",
      "02 / 06",
      "03 / 06",
      "04 / 06",
      "05 / 06",
      "06 / 06",
    ]);
    expect(mentorProfileHref("ron-lewis")).toBe("/office-hours/ron-lewis");
    expect(mentorProfileHref("elliott-notrica")).toBe("/office-hours/elliott-notrica");
    expect(mentorProfileHref("rishab-veldur")).toBe("/office-hours/rishab-veldur");
    expect(mentorSectionId("ron-lewis")).toBe("mentor-ron-lewis");
    expect(mentorSectionId("elliott-notrica")).toBe("mentor-elliott-notrica");
    expect(mentorSectionId("rishab-veldur")).toBe("mentor-rishab-veldur");
  });

  it("excerpts at a word boundary", () => {
    expect(excerpt("Short bio.", 50)).toBe("Short bio.");
    const out = excerpt("Ron is a repeat entrepreneur and co-founder of Auctus Advisory, where he advises", 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).toBe("Ron is a repeat entrepreneur and…");
  });

  it("describes profiles in metadata from verified facts", () => {
    expect(mentorMetaDescription(patrick)).toBe(
      "Founders Office Hours with Patrick Haddox (CEO & Co-Founder, Samara Aerospace) during Founders Week at UIUC. Availability: Thu, Oct 1 · 10:00–11:30 AM CT. Apply to request a time.",
    );
    expect(mentorMetaDescription(ron)).toBe(
      `Founders Office Hours with Ron Lewis (Co-Founder, Auctus Advisory) during Founders Week at UIUC. Availability: ${RON_LINE}. Apply to request a time.`,
    );
    expect(mentorMetaDescription(vik)).toContain("Scheduling is in progress");
    for (const m of productionMentors) expect(mentorMetaDescription(m), m.id).not.toContain("—");
    expect(mentorMetaDescription(vik)).toContain("Vikram “Vik” Lakhwara (Founder & Managing Member, Stakehouse)");
    expect(mentorMetaDescription(elliott)).toBe(
      "Founders Office Hours with Elliott Notrica (Founder & CEO, Symbio Bioculinary) during Founders Week at UIUC. Scheduling is in progress, but you can apply now. Founders will follow up once availability is finalized.",
    );
    expect(mentorMetaDescription(rishab)).toBe(
      "Founders Office Hours with Rishab Veldur (Co-Founder & CEO, Auvi Labs) during Founders Week at UIUC. Availability: Thu, Oct 1 · 12:00–5:00 PM CT. Apply to request a time.",
    );
    // A date-only window still says the exact time is to be confirmed.
    expect(mentorMetaDescription(tbaMentor)).toBe(
      "Founders Office Hours with Sam Fixture (Founder, Fixture Co) during Founders Week at UIUC. Availability: Thu, Oct 1 · Exact time to be confirmed. Apply to request a time.",
    );
  });
});

describe("Office Hours cards and profiles", () => {
  it("shows 'Can help with' as labels only — approved, never the basis, never a draft", () => {
    expect(helpLabels(patrick, 3)).toEqual([
      "Turning university research into a startup",
      "Raising a seed round for deep-tech hardware",
      "Spacecraft engineering and testing",
    ]);
    expect(helpLabels(arnav)).toHaveLength(5);
    expect(helpLabels(rishab)).toEqual([]);
    const bases = productionMentors.flatMap((m) => m.expertise?.value.map((e) => e.basis) ?? []);
    for (const m of productionMentors) {
      for (const label of helpLabels(m)) expect(bases).not.toContain(label);
    }
    expect(helpLabels({ expertise: null })).toEqual([]);
    expect(helpLabels({ expertise: { status: "draft", value: [{ label: "x", basis: "y" }] } })).toEqual([]);
  });

  it("takes the first sentence of an approved bio ('St. Louis' is not a break)", () => {
    expect(bioFirstSentence(vik)).toBe(
      "Vik Lakhwara is the founder and managing member of Stakehouse, a St. Louis venture fund that backs early-stage founders with ties to universities in Missouri and its neighboring states, including Illinois.",
    );
    expect(bioFirstSentence(ron)).toBe(
      "Ron is a repeat entrepreneur and co-founder of Auctus Advisory, where he advises on revenue optimization, financial forecasting, and stakeholder communication.",
    );
    expect(bioFirstSentence(rishab)).toBe(RISHAB_BIO_FIRST);
    expect(bioFirstSentence({ bio: null })).toBeNull();
    expect(bioFirstSentence({ bio: { status: "draft", value: "Draft bio. More." } })).toBeNull();
  });

  it("writes one availability line per mentor, never implying a booking", () => {
    expect(availabilityLine(patrick)).toEqual({
      pending: false,
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      detail: "10:00–11:30 AM CT",
      text: "Thu, Oct 1 · 10:00–11:30 AM CT",
      more: 0,
    });
    expect(availabilityLine(arnav)).toEqual({
      pending: false,
      date: "Fri, Oct 2",
      dateTime: "2026-10-02",
      detail: "10:00–11:30 AM CT",
      text: "Fri, Oct 2 · 10:00–11:30 AM CT",
      more: 0,
    });
    expect(availabilityLine(roughMentor)).toMatchObject({
      date: "Fri, Oct 2",
      detail: "Morning, exact window pending",
      text: "Fri, Oct 2 · Morning, exact window pending",
    });
    expect(availabilityLine(rishab)).toEqual({
      pending: false,
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      detail: RISHAB_TIME,
      text: RISHAB_LINE,
      more: 0,
    });
    expect(availabilityLine(tbaMentor)).toMatchObject({
      date: "Thu, Oct 1",
      detail: "Exact time to be confirmed",
      text: TBA_LINE,
    });
    expect(availabilityLine(ron)).toEqual({
      pending: false,
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      detail: RON_TIME,
      text: RON_LINE,
      more: 0,
    });
    for (const m of [vik, elliott]) {
      expect(availabilityLine(m)).toEqual({
        pending: true,
        date: null,
        dateTime: null,
        detail: "Scheduling in progress",
        text: "Scheduling in progress",
        more: 0,
      });
      expect(availabilityLines(m)).toEqual([]);
    }
    // Several published times: the first, then how many more; the profile lists them all.
    expect(availabilityLine(avery).text).toBe("Thu, Oct 1 · 2:00–2:25 PM CT · +1 more");
    expect(availabilityLines(avery).map((l) => l.text)).toEqual([
      "Thu, Oct 1 · 2:00–2:25 PM CT",
      "Thu, Oct 1 · 2:30–2:55 PM CT",
    ]);
    expect(availabilityLines(avery)[0].dateTime).toBe("2026-10-01T14:00");
  });

  it("uses the window's public note, or the follow-up promise while scheduling", () => {
    expect(availabilityNote(patrick)).toBe(patrick.availability[0].note);
    expect(availabilityNote(arnav)).toBe(arnav.availability[0].note);
    expect(availabilityNote(rishab)).toBe(RISHAB_WINDOW_NOTE);
    expect(availabilityNote(tbaMentor)).toBe(TBA_WINDOW_NOTE);
    expect(availabilityNote(roughMentor)).toBe(ROUGH_WINDOW_NOTE);
    expect(availabilityNote(ron)).toBe(ron.availability[0].note);
    expect(availabilityNote(ron)).toBe("Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.");
    for (const m of [vik, elliott]) expect(availabilityNote(m)).toBe("Founders will follow up once availability is finalized.");
    // Organizer notes never feed it.
    for (const m of productionMentors) expect(availabilityNote(m)).not.toBe(m.organizerNotes);
  });

  it("states the session rule under a profile's times for exact windows or while scheduling, never a count", () => {
    const rule = site.officeHours;
    const text = `Each session is ${rule.sessionMinutes} minutes, with a ${rule.breakMinutes}-minute break between sessions.`;
    // Exact windows (Patrick, Arnav, Ron, Rishab) and mentors still scheduling (Vik, Elliott).
    for (const m of [patrick, arnav, rishab, vik, elliott, ron]) expect(sessionRuleLine(m, rule), m.id).toBe(text);
    // Specific slots follow the same grid.
    expect(sessionRuleLine(avery, rule)).toBe(text);
    // Rough windows (a part-of-day or date-only window) have no sessions yet: no line.
    expect(sessionRuleLine(roughMentor, rule)).toBeNull();
    expect(sessionRuleLine(tbaMentor, rule)).toBeNull();
    // Built from the rule it's given, and never a number of sessions (Patrick's window fits three,
    // but he agreed to one or two).
    expect(sessionRuleLine(patrick, { sessionMinutes: 20, breakMinutes: 10 })).toBe(
      "Each session is 20 minutes, with a 10-minute break between sessions.",
    );
    expect(sessionRuleLine(patrick, { sessionMinutes: 30, breakMinutes: 0 })).toBe("Each session is 30 minutes.");
    for (const m of productionMentors) {
      expect(sessionRuleLine(m, rule) ?? "", m.id).not.toMatch(/\b(one|two|three|\d+) sessions\b/i);
    }
  });

  it("links every mentor action to #apply with the mentor (and a single window) preselected", () => {
    expect(mentorAction(patrick, { applicationsOpen: true })).toEqual({
      open: true,
      href: "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
    });
    expect(mentorAction(arnav, { applicationsOpen: true })).toEqual({
      open: true,
      href: "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
    });
    expect(mentorAction(elliott, { applicationsOpen: true })).toEqual({
      open: true,
      href: "/office-hours?mentor=elliott-notrica#apply",
    });
    expect(mentorAction(rishab, { applicationsOpen: true })).toEqual({ open: true, href: RISHAB_APPLY_HREF });
    expect(mentorAction(ron, { applicationsOpen: false })).toMatchObject({ open: false, label: "Applications closed" });
    expect(SELECT_MENTOR_LABEL).toBe("Select mentor");
    expect(applyToMeetLabel(vik)).toBe("Apply to meet Vik");
  });

  it("builds a card with only what the card shows", () => {
    expect(mentorCardView(elliott, { applicationsOpen: true })).toEqual({
      id: "elliott-notrica",
      anchor: "mentor-elliott-notrica",
      name: "Elliott Notrica",
      role: "Founder & CEO",
      company: "Symbio Bioculinary",
      headshot: elliott.headshot,
      help: [
        "Starting a company as an undergrad",
        "Biotech and food-tech startups",
        "Licensing a technology instead of making the product",
      ],
      intro: null,
      availability: expect.objectContaining({ pending: true, text: "Scheduling in progress" }),
      action: { open: true, href: "/office-hours?mentor=elliott-notrica#apply" },
      profileHref: "/office-hours/elliott-notrica",
      demo: false,
    });
    // No approved labels → the first sentence of the bio instead.
    expect(mentorCardView({ ...ron, expertise: null }, { applicationsOpen: true })).toMatchObject({
      help: [],
      intro: bioFirstSentence(ron),
    });
    // The card view carries no full bio, basis, notes, sources or profile-only fields.
    const json = JSON.stringify(getMentors().map((m) => mentorCardView(m, { applicationsOpen: true })));
    for (const m of productionMentors) {
      expect(json).not.toContain(m.bio!.value);
      for (const e of m.expertise?.value ?? []) expect(json).not.toContain(`"${e.basis}"`);
      expect(json).not.toContain(m.organizerNotes!);
    }
    expect(json).not.toMatch(/sources|organizerNotes|basis|backgroundTags|goodFitFor/);
    expect(json).not.toContain(RISHAB_GOOD_FIT);
    expect(json).not.toContain("Medtech");
  });

  it("builds Rishab's card: his bio's first sentence as the intro, his Thursday line and his window preselected", () => {
    expect(mentorCardView(rishab, { applicationsOpen: true })).toEqual({
      id: "rishab-veldur",
      anchor: "mentor-rishab-veldur",
      name: "Rishab Veldur",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      headshot: rishab.headshot,
      help: [],
      intro: RISHAB_BIO_FIRST,
      availability: {
        pending: false,
        date: "Thu, Oct 1",
        dateTime: "2026-10-01",
        detail: RISHAB_TIME,
        text: RISHAB_LINE,
        more: 0,
      },
      action: { open: true, href: RISHAB_APPLY_HREF },
      profileHref: "/office-hours/rishab-veldur",
      demo: false,
    });
  });

  it("builds a date-only mentor's card (fixture): the exact time to be confirmed, the window preselected", () => {
    expect(mentorCardView(tbaMentor, { applicationsOpen: true })).toEqual({
      id: "fixture-tba-mentor",
      anchor: "mentor-fixture-tba-mentor",
      name: "Sam Fixture",
      role: "Founder",
      company: "Fixture Co",
      headshot: null,
      help: [],
      intro: "Sam is a fictional founder used only in tests.",
      availability: {
        pending: false,
        date: "Thu, Oct 1",
        dateTime: "2026-10-01",
        detail: "Exact time to be confirmed",
        text: TBA_LINE,
        more: 0,
      },
      action: { open: true, href: TBA_APPLY_HREF },
      profileHref: "/office-hours/fixture-tba-mentor",
      demo: false,
    });
  });

  it("keeps Rishab's public copy free of medical-device claims and one-on-one promises", () => {
    const publicRishab = byId(getMentors(), "rishab-veldur");
    const copy = [
      publicRishab.bio!.value,
      ...publicRishab.goodFitFor!.value,
      ...(publicRishab.backgroundTags ?? []),
      ...publicRishab.availability.flatMap((w) => [w.label ?? "", w.note ?? ""]),
      publicRishab.session.note ?? "",
      mentorMetaDescription(publicRishab),
      JSON.stringify(mentorCardView(publicRishab, { applicationsOpen: true })),
      JSON.stringify(availabilityLines(publicRishab)),
      JSON.stringify(mentorAppearanceViews(getScheduleEntries(), "rishab-veldur")),
    ].join("\n");
    for (const claim of FORBIDDEN_CLAIMS) expect(copy, String(claim)).not.toMatch(claim);
    expect(copy).not.toMatch(/student teams|phone/i);
  });
});
