/**
 * "Data store" indicator for the organizer dashboard: which persistence is active (hosted
 * Postgres/Supabase vs. local PGlite) and whether it's usable right now — so organizers see
 * immediately when the live database isn't connected.
 *
 * Never exposes connection strings, hosts, users or passwords: the provider is reduced to a label
 * on the server, and the only free text (a setup hint on non-production deploys) is redacted.
 */
import "server-only";
import { isNonProductionDeploy } from "@/lib/config";
import { getDatabaseConfig, getDb, getPersistenceStatus, LATEST_MIGRATION, type PersistenceStatus } from "@/lib/db/client";
import { connectionValues, redactConnectionDetails } from "@/lib/security/redact";
import { describeDataStore, type DataStoreStatus } from "./data-store-view";

export type { DataStoreStatus } from "./data-store-view";

const PING_TIMEOUT_MS = 2500;

/** "Supabase" when the connection points at Supabase's hosts; the host itself never leaves here. */
export function postgresProvider(url: string): "supabase" | "postgres" {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)supabase\.(co|com|net)$/.test(host) ? "supabase" : "postgres";
  } catch {
    return "postgres";
  }
}

/** Values of the configured connection string that must never appear in a hint. */
function knownConnectionValues() {
  const config = getDatabaseConfig();
  return config.ok && config.kind === "postgres" ? connectionValues(config.url) : undefined;
}

/**
 * A persistence error message (driver text) made safe for preview-deploy hints on the sign-in and
 * application pages: no connection string, credentials, user or database name, host or address.
 */
export function redactDatabaseDetail(detail: string): string {
  return redactConnectionDetails(detail, knownConnectionValues());
}

async function ping(): Promise<string | null> {
  try {
    const db = await getDb();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("The database did not respond in time.")), PING_TIMEOUT_MS);
    });
    try {
      await Promise.race([db.query("select 1"), timeout]);
    } finally {
      clearTimeout(timer);
    }
    return null;
  } catch (error) {
    return (error as Error).message || "The database did not respond.";
  }
}

/**
 * Current data-store status. Pings the shared connection (a cached connection can go stale),
 * so a database that went away after start-up shows as disconnected. Never throws.
 */
export async function getDataStoreStatus(now: Date = new Date()): Promise<DataStoreStatus> {
  const config = getDatabaseConfig();
  let persistence: PersistenceStatus = await getPersistenceStatus();
  if (persistence.ready) {
    const failure = await ping();
    if (failure) persistence = { ready: false, reason: "unreachable", detail: failure };
  }
  return describeDataStore({
    persistence,
    provider: config.ok ? (config.kind === "postgres" ? postgresProvider(config.url) : "pglite") : null,
    schema: LATEST_MIGRATION,
    showHints: isNonProductionDeploy(),
    checkedAt: now.toISOString(),
    known: knownConnectionValues(),
  });
}
