/**
 * GET /schedule/calendar.ics — every calendar-eligible (confirmed, exact-time) entry in one
 * iCalendar file. Planned/tentative events and office hours are left out until they're confirmed.
 */
import { getScheduleEntries, getSite } from "@/content";
import { buildIcsCalendar, ICS_CONTENT_TYPE } from "@/lib/calendar/ics";
import { getSiteUrl } from "@/lib/config";

export async function GET() {
  const site = getSite();
  const entries = getScheduleEntries().filter((e) => e.calendar.available);
  const body = buildIcsCalendar(entries, { siteUrl: getSiteUrl(), name: `${site.week.name} ${site.week.year}` });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": ICS_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="founders-week-${site.week.year}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
