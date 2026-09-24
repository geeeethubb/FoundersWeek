/**
 * CSV export of applications (RFC 4180) with spreadsheet formula-injection protection.
 *
 * Applicant answers are untrusted: a cell like `=HYPERLINK(...)` or `+1+cmd|...` would execute as
 * a formula when an organizer opens the file in Excel/Sheets. Any cell whose first character —
 * after optional leading whitespace — is = + - @, or that starts with TAB or CR, is prefixed with
 * a single quote so spreadsheets treat it as text.
 */
import {
  APPLICATION_STATUS_LABELS,
  PARTICIPATION_OPTIONS,
  STAGE_OPTIONS,
  YEAR_OPTIONS,
} from "@/lib/applications/constants";
import { TZ_LABEL, utcToZoned } from "@/lib/time";
import { intervalLabel, mentorName, resolveAvailability, type OrganizerDirectory } from "./directory";
import type { ApplicationRecord } from "./queries";

const FORMULA_TRIGGER = /^(?:[\t\r]|\s*[=+\-@])/;

/** Neutralize spreadsheet formulas. */
export function sanitizeCell(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

/** One RFC 4180 field: sanitized, quoted when needed, embedded quotes doubled. */
export function csvField(value: unknown): string {
  const text = sanitizeCell(value == null ? "" : String(value));
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV document with CRLF line endings (no BOM here; the route adds it for Excel). */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export const APPLICATION_CSV_COLUMNS = [
  "id",
  "submitted_at",
  "status",
  "full_name",
  "email",
  "year",
  "major",
  "participation",
  "team_name",
  "teammates",
  "stage",
  "working_on",
  "question",
  "link",
  "first_choice",
  "preferred_mentors",
  "availability",
  "availability_notes",
  "appointments",
  "acknowledged_no_guarantee",
  "consent_to_share",
  "organizer_notes",
  "duplicate_count",
] as const;

const label = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

/** "2026-09-23 14:15 CT": sortable, unambiguous. */
export function csvTimestamp(iso: string): string {
  const { date, time } = utcToZoned(new Date(iso));
  return `${date} ${time} ${TZ_LABEL}`;
}

export function applicationCsvRow(app: ApplicationRecord, directory: OrganizerDirectory): string[] {
  const availability = app.availability.length
    ? app.availability
        .map((a) => {
          const r = resolveAvailability(directory, a);
          return `${r.mentorName}: ${r.label}${r.kind === "window" ? " (window)" : r.certainty ? ` (${r.certainty} slot)` : ""}`;
        })
        .join("; ")
    : "Interest only (no time selected)";
  const appointments = app.appointments
    .filter((a) => a.status !== "canceled")
    .map((a) => `${mentorName(directory, a.mentorId)}: ${intervalLabel(a.startsAt, a.endsAt)} (${a.status})`)
    .join("; ");
  return [
    app.id,
    csvTimestamp(app.createdAt),
    APPLICATION_STATUS_LABELS[app.status] ?? app.status,
    app.fullName,
    app.email,
    label(YEAR_OPTIONS, app.year),
    app.major,
    label(PARTICIPATION_OPTIONS, app.participation),
    app.teamName ?? "",
    app.teammates ?? "",
    label(STAGE_OPTIONS, app.stage),
    app.workingOn,
    app.question,
    app.link ?? "",
    mentorName(directory, app.firstChoiceMentorId),
    app.mentors.map((m) => `${m.rank}. ${mentorName(directory, m.mentorId)}`).join("; "),
    availability,
    app.availabilityNotes ?? "",
    appointments,
    app.acknowledgedNoGuarantee ? "yes" : "no",
    app.consentToShare ? "yes" : "no",
    app.organizerNotes,
    String(app.duplicateCount),
  ];
}

export function applicationsToCsv(apps: ApplicationRecord[], directory: OrganizerDirectory): string {
  return toCsv(
    APPLICATION_CSV_COLUMNS,
    apps.map((a) => applicationCsvRow(a, directory)),
  );
}

/** founders-week-applications-YYYY-MM-DD.csv (date in Central Time). */
export function exportFilename(now: Date = new Date()): string {
  return `founders-week-applications-${utcToZoned(now).date}.csv`;
}
