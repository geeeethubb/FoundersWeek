/**
 * Redaction for diagnostics derived from database driver errors and network probes, shown on
 * GET /api/health and the organizer sign-in page's Setup checklist (both public) and in preview
 * hints. What stays: our own wording, stages, error codes ("ECONNREFUSED", "28P01"), timings and
 * provider labels. What goes: anything that could identify or unlock the database.
 *
 * - connection strings and `user:password@host` fragments
 * - `password=…` style secrets and libpq `user=… dbname=… host=…` settings
 * - double-quoted identifiers, which is how Postgres names users, roles, databases and hosts in
 *   its errors (`password authentication failed for user "neondb_owner"`)
 * - IPv4 and IPv6 addresses (bare or `[bracketed]`, with ports), `localhost`
 * - host names (`db.<ref>.supabase.co`, `ep-….neon.tech`, `postgres.<ref>`) and Neon endpoint ids
 * - optionally, the literal user, database and host of the configured connection string
 *
 * Pure (no environment access) — safe on server and client.
 */

const HOST = "[host hidden]";

/** Values from the configured connection string that must never appear in diagnostics. */
export interface KnownConnectionValues {
  user?: string | null;
  database?: string | null;
  host?: string | null;
}

/** User, database and host of a postgres:// URL (empty when it doesn't parse). */
export function connectionValues(rawUrl: string | null | undefined): KnownConnectionValues {
  if (!rawUrl) return {};
  try {
    const u = new URL(rawUrl);
    const decode = (v: string) => {
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    };
    return { user: decode(u.username), database: decode(u.pathname.replace(/^\//, "")), host: u.hostname };
  } catch {
    return {};
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactConnectionDetails(text: string, known: KnownConnectionValues = {}): string {
  let out = text
    // Connection strings and URLs (postgres://user:pass@host/db, https://…).
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>]+/gi, "[connection string hidden]")
    // user:password@host and user@host fragments.
    .replace(/[^\s:@/"'()[\]]+:[^\s@/]+@[^\s/'"]+/g, "[credentials hidden]")
    .replace(/[^\s@"'()[\]]+@[^\s'"()[\]]+/g, "[credentials hidden]");
  // The configured user, database and host, wherever a driver repeats them. Very short values
  // ("db", "pg") would mangle ordinary words; the generic rules below still cover those.
  for (const value of [known.host, known.user, known.database]) {
    const v = value?.trim();
    if (v && v.length >= 3) out = out.replace(new RegExp(escapeRegExp(v), "gi"), "[hidden]");
  }
  return (
    out
      // key=value secrets, and libpq-style identity settings (only with "=": "the database: …"
      // in our own messages is not a setting).
      .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|sslpassword)\s*[=:]\s*\S+/gi, "$1=[hidden]")
      .replace(/\b(user|username|role|dbname|database|db|host|hostaddr|server|endpoint|options)\s*=\s*\S+/gi, "$1=[hidden]")
      // Postgres quotes identifiers: user "x", role "x", database "x", host "x", endpoint "x".
      .replace(/"[^"\r\n]*"/g, '"[hidden]"')
      // Unquoted names after "for user" / "no such user" (poolers, older servers).
      .replace(/\b(for (?:user|role|database)|no such (?:user|role|database):?)\s+(?!\[|")[^\s,;()]+/gi, "$1 [hidden]")
      // IPv6 in brackets (with port), then IPv6 with an IPv4 tail or bare, then IPv4.
      .replace(/\[[0-9a-f:.%]+\](?::\d+)?/gi, HOST)
      .replace(
        /(?<![0-9a-z:.])(?:[0-9a-f]{0,4}:){2,7}(?:\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?|[0-9a-f]{1,4})(?:%[0-9a-z]+)?(?![0-9a-z:.])/gi,
        HOST,
      )
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, HOST)
      .replace(/\blocalhost(?::\d+)?\b/gi, HOST)
      // Host names: any dotted name ending in letters (db.x.supabase.co, x.neon.tech:5432, and
      // Supabase pooler user names like postgres.<ref>).
      .replace(/\b(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*[a-z0-9](?::\d+)?\b/gi, HOST)
      // Neon endpoint ids on their own ("endpoint ep-cool-name-123456 not found").
      .replace(/\bep-[a-z0-9]+(?:-[a-z0-9]+)*/gi, "[endpoint hidden]")
  );
}
