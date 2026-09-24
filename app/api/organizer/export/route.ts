/**
 * GET /api/organizer/export?<dashboard filters> → CSV download of matching applications.
 * Organizer-only; cells are formula-sanitized (lib/organizer/csv.ts).
 */
import { authorizeOrganizerRequest, errorResponse } from "@/lib/organizer/auth";
import { getOrganizerDirectory } from "@/lib/organizer/content";
import { applicationsToCsv, exportFilename } from "@/lib/organizer/csv";
import { parseApplicationFilters, restrictToDirectory } from "@/lib/organizer/filters";
import { listApplications } from "@/lib/organizer/queries";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const UTF8_BOM = "\uFEFF";

export async function GET(request: Request) {
  const auth = authorizeOrganizerRequest(request, { mutation: false });
  if (!auth.ok) return auth.response;

  try {
    const directory = getOrganizerDirectory();
    // Same filters as the dashboard (unknown mentor/slot ids are dropped there too).
    const filters = restrictToDirectory(parseApplicationFilters(new URL(request.url).searchParams), directory);
    const db = await getDb();
    const apps = await listApplications(db, filters);
    // UTF-8 BOM so Excel detects the encoding (names, curly quotes, en dashes).
    const body = UTF8_BOM + applicationsToCsv(apps, directory);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename()}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
