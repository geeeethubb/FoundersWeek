/**
 * PATCH /api/organizer/applications/:id  { status?, organizerNotes? }
 * Organizer-only. Status rules live in lib/organizer/service.ts.
 */
import { authorizeOrganizerRequest, errorResponse, jsonOk, readJson } from "@/lib/organizer/auth";
import { getOrganizerDirectory } from "@/lib/organizer/content";
import { isUuid } from "@/lib/organizer/queries";
import { updateApplication, updateApplicationSchema } from "@/lib/organizer/service";
import { getDb } from "@/lib/db/client";
import { jsonError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizeOrganizerRequest(request, { mutation: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) return jsonError(404, "application_not_found", "That application doesn’t exist.");

  const parsed = updateApplicationSchema.safeParse((await readJson(request)) ?? undefined);
  if (!parsed.success) {
    return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    const db = await getDb();
    const result = await updateApplication(db, { id, ...parsed.data }, {
      actor: auth.session.name,
      slots: getOrganizerDirectory().slotsById,
    });
    return jsonOk({ application: { id, ...result } });
  } catch (error) {
    return errorResponse(error);
  }
}
