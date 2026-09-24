import { describe, expect, it } from "vitest";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import {
  APPLICATION_CSV_COLUMNS,
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
  const directory = buildOrganizerDirectory([...mentors, ...demoMentors]);
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
});
