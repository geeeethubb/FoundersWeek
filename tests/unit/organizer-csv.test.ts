import { describe, expect, it } from "vitest";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor } from "@/content/types";
import {
  APPLICATION_CSV_COLUMNS,
  applicationCsvRow,
  applicationsToCsv,
  csvField,
  exportFilename,
  sanitizeCell,
  toCsv,
} from "@/lib/organizer/csv";
import { buildOrganizerDirectory } from "@/lib/organizer/directory";
import type { ApplicationRecord } from "@/lib/organizer/queries";

describe("CSV formula-injection sanitization", () => {
  it.each([
    ["=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"],
    ["+1", "'+1"],
    ["-2", "'-2"],
    ["@x", "'@x"],
    ["\tleading tab", "'\tleading tab"],
    ["\rleading CR", "'\rleading CR"],
    ["   =1+1", "'   =1+1"],
    ["\n=1+1", "'\n=1+1"],
  ])("neutralizes %j", (input, expected) => {
    expect(sanitizeCell(input)).toBe(expected);
  });

  it.each(["Alex Student", "a=b", "email@illinois.edu", "", "3-2", "100%"])("leaves %j alone", (input) => {
    expect(sanitizeCell(input)).toBe(input);
  });
});

describe("CSV fields (RFC 4180)", () => {
  it("quotes and escapes when needed", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
    expect(csvField(" padded")).toBe('" padded"');
    expect(csvField(null)).toBe("");
    expect(csvField(3)).toBe("3");
  });

  it("sanitizes before quoting", () => {
    expect(csvField('=HYPERLINK("https://x","y")')).toBe(`"'=HYPERLINK(""https://x"",""y"")"`);
    expect(csvField("\tTab, and comma")).toBe(`"'\tTab, and comma"`);
  });

  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });

  it("names the file by Central Time date", () => {
    // 03:00 UTC on Oct 2 is still Oct 1 in Chicago.
    expect(exportFilename(new Date("2026-10-02T03:00:00Z"))).toBe("founders-week-applications-2026-10-01.csv");
  });
});

describe("application CSV rows", () => {
  const directory = buildOrganizerDirectory([...mentors, ...demoMentors], site.officeHours);
  const app: ApplicationRecord = {
    id: "0b5c7b8e-6f1e-4a8e-9a57-0c1f5f1e2d3a",
    createdAt: "2026-09-23T19:15:00.000Z",
    updatedAt: "2026-09-23T19:15:00.000Z",
    status: "selected",
    fullName: "=HYPERLINK(\"https://evil.example\",\"click\")",
    email: "student@illinois.edu",
    emailNormalized: "student@illinois.edu",
    year: "junior",
    major: "+1 Engineering",
    participation: "team",
    teamName: "@Team",
    teammates: "-2, \"Quoted\"",
    stage: "building",
    workingOn: "  =cmd",
    question: "Line one\nLine two",
    link: "https://example.com",
    availabilityNotes: null,
    firstChoiceMentorId: "demo-avery-sample",
    acknowledgedNoGuarantee: true,
    consentToShare: true,
    referrerMentorId: null,
    organizerNotes: "",
    mentors: [
      { mentorId: "demo-avery-sample", rank: 1 },
      { mentorId: "ron-lewis", rank: 2 },
    ],
    availability: [{ mentorId: "demo-avery-sample", kind: "slot", optionId: "demo-avery-slot-1400" }],
    appointments: [
      {
        id: "a",
        applicationId: "0b5c7b8e-6f1e-4a8e-9a57-0c1f5f1e2d3a",
        mentorId: "demo-avery-sample",
        slotId: "demo-avery-slot-1400",
        startsAt: "2026-10-01T19:00:00.000Z",
        endsAt: "2026-10-01T19:25:00.000Z",
        status: "proposed",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: null,
        createdBy: "Organizer",
      },
    ],
    duplicateCount: 2,
  };

  it("emits every column with sanitized, readable values", () => {
    const csv = applicationsToCsv([app], directory);
    const [header] = csv.split("\r\n");
    expect(header).toBe(APPLICATION_CSV_COLUMNS.join(","));
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"",""click"")"`);
    expect(csv).toContain(",'+1 Engineering,");
    expect(csv).toContain(",'@Team,");
    expect(csv).toContain(`"'-2, ""Quoted"""`);
    expect(csv).toContain(",'  =cmd,");
    expect(csv).toContain('"Line one\nLine two"');
    expect(csv).toContain("2026-09-23 14:15 CT");
    expect(csv).toContain("1. Avery Sample; 2. Ron Lewis");
    expect(csv).toContain("Avery Sample: Thu, Oct 1 · 2:00–2:25 PM CT (proposed)");
    expect(csv).toContain("Selected, awaiting confirmation");
    // No line in the file (outside quoted multi-line cells) starts a cell with a formula trigger.
    for (const cell of csv.split(/,|\r\n/)) {
      expect(cell).not.toMatch(/^\s*[=+@]/);
    }
  });

  it("labels an application with no time picked as interest only", () => {
    const row = applicationCsvRow({ ...app, availability: [], appointments: [] }, directory);
    expect(row[APPLICATION_CSV_COLUMNS.indexOf("availability")]).toBe("Interest only (no time selected)");
    expect(row[APPLICATION_CSV_COLUMNS.indexOf("appointments")]).toBe("");
  });

  it("exports an application listing Rishab with his Oct 1 window (12:00–5:00 PM)", () => {
    const rishabApp: ApplicationRecord = {
      ...app,
      status: "submitted",
      fullName: "Nadia Brooks",
      email: "nbrooks4@illinois.edu",
      emailNormalized: "nbrooks4@illinois.edu",
      major: "Bioengineering",
      teamName: "PulseFit",
      teammates: "Omar Haddad (Electrical Engineering)",
      workingOn: "Low-cost wearable sensors",
      question: "What should a student team do first?",
      availabilityNotes: "Thursday Oct 1: free before 11 AM and after 3 PM.",
      firstChoiceMentorId: "rishab-veldur",
      mentors: [
        { mentorId: "rishab-veldur", rank: 1 },
        { mentorId: "patrick-haddox", rank: 2 },
      ],
      availability: [
        { mentorId: "patrick-haddox", kind: "window", optionId: "patrick-haddox-2026-10-01-am" },
        { mentorId: "rishab-veldur", kind: "window", optionId: "rishab-veldur-2026-10-01" },
      ],
      appointments: [],
      duplicateCount: 1,
    };
    const row = applicationCsvRow(rishabApp, directory);
    const cell = (column: (typeof APPLICATION_CSV_COLUMNS)[number]) => row[APPLICATION_CSV_COLUMNS.indexOf(column)];
    expect(row).toHaveLength(APPLICATION_CSV_COLUMNS.length);
    expect(cell("status")).toBe("Submitted");
    expect(cell("first_choice")).toBe("Rishab Veldur");
    expect(cell("preferred_mentors")).toBe("1. Rishab Veldur; 2. Patrick Haddox");
    expect(cell("availability")).toBe(
      "Patrick Haddox: Thu, Oct 1 · 10:00–11:30 AM CT (window); Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)",
    );
    expect(cell("availability_notes")).toBe("Thursday Oct 1: free before 11 AM and after 3 PM.");
    expect(cell("appointments")).toBe("");
    expect(cell("duplicate_count")).toBe("1");

    const csv = applicationsToCsv([rishabApp], directory);
    expect(csv.split("\r\n")).toHaveLength(3); // header, one row, trailing newline
    expect(csv).toContain(
      '"Patrick Haddox: Thu, Oct 1 · 10:00–11:30 AM CT (window); Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)"',
    );
    expect(csv).toContain(",Rishab Veldur,1. Rishab Veldur; 2. Patrick Haddox,");
    expect(csv).not.toMatch(/Oct 2|no longer listed|Time TBA|Exact time to be confirmed/);
  });

  it("exports a date-only window (fixture mentor: date set, time not) with its date-only label", () => {
    const dateOnlyMentor: Mentor = {
      id: "fixture-date-only",
      name: "Dana Fixture",
      firstName: "Dana",
      role: null,
      company: null,
      headshot: null,
      bio: null,
      expertise: null,
      askMeAbout: null,
      goodFitFor: null,
      session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
      availability: [
        { id: "fixture-date-only-2026-10-01", date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" },
      ],
      slots: [],
      links: [],
      acceptingApplications: true,
      sources: [],
    };
    const withDateOnly = buildOrganizerDirectory([...mentors, dateOnlyMentor], site.officeHours);
    const row = applicationCsvRow(
      {
        ...app,
        availabilityNotes: "Thu Oct 1 after 2 PM",
        firstChoiceMentorId: "fixture-date-only",
        mentors: [
          { mentorId: "fixture-date-only", rank: 1 },
          { mentorId: "rishab-veldur", rank: 2 },
        ],
        availability: [
          { mentorId: "fixture-date-only", kind: "window", optionId: "fixture-date-only-2026-10-01" },
          { mentorId: "rishab-veldur", kind: "window", optionId: "rishab-veldur-2026-10-01" },
        ],
        appointments: [],
      },
      withDateOnly,
    );
    const cell = (column: (typeof APPLICATION_CSV_COLUMNS)[number]) => row[APPLICATION_CSV_COLUMNS.indexOf(column)];
    expect(cell("first_choice")).toBe("Dana Fixture");
    expect(cell("preferred_mentors")).toBe("1. Dana Fixture; 2. Rishab Veldur");
    expect(cell("availability")).toBe(
      "Dana Fixture: Thu, Oct 1 · Exact time to be confirmed (window); Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)",
    );
    expect(cell("availability_notes")).toBe("Thu Oct 1 after 2 PM");
    expect(cell("appointments")).toBe("");
  });

  it("still labels a Rishab window that disappeared from content instead of dropping it", () => {
    const row = applicationCsvRow(
      {
        ...app,
        mentors: [{ mentorId: "rishab-veldur", rank: 1 }],
        firstChoiceMentorId: "rishab-veldur",
        availability: [{ mentorId: "rishab-veldur", kind: "window", optionId: "rishab-veldur-2026-10-02" }],
        appointments: [],
      },
      directory,
    );
    expect(row[APPLICATION_CSV_COLUMNS.indexOf("availability")]).toBe(
      "Rishab Veldur: Window rishab-veldur-2026-10-02 (no longer listed) (window)",
    );
  });

  it("exports the session an application was assigned to (window chosen, 25-minute session booked)", () => {
    const appointment = (slotId: string, startsAt: string, endsAt: string, status: "proposed" | "confirmed" | "canceled") => ({
      ...app.appointments[0],
      id: slotId,
      mentorId: slotId.startsWith("rishab") ? "rishab-veldur" : "patrick-haddox",
      slotId,
      startsAt,
      endsAt,
      status,
    });
    const row = applicationCsvRow(
      {
        ...app,
        mentors: [
          { mentorId: "rishab-veldur", rank: 1 },
          { mentorId: "patrick-haddox", rank: 2 },
        ],
        firstChoiceMentorId: "rishab-veldur",
        availability: [
          { mentorId: "patrick-haddox", kind: "window", optionId: "patrick-haddox-2026-10-01-am" },
          { mentorId: "rishab-veldur", kind: "window", optionId: "rishab-veldur-2026-10-01" },
        ],
        appointments: [
          // 10:30–10:55 AM CDT and 12:00–12:25 PM CDT (UTC-5).
          appointment("patrick-haddox-2026-10-01-am-1030", "2026-10-01T15:30:00.000Z", "2026-10-01T15:55:00.000Z", "canceled"),
          appointment("rishab-veldur-2026-10-01-1200", "2026-10-01T17:00:00.000Z", "2026-10-01T17:25:00.000Z", "confirmed"),
        ],
      },
      directory,
    );
    const cell = (column: (typeof APPLICATION_CSV_COLUMNS)[number]) => row[APPLICATION_CSV_COLUMNS.indexOf(column)];
    // What the student chose: the windows. What they got: the session (canceled ones left out).
    expect(cell("availability")).toBe(
      "Patrick Haddox: Thu, Oct 1 · 10:00–11:30 AM CT (window); Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)",
    );
    expect(cell("appointments")).toBe("Rishab Veldur: Thu, Oct 1 · 12:00–12:25 PM CT (confirmed)");
  });
});
