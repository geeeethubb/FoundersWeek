/**
 * The organizer view against the current content: the six mentors (names, verified roles,
 * headshots), organizer-only notes and drafts (including Rishab's), the lineup balanced three
 * across, Rishab's date-only Oct 1 window in filters, no events (Dan Caruso, Arnav's happy hour,
 * Rishab's Showcase panel, the canceled afterparty) posing as mentors, and the "Data store"
 * indicator never exposing connection details.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getMentorsForOrganizers } from "@/content";
import { events } from "@/content/events";
import { mentors as productionMentors } from "@/content/mentors";
import { ApplicationFiltersForm } from "@/components/organizer/application-filters";
import { lineupColumns, MentorLineup } from "@/components/organizer/mentor-lineup";
import { MentorNotes, mentorDrafts, mentorMissing } from "@/components/organizer/mentor-notes";
import { buildApplicationCatalog, mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { balancedColumns } from "@/lib/columns";
import { __setDbForTests, createMemoryDbForTests } from "@/lib/db/client";
import { getDataStoreStatus, postgresProvider } from "@/lib/organizer/data-store";
import { describeDataStore, redactSecrets } from "@/lib/organizer/data-store-view";
import { buildOrganizerDirectory, joinNames, mentorBookability } from "@/lib/organizer/directory";
import { DEFAULT_APPLICATION_FILTERS, parseApplicationFilters, restrictToDirectory } from "@/lib/organizer/filters";
import { directory as fixtureDirectory } from "./organizer-fixtures";

const MENTOR_IDS = ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "elliott-notrica", "ron-lewis", "rishab-veldur"];
const RISHAB_WINDOW = "rishab-veldur-2026-10-01";

/** Every <img> alt text in the markup. */
function imageAlts(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((m) => m[1]);
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  vi.stubEnv("SHOW_DEMO_CONTENT", "");
  vi.stubEnv("SHOW_DRAFT_CONTENT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("organizer directory from production content", () => {
  const directory = buildOrganizerDirectory(getMentorsForOrganizers());

  it("lists exactly the six mentors with verified names, roles and headshots", () => {
    expect(directory.mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(directory.mentors).toHaveLength(6);
    const by = (id: string) => directory.mentorsById.get(id)!;
    expect(by("patrick-haddox")).toMatchObject({ name: "Patrick Haddox", affiliation: "CEO & Co-Founder, Samara Aerospace" });
    expect(by("arnav-mishra")).toMatchObject({ name: "Arnav Mishra", affiliation: "Co-Founder & CTO, Doss" });
    // Vik's title is verified now (Stakehouse team page).
    expect(by("vikram-lakhwara")).toMatchObject({
      name: "Vikram “Vik” Lakhwara",
      firstName: "Vik",
      role: "Founder & Managing Member",
      company: "Stakehouse",
      affiliation: "Founder & Managing Member, Stakehouse",
    });
    expect(by("elliott-notrica")).toMatchObject({
      name: "Elliott Notrica",
      firstName: "Elliott",
      role: "Founder & CEO",
      company: "Symbio Bioculinary",
      affiliation: "Founder & CEO, Symbio Bioculinary",
      demo: false,
      acceptingApplications: true,
    });
    expect(by("ron-lewis")).toMatchObject({ name: "Ron Lewis", affiliation: "Co-Founder, Auctus Advisory" });
    expect(by("rishab-veldur")).toEqual({
      id: "rishab-veldur",
      name: "Rishab Veldur",
      firstName: "Rishab",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      affiliation: "Co-Founder & CEO, Auvi Labs",
      headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 },
      demo: false,
      scheduling: "available",
      acceptingApplications: true,
    });
    expect(Object.fromEntries(directory.mentors.map((m) => [m.id, m.scheduling]))).toEqual({
      "patrick-haddox": "available",
      "arnav-mishra": "available",
      "vikram-lakhwara": "in-progress",
      "elliott-notrica": "in-progress",
      "ron-lewis": "in-progress",
      "rishab-veldur": "available",
    });
    for (const m of directory.mentors) expect(m.headshot).toMatchObject({ src: `/mentors/${m.id}.jpg`, alt: m.name });
    // Elliott has no windows or slots yet.
    expect(directory.windows.filter((w) => w.mentorId === "elliott-notrica")).toEqual([]);
    expect(directory.slots.filter((s) => s.mentorId === "elliott-notrica")).toEqual([]);
    // Rishab: ONE date-only window on Thu, Oct 1 (never Oct 2), and no appointment slots.
    expect(directory.windows.filter((w) => w.mentorId === "rishab-veldur")).toEqual([
      {
        id: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        mentorName: "Rishab Veldur",
        date: "2026-10-01",
        time: { kind: "tba" },
        kind: "window-approx",
        demo: false,
        label: "Thu, Oct 1 · Exact time to be confirmed",
      },
    ]);
    expect(directory.slots.filter((s) => s.mentorId === "rishab-veldur")).toEqual([]);
    expect(directory.windows.some((w) => w.mentorId === "rishab-veldur" && w.date !== "2026-10-01")).toBe(false);
    // Production has no appointment slots at all; windows in content order.
    expect(directory.slots).toEqual([]);
    expect(directory.windows.map((w) => w.id)).toEqual([
      "patrick-haddox-2026-10-01-am",
      "arnav-mishra-2026-10-02-am",
      RISHAB_WINDOW,
    ]);
  });

  it("never treats an event (Dan Caruso, Arnav's happy hour, Rishab's Showcase panel, the canceled afterparty) as a mentor, window, slot or option", () => {
    expect(events.some((e) => e.id === "dan-caruso-fireside-chat")).toBe(true);
    expect(events.some((e) => e.id === "happy-hour-at-legends-with-arnav-mishra")).toBe(true);
    expect(events.some((e) => e.id === "founders-week-afterparty")).toBe(false);
    // Rishab speaks on the Friday Showcase panel: a separate appearance, not office hours.
    expect(JSON.stringify(events)).toContain('"mentorId":"rishab-veldur"');
    const everything = JSON.stringify({
      mentors: directory.mentors,
      slots: directory.slots,
      windows: directory.windows,
      catalog: buildApplicationCatalog(getMentorsForOrganizers()),
    });
    expect(everything).not.toMatch(/caruso|afterparty|happy hour|legends|HERE Apartments/i);
    expect(everything).not.toMatch(/Health Innovation|Therapeutics|Showcase|Conference Center/i);

    // A filter URL naming an event is dropped instead of silently filtering to nothing.
    for (const eventId of ["dan-caruso-fireside-chat", "happy-hour-at-legends-with-arnav-mishra", "founders-week-afterparty"]) {
      const filters = restrictToDirectory(
        parseApplicationFilters({ mentor: eventId, choice: "first", availability: `window:${eventId}` }),
        directory,
      );
      expect(filters, eventId).toEqual(DEFAULT_APPLICATION_FILTERS);
    }
    // Known ids survive.
    expect(
      restrictToDirectory(
        parseApplicationFilters({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" }),
        directory,
      ),
    ).toMatchObject({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" });
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "elliott-notrica", choice: "first" }), directory),
    ).toMatchObject({ mentor: "elliott-notrica", firstChoiceOnly: true });
    expect(restrictToDirectory(parseApplicationFilters({ availability: "none" }), directory).availability).toBe("none");
  });

  it("labels windows without repeating the weekday", () => {
    expect(directory.windowsById.get("patrick-haddox-2026-10-01-am")?.label).toBe("Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(directory.windowsById.get("arnav-mishra-2026-10-02-am")?.label).toBe(
      "Oct 2 · Friday morning, before noon · Exact window pending",
    );
    // Date set, time not: the label says so plainly (never "Time TBA" or "Time to be announced").
    expect(directory.windowsById.get(RISHAB_WINDOW)?.label).toBe("Thu, Oct 1 · Exact time to be confirmed");
  });

  it("offers Rishab's Oct 1 window as a date-only option that needs broad availability", () => {
    const catalog = buildApplicationCatalog(getMentorsForOrganizers());
    expect(catalog.mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    const rishab = catalog.mentors.find((m) => m.id === "rishab-veldur")!;
    expect(rishab).toMatchObject({ name: "Rishab Veldur", firstName: "Rishab", affiliation: "Co-Founder & CEO, Auvi Labs", scheduling: "available", demo: false });
    expect(rishab.options).toEqual([
      {
        key: `window:${RISHAB_WINDOW}`,
        kind: "window",
        id: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        certainty: "window",
        date: "2026-10-01",
        label: "Thu, Oct 1 · Exact time to be confirmed",
        // Fallback wording only: the form shows lib/applications/option-presentation.ts copy.
        detail: expect.any(String),
        timeKnown: false,
      },
    ]);
    // Vik, Elliott, Ron (no times) and Rishab (date only) need the broad-availability note.
    expect(catalog.mentors.filter(mentorNeedsBroadAvailability).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
  });

  it("explains which preferred mentors can't be booked yet", () => {
    const prefs = mentorBookability(directory, ["vikram-lakhwara", "elliott-notrica", "ron-lewis", "patrick-haddox"]);
    expect(prefs.map((p) => [p.firstName, p.slots.length, p.windows.length, p.scheduling])).toEqual([
      ["Vik", 0, 0, "in-progress"],
      ["Elliott", 0, 0, "in-progress"],
      ["Ron", 0, 0, "in-progress"],
      ["Patrick", 0, 1, "available"],
    ]);
    expect(joinNames(prefs.map((p) => p.firstName))).toBe("Vik, Elliott, Ron and Patrick");
    expect(joinNames(["Vik", "Ron"])).toBe("Vik and Ron");
    // Rishab has a date but no slots yet: his applications can be reviewed, not confirmed.
    const [rishab] = mentorBookability(directory, ["rishab-veldur"]);
    expect(rishab).toMatchObject({ mentorId: "rishab-veldur", mentorName: "Rishab Veldur", firstName: "Rishab", scheduling: "available", slots: [] });
    expect(rishab.windows.map((w) => [w.id, w.label, w.kind])).toEqual([
      [RISHAB_WINDOW, "Thu, Oct 1 · Exact time to be confirmed", "window-approx"],
    ]);
    // With demo content, slots exist for demo mentors only.
    expect(mentorBookability(fixtureDirectory, ["demo-avery-sample"])[0].slots).toHaveLength(2);
    expect(mentorBookability(fixtureDirectory, ["rishab-veldur"])[0].slots).toEqual([]);
  });

  it("filters by mentor=rishab-veldur and his Oct 1 window, and drops an Oct 2 window he doesn't have", () => {
    const filters = restrictToDirectory(
      parseApplicationFilters(new URLSearchParams(`mentor=rishab-veldur&choice=first&availability=window:${RISHAB_WINDOW}`)),
      directory,
    );
    expect(filters).toEqual({
      ...DEFAULT_APPLICATION_FILTERS,
      mentor: "rishab-veldur",
      firstChoiceOnly: true,
      availability: `window:${RISHAB_WINDOW}`,
    });
    // He isn't available for office hours on Oct 2, so no such window exists to filter by.
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "rishab-veldur", availability: "window:rishab-veldur-2026-10-02" }), directory),
    ).toEqual({ ...DEFAULT_APPLICATION_FILTERS, mentor: "rishab-veldur" });

    // The GET form reflects the filter: Rishab selected among six mentors, his window among the options.
    const html = renderToStaticMarkup(createElement(ApplicationFiltersForm, { filters, directory }));
    const mentorSelect = /<select id="f-mentor"[^>]*>([\s\S]*?)<\/select>/.exec(html)![1];
    expect([...mentorSelect.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(["", ...MENTOR_IDS]);
    expect(mentorSelect).toContain('<option value="rishab-veldur" selected="">Rishab Veldur</option>');
    expect(mentorSelect.match(/selected=""/g)).toHaveLength(1);
    const availabilitySelect = /<select id="f-availability"[^>]*>([\s\S]*?)<\/select>/.exec(html)![1];
    // Only mentors with published times get a group; Vik, Elliott and Ron are still scheduling.
    expect([...availabilitySelect.matchAll(/<optgroup label="([^"]*)"/g)].map((m) => m[1])).toEqual([
      "Patrick Haddox",
      "Arnav Mishra",
      "Rishab Veldur",
    ]);
    expect(availabilitySelect).toContain(
      `<optgroup label="Rishab Veldur"><option value="window:${RISHAB_WINDOW}" selected="">Thu, Oct 1 · Exact time to be confirmed (window)</option></optgroup>`,
    );
    expect(availabilitySelect).not.toContain("rishab-veldur-2026-10-02");
    expect(html).toContain('href="/organizers"'); // "Clear filters"
  });
});

describe("mentor notes (organizer-only)", () => {
  it("keeps organizer notes and drafts out of public mentor data", () => {
    const publicMentors = JSON.stringify(getMentors());
    expect(publicMentors).not.toContain("not available slots");
    expect(publicMentors).not.toContain("Wednesday through Saturday");
    expect(publicMentors).not.toContain("commitments");
    // Ron's draft topics (his approved highlight "Revenue strategy and optimization" is public).
    expect(publicMentors).not.toContain('"Revenue strategy"');
    expect(publicMentors).not.toContain("Startup financial planning");
    expect(publicMentors).not.toContain("Communicating business progress to stakeholders");
    const organizer = getMentorsForOrganizers();
    expect(organizer.map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(organizer.every((m) => Boolean(m.organizerNotes))).toBe(true);
    for (const m of organizer) expect(publicMentors).not.toContain(m.organizerNotes!);
    expect(getMentors().map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(getMentors().some((m) => "organizerNotes" in m)).toBe(false);
  });

  it("keeps Rishab's email details (team preference, Oct 2, phone number) organizer-only", () => {
    const rishab = getMentorsForOrganizers().find((m) => m.id === "rishab-veldur")!;
    expect(rishab.organizerNotes).toContain(
      "he’d like to meet student teams (a preference, not an eligibility rule; individuals can apply)",
    );
    expect(rishab.organizerNotes).toContain("only has time for office hours on Thu Oct 1");
    expect(rishab.organizerNotes).toContain("Keep the phone number from his email signature off the site.");
    const publicMentor = getMentors().find((m) => m.id === "rishab-veldur")!;
    expect(publicMentor).not.toHaveProperty("organizerNotes");
    const publicRishab = JSON.stringify(publicMentor);
    expect(publicRishab).not.toMatch(/student teams|eligibility|phone number|signature|Oct 1 and 2|capacity/i);
    // Students see one date (Thu, Oct 1) with its time still to be confirmed, never Oct 2.
    expect(publicMentor.availability).toEqual([
      expect.objectContaining({ id: RISHAB_WINDOW, date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" }),
    ]);
    expect(publicMentor.slots).toEqual([]);
    // The copy students read makes no regulatory, commercial, clinical or one-on-one claims.
    const studentFacing = JSON.stringify([
      publicMentor.bio?.value,
      publicMentor.goodFitFor?.value,
      publicMentor.backgroundTags,
      publicMentor.session.note,
      publicMentor.availability.map((w) => [w.label, w.note]),
    ]);
    expect(studentFacing).not.toMatch(/FDA|approved|cleared|commercially available|clinically proven|one-on-one|1:1/i);
  });

  it("shows Rishab's organizer notes, his Oct 1 window (time to be confirmed) and what's still missing", () => {
    const rishab = getMentorsForOrganizers().find((m) => m.id === "rishab-veldur")!;
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors: [rishab] }));
    const t = text(html);
    expect(t).toContain("Rishab Veldur Co-Founder & CEO · Auvi Labs");
    expect(imageAlts(html)).toEqual(["Rishab Veldur"]);
    // Scheduling: one date-only window with the "Exact times TBA" badge; no slots, never Oct 2.
    expect(t).toContain(
      `Scheduling Thu, Oct 1 · Exact time to be confirmed Exact times TBA No appointment slots yet. ${rishab.session.note}`,
    );
    expect(rishab.session.note).toBe(
      "Rishab has time for office hours on Thursday, October 1. We’re still confirming the exact time, length and location.",
    );
    expect(t).not.toContain("Scheduling in progress");
    expect(t).not.toMatch(/Fri, Oct 2 ·|Oct 2 · /);
    // Organizer-only notes, shown in full with the lock.
    expect(t).toContain(`Organizer notes ${rishab.organizerNotes}`);
    // His approved copy needs no approval; the public preview shows the approved bio only.
    expect(mentorDrafts(rishab)).toEqual([]);
    expect(t).not.toContain("Awaiting approval");
    expect(t).toContain(`Public profile Show what students see Hide what students see ${rishab.bio!.value}`);
    expect(t).not.toContain("Basis (internal):");
    // No approved topic list and no confirmed session format yet.
    expect(mentorMissing(rishab)).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(t).toContain("Not yet provided Topics from the mentor Session format, length & location");
    // Links: his applications, his public profile, and the application with him preselected.
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    expect(t).toContain("Applications listing Rishab");
    expect(html).toContain('href="/office-hours/rishab-veldur"');
    expect(html).toContain('href="/office-hours?mentor=rishab-veldur#apply"');
    expect(t).toContain("Application with Rishab preselected");
    expect(html).not.toMatch(/href="\/apply/);
  });

  it("shows every mentor's organizer notes, Ron's draft topics and what's still missing", () => {
    const mentors = getMentorsForOrganizers();
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors }));
    const t = text(html);
    expect(productionMentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    for (const m of productionMentors) {
      expect(t).toContain(m.name);
      expect(t).toContain(m.organizerNotes!);
    }
    // No decorative numbering ("01 / 06") — mentors are listed by name.
    expect(t).not.toMatch(/\b0\d \/ 0\d\b/);
    // Vik's existing commitments are constraints, not availability.
    expect(t).toMatch(/these are not available slots/i);
    // Elliott is more available than the others — organizers see that, students don't.
    expect(t).toMatch(/much more available than the other mentors/i);
    const elliott = mentors.find((m) => m.id === "elliott-notrica")!;
    expect(elliott.session.note).toMatch(/still scheduling Elliott’s office hours/);
    expect(t).toContain(elliott.session.note!);
    // Ron's suggested topics are the only drafts awaiting confirmation.
    const ron = mentors.find((m) => m.id === "ron-lewis")!;
    expect(mentorDrafts(ron).map((d) => d.label)).toEqual(["Ask me about"]);
    for (const m of mentors.filter((x) => x.id !== "ron-lewis")) expect(mentorDrafts(m), m.id).toEqual([]);
    for (const topic of ron.askMeAbout!.value) expect(t).toContain(topic);
    // Approved expertise: organizers see the internal basis, clearly marked as never public.
    expect(t).toContain("Basis (internal):");
    expect(t).toContain("Students only see the expertise labels, never the basis.");
    expect(t.match(/Hidden on the public site until marked approved/g)).toHaveLength(1);
    expect(t).toContain("Draft");
    // Vik, Elliott and Ron are still scheduling; Patrick, Arnav and Rishab have windows.
    expect(html.match(/>Scheduling in progress</g)).toHaveLength(3);
    expect(t.match(/No appointment slots yet\./g)).toHaveLength(3);
    // Missing details are honest: every title is verified and every headshot supplied now.
    const missing = (id: string) => mentorMissing(mentors.find((m) => m.id === id)!);
    expect(missing("vikram-lakhwara")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(missing("elliott-notrica")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(missing("ron-lewis")).toEqual(["Session format, length & location"]);
    expect(missing("rishab-veldur")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(t).not.toContain("Title not verified");
    expect(t).not.toContain("Company not verified");
    expect(t).not.toContain("Title (unverified, so hidden)");
    expect(t).not.toContain("Headshot (initials portrait shown)");
    // Links go to the application section on the Office Hours page — never /apply.
    expect(html).toContain('href="/office-hours?mentor=ron-lewis#apply"');
    expect(html).toContain('href="/office-hours?mentor=elliott-notrica#apply"');
    expect(html).toContain('href="/office-hours?mentor=rishab-veldur#apply"');
    expect(html).toContain('href="/office-hours/vikram-lakhwara"');
    expect(html).toContain('href="/office-hours/elliott-notrica"');
    expect(html).toContain('href="/office-hours/rishab-veldur"');
    expect(html).toContain('href="/organizers?mentor=elliott-notrica"');
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    expect(html).not.toMatch(/href="\/apply/);
    // Headshots (alt = name) rather than generated initials, in content order; no event appears.
    expect(imageAlts(html)).toEqual(productionMentors.map((m) => m.name));
    expect(imageAlts(html)).toHaveLength(6);
    expect(html).not.toContain('viewBox="0 0 100 125"');
    expect(t).not.toMatch(/caruso/i);
  });

  it("the mentor lineup shows all six mentors, three across, with demand and scheduling state", () => {
    const directory = buildOrganizerDirectory(getMentorsForOrganizers());
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([["ron-lewis", { any: 5, first: 2 }]]),
        usage: new Map(),
        filters: { ...DEFAULT_APPLICATION_FILTERS, mentor: "ron-lewis" },
      }),
    );
    const t = text(html);
    for (const m of productionMentors) expect(t).toContain(m.name);
    expect(imageAlts(html)).toEqual(productionMentors.map((m) => m.name));
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(t).toContain("5 interested · 2 first choice");
    // Vik, Elliott and Ron are still scheduling.
    expect(t.match(/Scheduling in progress/g)).toHaveLength(3);
    expect(t).toContain("Thu, Oct 1 · 10:00–11:30 AM");
    // Rishab: his date is set, his time isn't (compact organizer wording).
    expect(t).toContain("Rishab Veldur 0 interested · 0 first choice Thu, Oct 1 · Time TBA (show applications that list this mentor)");
    expect(html).toContain('href="/organizers?mentor=elliott-notrica"');
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    // The active mentor links back to all mentors; the others filter.
    expect(html).toContain('href="/organizers"');
    expect(html).toContain('href="/organizers?mentor=patrick-haddox"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    // Six mentors balance as two rows of three on desktop (never 5 + 1), with no index numbers.
    expect(html).toContain('<ul class="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">');
    expect(html).not.toMatch(/lg:grid-cols-[245]/);
    // Portrait-over-text cards are only for a single row of five.
    expect(html).not.toContain("lg:flex-col");
    expect(t).not.toMatch(/\b0[1-6]\b/);
  });

  it("marks Rishab's card as the active filter and keeps the other filters in every link", () => {
    const directory = buildOrganizerDirectory(getMentorsForOrganizers());
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([
          ["rishab-veldur", { any: 2, first: 1 }],
          ["patrick-haddox", { any: 1, first: 0 }],
        ]),
        usage: new Map(),
        filters: { ...DEFAULT_APPLICATION_FILTERS, mentor: "rishab-veldur", firstChoiceOnly: true, status: "submitted" },
      }),
    );
    const t = text(html);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    // Selecting the active card again clears the mentor (and first-choice) filter, keeping status.
    expect(html).toMatch(/<a aria-current="true" class="[^"]*border-accent bg-accent-soft[^"]*" href="\/organizers\?status=submitted">/);
    expect(t).toContain(
      "Rishab Veldur 2 interested · 1 first choice Thu, Oct 1 · Time TBA (filtering by this mentor; select to show all mentors)",
    );
    expect(t).toContain("Patrick Haddox 1 interested · 0 first choice");
    // The other five cards filter by their mentor (any preference), keeping status.
    expect([...html.matchAll(/href="(\/organizers\?mentor=[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))).toEqual(
      MENTOR_IDS.filter((id) => id !== "rishab-veldur").map((id) => `/organizers?mentor=${id}&status=submitted`),
    );
  });

  it("chooses a desktop column count that keeps the lineup's rows full", () => {
    expect([1, 2, 3, 4, 5].map(lineupColumns)).toEqual([2, 2, 3, 4, 5]);
    // Six production mentors → three across (two full rows), never 5 + 1.
    expect(lineupColumns(productionMentors.length)).toBe(3);
    expect(lineupColumns(6)).toBe(3);
    expect(lineupColumns(7)).toBe(4);
    expect(lineupColumns(8)).toBe(4);
    expect(lineupColumns(9)).toBe(3);
    expect(lineupColumns(10)).toBe(5);
    // Six production + two demo mentors = eight → four across.
    expect(fixtureDirectory.mentors).toHaveLength(8);
    expect(lineupColumns(fixtureDirectory.mentors.length)).toBe(4);
    // Same balancing rule as the public lineups (lib/columns.ts) for any real lineup size.
    for (let n = 2; n <= 12; n++) expect(lineupColumns(n), String(n)).toBe(balancedColumns(n));
  });
});

describe("data store indicator", () => {
  const checkedAt = "2026-09-23T20:00:00.000Z";

  it("labels live Postgres/Supabase, local PGlite and disconnected states", () => {
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "supabase", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Supabase · Postgres", headline: "Live database connected", schema: "0001_init", hint: null });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "postgres", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Postgres" });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "pglite" }, provider: "pglite", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "local", provider: "PGlite · local file" });
    const down = describeDataStore({
      persistence: { ready: false, reason: "unreachable", detail: "Could not connect: postgres://admin:hunter2@db.abc.supabase.co:5432/postgres" },
      provider: "supabase",
      schema: "0001_init",
      showHints: true,
      checkedAt,
    });
    expect(down).toMatchObject({ state: "down", headline: "Database not connected", schema: null });
    expect(JSON.stringify(down)).not.toMatch(/hunter2|admin:|postgres:\/\//);
    // Production: no hint at all.
    expect(
      describeDataStore({ persistence: { ready: false, reason: "not-migrated", detail: "x" }, provider: "postgres", schema: "0001_init", showHints: false, checkedAt }).hint,
    ).toBeNull();
  });

  it("redacts connection strings and credentials from free text", () => {
    expect(redactSecrets("failed for postgresql://user:p%40ss@host:6543/db?sslmode=require now")).toBe(
      "failed for [connection string hidden] now",
    );
    expect(redactSecrets("auth failed for admin:hunter2@10.0.0.5")).not.toContain("hunter2");
    expect(redactSecrets("password=hunter2 sslmode=require")).toBe("password=[hidden] sslmode=require");
    expect(redactSecrets("Database schema is missing. Run `npm run db:migrate`.")).toBe(
      "Database schema is missing. Run `npm run db:migrate`.",
    );
  });

  it("hides database hosts and IPs from driver errors (shown as setup hints on preview deploys)", () => {
    expect(redactSecrets("Could not connect to the database: connect ECONNREFUSED 127.0.0.1:1")).toBe(
      "Could not connect to the database: connect ECONNREFUSED [host hidden]",
    );
    expect(redactSecrets("getaddrinfo ENOTFOUND db.abcdefghijkl.supabase.co")).toBe("getaddrinfo ENOTFOUND [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED ::1:5432")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED [2600:1f18::5]:6543")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("timeout on aws-0-us-east-1.pooler.supabase.com:6543 after 10s")).toBe(
      "timeout on [host hidden] after 10s",
    );
    expect(redactSecrets("no route to localhost:5432")).toBe("no route to [host hidden]");
  });

  it("detects Supabase by host without exposing it", () => {
    expect(postgresProvider("postgresql://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://postgres:pw@db.abcdefgh.supabase.co:5432/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://u:p@localhost:5432/app")).toBe("postgres");
    expect(postgresProvider("postgres://u:p@supabase.co.evil.example/app")).toBe("postgres");
    expect(postgresProvider("not a url")).toBe("postgres");
  });

  it("reports the connected database and a dead one without leaking the URL", async () => {
    const db = await createMemoryDbForTests();
    __setDbForTests(db);
    try {
      expect(await getDataStoreStatus(new Date(checkedAt))).toMatchObject({ state: "local", checkedAt });
    } finally {
      __setDbForTests(undefined);
    }
    vi.stubEnv("DATABASE_URL", "postgres://admin:hunter2@127.0.0.1:1/founders");
    vi.stubEnv("POSTGRES_URL", "");
    const dead = await getDataStoreStatus();
    expect(dead.state).toBe("down");
    expect(dead.provider).toBe("Postgres");
    expect(JSON.stringify(dead)).not.toMatch(/hunter2|admin|postgres:\/\//);

    vi.stubEnv("DATABASE_URL", "");
    expect(await getDataStoreStatus()).toMatchObject({ state: "down", headline: "No database configured", provider: "Not configured" });
  });
});
