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
  const handshake = tcp.startsWith("TCP ok") ? await probeHandshake(rawUrl, host, port) : "";
  return `${provider}, port ${port}, ${dnsNote}, ${tcp}${handshake ? `, ${handshake}` : ""}`;
}

/**
 * Walks the Postgres wire handshake by hand (SSLRequest → TLS → StartupMessage) and reports how far
 * it gets, then tries the driver without its type lookup. Only step results are returned.
 */
async function probeHandshake(rawUrl: string, host: string, port: number): Promise<string> {
  const tls = await import("node:tls");
  const u = new URL(rawUrl);
  const user = decodeURIComponent(u.username);
  const database = decodeURIComponent(u.pathname.slice(1)) || user;
  const steps: string[] = [];
  await new Promise<void>((resolve) => {
    const socket = net.connect({ host, port });
    const done = (note: string) => {
      steps.push(note);
      socket.destroy();
      resolve();
    };
    const timer = setTimeout(() => done(`handshake stalled after: ${steps.join(" → ") || "connect"}`), 7000);
    socket.once("error", (e) => {
      clearTimeout(timer);
      done(`socket error ${(e as { code?: string }).code ?? ""}`);
    });
    socket.once("connect", () => {
      const ssl = Buffer.alloc(8);
      ssl.writeInt32BE(8, 0);
      ssl.writeInt32BE(80877103, 4);
      socket.write(ssl);
      socket.once("data", (d) => {
        steps.push(`SSL reply ${String.fromCharCode(d[0])}`);
        if (d[0] !== 83) {
          clearTimeout(timer);
          return done("server refused SSL");
        }
        const started = Date.now();
        const secure = tls.connect({ socket, servername: host, rejectUnauthorized: false });
        secure.once("error", (e) => {
          clearTimeout(timer);
          done(`TLS error ${(e as { code?: string }).code ?? sanitizeForProbe((e as Error).message)}`);
        });
        secure.once("secureConnect", () => {
          steps.push(`TLS ok ${Date.now() - started}ms`);
          const params = Buffer.from(`user\0${user}\0database\0${database}\0\0`);
          const startup = Buffer.alloc(8 + params.length);
          startup.writeInt32BE(8 + params.length, 0);
          startup.writeInt32BE(196608, 4);
          params.copy(startup, 8);
          secure.write(startup);
          secure.once("data", (m) => {
            clearTimeout(timer);
            const type = String.fromCharCode(m[0]);
            if (type === "R") done(`startup → auth request ${m.readInt32BE(5)}`);
            else if (type === "E") {
              const text = m.toString("utf8", 5).split("\0").find((f: string) => f.startsWith("M"))?.slice(1) ?? "error";
              done(`startup → error: ${sanitizeForProbe(text)}`);
            } else done(`startup → message ${type}`);
            secure.destroy();
          });
        });
      });
    });
  });
  // The real driver in several shapes, to isolate what differs from the app's own connection:
  // A = the app's exact options + simple-protocol query; B = app options + extended protocol;
  // C = single connection + simple protocol; D = single connection + extended protocol.
  try {
    const postgres = (await import("postgres")).default;
    const { normalizePostgresUrl } = await import("@/db/migrate-core.mjs");
    const { url, ssl } = normalizePostgresUrl(rawUrl);
    const appOptions = { ssl, prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10, fetch_types: false, onnotice: () => {} };
    const singleOptions = { ssl, prepare: false, max: 1, connect_timeout: 8, fetch_types: false, onnotice: () => {} };
    const variants: [string, typeof appOptions | typeof singleOptions, boolean][] = [
      ["A", appOptions, true],
      ["B", appOptions, false],
      ["C", singleOptions, true],
      ["D", singleOptions, false],
    ];
    for (const [name, options, simple] of variants) {
      const sql = postgres(url, options);
      const started = Date.now();
      const query = simple ? sql.unsafe("select 1") : sql.unsafe("select $1::int as ok", [1]);
      const result = await Promise.race([
        query.then(() => `${name} ok ${Date.now() - started}ms`),
        new Promise<string>((r) => setTimeout(() => r(`${name} timed out`), 6000)),
      ]).catch((e: Error & { code?: string }) => `${name} error ${e.code ?? ""} ${sanitizeForProbe(e.message)}`);
      sql.end({ timeout: 1 }).catch(() => {});
      steps.push(result);
    }
  } catch (e) {
    steps.push(`driver probe failed: ${sanitizeForProbe((e as Error).message)}`);
  }
  return steps.join("; ");
}

function sanitizeForProbe(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[connection string]")
    .replace(/\b(?:[a-z0-9-]+\.)+(?:tech|co|com|net|org|io|dev|app|cloud)\b/gi, "[host]")
    .replace(/\bep-[a-z0-9-]+\b/gi, "[endpoint]")
    .slice(0, 160);
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
