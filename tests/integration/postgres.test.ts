/**
 * Real-Postgres integration tests for the production database path (postgres.js, pooled
 * connections, automatic setup, dedicated schema). Skipped unless TEST_POSTGRES_URL points at a
 * server where the user may CREATE DATABASE, e.g.
 *   TEST_POSTGRES_URL=postgresql://user:pass@localhost:5432/postgres npx vitest run tests/integration
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { connectPostgresForTests, DatabaseUnavailableError, type Database } from "@/lib/db/client";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const ADMIN_URL = process.env.TEST_POSTGRES_URL;
const suite = ADMIN_URL ? describe : describe.skip;

const created: string[] = [];
const open: Database[] = [];

function urlFor(db: string, extra = "") {
  const u = new URL(ADMIN_URL!);
  u.pathname = `/${db}`;
  return u.toString() + extra;
}

async function freshDatabase(label: string, setup?: (sql: postgres.Sql) => Promise<void>): Promise<string> {
  const name = `fw_it_${label}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  const admin = postgres(ADMIN_URL!, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();
  created.push(name);
  if (setup) {
    const sql = postgres(urlFor(name), { max: 1, onnotice: () => {} });
    await setup(sql);
    await sql.end();
  }
  return urlFor(name);
}

async function connect(url: string, options?: Parameters<typeof connectPostgresForTests>[1]) {
  const db = await connectPostgresForTests(url, options);
  open.push(db);
  return db;
}

afterAll(async () => {
  await Promise.all(open.map((db) => db.close?.().catch(() => {})));
  if (!ADMIN_URL) return;
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  for (const name of created) await admin.unsafe(`drop database if exists ${name} with (force)`).catch(() => {});
  await admin.end();
});

suite("postgres (production driver)", () => {
  it("creates its tables automatically on first connection", async () => {
    const url = await freshDatabase("auto");
    const db = await connect(url);
    const [row] = await db.query<{ version: string }>("select version from schema_migrations");
    expect(row.version).toBe("0001_init");
    const tables = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('applications','application_mentors','application_availability','appointments','application_activity','rate_limit_events')",
    );
    expect(tables[0].n).toBe(6);
  });

  it("serializes concurrent cold starts (several instances migrating at once)", async () => {
    const url = await freshDatabase("race");
    const dbs = await Promise.all([1, 2, 3, 4, 5].map(() => connect(url)));
    const rows = await dbs[0].query<{ n: number }>("select count(*)::int as n from schema_migrations");
    expect(rows[0].n).toBe(1);
  });

  it("strips hosted-provider URL flags (supa=, pgbouncer=, channel_binding=)", async () => {
    const url = await freshDatabase("flags");
    const db = await connect(`${url}?sslmode=disable&supa=base-pooler.x&pgbouncer=true&channel_binding=require`);
    expect((await db.query<{ ok: number }>("select 1 as ok"))[0].ok).toBe(1);
  });

  it("refuses to run unmigrated when automatic setup is disabled", async () => {
    const url = await freshDatabase("noauto");
    await expect(connectPostgresForTests(url, { autoMigrate: false })).rejects.toBeInstanceOf(DatabaseUnavailableError);
  });

  it("shares a Supabase-style project safely with DATABASE_SCHEMA", async () => {
    const url = await freshDatabase("shared", async (sql) => {
      // Another app's data in `public`, plus Supabase's API roles with broad default grants.
      await sql.unsafe("create table applications (id serial primary key, other_app text)");
      await sql.unsafe("insert into applications (other_app) values ('keep me')");
      for (const role of ["anon", "authenticated"]) {
        await sql.unsafe(`do $$ begin create role ${role} nologin; exception when duplicate_object then null; end $$`);
      }
      await sql.unsafe("grant usage on schema public to anon, authenticated");
      await sql.unsafe("alter default privileges grant all on tables to anon, authenticated");
    });
    const db = await connect(url, { schema: "founders_week" });

    // Our tables live in founders_week; the other app's `public.applications` is untouched.
    const ours = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_tables where schemaname = 'founders_week'",
    );
    expect(ours[0].n).toBe(7); // 6 app tables + schema_migrations
    const raw = postgres(url, { max: 1, onnotice: () => {} });
    const other = await raw.unsafe("select other_app from public.applications");
    expect(other).toEqual([{ other_app: "keep me" }]);

    // Unqualified queries resolve to founders_week through the app connection.
    await db.query(
      `insert into applications (idempotency_key, full_name, email, email_normalized, year, major, participation, stage,
         working_on, question, first_choice_mentor_id, acknowledged_no_guarantee, consent_to_share)
       values (gen_random_uuid(), 'T', 't@illinois.edu', 't@illinois.edu', 'junior', 'CS', 'individual', 'idea', 'x', 'y',
         'ron-lewis', true, true)`,
    );
    expect((await db.query<{ n: number }>("select count(*)::int as n from applications"))[0].n).toBe(1);
    await db.transaction(async (tx) => {
      expect((await tx.query<{ s: string }>("select current_schema() as s"))[0].s).toBe("founders_week");
    });

    // Supabase API roles can't reach it.
    for (const role of ["anon", "authenticated"]) {
      await expect(
        raw.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`);
          return tx.unsafe("select * from founders_week.applications");
        }),
      ).rejects.toThrow(/permission denied/);
    }
    await raw.end();
  });

  it("rate limits hold under a parallel burst (no count-then-insert race)", async () => {
    const db = await connect(await freshDatabase("ratelimit"), { autoMigrate: true });
    // A small pool on purpose: parallel requests really do run on separate connections.
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consumeRateLimit(db, { bucket: "it-burst", key: "203.0.113.9", limit: 5, windowSeconds: 900 }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed).every((r) => r.retryAfterSeconds > 0)).toBe(true);
  });
});
