/**
 * Private status links for applicants (no accounts). The token is `<applicationId>.<signature>`,
 * where the signature is an HMAC of the id — so links can be re-issued without storing secrets,
 * and a guessed id alone reveals nothing.
 */
import "server-only";
import { safeEqual, sign } from "./crypto";

const PURPOSE = "application-status-link:v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createStatusToken(applicationId: string): string {
  return `${applicationId}.${sign(PURPOSE, applicationId).slice(0, 32)}`;
}

/** Returns the application id when the token is authentic, else null. */
export function verifyStatusToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!UUID_RE.test(id) || sig.length !== 32) return null;
  return safeEqual(sig, sign(PURPOSE, id).slice(0, 32)) ? id.toLowerCase() : null;
}

export function statusPath(applicationId: string): string {
  return `/apply/status/${createStatusToken(applicationId)}`;
}
