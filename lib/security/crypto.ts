import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppSecret } from "@/lib/config";

export class MissingSecretError extends Error {
  constructor() {
    super("APP_SECRET is not configured.");
    this.name = "MissingSecretError";
  }
}

export function requireAppSecret(): string {
  const secret = getAppSecret();
  if (!secret) throw new MissingSecretError();
  return secret;
}

/** HMAC-SHA256 of `data`, domain-separated by `purpose`, as base64url. */
export function sign(purpose: string, data: string, secret: string = requireAppSecret()): string {
  return createHmac("sha256", secret).update(`${purpose}\u0000${data}`).digest("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still spend comparable time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Pseudonymous identifier (e.g. for IPs) — stable per secret, not reversible. */
export function hashIdentifier(bucket: string, value: string): string {
  return sign(`id:${bucket}`, value).slice(0, 32);
}
