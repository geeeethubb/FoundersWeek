/**
 * Database access. One small interface over two drivers — any standard Postgres works:
 * - `postgres://…` → hosted Postgres via postgres.js: Vercel Storage (Neon), an existing Supabase
 *   project, Railway, RDS, a local server… Tables are created automatically on first use
 *   (DATABASE_AUTO_MIGRATE, default on), or ahead of time with `npm run db:migrate`.
 * - `pglite:<dir>` → an embedded Postgres (PGlite) stored on local disk, for zero-setup local
 *   development or a single self-hosted machine. Refused on Vercel (no persistent disk).
 *
 * DATABASE_SCHEMA (optional) keeps every table in its own schema, e.g. `founders_week`, so the app
 * can share a database/project with something else without touching its tables.
 *
 * Write SQL with $1, $2… placeholders and unqualified table names. Cast bigint results
 * (e.g. `count(*)::int`) — the two drivers return int8 differently.
 */
import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  applyMigrations,
  normalizePostgresUrl,
  normalizeSchemaName,
  pgliteAdapter,
  postgresAdapter,
  searchPathStatement,
} from "@/db/migrate-core.mjs";

export { normalizePostgresUrl };

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Database extends Queryable {
  kind: "postgres" | "pglite";
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /** Close connections (tests/scripts). The shared app connection is never closed. */
  close?: () => Promise<void>;
}

/** Latest migration the app code expects. Keep in sync with db/migrations (tested). */
export const LATEST_MIGRATION = "0001_init";

export type DatabaseConfig =
  | { ok: true; kind: "postgres"; url: string; schema: string | null; autoMigrate: boolean }
  | { ok: true; kind: "pglite"; dataDir: string; schema: string | null }
  | { ok: false; reason: "not-configured" | "misconfigured"; detail: string };

const TOOLING_PREFIX = /^(TEST|E2E|MIGRATION)_/;

/**
 * Finds the connection string. Checks DATABASE_URL, then POSTGRES_URL, then the same names with
 * a custom prefix — Vercel's Neon/Supabase integrations let you prefix their variables
 * (e.g. STORAGE_DATABASE_URL). Pooled URLs are preferred; *_UNPOOLED / *_NON_POOLING never match.
 */
export function findDatabaseUrl(env: Record<string, string | undefined> = process.env): { name: string; url: string } | null {
  for (const name of ["DATABASE_URL", "POSTGRES_URL"]) {
    const value = env[name]?.trim();
    if (value) return { name, url: value };
  }
  const prefixed = Object.keys(env)
    .filter((k) => /^[A-Z0-9_]+_(DATABASE_URL|POSTGRES_URL)$/.test(k) && !TOOLING_PREFIX.test(k))
    .sort((a, b) => Number(!a.endsWith("DATABASE_URL")) - Number(!b.endsWith("DATABASE_URL")) || a.localeCompare(b));
  for (const name of prefixed) {
    const value = env[name]?.trim();
    if (value && /^postgres(ql)?:\/\//.test(value)) return { name, url: value };
  }
  return null;
}

/** Names (never values) of variables that look like database settings — for diagnostics. */
export function databaseEnvNames(env: Record<string, string | undefined> = process.env): string[] {
  return Object.keys(env)
    .filter((k) => /(DATABASE|POSTGRES)/.test(k) && /_URL/.test(k) && !TOOLING_PREFIX.test(k) && env[k]?.trim())
    .sort();
}

export function getDatabaseConfig(env: Record<string, string | undefined> = process.env): DatabaseConfig {
  const found = findDatabaseUrl(env);
  const url = found?.url;
  if (!url) return { ok: false, reason: "not-configured", detail: "DATABASE_URL (or POSTGRES_URL) is not set." };
  let schema: string | null;
  try {
    schema = normalizeSchemaName(env.DATABASE_SCHEMA);
  } catch (error) {
    return { ok: false, reason: "misconfigured", detail: (error as Error).message };
  }
  if (url.startsWith("pglite:")) {
    if (env.VERCEL) {
      return {
        ok: false,
        reason: "misconfigured",
        detail: "PGlite (local file database) cannot be used on Vercel. Use a hosted Postgres DATABASE_URL.",
      };
    }
    const dataDir = url.slice("pglite:".length) || "./.data/pglite";
    return { ok: true, kind: "pglite", dataDir, schema };
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return { ok: true, kind: "postgres", url, schema, autoMigrate: env.DATABASE_AUTO_MIGRATE !== "false" };
  }
  return {
    ok: false,
    reason: "misconfigured",
    detail: "DATABASE_URL must start with postgres://, postgresql:// or pglite:",
  };
}

export class DatabaseUnavailableError extends Error {
  constructor(
    public readonly reason: "not-configured" | "misconfigured" | "not-migrated" | "unreachable",
    message: string,
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

// Bundled into serverless functions via outputFileTracingIncludes (next.config.ts).
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

type RawConn = { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };

async function connectPglite(dataDir: string, schema: string | null): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const resolved = dataDir.startsWith("memory://")
    ? dataDir
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), dataDir);
  // PGlite creates only the last path segment; make sure parents (e.g. ./.data) exist.
  if (!resolved.startsWith("memory://")) mkdirSync(path.dirname(resolved), { recursive: true });
  const db = await PGlite.create(resolved);
  await applyMigrations(pgliteAdapter(db), MIGRATIONS_DIR, (m) => console.info(`[db] ${m}`), { schema });
  const prelude = schema ? searchPathStatement(schema) : null;
  const wrap = (conn: RawConn): Queryable => ({
    query: async <T,>(text: string, params: unknown[] = []) => (await conn.query(text, params)).rows as T[],
  });
  const inTx = <T,>(fn: (tx: Queryable) => Promise<T>) =>
    db.transaction(async (tx) => {
      if (prelude) await tx.query(prelude);
      return fn(wrap(tx));
    });
  return {
    kind: "pglite",
    // With a dedicated schema every statement runs in a short transaction that sets search_path.
    query: prelude ? (text, params) => inTx((tx) => tx.query(text, params)) : wrap(db).query,
    transaction: inTx,
    close: () => db.close(),
  };
}

type PgConn = { unsafe: (t: string, p?: never[]) => Promise<unknown[]> };

async function connectPostgres(rawUrl: string, schema: string | null, autoMigrate: boolean): Promise<Database> {
  const postgres = (await import("postgres")).default;
  const { url, ssl } = normalizePostgresUrl(rawUrl);
  const sql = postgres(url, {
    ssl,
    // Required for transaction-mode poolers (Supabase :6543, Neon -pooler, PgBouncer); harmless elsewhere.
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const prelude = schema ? searchPathStatement(schema) : null;
  const wrap = (conn: PgConn): Queryable => ({
    query: async <T,>(text: string, params: unknown[] = []) =>
      [...(await conn.unsafe(text, params as never[]))] as T[],
  });
  // `set local search_path` only lives for one transaction — the only form that is reliable
  // through transaction-mode poolers, where consecutive statements may use different sessions.
  const inTx = <T,>(fn: (tx: Queryable) => Promise<T>) =>
    sql.begin(async (tx) => {
      if (prelude) await (tx as unknown as PgConn).unsafe(prelude);
      return fn(wrap(tx as unknown as PgConn));
    }) as Promise<T>;
  const db: Database = {
    kind: "postgres",
    query: prelude ? (text, params) => inTx((tx) => tx.query(text, params)) : wrap(sql as unknown as PgConn).query,
    transaction: inTx,
    close: () => sql.end({ timeout: 5 }),
  };

  const readVersion = async (): Promise<"ready" | "missing"> => {
    try {
      const rows = await db.query<{ version: string }>("select version from schema_migrations where version = $1", [
        LATEST_MIGRATION,
      ]);
      return rows.length ? "ready" : "missing";
    } catch (error) {
      if ((error as { code?: string }).code === "42P01") return "missing"; // table doesn't exist yet
      throw error;
    }
  };

  const fail = async (error: DatabaseUnavailableError): Promise<never> => {
    await sql.end({ timeout: 1 }).catch(() => {});
    throw error;
  };

  let state: "ready" | "missing";
  try {
    state = await readVersion();
  } catch (error) {
    return fail(
      new DatabaseUnavailableError("unreachable", `Could not connect to the database: ${(error as Error).message}`),
    );
  }
  if (state === "missing") {
    if (!autoMigrate) {
      return fail(
        new DatabaseUnavailableError(
          "not-migrated",
          `Database is missing migration ${LATEST_MIGRATION}. Run \`npm run db:migrate\` (or unset DATABASE_AUTO_MIGRATE=false).`,
        ),
      );
    }
    try {
      await applyMigrations(postgresAdapter(sql), MIGRATIONS_DIR, (m) => console.info(`[db] ${m}`), { schema });
      state = await readVersion();
    } catch (error) {
      return fail(
        new DatabaseUnavailableError(
          "not-migrated",
          `Automatic database setup failed: ${(error as Error).message}. Run \`npm run db:migrate\` and check the database user's permissions.`,
        ),
      );
    }
    if (state !== "ready") {
      return fail(new DatabaseUnavailableError("not-migrated", `Database is missing migration ${LATEST_MIGRATION}.`));
    }
  }
  return db;
}

const globalForDb = globalThis as unknown as { __foundersDb?: Promise<Database> };

/** Shared connection. Throws DatabaseUnavailableError when persistence isn't usable. */
export async function getDb(): Promise<Database> {
  if (globalForDb.__foundersDb) return globalForDb.__foundersDb;
  const config = getDatabaseConfig();
  if (!config.ok) throw new DatabaseUnavailableError(config.reason, config.detail);
  const pending =
    config.kind === "pglite"
      ? connectPglite(config.dataDir, config.schema)
      : connectPostgres(config.url, config.schema, config.autoMigrate);
  globalForDb.__foundersDb = pending;
  try {
    return await pending;
  } catch (error) {
    // Don't cache failures: a later request may succeed once the database is reachable.
    if (globalForDb.__foundersDb === pending) globalForDb.__foundersDb = undefined;
    if (error instanceof DatabaseUnavailableError) throw error;
    throw new DatabaseUnavailableError("unreachable", `Database error: ${(error as Error).message}`);
  }
}

export type PersistenceStatus =
  | { ready: true; kind: Database["kind"] }
  | { ready: false; reason: DatabaseUnavailableError["reason"]; detail: string };

/** Whether applications can actually be stored right now. Never throws. */
export async function getPersistenceStatus(): Promise<PersistenceStatus> {
  try {
    const db = await getDb();
    return { ready: true, kind: db.kind };
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return { ready: false, reason: error.reason, detail: error.message };
    }
    return { ready: false, reason: "unreachable", detail: (error as Error).message };
  }
}

/** Test helper: use an explicit database instead of DATABASE_URL. */
export function __setDbForTests(db: Database | undefined) {
  globalForDb.__foundersDb = db ? Promise.resolve(db) : undefined;
}

/** Test helper: an in-memory, fully migrated PGlite database (optionally in a dedicated schema). */
export async function createMemoryDbForTests(options: { schema?: string } = {}): Promise<Database> {
  return connectPglite("memory://", normalizeSchemaName(options.schema));
}

/** Test helper: connect to a real Postgres URL with the production code path. */
export async function connectPostgresForTests(
  url: string,
  options: { schema?: string; autoMigrate?: boolean } = {},
): Promise<Database> {
  return connectPostgres(url, normalizeSchemaName(options.schema), options.autoMigrate ?? true);
}
