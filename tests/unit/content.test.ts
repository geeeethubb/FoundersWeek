import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMentors } from "@/content";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor } from "@/content/types";
import { ContentValidationError, validateContent } from "@/content/validate";
import { LATEST_MIGRATION } from "@/lib/db/client";
import { mentorCtaLabel, schedulingStatus } from "@/lib/mentors";
import { applyHref, buildScheduleEntries, featuredEntries, mentorAppearances } from "@/lib/schedule/entries";

const HAPPY_HOUR = "happy-hour-at-legends-with-arnav-mishra";
const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
const DAN = "dan-caruso-fireside-chat";
const TECHRISE = "techrise-pitch-competition";
const COHORT_PANEL = "TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?";
const SHOWCASE = "founders-showcase-day-sessions";
const HEALTH_PANEL = "Health Innovation: From Therapeutics to Devices";
const RISHAB = "rishab-veldur";
const RISHAB_WINDOW = "rishab-veldur-2026-10-01";
const RISHAB_OH = "office-hours-rishab-veldur-2026-10-01";
const RON_OH = "office-hours-ron-lewis-2026-10-01-pm";
const ELLIOTT_WED_AM_OH = "office-hours-elliott-notrica-2026-09-30-am";
const ELLIOTT_WED_PM_OH = "office-hours-elliott-notrica-2026-09-30-pm";
const ELLIOTT_THU_OH = "office-hours-elliott-notrica-2026-10-01-pm";
/** The organizers' approved bio, verbatim. */
const RISHAB_BIO =
  "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier. With a background in engineering at Illinois, he helped build a company that placed second in the 2024 Cozad New Venture Challenge.";
/** The organizers' suggested fit: one sentence-style item (renders as prose under "Good fit for"). */
const RISHAB_GOOD_FIT =
  "Interested in turning a technical project into a healthcare startup? Rishab’s experience spans engineering, medical-device development, and building a company through Illinois’ entrepreneurship ecosystem.";
/** Claims never made about Auvi's investigational device, and meetings never promised. */
const UNAPPROVED_CLAIMS = /FDA|\bcleared\b|commercially available|clinically (proven|validated)|one-on-one|1:1/i;

/**
 * A synthetic mentor whose only window is date-only (time still to be confirmed). No real mentor
 * has one now that Rishab's Thursday window is set, but the code path stays for future mentors.
 */
const DATE_ONLY_MENTOR: Mentor = {
  id: "fixture-date-only",
  name: "Fixture Mentor",
  firstName: "Fixture",
  role: "Founder",
  company: "Fixture Labs",
  headshot: null,
  bio: null,
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: {
    format: null,
    durationMinutes: null,
    location: null,
    sessionCount: null,
    confirmed: false,
    note: "Fixture has time for office hours on Thursday, October 1. We’re still confirming the exact time, length and location.",
  },
  availability: [
    { id: "fixture-date-only-2026-10-01", date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" },
  ],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [{ label: "Test fixture" }],
};
const FIXTURE_OH = "office-hours-fixture-date-only-2026-10-01";

/** A part-of-day window ("Friday morning, before noon"), like Arnav's before it became exact on Sept 24. */
const PART_OF_DAY_MENTOR: Mentor = {
  ...DATE_ONLY_MENTOR,
  id: "fixture-part-of-day",
  name: "Fixture Morning",
  firstName: "Morning",
  session: { ...DATE_ONLY_MENTOR.session, note: undefined },
  availability: [
    {
      id: "fixture-part-of-day-2026-10-02-am",
      date: "2026-10-02",
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
      label: "Friday morning, before noon · Exact window pending",
    },
  ],
};
const PART_OF_DAY_OH = "office-hours-fixture-part-of-day-2026-10-02-am";

/** The LinkedIn profiles the organizers supplied, in display order. */
const LINKEDIN: Record<string, string> = {
  "patrick-haddox": "https://www.linkedin.com/in/patrick-haddox/",
  "arnav-mishra": "https://www.linkedin.com/in/arnav-mishra/",
  "vikram-lakhwara": "https://www.linkedin.com/in/viklakhwara/",
  "elliott-notrica": "https://www.linkedin.com/in/elliottnotrica/",
  "ron-lewis": "https://www.linkedin.com/in/ronlewis20/",
  "rishab-veldur": "https://www.linkedin.com/in/rishab-veldur",
};

/** Sentences in a bio ("St. Louis" is not a sentence break). */
function sentences(text: string): string[] {
  return text
    .replace(/\bSt\. /g, "St ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

/** Pixel size from a baseline/progressive JPEG's SOF segment. */
function jpegSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  for (let i = 2; i < buf.length; ) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error(`no SOF marker in ${file}`);
}

describe("content", () => {
  it("production content is valid and contains no demo items", () => {
    expect(() => validateContent({ events, mentors, forbidDemo: true })).not.toThrow();
    expect(events.some((e) => e.demo)).toBe(false);
    expect(mentors.some((m) => m.demo)).toBe(false);
  });

  it("demo content is valid and every item is flagged demo", () => {
    expect(() =>
      validateContent({ events: [...events, ...demoEvents], mentors: [...mentors, ...demoMentors], forbidDemo: false }),
    ).not.toThrow();
    expect(demoEvents.every((e) => e.demo)).toBe(true);
    expect(demoMentors.every((m) => m.demo)).toBe(true);
  });

  it("rejects demo items in production data", () => {
    expect(() => validateContent({ events: demoEvents, mentors: [], forbidDemo: true })).toThrow(
      ContentValidationError,
    );
  });

  it("rejects slots outside their window and bad times", () => {
    const bad = structuredClone(demoMentors[0]);
    bad.slots[0].start = "09:00";
    bad.slots[0].end = "09:30";
    expect(() => validateContent({ events: [], mentors: [bad], forbidDemo: false })).toThrow(/outside window/);

    const badEvent = structuredClone(events[0]);
    badEvent.time = { kind: "exact", start: "20:00", end: "18:00" };
    expect(() => validateContent({ events: [badEvent], mentors: [], forbidDemo: true })).toThrow(/End time/);
  });

  it("lists six mentors in display order, Elliott Notrica fourth and Rishab Veldur sixth", () => {
    expect(mentors.map((m) => m.name)).toEqual([
      "Patrick Haddox",
      "Arnav Mishra",
      "Vikram “Vik” Lakhwara",
      "Elliott Notrica",
      "Ron Lewis",
      "Rishab Veldur",
    ]);
    expect(mentors.map((m) => m.id)).toEqual(Object.keys(LINKEDIN));
    expect(mentors.every((m) => m.acceptingApplications)).toBe(true);
    expect(mentors.map((m) => m.firstName)).toEqual(["Patrick", "Arnav", "Vik", "Elliott", "Ron", "Rishab"]);
  });

  it("gives every mentor a headshot file, their LinkedIn first and an approved bio", () => {
    for (const m of mentors) {
      // Headshot: /public/mentors/<id>.jpg, alt text = the mentor's name, declared size = file size.
      expect(m.headshot, m.id).toMatchObject({ src: `/mentors/${m.id}.jpg`, alt: m.name });
      const file = path.join(process.cwd(), "public", m.headshot!.src);
      expect(existsSync(file), file).toBe(true);
      const size = jpegSize(file);
      expect(size, m.id).toEqual({ width: m.headshot!.width, height: m.headshot!.height });

      expect(m.links[0], m.id).toEqual({ label: "LinkedIn", url: LINKEDIN[m.id] });
      expect(m.bio?.status, m.id).toBe("approved");

      // Nothing organizer-only leaks into the public copy.
      const publicCopy = JSON.stringify([
        m.bio,
        m.expertise,
        m.goodFitFor,
        m.backgroundTags,
        m.session.note,
        m.availability,
      ]);
      expect(publicCopy, m.id).not.toMatch(/commitment|Wednesday through Saturday|much more available|extra sessions|anytime after 9 AM|sessions in all/i);
      expect(publicCopy, m.id).not.toMatch(/student teams|phone/i);
    }
  });

  it("gives the five original mentors LinkedIn only, a 3-sentence bio and approved highlights", () => {
    const original = mentors.filter((m) => m.id !== RISHAB);
    expect(original).toHaveLength(5);
    for (const m of original) {
      expect(m.links, m.id).toEqual([{ label: "LinkedIn", url: LINKEDIN[m.id] }]);
      expect(sentences(m.bio!.value), m.id).toHaveLength(3);
      expect(m.backgroundTags, m.id).toBeUndefined();

      // "Can help most with": 3–5 approved phrases, each grounded in a stated basis.
      expect(m.expertise?.status, m.id).toBe("approved");
      expect(m.expertise!.value.length, m.id).toBeGreaterThanOrEqual(3);
      expect(m.expertise!.value.length, m.id).toBeLessThanOrEqual(5);
      for (const item of m.expertise!.value) {
        expect(item.label.trim(), m.id).not.toBe("");
        expect(item.basis.trim(), m.id).not.toBe("");
      }
    }
  });

  it("adds Rishab Veldur of Auvi Labs exactly as the organizers supplied", () => {
    const rishab = mentors.find((m) => m.id === RISHAB)!;
    expect(rishab).toMatchObject({
      name: "Rishab Veldur",
      firstName: "Rishab",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 },
      acceptingApplications: true,
      slots: [],
    });
    expect(rishab.links).toEqual([
      { label: "LinkedIn", url: "https://www.linkedin.com/in/rishab-veldur" },
      { label: "Auvi Labs", url: "https://www.auvilabs.com/" },
    ]);
    // Approved bio, verbatim (two sentences).
    expect(rishab.bio).toMatchObject({ status: "approved", value: RISHAB_BIO });
    expect(sentences(rishab.bio!.value)).toHaveLength(2);
    // Background chips, not a list of topics he agreed to cover.
    expect(rishab.backgroundTags).toEqual(["Medtech", "Hardware and software", "University spinouts"]);
    // No approved topic list ("Can help with" is skipped); one sentence-style "Good fit for" item.
    expect(rishab.expertise).toBeNull();
    expect(rishab.askMeAbout).toBeNull();
    expect(rishab.goodFitFor).toMatchObject({ status: "approved", value: [RISHAB_GOOD_FIT] });
    expect(rishab.goodFitFor!.value[0]).toMatch(/^[A-Z].*\.$/);
    // Sessions follow the site-wide rule (25 minutes today); format, location and how many
    // sessions he holds aren't set, so nothing is invented.
    expect(rishab.session).toMatchObject({
      format: null,
      durationMinutes: site.officeHours.sessionMinutes,
      location: null,
      sessionCount: null,
      confirmed: false,
    });
  });

  it("gives Rishab one office-hours window on Thu Oct 1, anytime noon to 5 PM (never Oct 2)", () => {
    const rishab = mentors.find((m) => m.id === RISHAB)!;
    expect(rishab.availability).toHaveLength(1);
    // Locked by the organizers on Sept 24. The id is unchanged (applications store it), and with
    // an exact time there's no "Exact time to be confirmed" label any more.
    expect(rishab.availability[0]).toEqual({
      id: RISHAB_WINDOW,
      date: "2026-10-01",
      time: { kind: "exact", start: "12:00", end: "17:00" },
      note: "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
    });
    expect(rishab.session.note).toBe(
      "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting the location.",
    );
    // A window, not a confirmed session: the location is still open (session length is the site rule).
    expect(rishab.session.confirmed).toBe(false);
    expect(rishab.organizerNotes).toMatch(/Window locked for Thu Oct 1, anytime 12–5 PM \(organizer update, Sept 24\)/);
    expect(rishab.availability.some((w) => w.date === "2026-10-02")).toBe(false);
    expect(rishab.slots).toEqual([]);
    // A published window: he's "available", so the CTA applies with his window preselected.
    expect(schedulingStatus(rishab)).toBe("available");
    expect(mentorCtaLabel(rishab)).toBe("Apply to meet Rishab");
    expect(applyHref({ mentorId: RISHAB, optionKind: "window", optionId: RISHAB_WINDOW })).toBe(
      "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply",
    );
    // Public availability copy never mentions Oct 2 / Friday, nor the old "time to be confirmed".
    const publicCopy = JSON.stringify([rishab.availability, rishab.session.note]);
    expect(publicCopy).not.toMatch(/October 2|Oct 2\b|Friday/i);
    expect(publicCopy).not.toMatch(/to be confirmed|to be announced/i);
    expect(publicCopy).toContain("Thursday, October 1");
  });

  it("cites a source for every public fact about Rishab", () => {
    const rishab = mentors.find((m) => m.id === RISHAB)!;
    expect(rishab.sources.map((s) => s.label)).toEqual([
      "Founders organizer update: Rishab Veldur profile and his email about availability",
      "Founders Week agenda",
      "Carle Illinois College of Medicine: U of I innovation detects dialysis access failure (Aug 17, 2026)",
      "Auvi Labs: About (founders)",
      "Technology Entrepreneur Center: 2024 Cozad New Venture Challenge winners",
    ]);
    expect(rishab.sources.map((s) => s.url ?? null)).toEqual([
      null,
      null,
      "https://medicine.illinois.edu/news/u-of-i-innovation-detects-dialysis-access-failure",
      "https://www.auvilabs.com/about",
      "https://tec.illinois.edu/news/66233",
    ]);
    expect(rishab.sources.every((s) => Boolean(s.checked))).toBe(true);
    // Each bio claim is grounded: spinout, wearable ultrasound and dialysis (Carle), CEO (Auvi),
    // Cozad second place (TEC). Auvi's own site says the device is investigational.
    const note = (i: number) => rishab.sources[i].note ?? "";
    expect(note(2)).toMatch(/UIUC spinout; wearable ultrasound/);
    expect(note(3)).toMatch(/Rishab Veldur as CEO/);
    expect(note(3)).toMatch(/investigational and not cleared for sale by the FDA/);
    expect(note(4)).toBe("AUVI placed second.");
  });

  describe("Rishab's public profile data", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("keeps his email details organizer-only and makes no unapproved claims", () => {
      vi.stubEnv("SHOW_DEMO_CONTENT", "");
      vi.stubEnv("SHOW_DRAFT_CONTENT", "");
      const raw = mentors.find((m) => m.id === RISHAB)!;
      // His preference to meet student teams is organizer context, not an eligibility rule.
      expect(raw.organizerNotes).toMatch(/student teams \(a preference, not an eligibility rule; individuals can apply\)/);
      expect(raw.organizerNotes).toMatch(/only has time for office hours on Thu Oct 1/);

      const pub = getMentors().find((m) => m.id === RISHAB)!;
      expect(pub.organizerNotes).toBeUndefined();
      expect(pub).toMatchObject({
        bio: { status: "approved", value: RISHAB_BIO },
        goodFitFor: { status: "approved", value: [RISHAB_GOOD_FIT] },
        backgroundTags: ["Medtech", "Hardware and software", "University spinouts"],
        expertise: null,
        askMeAbout: null,
      });
      const publicCopy = JSON.stringify([
        pub.bio!.value,
        pub.goodFitFor!.value,
        pub.backgroundTags,
        pub.session.note,
        pub.availability,
      ]);
      expect(publicCopy).not.toMatch(/team|phone|eligib/i);
      expect(publicCopy).not.toMatch(UNAPPROVED_CLAIMS);
      expect(publicCopy).not.toContain("—");
    });
  });

  it("validates background tags and date-only windows", () => {
    const rishab = mentors.find((m) => m.id === RISHAB)!;
    const check = (m: typeof rishab) => () => validateContent({ events: [], mentors: [m], forbidDemo: true });
    expect(check(rishab)).not.toThrow();
    // A date-only window (time still to be confirmed) is valid for future mentors, alongside real ones.
    expect(check(DATE_ONLY_MENTOR)).not.toThrow();
    expect(() => validateContent({ events, mentors: [...mentors, DATE_ONLY_MENTOR], forbidDemo: true })).not.toThrow();
    // Rishab's window keeps a real range: an end before the start is rejected.
    const backwards = structuredClone(rishab);
    backwards.availability[0].time = { kind: "exact", start: "17:00", end: "12:00" };
    expect(check(backwards)).toThrow(/\(rishab-veldur\)\.availability\.0\.time: End time must be after start time/);

    const noTags = structuredClone(rishab);
    delete noTags.backgroundTags;
    expect(check(noTags)).not.toThrow(); // optional

    const tooMany = structuredClone(rishab);
    tooMany.backgroundTags = ["A", "B", "C", "D", "E", "F", "G"];
    expect(check(tooMany)).toThrow(/\(rishab-veldur\)\.backgroundTags:/);

    const tooLong = structuredClone(rishab);
    tooLong.backgroundTags = ["x".repeat(41)];
    expect(check(tooLong)).toThrow(/\(rishab-veldur\)\.backgroundTags\.0:/);

    const blank = structuredClone(rishab);
    blank.backgroundTags = [""];
    expect(check(blank)).toThrow(/\(rishab-veldur\)\.backgroundTags\.0:/);

    // Window ids are stored with applications: they must be unique across mentors.
    const clash = structuredClone(rishab);
    clash.availability[0].id = "patrick-haddox-2026-10-01-am";
    expect(() => validateContent({ events: [], mentors: [mentors[0], clash], forbidDemo: true })).toThrow(
      /availability\/slot id "patrick-haddox-2026-10-01-am" is not unique/,
    );
  });

  it("keeps the seed facts exactly as supplied", () => {
    const patrick = mentors.find((m) => m.id === "patrick-haddox")!;
    expect(patrick.role).toBe("CEO & Co-Founder");
    expect(patrick.company).toBe("Samara Aerospace");
    expect(patrick.availability).toHaveLength(1);
    expect(patrick.availability[0]).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "10:00", end: "11:30" },
    });
    expect(patrick.slots).toHaveLength(0); // a window, not two confirmed bookings
    expect(patrick.askMeAbout).toBeNull(); // never inferred from title

    const arnav = mentors.find((m) => m.id === "arnav-mishra")!;
    expect(arnav.company).toBe("Doss");
    expect(arnav.role).toBe("Co-Founder & CTO");
    expect(arnav.slots).toHaveLength(0);
    // Exact since the organizer update on Sept 24; the id is unchanged because applications store it.
    expect(arnav.availability).toHaveLength(1);
    expect(arnav.availability[0]).toEqual({
      id: "arnav-mishra-2026-10-02-am",
      date: "2026-10-02",
      time: { kind: "exact", start: "10:00", end: "11:30" },
      note: "Arnav is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
    });
    expect(arnav.session.durationMinutes).toBe(site.officeHours.sessionMinutes);
    expect(arnav.session.note).toBe(
      "Arnav is holding office hours on Friday, October 2, from 10:00 to 11:30 AM. We’re still setting the location.",
    );

    // Ron: Thu Oct 1, 2:30–4:30 PM at BIF (organizer update, Sept 24). Time and place are set, so
    // his session is confirmed; it's still a window students apply to, not a booking.
    const ron = mentors.find((m) => m.id === "ron-lewis")!;
    expect(ron).toMatchObject({ role: "Co-Founder", company: "Auctus Advisory", slots: [] });
    expect(ron.availability).toEqual([
      {
        id: "ron-lewis-2026-10-01-pm",
        date: "2026-10-01",
        time: { kind: "exact", start: "14:30", end: "16:30" },
        note: "Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ]);
    expect(ron.session).toEqual({
      format: "in-person",
      durationMinutes: site.officeHours.sessionMinutes,
      location: "Business Instructional Facility (BIF)",
      address: "515 E. Gregory Drive, Champaign, IL 61820",
      sessionCount: null,
      confirmed: true,
      note: "Ron is holding office hours on Thursday, October 1, from 2:30 to 4:30 PM at the Business Instructional Facility (BIF).",
    });
    // Ron's suggested topics are still a draft pending his confirmation (never public).
    expect(ron.askMeAbout).toMatchObject({ status: "draft" });
    expect(ron.askMeAbout?.value).toEqual([
      "Revenue strategy",
      "Startup financial planning",
      "Communicating business progress to stakeholders",
    ]);
    expect(schedulingStatus(ron)).toBe("available");
    expect(mentorCtaLabel(ron)).toBe("Apply to meet Ron");
    expect(applyHref({ mentorId: "ron-lewis", optionKind: "window", optionId: "ron-lewis-2026-10-01-pm" })).toBe(
      "/office-hours?mentor=ron-lewis&window=ron-lewis-2026-10-01-pm#apply",
    );
    // His openness to Oct 4 is organizer-only: never in any public field.
    expect(ron.organizerNotes).toMatch(/also open to Oct 4/);
    const ronPublicCopy = JSON.stringify([ron.bio, ron.expertise, ron.goodFitFor, ron.session, ron.availability]);
    expect(ronPublicCopy).not.toMatch(/Oct(ober)?\.? 4\b|Sunday/i);

    const vikram = mentors.find((m) => m.id === "vikram-lakhwara")!;
    // Title verified against Stakehouse's own team page.
    expect(vikram).toMatchObject({
      role: "Founder & Managing Member",
      company: "Stakehouse",
      askMeAbout: null,
      firstName: "Vik",
    });
    expect(vikram.sources.map((s) => s.url)).toContain("https://www.stakehouse.fund/team");
    expect(vikram.name).toBe("Vikram “Vik” Lakhwara");
    // Commitments Wed–Sat morning are organizer-only context, not available slots.
    expect(vikram.availability).toEqual([]);
    expect(vikram.slots).toEqual([]);
    expect(vikram.organizerNotes).toMatch(/Wednesday through Saturday/);
    expect(vikram.bio?.value).not.toMatch(/Wednesday|Saturday|commitment/i);
    // Vik is the only mentor still scheduling.
    expect(schedulingStatus(vikram)).toBe("in-progress");
    expect(mentorCtaLabel(vikram)).toBe("Express interest");
    expect(mentorCtaLabel(patrick)).toBe("Apply to meet Patrick");

    // Elliott: three exact windows (Wed Sept 30, 9–noon and 2–5 PM; Thu Oct 1, noon–5 PM). They're
    // windows, not bookings; the location is still being set, so his session isn't confirmed.
    const elliott = mentors.find((m) => m.id === "elliott-notrica")!;
    expect(elliott).toMatchObject({
      name: "Elliott Notrica",
      firstName: "Elliott",
      role: "Founder & CEO",
      company: "Symbio Bioculinary",
      slots: [],
      askMeAbout: null,
      goodFitFor: null,
    });
    const elliottWindowNote =
      "Elliott is free at these times, but they aren’t booked appointments. We’ll schedule sessions inside them.";
    expect(elliott.availability).toEqual([
      {
        id: "elliott-notrica-2026-09-30-am",
        date: "2026-09-30",
        time: { kind: "exact", start: "09:00", end: "12:00" },
        note: elliottWindowNote,
      },
      {
        id: "elliott-notrica-2026-09-30-pm",
        date: "2026-09-30",
        time: { kind: "exact", start: "14:00", end: "17:00" },
        note: elliottWindowNote,
      },
      {
        id: "elliott-notrica-2026-10-01-pm",
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        note: elliottWindowNote,
      },
    ]);
    expect(elliott.session).toMatchObject({ location: null, sessionCount: null, confirmed: false });
    expect(elliott.session.note).toBe(
      "Elliott is holding office hours on Wednesday, September 30 (9 AM to noon and 2 to 5 PM) and Thursday, October 1 (noon to 5 PM). We’re still setting the location.",
    );
    expect(schedulingStatus(elliott)).toBe("available");
    expect(mentorCtaLabel(elliott)).toBe("Apply to meet Elliott");
    expect(mentors.filter((m) => schedulingStatus(m) === "in-progress").map((m) => m.id)).toEqual([
      "vikram-lakhwara",
    ]);

    // The Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled: it must not exist
    // anywhere in the data. (Arnav's Wednesday happy hour at Legends is a separate, real event.)
    expect(events.some((e) => e.id === "founders-week-afterparty")).toBe(false);
    const allData = JSON.stringify([events, mentors]);
    expect(allData).not.toMatch(/HERE Apartments/i);
    expect(allData).not.toMatch(/Founders Week Afterparty/i);
    expect(allData).not.toContain("founders-week-afterparty");
    // No Saturday afterparty: Saturday is the tailgate and the game only.
    expect(events.filter((e) => e.date === "2026-10-03").map((e) => e.id)).toEqual([
      "tailgate-and-enterpriseworks-tour",
      "illinois-football-vs-purdue",
    ]);
    // …and the university's Friday evening showcase and reception stays.
    expect(events.find((e) => e.id === "founders-evening-showcase-and-reception")).toMatchObject({
      date: "2026-10-02",
      time: { kind: "exact", start: "18:00", end: "20:30" },
      involvement: "week",
    });

    const dan = events.find((e) => e.id === DAN)!;
    expect(dan).toMatchObject({
      title: "Fireside Chat with Dan Caruso",
      date: "2026-09-28",
      // 4 p.m. start; no end time was supplied, so none is invented.
      time: { kind: "exact", start: "16:00" },
      status: "confirmed",
      involvement: "supported",
      related: true,
      registration: null,
      location: {
        kind: "in-person",
        venue: "Beckman Institute",
        room: "Auditorium (Room 1025)",
        address: "405 N. Mathews Ave., Urbana, IL 61801",
      },
    });
    expect(dan.time.kind === "exact" && dan.time.end).toBeFalsy();
    expect(dan.featured?.rank).toBe(2);

    const panel = events.find((e) => e.id === "how-to-make-10k-a-month-in-college")!;
    expect(panel).toMatchObject({
      title: "How to Make $10K/Month in College",
      date: "2026-09-29",
      time: { kind: "exact", start: "18:00", end: "20:00" },
      involvement: "cohosted",
      location: {
        kind: "in-person",
        venue: "Materials Science and Engineering Building",
        room: "Room 100",
        address: "1304 W. Green St., Urbana, IL 61801",
      },
    });
    expect(panel.featured?.rank).toBe(3);
    expect(site.applications.deadline).toBeNull();
  });

  it("says an unannounced time once: the Saturday descriptions don't repeat \"Time to be announced\"", () => {
    const saturday = events.filter((e) => e.date === "2026-10-03");
    expect(saturday.map((e) => e.id)).toEqual(["tailgate-and-enterpriseworks-tour", "illinois-football-vs-purdue"]);
    for (const e of saturday) {
      expect(e.time, e.id).toEqual({ kind: "tba" });
      // The event page shows "Time to be announced" under When; this note matches it, so it isn't repeated.
      expect(e.statusNote, e.id).toBe("Time to be announced.");
      expect([e.summary, e.description].join(" "), e.id).not.toMatch(/time|announced|agenda doesn’t list/i);
    }
    expect(saturday[0].description).toBe(
      "A Founders Week tailgate at Atkins Patio & Lawn, with a tour of EnterpriseWorks.",
    );
    expect(saturday[1].description).toBe(
      "Illinois vs. Purdue at Memorial Stadium, listed on the Founders Week agenda.\n\nThis listing doesn’t include admission or tickets.",
    );
  });

  it("keeps em dashes out of every public event string (production and demo)", () => {
    for (const e of [...events, ...demoEvents]) {
      const copy = JSON.stringify([
        e.title,
        e.summary,
        e.description,
        e.statusNote,
        e.organizer,
        e.location,
        e.speakers,
        e.sessions,
        e.links,
        e.registration,
        e.callout,
      ]);
      expect(copy, e.id).not.toContain("—");
    }
  });

  it("lists Arnav's Wednesday happy hour at Legends: confirmed, related, hosted by Arnav, RSVP on Partiful", () => {
    const hh = events.find((e) => e.id === HAPPY_HOUR)!;
    expect(hh).toMatchObject({
      title: HAPPY_HOUR_TITLE,
      date: "2026-09-30",
      time: { kind: "exact", start: "17:00", end: "19:00" },
      status: "confirmed",
      types: ["social", "networking"],
      involvement: "supported", // Arnav's event, supported by Founders
      related: true,
      foundersPick: true,
      location: { kind: "in-person", venue: "Legends", address: "6th & Green" },
      registration: { label: "RSVP on Partiful", url: "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN" },
    });
    expect(hh.featured?.rank).toBe(4); // featured after Dan Caruso and the Sept 29 panel
    expect(hh.speakers).toEqual([
      expect.objectContaining({ name: "Arnav Mishra", verified: true, role: "host", mentorId: "arnav-mishra" }),
    ]);
    expect(hh.sources.map((s) => s.url)).toContain("https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN");
  });

  it("keeps Dan Caruso's fireside chat information-only: blurb, LinkedIn, private-session note, no sign-up", () => {
    const dan = events.find((e) => e.id === DAN)!;
    const [blurb, ...rest] = dan.description.split(/\n\s*\n/);
    expect(sentences(blurb)).toHaveLength(4);
    expect(blurb).toMatch(/^Dan Caruso is one of the most successful entrepreneurs among Illinois alumni\./);
    expect(rest.join(" ")).toContain("supported by Founders");
    expect(dan.links).toEqual([{ label: "Dan Caruso on LinkedIn", url: "https://www.linkedin.com/in/danielpcaruso" }]);
    expect(dan.speakers).toEqual([expect.objectContaining({ name: "Dan Caruso", verified: true })]);
    expect(dan.callout?.title).toBe("Private session with Dan Caruso");
    // Information only: no registration, and nothing in the copy invites an application or booking.
    expect(dan.registration).toBeNull();
    expect(JSON.stringify([dan.summary, dan.description, dan.callout, dan.links])).not.toMatch(
      /apply|application|express interest|waitlist|book(ing)?\b|reserve|sign up|register/i,
    );
  });

  it("links Elliott as a speaker on the TechRise Cohort 2 panel", () => {
    const techrise = events.find((e) => e.id === TECHRISE)!;
    const session = techrise.sessions!.find((s) => s.title === COHORT_PANEL)!;
    expect(session).toMatchObject({ start: "18:30", end: "18:50" });
    expect(session.people).toContainEqual({ name: "Elliott Notrica", verified: true, mentorId: "elliott-notrica" });
  });

  it("links Rishab as a speaker on the Friday Showcase's Health Innovation session", () => {
    const showcase = events.find((e) => e.id === SHOWCASE)!;
    expect(showcase).toMatchObject({
      date: "2026-10-02",
      location: { kind: "in-person", venue: "Illinois Conference Center" },
    });
    const session = showcase.sessions!.find((s) => s.title === HEALTH_PANEL)!;
    expect(session).toMatchObject({ start: "13:20", end: "13:55" });
    expect(session.people.map((p) => p.name)).toEqual([
      "Marty Burke",
      "Carol Curtis",
      "Steve Boppart",
      "Rishab Veldur",
      "Rohit Bhargava",
    ]);
    expect(session.people).toContainEqual({ name: "Rishab Veldur", verified: true, mentorId: RISHAB });
    expect(session.people.filter((p) => p.mentorId).map((p) => p.mentorId)).toEqual([RISHAB]);
    // It's his only linked appearance on the calendar.
    const linked = events.flatMap((e) => [...e.speakers, ...(e.sessions ?? []).flatMap((s) => s.people)]);
    expect(linked.filter((p) => p.mentorId === RISHAB)).toHaveLength(1);
    // The link is checked: without Rishab in the mentor list, validation fails loudly.
    expect(() =>
      validateContent({ events, mentors: mentors.filter((m) => m.id !== RISHAB), forbidDemo: true }),
    ).toThrow(/\(founders-showcase-day-sessions\): speaker "Rishab Veldur" links to unknown mentor "rishab-veldur"/);
  });

  it("the Showcase blurb names every office-hours mentor on its stage, Rishab included", () => {
    const showcase = events.find((e) => e.id === SHOWCASE)!;
    const onStage = showcase.sessions!.flatMap((s) => s.people).filter((p) => p.mentorId);
    expect(onStage.map((p) => p.name)).toEqual(["Rishab Veldur", "Arnav Mishra", "Patrick Haddox", "Vik Lakhwara"]);
    for (const { name } of onStage) {
      expect(showcase.summary, `summary names ${name}`).toContain(name);
      expect(showcase.description, `description names ${name}`).toContain(name);
    }
    // No stale head count ("Three of this week’s office-hours mentors…") when four are speaking.
    expect(showcase.description).not.toMatch(/\b(One|Two|Three) of this week’s office-hours mentors\b/);
  });

  it("builds office-hours entries from mentor windows", () => {
    const entries = buildScheduleEntries({ events, mentors, site });
    expect(entries).toHaveLength(19);
    const oh = entries.filter((e) => e.kind === "office-hours");
    // Only mentors with published windows get entries (Vik is still scheduling). Elliott's two
    // Wednesday windows come first; on Oct 1, Patrick's morning window, then Elliott's and Rishab's
    // (both noon–5 PM; ties keep content order), then Ron's (2:30–4:30 PM).
    expect(oh.map((e) => e.id)).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      "office-hours-patrick-haddox-2026-10-01-am",
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      "office-hours-arnav-mishra-2026-10-02-am",
    ]);
    expect(oh.every((e) => !e.calendar.available)).toBe(true);
    // All seven windows are exact: Elliott's Wednesday is 9:00 AM–12:00 PM and 2:00–5:00 PM CT
    // (14:00–17:00Z, 19:00–22:00Z), Ron's Thursday is 2:30–4:30 PM CT (19:30–21:30Z) and Arnav's
    // Friday is 10:00–11:30 AM CT (15:00–16:30Z).
    expect(oh.map((e) => e.startsAt)).toEqual([
      "2026-09-30T14:00:00.000Z",
      "2026-09-30T19:00:00.000Z",
      "2026-10-01T15:00:00.000Z",
      "2026-10-01T17:00:00.000Z",
      "2026-10-01T17:00:00.000Z",
      "2026-10-01T19:30:00.000Z",
      "2026-10-02T15:00:00.000Z",
    ]);
    expect(oh.map((e) => e.endsAt)).toEqual([
      "2026-09-30T17:00:00.000Z",
      "2026-09-30T22:00:00.000Z",
      "2026-10-01T16:30:00.000Z",
      "2026-10-01T22:00:00.000Z",
      "2026-10-01T22:00:00.000Z",
      "2026-10-01T21:30:00.000Z",
      "2026-10-02T16:30:00.000Z",
    ]);
    // Elliott's windows: planned (his location is still being set), each with its own apply link.
    const elliottNote =
      "Elliott is holding office hours on Wednesday, September 30 (9 AM to noon and 2 to 5 PM) and Thursday, October 1 (noon to 5 PM). We’re still setting the location.";
    expect([oh[0], oh[1], oh[3]].map((e) => e.registration)).toEqual(
      ["elliott-notrica-2026-09-30-am", "elliott-notrica-2026-09-30-pm", "elliott-notrica-2026-10-01-pm"].map((w) => ({
        url: `/office-hours?mentor=elliott-notrica&window=${w}#apply`,
        label: "Apply to meet Elliott",
        internal: true,
      })),
    );
    for (const e of [oh[0], oh[1], oh[3]]) {
      expect(e, e.id).toMatchObject({
        title: "Office hours with Elliott Notrica",
        timeLabel: null,
        status: "planned",
        statusNote: elliottNote,
        location: { kind: "tba", note: "Location is shared with selected students once confirmed." },
        featuredRank: 1,
        mentor: { id: "elliott-notrica", firstName: "Elliott" },
      });
    }
    expect(oh.map((e) => e.description.split("\n\n")[0]).filter((d) => d.startsWith("Elliott"))).toEqual([
      "Elliott Notrica (Founder & CEO, Symbio Bioculinary) is available for office hours: Wednesday, September 30, 9:00 AM–12:00 PM CT.",
      "Elliott Notrica (Founder & CEO, Symbio Bioculinary) is available for office hours: Wednesday, September 30, 2:00–5:00 PM CT.",
      "Elliott Notrica (Founder & CEO, Symbio Bioculinary) is available for office hours: Thursday, October 1, 12:00–5:00 PM CT.",
    ]);
    expect(oh[6]).toMatchObject({
      date: "2026-10-02",
      time: { kind: "exact", start: "10:00", end: "11:30" },
      timeLabel: null,
      status: "planned",
      location: { kind: "tba", note: "Location is shared with selected students once confirmed." },
      registration: {
        url: "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
        label: "Apply to meet Arnav",
        internal: true,
      },
    });
    // Ron's window has a confirmed time and place (BIF), so his entry is confirmed, in person.
    expect(oh[5]).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "14:30", end: "16:30" },
      timeLabel: null,
      status: "confirmed",
      statusNote: null,
      location: {
        kind: "in-person",
        venue: "Business Instructional Facility (BIF)",
        address: "515 E. Gregory Drive, Champaign, IL 61820",
      },
      registration: {
        url: "/office-hours?mentor=ron-lewis&window=ron-lewis-2026-10-01-pm#apply",
        label: "Apply to meet Ron",
        internal: true,
      },
    });
    expect(oh[5].description.split("\n\n")[0]).toBe(
      "Ron Lewis (Co-Founder, Auctus Advisory) is available for office hours: Thursday, October 1, 2:30–4:30 PM CT.",
    );
    expect(oh[5].description).not.toMatch(/Oct(ober)?\.? 4\b|Sunday/i);
    expect(oh.every((e) => e.featuredRank === 1 && e.registration?.url.startsWith("/office-hours?"))).toBe(true);
    expect(oh[4]).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "12:00", end: "17:00" },
      timeLabel: null,
      // A window, not a confirmed session (the location is still being set).
      status: "planned",
      registration: {
        url: "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply",
        label: "Apply to meet Rishab",
        internal: true,
      },
    });
    expect(oh[4].description.split("\n\n")[0]).toBe(
      "Rishab Veldur (Co-Founder & CEO, Auvi Labs) is available for office hours: Thursday, October 1, 12:00–5:00 PM CT.",
    );

    // A date-only window (a future mentor's) has no time yet, so it sorts after the day's timed
    // entries and nothing is invented for it.
    const withDateOnly = buildScheduleEntries({ events, mentors: [...mentors, DATE_ONLY_MENTOR], site });
    expect(withDateOnly).toHaveLength(20);
    expect(withDateOnly.filter((e) => e.date === "2026-10-01").map((e) => e.id)).toEqual([
      "office-hours-patrick-haddox-2026-10-01-am",
      "science-and-practice-of-pitching",
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      "entrepreneurial-impact-launching-from-illinois",
      TECHRISE,
      FIXTURE_OH,
    ]);
    expect(withDateOnly.find((e) => e.id === FIXTURE_OH)).toMatchObject({
      date: "2026-10-01",
      time: { kind: "tba" },
      timeLabel: "Exact time to be confirmed",
      status: "planned",
      startsAt: null,
      endsAt: null,
      featuredRank: 1,
      calendar: { available: false },
      registration: {
        url: "/office-hours?mentor=fixture-date-only&window=fixture-date-only-2026-10-01#apply",
        label: "Apply to meet Fixture",
        internal: true,
      },
    });

    // A part-of-day window has no exact interval: nothing is invented for it, and it sorts at the
    // earliest start of its part of day (morning: 6:00, before the 8:00 Showcase).
    const withMorning = buildScheduleEntries({ events, mentors: [...mentors, PART_OF_DAY_MENTOR], site });
    expect(withMorning.filter((e) => e.date === "2026-10-02").map((e) => e.id)).toEqual([
      PART_OF_DAY_OH,
      "founders-showcase-day-sessions",
      "office-hours-arnav-mishra-2026-10-02-am",
      "founders-evening-showcase-and-reception",
    ]);
    expect(withMorning.find((e) => e.id === PART_OF_DAY_OH)).toMatchObject({
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
      timeLabel: "Friday morning, before noon · Exact window pending",
      startsAt: null,
      endsAt: null,
      sessionRule: null,
      calendar: { available: false },
    });

    // Featured order: office hours, then Dan Caruso, the Sep 29 panel, Arnav's happy hour and
    // Founder Failure Lab.
    expect(featuredEntries(entries).map((e) => e.id)).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      "office-hours-patrick-haddox-2026-10-01-am",
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      "office-hours-arnav-mishra-2026-10-02-am",
      DAN,
      "how-to-make-10k-a-month-in-college",
      HAPPY_HOUR,
      "founder-failure-lab",
    ]);
    // Calendar export: confirmed exact events only — the happy hour included.
    expect(entries.find((e) => e.id === "how-to-make-10k-a-month-in-college")!.calendar.available).toBe(true);
    expect(entries.find((e) => e.id === HAPPY_HOUR)!.calendar.available).toBe(true);
    // Dan's chat has a start time but no announced end, so it can't be exported yet.
    expect(entries.find((e) => e.id === DAN)!.calendar).toEqual({
      available: false,
      reason: "Calendar export opens once an end time is announced.",
    });

    // Mentors on stage (or hosting) are linked from the agenda, chronologically.
    expect(mentorAppearances(entries, "arnav-mishra")).toEqual([
      expect.objectContaining({ entryId: HAPPY_HOUR, sessionTitle: null, start: "17:00", end: "19:00", role: "host", venue: "Legends" }),
      expect.objectContaining({ entryId: "founders-showcase-day-sessions", start: "13:55", role: "speaker" }),
    ]);
    expect(mentorAppearances(entries, "patrick-haddox").map((a) => a.sessionTitle)).toEqual([
      "Next Generation Industrial, Manufacturing and Space Tech",
    ]);
    expect(mentorAppearances(entries, "vikram-lakhwara")).toHaveLength(1);
    expect(mentorAppearances(entries, "elliott-notrica")).toEqual([
      {
        entryId: TECHRISE,
        entryTitle: "TechRise Pitch Competition and Panel Discussion",
        date: "2026-10-01",
        sessionTitle: COHORT_PANEL,
        start: "18:30",
        end: "18:50",
        role: "speaker",
        venue: "EnterpriseWorks",
      },
    ]);
    expect(mentorAppearances(entries, "ron-lewis")).toHaveLength(0);
    // Rishab speaks Friday at the Showcase: a separate appearance, not his Thursday office hours.
    expect(mentorAppearances(entries, RISHAB)).toEqual([
      {
        entryId: SHOWCASE,
        entryTitle: "Founders Showcase Day Sessions",
        date: "2026-10-02",
        sessionTitle: HEALTH_PANEL,
        start: "13:20",
        end: "13:55",
        role: "speaker",
        venue: "Illinois Conference Center",
      },
    ]);
    // Chronological order
    expect(entries.map((e) => e.date)).toEqual([...entries.map((e) => e.date)].sort());
  });

  it("LATEST_MIGRATION matches the newest migration file", () => {
    const files = readdirSync(path.join(process.cwd(), "db", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files.at(-1)).toBe(`${LATEST_MIGRATION}.sql`);
  });
});
