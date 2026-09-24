import "server-only";
import type { Database, Queryable } from "@/lib/db/client";
import { hashIdentifier } from "./crypto";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Sliding-window limiter backed by the database, so it holds across serverless instances.
 * Counts the attempt when allowed. The count and the insert run in one transaction under a
 * per-key advisory lock, so a burst of parallel requests can't all slip under the limit.
 */
export async function consumeRateLimit(
  db: Pick<Database, "transaction">,
  options: { bucket: string; key: string; limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const keyHash = hashIdentifier(options.bucket, options.key);
  return db.transaction(async (tx) => {
    await tx.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`rate:${options.bucket}:${keyHash}`]);
    const [row] = await tx.query<{ n: number; oldest: Date | string | null }>(
      `select count(*)::int as n, min(at) as oldest
         from rate_limit_events
        where bucket = $1 and key_hash = $2 and at > now() - ($3::int * interval '1 second')`,
      [options.bucket, keyHash, options.windowSeconds],
    );
    if (row && row.n >= options.limit) {
      return { allowed: false, retryAfterSeconds: retryAfter(row.oldest, options.windowSeconds) };
    }
    await tx.query(`insert into rate_limit_events (bucket, key_hash) values ($1, $2)`, [options.bucket, keyHash]);
    // Housekeeping: drop this key's stale rows.
    await tx.query(
      `delete from rate_limit_events where bucket = $1 and key_hash = $2 and at < now() - interval '2 days'`,
      [options.bucket, keyHash],
    );
    return { allowed: true, retryAfterSeconds: 0 };
  });
}

/** Seconds until the oldest counted event leaves the window (at least 1). */
export function retryAfter(oldest: Date | string | null, windowSeconds: number): number {
  const start = oldest ? new Date(oldest).getTime() : Date.now();
  return Math.max(1, Math.ceil((start + windowSeconds * 1000 - Date.now()) / 1000));
}

/** Clear a key's history (e.g. after a successful organizer sign-in). */
export async function resetRateLimit(db: Queryable, bucket: string, key: string): Promise<void> {
  await db.query(`delete from rate_limit_events where bucket = $1 and key_hash = $2`, [
    bucket,
    hashIdentifier(bucket, key),
  ]);
}
