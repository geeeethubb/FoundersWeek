/**
 * Deployment readiness, without secrets. Powers GET /api/health and the organizer sign-in page so
 * whoever deploys the site can see exactly which setting is missing. Never returns secret values,
 * lengths, connection strings or database host names.
 */
import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { getSite } from "@/content";
import { getAppSecret, getOrganizerPassword } from "@/lib/config";
import {
  databaseEnvNames,
  findDatabaseUrl,
  getDatabaseConfig,
  getPersistenceStatus,
  lastDatabaseFailure,
} from "@/lib/db/client";

export type SetupKey = "app-secret" | "database" | "organizer-password" | "applications-switch";

export interface SetupCheck {
  key: SetupKey;
  ok: boolean;
  /** Short, non-sensitive status, e.g. "missing", "ok (Postgres via POSTGRES_URL)". */
  status: string;
  /** What to do when not ok. */
  fix: string | null;
}

export interface SetupStatus {
  applicationsOpen: boolean;
  checks: SetupCheck[];
}


/**
 * Network probe for a connection string that won't connect. Reports only non-sensitive facts:
 * provider type, pooled/direct, port, DNS address families and whether a plain TCP connection
 * to the port succeeds — never the host name or credentials.
 */
async function probeDatabase(rawUrl: string): Promise<string> {
  let host: string;
  let port: number;
  try {
    const u = new URL(rawUrl);
    host = u.hostname;
    port = Number(u.port || 5432);
  } catch {
    return "connection string is not a valid URL";
  }
  const provider = /neon\.tech$/i.test(host)
    ? `Neon ${/-pooler\./i.test(host) ? "(pooled)" : "(direct)"}`
    : /pooler\.supabase\.com$/i.test(host)
      ? "Supabase pooler"
      : /supabase\.co$/i.test(host)
        ? "Supabase direct host (IPv6-only — unreachable from Vercel; use the pooler URI)"
        : /vercel-storage\.com$/i.test(host)
          ? "Vercel Postgres"
          : "other host";
  let dnsNote: string;
  try {
    const addresses = await dns.lookup(host, { all: true });
    const v4 = addresses.filter((a) => a.family === 4).length;
    const v6 = addresses.filter((a) => a.family === 6).length;
    dnsNote = `DNS ${v4} IPv4 / ${v6} IPv6`;
  } catch (error) {
    dnsNote = `DNS failed (${(error as { code?: string }).code ?? "error"})`;
  }
  const started = Date.now();
  const tcp = await new Promise<string>((resolve) => {
    const socket = net.connect({ host, port, timeout: 6000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(`TCP ok in ${Date.now() - started}ms`);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve("TCP timed out after 6s");
    });
    socket.once("error", (e) => resolve(`TCP error ${(e as { code?: string }).code ?? "unknown"}`));
  });
  return `${provider}, port ${port}, ${dnsNote}, ${tcp}`;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const checks: SetupCheck[] = [];
  const env = process.env;

  // 1. Signing secret (status links, organizer sessions). Required in production.
  const rawSecret = env.APP_SECRET?.trim() ?? "";
  const secretOk = Boolean(getAppSecret()) && (rawSecret.length >= 32 || env.NODE_ENV !== "production");
  checks.push({
    key: "app-secret",
    ok: secretOk,
    status: rawSecret.length >= 32 ? "ok" : rawSecret.length > 0 ? "too short (needs at least 32 characters)" : env.NODE_ENV === "production" ? "missing" : "missing (development fallback in use)",
    fix: secretOk
      ? null
      : "Add APP_SECRET (32+ random characters) to the Production environment in Vercel, then redeploy.",
  });

  // 2. Database.
  const config = getDatabaseConfig();
  const source = findDatabaseUrl(env)?.name ?? null;
  if (!config.ok) {
    const seen = databaseEnvNames(env);
    checks.push({
      key: "database",
      ok: false,
      status:
        config.reason === "not-configured"
          ? `missing — no DATABASE_URL or POSTGRES_URL in this deployment${seen.length ? ` (found: ${seen.join(", ")})` : ""}`
          : "misconfigured",
      fix:
        config.reason === "not-configured"
          ? "In Vercel → Storage, connect the database to this project with the Production environment ticked (or add DATABASE_URL manually), then redeploy."
          : "DATABASE_URL must be a postgres:// or postgresql:// connection string (PGlite can't be used on Vercel).",
    });
  } else {
    const persistence = await getPersistenceStatus();
    const failure = lastDatabaseFailure();
    const found = findDatabaseUrl(env);
    const probe = !persistence.ready && found && config.kind === "postgres" ? await probeDatabase(found.url) : null;
    const failureNote = failure
      ? ` — using ${found?.name ?? "?"}; ${failure.stage} step${failure.code ? ` (${failure.code})` : ""}: ${failure.message}${probe ? `; probe: ${probe}` : ""}`
      : probe
        ? ` — using ${found?.name ?? "?"}; probe: ${probe}`
        : "";
    const via = config.kind === "pglite" ? "local PGlite" : `Postgres via ${source ?? "DATABASE_URL"}`;
    const schema = config.schema ? `, schema "${config.schema}"` : "";
    checks.push(
      persistence.ready
        ? { key: "database", ok: true, status: `ok (${via}${schema})`, fix: null }
        : {
            key: "database",
            ok: false,
            status:
              (persistence.reason === "not-migrated"
                ? "reachable, but tables could not be created"
                : persistence.reason === "unreachable"
                  ? "could not connect"
                  : persistence.reason) + failureNote,
            fix:
              persistence.reason === "unreachable"
                ? "Check the connection string (for Supabase use the Transaction pooler URI on port 6543) and the database password, then redeploy. Server logs show the exact error."
                : "Run `npm run db:migrate` with this DATABASE_URL, or check that the database user can create tables.",
          },
    );
  }

  // 3. Organizer sign-in.
  const organizerOk = Boolean(getOrganizerPassword());
  checks.push({
    key: "organizer-password",
    ok: organizerOk,
    status: organizerOk ? "ok" : env.ORGANIZER_PASSWORD ? "too short (needs at least 12 characters)" : "missing",
    fix: organizerOk ? null : "Add ORGANIZER_PASSWORD (12+ characters) to the Production environment in Vercel, then redeploy.",
  });

  // 4. Content switch.
  const switchOn = getSite().applications.open;
  checks.push({
    key: "applications-switch",
    ok: switchOn,
    status: switchOn ? "open" : "closed in content/site.ts",
    fix: switchOn ? null : "Set applications.open to true in content/site.ts.",
  });

  const applicationsOpen = checks.filter((c) => c.key !== "organizer-password").every((c) => c.ok);
  return { applicationsOpen, checks };
}
