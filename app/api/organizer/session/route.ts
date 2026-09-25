/**
 * Organizer sign-in (POST) and sign-out (DELETE).
 *
 * POST { password, name } → sets the `fw_organizer` session cookie.
 * Rate limited per IP (8 attempts / 15 minutes, cleared on success) and across all networks
 * (300 / 15 minutes, see ORGANIZER_LOGIN_LIMITS); password compared in constant time; same-origin
 * only.
 */
import { z } from "zod";
import { NO_STORE_HEADERS, readJson } from "@/lib/organizer/auth";
import {
  checkOrganizerPassword,
  clearSessionCookieHeader,
  createSessionToken,
  ORGANIZER_LOGIN_LIMITS,
  ORGANIZER_NAME_MAX,
  sessionCookieHeader,
} from "@/lib/organizer/session";
import { getAppSecret, getOrganizerPassword } from "@/lib/config";
import { DatabaseUnavailableError, getDb } from "@/lib/db/client";
import { consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";
import { clientIp, isSameOriginRequest, jsonError } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const LOGIN_BUCKET = "organizer-login";
const LOGIN_LIMIT = ORGANIZER_LOGIN_LIMITS.perIp;
const LOGIN_WINDOW_SECONDS = ORGANIZER_LOGIN_LIMITS.windowSeconds;
// Shared by every network, so spreading guesses across many addresses doesn't help. Kept well
// above the per-IP limit: at 50, about seven addresses could lock every organizer out for 15
// minutes (see ORGANIZER_LOGIN_LIMITS for the reasoning behind 300).
const LOGIN_GLOBAL_BUCKET = "organizer-login:all";
const LOGIN_GLOBAL_LIMIT = ORGANIZER_LOGIN_LIMITS.all;

const loginSchema = z.object({
  password: z.string().min(1, "Enter the organizer password.").max(200),
  name: z
    .string()
    .trim()
    .min(1, "Enter your name so the activity log shows who made changes.")
    .max(ORGANIZER_NAME_MAX, `Keep your name under ${ORGANIZER_NAME_MAX} characters.`)
    // No control characters in names that end up in logs and exports.
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Use letters, numbers and spaces."),
});

export async function POST(request: Request) {
  const password = getOrganizerPassword();
  if (!password) {
    return jsonError(503, "organizer_disabled", "Organizer sign-in is disabled. Set ORGANIZER_PASSWORD (see README).");
  }
  // Sessions (and the rate limiter's hashed IPs) are signed with APP_SECRET.
  if (!getAppSecret()) {
    return jsonError(503, "organizer_disabled", "Organizer sign-in is disabled. Set APP_SECRET (see README).");
  }
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "forbidden_origin", "Request blocked: cross-origin request.");
  }

  const body = await readJson(request);
  const parsed = loginSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return jsonError(400, "invalid_input", "Check the highlighted fields.", { fieldErrors });
  }

  let db;
  try {
    db = await getDb();
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return jsonError(503, "database_unavailable", "Sign-in won’t work until the application database is ready.");
    }
    throw error;
  }

  const ip = clientIp(request);
  const perIp = await consumeRateLimit(db, {
    bucket: LOGIN_BUCKET,
    key: ip,
    limit: LOGIN_LIMIT,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  });
  const limit = perIp.allowed
    ? await consumeRateLimit(db, {
        bucket: LOGIN_GLOBAL_BUCKET,
        key: "all",
        limit: LOGIN_GLOBAL_LIMIT,
        windowSeconds: LOGIN_WINDOW_SECONDS,
      })
    : perIp;
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return jsonError(
      429,
      "rate_limited",
      `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      { retryAfterSeconds: limit.retryAfterSeconds },
    );
  }

  if (!checkOrganizerPassword(parsed.data.password, password)) {
    return jsonError(401, "invalid_credentials", "That password isn’t right.");
  }

  await resetRateLimit(db, LOGIN_BUCKET, ip);
  const token = createSessionToken({ name: parsed.data.name, password });
  return Response.json(
    { ok: true, name: parsed.data.name },
    { status: 200, headers: { ...NO_STORE_HEADERS, "Set-Cookie": sessionCookieHeader(token) } },
  );
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError(403, "forbidden_origin", "Request blocked: cross-origin request.");
  }
  return Response.json(
    { ok: true },
    { status: 200, headers: { ...NO_STORE_HEADERS, "Set-Cookie": clearSessionCookieHeader() } },
  );
}
