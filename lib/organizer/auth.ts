/**
 * Authorization for organizer API route handlers. Every /api/organizer/* handler calls
 * `authorizeOrganizerRequest` first — there is no proxy/middleware to rely on.
 *
 * Reads the session from the request's Cookie header (not `next/headers`) so handlers can be
 * exercised in unit tests with plain `Request` objects.
 */
import "server-only";
import { getAppSecret, getOrganizerPassword } from "@/lib/config";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { isSameOriginRequest, jsonError } from "@/lib/security/request";
import { OrganizerActionError } from "./errors";
import { getSessionFromRequest, type OrganizerSession } from "./session";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export type AuthorizationResult = { ok: true; session: OrganizerSession } | { ok: false; response: Response };

/**
 * - Sign-in disabled (no ORGANIZER_PASSWORD, or no APP_SECRET to verify sessions with) → 503
 * - Mutation from another origin → 403 (checked before the session: CSRF never reaches data)
 * - Missing/invalid/expired session → 401
 */
export function authorizeOrganizerRequest(
  request: Request,
  options: { mutation: boolean },
): AuthorizationResult {
  if (!getOrganizerPassword()) {
    return {
      ok: false,
      response: jsonError(503, "organizer_disabled", "Organizer sign-in is disabled. Set ORGANIZER_PASSWORD."),
    };
  }
  if (!getAppSecret()) {
    return {
      ok: false,
      response: jsonError(503, "organizer_disabled", "Organizer sign-in is disabled. Set APP_SECRET."),
    };
  }
  if (options.mutation && !isSameOriginRequest(request)) {
    return { ok: false, response: jsonError(403, "forbidden_origin", "Request blocked: cross-origin request.") };
  }
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: jsonError(401, "unauthorized", "Your organizer session has expired. Sign in again."),
    };
  }
  return { ok: true, session };
}

export function jsonOk(body: Record<string, unknown>, init: { status?: number; headers?: Record<string, string> } = {}) {
  return Response.json({ ok: true, ...body }, { status: init.status ?? 200, headers: { ...NO_STORE_HEADERS, ...init.headers } });
}

/** Parse a JSON body; `null` when it isn't valid JSON. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Map service/database errors to JSON responses. Unknown errors are logged, not leaked. */
export function errorResponse(error: unknown): Response {
  if (error instanceof OrganizerActionError) {
    return jsonError(error.status, error.code, error.message, error.extra);
  }
  if (error instanceof DatabaseUnavailableError) {
    return jsonError(503, "database_unavailable", "The application database isn’t available right now.");
  }
  // Class and driver code only: Postgres error messages and details can contain row values.
  const e = error as { name?: string; code?: string };
  console.error(`[organizer] unexpected error: ${e?.name ?? "Error"}${e?.code ? ` code=${e.code}` : ""}`);
  return jsonError(500, "server_error", "Something went wrong. Try again.");
}
