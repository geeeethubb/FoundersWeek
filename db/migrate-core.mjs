// Shared migration runner used by `npm run db:migrate` (scripts/db-migrate.mjs), by the app's
// automatic setup on first connection (lib/db/client.ts), and by local PGlite databases.
//
// An adapter provides:
//   exec(sql)                 run one or more statements (no parameters)
//   query(sql, params)        run one parameterized statement, resolve to rows
//   transaction(fn)           run fn(txAdapter) atomically
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;
const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export const SCHEMA_MIGRATIONS_SQL =
  "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())";

/** Validates an optional dedicated schema name (DATABASE_SCHEMA). Returns null for "use public". */
export function normalizeSchemaName(value) {
  const v = (value ?? "").trim();
  if (!v || v === "public") return null;
  if (!SCHEMA_NAME.test(v)) {
    throw new Error(`Invalid DATABASE_SCHEMA "${v}": use lowercase letters, digits and underscores.`);
  }
  return v;
}

/** `set local search_path` statement for a dedicated schema (validated name, so safe to inline). */
export function searchPathStatement(schema) {
  return `set local search_path to "${schema}"`;
}

export async function listMigrations(dir) {
  const files = (await readdir(dir)).filter((f) => MIGRATION_FILE.test(f)).sort();
  return Promise.all(
    files.map(async (file) => ({
      version: file.replace(/\.sql$/, ""),
      sql: await readFile(path.join(dir, file), "utf8"),
    })),
  );
}

/**
 * Apply pending migrations in ONE transaction, serialized by an advisory lock so concurrent
 * starts (several serverless instances waking up at once) can't race. Idempotent.
 * With `schema`, everything is created inside that schema (created if missing).
 */
export async function applyMigrations(adapter, dir, log = () => {}, options = {}) {
  const schema = normalizeSchemaName(options.schema);
  const migrations = await listMigrations(dir);
  return adapter.transaction(async (tx) => {
    // e.g. ["set local lock_timeout = '10s'"] so a stuck concurrent setup can't block forever.
    for (const statement of options.sessionSettings ?? []) await tx.exec(statement);
    await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `founders-week:migrations:${schema ?? "public"}`,
    ]);
    if (schema) {
      await tx.exec(`create schema if not exists "${schema}"`);
      await tx.exec(searchPathStatement(schema));
    }
    await tx.exec(SCHEMA_MIGRATIONS_SQL);
    const rows = await tx.query("select version from schema_migrations", []);
    const applied = new Set(rows.map((r) => r.version));
    const pending = migrations.filter((m) => !applied.has(m.version));
    for (const migration of pending) {
      await tx.exec(migration.sql);
      await tx.query("insert into schema_migrations (version) values ($1) on conflict (version) do nothing", [
        migration.version,
      ]);
      log(`applied ${migration.version}${schema ? ` in schema "${schema}"` : ""}`);
    }
    return pending.map((m) => m.version);
  });
}

/** Adapter for an @electric-sql/pglite instance. */
export function pgliteAdapter(db) {
  const wrap = (conn) => ({
    exec: async (sql) => {
      await conn.exec(sql);
    },
    query: async (sql, params = []) => (await conn.query(sql, params)).rows,
  });
  return {
    ...wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
  };
}

/** Adapter for a `postgres` (postgres.js) client. */
export function postgresAdapter(sql) {
  const wrap = (conn) => ({
    exec: async (text) => {
      await conn.unsafe(text).simple();
    },
    query: async (text, params = []) => [...(await conn.unsafe(text, params))],
  });
  return {
    ...wrap(sql),
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx))),
  };
}

/** Managed Postgres hosts that always require TLS. */
const TLS_HOSTS = /(^|\.)(supabase\.co|supabase\.com|neon\.tech|vercel-storage\.com|aivencloud\.com|render\.com)$/i;

/**
 * Hosted connection strings often carry driver-specific query flags (e.g. Vercel/Supabase's
 * `supa=base-pooler.x`, Prisma's `pgbouncer=true`, Neon's `channel_binding=require`). postgres.js
 * would forward unknown flags to the server as startup parameters, which Postgres rejects — so keep
 * only `sslmode` and translate it. Known managed hosts always use TLS.
 */
export function normalizePostgresUrl(raw) {
  const parsed = new URL(raw);
  const mode = parsed.searchParams.get("sslmode")?.toLowerCase() ?? null;
  parsed.search = "";
  const managed = TLS_HOSTS.test(parsed.hostname);
  let ssl;
  if (mode === "disable") ssl = false;
  else if (mode === "verify-full" || mode === "verify-ca") ssl = "verify-full";
  else if (mode === "require") ssl = "require";
  else if (mode === "prefer" || mode === "allow") ssl = "prefer";
  else ssl = managed ? "require" : false;
  return { url: parsed.toString(), ssl };
}
