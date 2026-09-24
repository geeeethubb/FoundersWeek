// Apply database migrations in db/migrations to DATABASE_URL.
//
//   npm run db:migrate                 # uses DATABASE_URL from the environment / .env.local
//   DATABASE_URL=postgres://… npm run db:migrate
//
// Supports postgres:// (Neon via Vercel Storage, Supabase, any Postgres) and pglite:<dir> (local).
// The app also does this automatically on first use (DATABASE_AUTO_MIGRATE, default on).
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyMigrations,
  normalizePostgresUrl,
  normalizeSchemaName,
  pgliteAdapter,
  postgresAdapter,
} from "../db/migrate-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "db", "migrations");
// MIGRATION_DATABASE_URL lets you migrate through a different (e.g. session-mode) connection.
const url = (process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();

if (!url) {
  console.error("DATABASE_URL (or POSTGRES_URL) is not set. Add it to .env.local or the environment. See README → Database.");
  process.exit(1);
}

const log = (m) => console.log(`✓ ${m}`);
// Optional dedicated schema (e.g. to share an existing Supabase project): DATABASE_SCHEMA=founders_week
const schema = normalizeSchemaName(process.env.DATABASE_SCHEMA);

if (url.startsWith("pglite:")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = url.slice("pglite:".length) || "./.data/pglite";
  const db = await PGlite.create(dataDir.startsWith("memory://") ? dataDir : path.resolve(root, dataDir));
  const applied = await applyMigrations(pgliteAdapter(db), dir, log, { schema });
  console.log(applied.length ? `Applied ${applied.length} migration(s) to ${dataDir}` : "Database is up to date.");
  await db.close();
} else if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
  const postgres = (await import("postgres")).default;
  const { url: cleanUrl, ssl } = normalizePostgresUrl(url);
  const sql = postgres(cleanUrl, { ssl, prepare: false, max: 1, onnotice: () => {} });
  try {
    const applied = await applyMigrations(postgresAdapter(sql), dir, log, { schema });
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : "Database is up to date.");
  } finally {
    await sql.end({ timeout: 5 });
  }
} else {
  console.error("DATABASE_URL must start with postgres://, postgresql:// or pglite:");
  process.exit(1);
}
