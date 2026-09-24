import "server-only";
import type { Queryable } from "@/lib/db/client";
import { hashIdentifier } from "./crypto";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Sliding-window limiter backed by the database, so it holds across serverless instances.
 * Counts the attempt when allowed.
 */
export async function consumeRateLimit(
  db: Queryable,
  options: { bucket: string; key: string; limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const keyHash = hashIdentifier(options.bucket, options.key);
  const [row] = await db.query<{ n: number; oldest: Date | string | null }>(
    `select count(*)::int as n, min(at) as oldest
       from rate_limit_events
      where bucket = $1 and key_hash = $2 and at > now() - ($3::int * interval '1 second')`,
    [options.bucket, keyHash, options.windowSeconds],
  );
  if (row && row.n >= options.limit) {
    const oldest = row.oldest ? new Date(row.oldest).getTime() : Date.now();
    const retry = Math.max(1, Math.ceil((oldest + options.windowSeconds * 1000 - Date.now()) / 1000));
    return { allowed: false, retryAfterSeconds: retry };
  }
  await db.query(`insert into rate_limit_events (bucket, key_hash) values ($1, $2)`, [options.bucket, keyHash]);
  // Housekeeping: drop this key's stale rows.
  await db.query(`delete from rate_limit_events where bucket = $1 and key_hash = $2 and at < now() - interval '2 days'`, [
    options.bucket,
    keyHash,
  ]);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clear a key's history (e.g. after a successful organizer sign-in). */
export async function resetRateLimit(db: Queryable, bucket: string, key: string): Promise<void> {
  await db.query(`delete from rate_limit_events where bucket = $1 and key_hash = $2`, [
    bucket,
    hashIdentifier(bucket, key),
  ]);
}
