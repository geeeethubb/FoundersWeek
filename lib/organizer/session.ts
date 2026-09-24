/**
 * Organizer sessions. A single shared password (ORGANIZER_PASSWORD) unlocks the organizer view;
 * the organizer also gives their name so the activity log says who did what.
 *
 * Cookie `fw_organizer` = base64url(JSON payload) + "." + HMAC(payload):
 *   { v: 1, name, iat, exp, pwv }   (iat/exp in seconds since the epoch)
 * - `pwv` is derived from the current password, so rotating ORGANIZER_PASSWORD signs everyone out.
 * - 12-hour lifetime, httpOnly, SameSite=Strict, Secure in production.
 *
 * Pure functions take `password`/`now` explicitly so they are easy to test; the request helpers
 * read the environment.
 */
import "server-only";
import { getOrganizerPassword } from "@/lib/config";
import { safeEqual, sign } from "@/lib/security/crypto";

export const SESSION_COOKIE = "fw_organizer";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_PURPOSE = "organizer-session:v1";
const PASSWORD_VERSION_PURPOSE = "organizer-password-version";
const PASSWORD_CHECK_PURPOSE = "organizer-password-check";
/** Tolerated clock skew for `iat` in the future (multiple serverless instances). */
const CLOCK_SKEW_SECONDS = 60;

export const ORGANIZER_NAME_MAX = 60;

export interface OrganizerSession {
  v: 1;
  /** Display name given at sign-in; recorded in the activity log. */
  name: string;
  iat: number;
  exp: number;
  pwv: string;
}

const nowSeconds = (now: Date) => Math.floor(now.getTime() / 1000);

/** Short fingerprint of the password. Changes whenever the password changes. */
export function passwordVersion(password: string): string {
  return sign(PASSWORD_VERSION_PURPOSE, password).slice(0, 16);
}

/**
 * Constant-time password check. Both sides are HMAC'd first so the comparison doesn't leak the
 * password length.
 */
export function checkOrganizerPassword(candidate: string, password: string): boolean {
  return safeEqual(sign(PASSWORD_CHECK_PURPOSE, candidate), sign(PASSWORD_CHECK_PURPOSE, password));
}

export function createSessionToken(options: { name: string; password: string; now?: Date }): string {
  const iat = nowSeconds(options.now ?? new Date());
  const payload: OrganizerSession = {
    v: 1,
    name: options.name,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
    pwv: passwordVersion(options.password),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(SESSION_PURPOSE, encoded)}`;
}

/** Returns the session when the token is authentic, unexpired and for the current password. */
export function verifySessionToken(
  token: string | null | undefined,
  options: { password: string | null; now?: Date },
): OrganizerSession | null {
  if (!token || !options.password || token.length > 2048) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(SESSION_PURPOSE, encoded))) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<OrganizerSession>;
  if (
    p.v !== 1 ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > ORGANIZER_NAME_MAX ||
    typeof p.iat !== "number" ||
    typeof p.exp !== "number" ||
    typeof p.pwv !== "string"
  ) {
    return null;
  }
  const now = nowSeconds(options.now ?? new Date());
  if (p.exp <= now) return null;
  if (p.iat > now + CLOCK_SKEW_SECONDS) return null;
  if (p.exp - p.iat > SESSION_TTL_SECONDS) return null;
  if (!safeEqual(p.pwv, passwordVersion(options.password))) return null;
  return { v: 1, name: p.name, iat: p.iat, exp: p.exp, pwv: p.pwv };
}

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/** `Set-Cookie` value that stores a session. */
export function sessionCookieHeader(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
    secureCookies() ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** `Set-Cookie` value that clears the session. */
export function clearSessionCookieHeader(): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Strict",
    secureCookies() ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Read one cookie from a raw `Cookie` header. */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Session from an API request's Cookie header (route handlers; testable without Next). */
export function getSessionFromRequest(request: Request, now: Date = new Date()): OrganizerSession | null {
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE), {
    password: getOrganizerPassword(),
    now,
  });
}

/** Session from a raw cookie value (server components read it via `cookies()`). */
export function getSessionFromCookieValue(value: string | undefined, now: Date = new Date()): OrganizerSession | null {
  return verifySessionToken(value, { password: getOrganizerPassword(), now });
}
