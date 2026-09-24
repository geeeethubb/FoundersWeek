/**
 * "Add to Google Calendar" template links. Dates are local wall-clock times with
 * `ctz=America/Chicago`, so Google places the event at the published Central Time and shows it
 * correctly in the student's own timezone.
 */
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { EVENT_TIMEZONE } from "@/lib/time";
import { calendarTimes, icsDescription, icsLocalDateTime, icsLocation } from "./ics";

const GOOGLE_TEMPLATE_BASE = "https://calendar.google.com/calendar/render";

/** Google Calendar template URL for an eligible entry, or `null` when it can't be exported. */
export function googleCalendarUrl(entry: ScheduleEntry, siteUrl: string): string | null {
  const times = calendarTimes(entry);
  if (!times) return null;
  const dates = `${icsLocalDateTime(entry.date, times.start)}/${icsLocalDateTime(entry.date, times.end)}`;
  const params: [string, string][] = [
    ["action", "TEMPLATE"],
    ["text", entry.title],
    ["dates", dates],
    ["ctz", EVENT_TIMEZONE],
    ["details", icsDescription(entry, siteUrl)],
  ];
  const location = icsLocation(entry);
  if (location) params.push(["location", location]);
  // Keep "/" in `dates` and the zone name readable; encode everything else.
  const query = params
    .map(([k, v]) => `${k}=${k === "dates" || k === "ctz" ? v : encodeURIComponent(v)}`)
    .join("&");
  return `${GOOGLE_TEMPLATE_BASE}?${query}`;
}
