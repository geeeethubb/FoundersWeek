/**
 * POST /api/organizer/appointments  { applicationId, slotId }
 * Proposes an appointment. Capacity and student-conflict checks run under advisory locks
 * (lib/organizer/service.ts).
 */
import { authorizeOrganizerRequest, errorResponse, jsonOk, readJson } from "@/lib/organizer/auth";
import { getOrganizerDirectory } from "@/lib/organizer/content";
import { assignAppointment, assignAppointmentSchema } from "@/lib/organizer/service";
import { getDb } from "@/lib/db/client";
import { jsonError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = authorizeOrganizerRequest(request, { mutation: true });
  if (!auth.ok) return auth.response;

  const parsed = assignAppointmentSchema.safeParse((await readJson(request)) ?? undefined);
  if (!parsed.success) {
    return jsonError(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    const db = await getDb();
    const result = await assignAppointment(db, parsed.data, {
      actor: auth.session.name,
      slots: getOrganizerDirectory().slotsById,
    });
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
