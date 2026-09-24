/**
 * Pure presentation rules for the organizer "Data store" indicator (see ./data-store.ts).
 * Safe on server and client; no environment access.
 */
import type { PersistenceStatus } from "@/lib/db/client";

export type DataStoreState = "live" | "local" | "down";

export interface DataStoreStatus {
  /**
   * - `live`: hosted Postgres (e.g. Supabase) connected — the real application database.
   * - `local`: embedded PGlite on this machine — development only, not the live database.
   * - `down`: nothing usable; applications can't be read or stored.
   */
  state: DataStoreState;
  /** "Supabase · Postgres", "Postgres", "PGlite · local file", "Not configured"… */
  provider: string;
  /** One-line status, e.g. "Live database connected". */
  headline: string;
  /** Plain-language explanation for organizers. */
  detail: string;
  /** Expected schema version (shown when connected). */
  schema: string | null;
  /** Setup hint for non-production deploys, redacted. `null` in production. */
  hint: string | null;
  checkedAt: string;
}

const REASON_COPY: Record<Extract<PersistenceStatus, { ready: false }>["reason"], { headline: string; detail: string }> = {
  "not-configured": {
    headline: "No database configured",
    detail: "Applications can’t be saved or reviewed until DATABASE_URL (or POSTGRES_URL) is set.",
  },
  misconfigured: {
    headline: "Database misconfigured",
    detail: "The database setting on this deployment doesn’t work, so applications can’t be saved or reviewed.",
  },
  "not-migrated": {
    headline: "Database schema missing",
    detail: "The database is reachable, but its tables haven’t been created yet. Run the migrations.",
  },
  unreachable: {
    headline: "Database not connected",
    detail: "The application database isn’t responding. Nothing is lost, but reviewing is on hold until it’s back.",
  },
};

/**
 * Remove anything that could be a credential or part of a connection string from free text:
 * URLs (postgres://user:pass@host/db…), `user:password@host` fragments, key=value secrets, and
 * hosts/IPs (driver errors such as "ECONNREFUSED 10.0.0.5:5432" or "ENOTFOUND db.<ref>.supabase.co"
 * would otherwise reveal the database host — the login page shows this text on preview deploys).
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>]+/gi, "[connection string hidden]")
    .replace(/\b[^\s:@/]+:[^\s@/]+@[^\s/'"]+/g, "[credentials hidden]")
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|sslpassword)\s*[=:]\s*\S+/gi, "$1=[hidden]")
    .replace(/\[[0-9a-f:.]+\](?::\d+)?/gi, "[host hidden]")
    .replace(/(^|[\s(])::1(?::\d+)?\b/g, "$1[host hidden]")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, "[host hidden]")
    .replace(/\blocalhost(?::\d+)?\b/gi, "[host hidden]")
    .replace(
      /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|dev|app|cloud|internal|local|tech|ai|xyz)(?::\d+)?\b/gi,
      "[host hidden]",
    );
}

const PROVIDER_LABELS = {
  supabase: "Supabase · Postgres",
  postgres: "Postgres",
  pglite: "PGlite · local file",
} as const;

export function describeDataStore(input: {
  persistence: PersistenceStatus;
  /** Configured engine/provider, or null when nothing (valid) is configured. */
  provider: keyof typeof PROVIDER_LABELS | null;
  schema: string;
  showHints: boolean;
  checkedAt: string;
}): DataStoreStatus {
  const provider = input.provider ? PROVIDER_LABELS[input.provider] : "Not configured";
  const base = { provider, checkedAt: input.checkedAt };

  if (!input.persistence.ready) {
    const copy = REASON_COPY[input.persistence.reason];
    return {
      ...base,
      state: "down",
      headline: copy.headline,
      detail: copy.detail,
      schema: null,
      hint: input.showHints ? `${redactSecrets(input.persistence.detail)} See README → Database.` : null,
    };
  }

  if (input.persistence.kind === "pglite") {
    return {
      ...base,
      provider: PROVIDER_LABELS.pglite,
      state: "local",
      headline: "Local database",
      detail: "A development database on this machine, not the live one. Applications sent to the live site won’t show up here.",
      schema: input.schema,
      hint: null,
    };
  }

  return {
    ...base,
    provider: input.provider === "supabase" ? PROVIDER_LABELS.supabase : PROVIDER_LABELS.postgres,
    state: "live",
    headline: "Live database connected",
    detail: "Applications are saved to the hosted database and show up here as soon as students submit.",
    schema: input.schema,
    hint: null,
  };
}
