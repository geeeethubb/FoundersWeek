import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleEntries } from "@/content";
import { demoMentors } from "@/content/demo";
import { mentors as productionMentors } from "@/content/mentors";
import type { Mentor } from "@/content/types";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import {
  appearancesByMentor,
  availabilityHeadline,
  availabilityItems,
  availabilityOneLiner,
  availabilityView,
  excerpt,
  expertiseSummary,
  factualOneLiner,
  mentorAppearanceViews,
  mentorCta,
  mentorIndexCaption,
  mentorMetaDescription,
  mentorProfileHref,
  mentorSectionId,
  preselectedOption,
  sessionDetails,
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
const avery = byId(demoMentors, "demo-avery-sample");
const jordan = byId(demoMentors, "demo-jordan-placeholder");

/** Words that only exist in organizer notes / unapproved drafts for the production mentors. */
const PRIVATE_FRAGMENTS = [
  "Wednesday",
  "Saturday morning",
  "commitments",
  "Revenue strategy",
  "Startup financial planning",
  "Communicating business progress",
  "Verify title",
];

describe("public mentor data (content loader, default env)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
    vi.stubEnv("VERCEL_ENV", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lists the four mentors in order, without organizer notes or drafts", () => {
    const mentors = getMentors();
    expect(mentors.map((m) => m.id)).toEqual(["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"]);
    for (const m of mentors) {
      expect(m).not.toHaveProperty("organizerNotes");
      for (const field of [m.bio, m.expertise, m.askMeAbout, m.goodFitFor]) {
        if (field) expect(field.status).toBe("approved");
      }
    }
    const publicRon = byId(mentors, "ron-lewis");
    expect(publicRon.askMeAbout).toBeNull(); // suggested topics pending Ron's confirmation
    expect(publicRon.bio?.status).toBe("approved");
    expect(publicRon.links).toEqual([{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }]);
    const publicVik = byId(mentors, "vikram-lakhwara");
    // Title unverified → never shown; bio is the approved, company-only one.
    expect(publicVik).toMatchObject({ firstName: "Vik", role: null, company: "Stakehouse", askMeAbout: null });
    expect(publicVik.bio?.value).toContain("Stakehouse");
  });

  it("uses the verified roles", () => {
    const mentors = getMentors();
    expect(byId(mentors, "patrick-haddox")).toMatchObject({ role: "CEO & Co-Founder", company: "Samara Aerospace" });
    expect(byId(mentors, "arnav-mishra")).toMatchObject({ role: "Co-Founder & CTO", company: "Doss" });
    expect(byId(mentors, "ron-lewis")).toMatchObject({ role: "Co-Founder", company: "Auctus Advisory" });
  });

  it("never serializes organizer-only constraints or draft topics", () => {
    const json = JSON.stringify(getMentors());
    for (const fragment of PRIVATE_FRAGMENTS) expect(json).not.toContain(fragment);
  });

  it("never lists Vik as available (his existing commitments are not slots)", () => {
    const publicVik = byId(getMentors(), "vikram-lakhwara");
    const view = availabilityView(publicVik);
    expect(view.status).toBe("in-progress");
    expect(view.windows).toEqual([]);
    expect(mentorMetaDescription(publicVik)).not.toMatch(/Wed|Thu|Fri|Sat/);
    expect(availabilityHeadline(publicVik)).toMatchObject({ kind: "in-progress", date: null });
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
    expect(topics?.value).toContain("Revenue strategy");
    // Organizer notes stay out even in preview.
    expect(previewRon).not.toHaveProperty("organizerNotes");
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
});

describe("expertise (verified, with its basis)", () => {
  it("keeps every item's basis", () => {
    expect(visibleExpertise(patrick)?.value).toEqual([
      { label: "Building an aerospace company", basis: "CEO & Co-Founder, Samara Aerospace" },
      { label: "Industrial, manufacturing & space tech", basis: "Founders Showcase panelist" },
    ]);
    expect(visibleExpertise(vik)?.value).toEqual([
      { label: "Funding start-ups in the Midwest", basis: "Founders Showcase panelist" },
    ]);
  });

  it("summarizes approved expertise in one line and never a draft", () => {
    expect(expertiseSummary(ron)).toBe("Revenue optimization · Financial forecasting · Stakeholder communication");
    expect(expertiseSummary({ expertise: null })).toBeNull();
    expect(expertiseSummary({ expertise: { status: "draft", value: [{ label: "x", basis: "y" }] } })).toBeNull();
  });
});

describe("Founders Week appearances", () => {
  it("links each Showcase speaker to their session on the calendar", () => {
    const entries = getScheduleEntries();
    expect(mentorAppearanceViews(entries, "arnav-mishra")).toEqual([
      expect.objectContaining({
        href: "/schedule/founders-showcase-day-sessions",
        title: "From Idea to Scale — Building Doss: Lessons from an Illini Founder",
        context: "Founders Showcase Day Sessions",
        dateShort: "Fri, Oct 2",
        timeLabel: "1:55–2:25 PM CT",
        startLabel: "1:55 PM",
        dateTime: "2026-10-02T13:55",
        roleLabel: "Speaking",
        venue: "Illinois Conference Center",
      }),
    ]);
    const byMentor = appearancesByMentor(entries, getMentors());
    expect(byMentor["patrick-haddox"].map((a) => a.title)).toEqual([
      "Next Generation Industrial, Manufacturing and Space Tech",
    ]);
    expect(byMentor["vikram-lakhwara"].map((a) => a.title)).toEqual(["Funding Start-ups in the Midwest"]);
    expect(byMentor["ron-lewis"]).toEqual([]);
  });
});

describe("availability", () => {
  it("distinguishes exact windows from rough ones", () => {
    expect(windowKind(patrick.availability[0])).toBe("window");
    expect(windowKind(arnav.availability[0])).toBe("window-approx");

    const p = availabilityView(patrick);
    expect(p.status).toBe("available");
    expect(p.windows[0]).toMatchObject({
      dateShort: "Thu, Oct 1",
      dateLong: "Thursday, October 1",
      timeLabel: "10:00–11:30 AM CT",
      slots: [],
    });
    expect(availabilityView(arnav).windows[0]).toMatchObject({
      dateShort: "Fri, Oct 2",
      timeLabel: "Morning, before noon CT",
      label: "Friday morning, before noon · Exact window pending",
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
    expect(strongestAvailabilityKind(availabilityView(arnav))).toBe("window-approx");
    expect(strongestAvailabilityKind(availabilityView(ron))).toBe("in-progress");
  });

  it("builds plain one-liners and card headlines", () => {
    expect(availabilityOneLiner(availabilityView(patrick))).toBe("Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(availabilityOneLiner(availabilityView(ron))).toBe("Scheduling in progress");
    expect(availabilityHeadline(patrick)).toEqual({
      kind: "window",
      label: "Availability window",
      date: "Thu, Oct 1",
      dateTime: "2026-10-01",
      time: "10:00–11:30 AM CT",
      more: 0,
    });
    expect(availabilityHeadline(arnav)).toMatchObject({ kind: "window-approx", label: "Exact times forthcoming" });
    expect(availabilityHeadline(ron)).toMatchObject({
      kind: "in-progress",
      label: "Scheduling in progress",
      time: "Times to be announced",
    });
  });
});

describe("calls to action", () => {
  it("preselects the only window or slot", () => {
    expect(preselectedOption(patrick)).toMatchObject({ kind: "window", id: "patrick-haddox-2026-10-01-am" });
    expect(preselectedOption(jordan)).toMatchObject({ kind: "slot", id: "demo-jordan-slot-1500" });
    expect(preselectedOption(avery)).toBeNull(); // two slots: let the student choose
    expect(preselectedOption(ron)).toBeNull();
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
      preselects: "Fri, Oct 2 · Morning, before noon CT",
    });
    expect(mentorCta(avery)).toMatchObject({
      label: "Apply to meet Avery",
      href: "/office-hours?mentor=demo-avery-sample#apply",
      preselects: null,
    });
    expect(mentorCta(jordan).href).toBe("/office-hours?mentor=demo-jordan-placeholder&slot=demo-jordan-slot-1500#apply");
  });

  it("uses 'Express interest' without a time while scheduling is in progress", () => {
    expect(mentorCta(ron)).toEqual({
      kind: "interest",
      label: "Express interest",
      href: "/office-hours?mentor=ron-lewis#apply",
      preselects: null,
    });
    expect(mentorCta(vik)).toEqual({
      kind: "interest",
      label: "Express interest",
      href: "/office-hours?mentor=vikram-lakhwara#apply",
      preselects: null,
    });
  });

  it("closes when applications are closed or the mentor isn't accepting", () => {
    expect(mentorCta(patrick, { applicationsOpen: false })).toMatchObject({ kind: "closed", href: null });
    expect(mentorCta({ ...ron, acceptingApplications: false })).toMatchObject({
      kind: "closed",
      label: "Not accepting applications",
      href: null,
    });
  });
});

describe("session details", () => {
  it("says plainly what isn't known yet", () => {
    expect(sessionSummary(patrick.session)).toBe("Format and length to be confirmed");
    expect(sessionSummary(jordan.session)).toBe("Virtual · Length to be confirmed");
    expect(sessionSummary(avery.session)).toBe("In person · 25 min");
    expect(sessionSummary({ ...patrick.session, durationMinutes: 20 })).toBe("20 min · Format to be confirmed");
  });

  it("fills every unknown row with 'To be confirmed'", () => {
    expect(sessionDetails(patrick.session)).toEqual([
      { label: "Format", value: "To be confirmed", known: false },
      { label: "Length", value: "To be confirmed", known: false },
      { label: "Location", value: "To be confirmed", known: false },
      { label: "Sessions", value: "One or two sessions", known: true },
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
    expect(factualOneLiner(vik)).toBe("Vikram “Vik” Lakhwara · Stakehouse");
    expect(factualOneLiner({ name: "Sam Doe", role: null, company: null })).toBe("Sam Doe");
  });

  it("builds stable ids, captions and profile links", () => {
    expect(mentorIndexCaption(0, 4)).toBe("01 / 04");
    expect(mentorIndexCaption(3, 4)).toBe("04 / 04");
    expect(mentorProfileHref("ron-lewis")).toBe("/office-hours/ron-lewis");
    expect(mentorSectionId("ron-lewis")).toBe("mentor-ron-lewis");
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
      "Founders Office Hours with Patrick Haddox (CEO & Co-Founder, Samara Aerospace) during Founders Week at UIUC. Availability: Thu, Oct 1 · 10:00–11:30 AM CT. Apply once to request time.",
    );
    expect(mentorMetaDescription(ron)).toContain("Scheduling is in progress");
    expect(mentorMetaDescription(vik)).toContain("Vikram “Vik” Lakhwara (Stakehouse)");
  });
});
