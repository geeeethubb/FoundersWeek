/**
 * GET /schedule/<id>/calendar.ics — one confirmed event as an iCalendar download
 * (Apple Calendar, Outlook, anything that reads .ics). 404 for unknown ids and for entries that
 * can't be exported yet (planned/tentative/canceled, no exact time, office hours).
 */
import { getScheduleEntry, getSite } from "@/content";
import { buildIcsCalendar, ICS_CONTENT_TYPE, icsFilename } from "@/lib/calendar/ics";
import { getSiteUrl } from "@/lib/config";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getScheduleEntry(id);
  if (!entry || !entry.calendar.available) {
    return new Response("No calendar file is available for this event.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const body = buildIcsCalendar([entry], { siteUrl: getSiteUrl(), name: getSite().week.name });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": ICS_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${icsFilename(entry.id)}"`,
      // Short cache: event details can still change; the file carries a fresh DTSTAMP.
      "Cache-Control": "public, max-age=300",
    },
  });
}
