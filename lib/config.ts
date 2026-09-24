/**
 * Server configuration from environment variables. Secrets never leave the server:
 * nothing here is NEXT_PUBLIC_ except the site URL.
 */
import "server-only";

const DEV_APP_SECRET = "dev-only-insecure-app-secret-do-not-use-in-production";
let warnedDevSecret = false;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True on anything that isn't a Vercel production deploy (local, previews). */
export function isNonProductionDeploy(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

/**
 * Secret for signing organizer sessions and student status links (HMAC-SHA256).
 * Must be ≥ 32 characters. In local development a fixed dev secret is used if unset.
 */
export function getAppSecret(): string | null {
  const secret = process.env.APP_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (!isProductionRuntime()) {
    if (!warnedDevSecret) {
      console.warn("[config] APP_SECRET is not set (or < 32 chars); using an insecure development secret.");
      warnedDevSecret = true;
    }
    return DEV_APP_SECRET;
  }
  return null;
}

/** Shared organizer password (≥ 12 characters). `null` disables organizer sign-in. */
export function getOrganizerPassword(): string | null {
  const pw = process.env.ORGANIZER_PASSWORD;
  return pw && pw.length >= 12 ? pw : null;
}

/** Transactional email via Resend's HTTP API. `null` = acknowledgments are not sent. */
export function getEmailConfig(): { apiKey: string; from: string; replyTo: string | null } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO?.trim() || null };
}

/** Canonical site origin for metadata, share links and emails. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
