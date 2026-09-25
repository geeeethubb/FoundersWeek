import { describe, expect, it } from "vitest";
import { createMemoryDbForTests, getDatabaseConfig, normalizePostgresUrl } from "@/lib/db/client";

describe("database", () => {
  it("parses DATABASE_URL", () => {
    expect(getDatabaseConfig({})).toMatchObject({ ok: false, reason: "not-configured" });
    expect(getDatabaseConfig({ DATABASE_URL: "pglite:./.data/x" })).toMatchObject({
      ok: true,
      kind: "pglite",
      dataDir: "./.data/x",
    });
    expect(
      getDatabaseConfig({ DATABASE_URL: "pglite:./.data/x", VERCEL: "1" }),
    ).toMatchObject({ ok: false, reason: "misconfigured" });
    expect(getDatabaseConfig({ DATABASE_URL: "postgresql://u:p@h:5432/db" })).toMatchObject({
      ok: true,
      kind: "postgres",
    });
    expect(getDatabaseConfig({ DATABASE_URL: "mysql://nope" })).toMatchObject({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("falls back to POSTGRES_URL and validates DATABASE_SCHEMA / DATABASE_AUTO_MIGRATE", () => {
    expect(getDatabaseConfig({ POSTGRES_URL: "postgres://u:p@h/db" })).toMatchObject({
      ok: true,
      kind: "postgres",
      schema: null,
      autoMigrate: true,
    });
    expect(
      getDatabaseConfig({ DATABASE_URL: "postgres://a/b", POSTGRES_URL: "postgres://c/d", DATABASE_AUTO_MIGRATE: "false" }),
    ).toMatchObject({ url: "postgres://a/b", autoMigrate: false });
    expect(getDatabaseConfig({ DATABASE_URL: "postgres://a/b", DATABASE_SCHEMA: "founders_week" })).toMatchObject({
      schema: "founders_week",
    });
    expect(getDatabaseConfig({ DATABASE_URL: "postgres://a/b", DATABASE_SCHEMA: "public" })).toMatchObject({ schema: null });
    expect(getDatabaseConfig({ DATABASE_URL: "postgres://a/b", DATABASE_SCHEMA: 'x"; drop table y; --' })).toMatchObject({
      ok: false,
      reason: "misconfigured",
    });
  });

  it("normalizes hosted connection strings", () => {
    expect(normalizePostgresUrl("postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=require&channel_binding=require")).toEqual({
      url: "postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db",
      ssl: "require",
    });
    expect(normalizePostgresUrl("postgres://u:p@aws-0-us.pooler.supabase.com:6543/postgres?supa=base-pooler.x").ssl).toBe(
      "require",
    );
    expect(normalizePostgresUrl("postgres://u:p@localhost:5432/db").ssl).toBe(false);
    expect(normalizePostgresUrl("postgres://u:p@localhost:5432/db?sslmode=disable&pgbouncer=true").url).toBe(
      "postgres://u:p@localhost:5432/db",
    );
  });

  it("keeps everything inside a dedicated schema when DATABASE_SCHEMA is set", async () => {
    const db = await createMemoryDbForTests({ schema: "founders_week" });
    const tables = await db.query<{ schemaname: string; n: number }>(
      "select schemaname, count(*)::int as n from pg_tables where tablename in ('applications','schema_migrations') group by schemaname",
    );
    expect(tables).toEqual([{ schemaname: "founders_week", n: 2 }]);
    const [s] = await db.query<{ s: string }>("select current_schema() as s");
    expect(s.s).toBe("founders_week");
    await db.close?.();
  });

  it("migrates a fresh database with RLS enabled on every applicant table", async () => {
    const db = await createMemoryDbForTests();
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('applications','application_mentors','application_availability','appointments','application_activity','rate_limit_events')`,
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    const [m] = await db.query<{ version: string }>("select version from schema_migrations");
    expect(m.version).toBe("0001_init");
  });

  it("enforces constraints: consent, statuses, idempotency, one active appointment per slot", async () => {
    const db = await createMemoryDbForTests();
    const insert = (key: string, overrides: Record<string, unknown> = {}) => {
      const v = {
        idempotency_key: key,
        full_name: "Test Student",
        email: "test@illinois.edu",
        email_normalized: "test@illinois.edu",
        year: "junior",
        major: "CS",
        participation: "individual",
        stage: "idea",
        working_on: "Something",
        question: "Something else",
        first_choice_mentor_id: "patrick-haddox",
        acknowledged_no_guarantee: true,
        consent_to_share: true,
        ...overrides,
      };
      const cols = Object.keys(v);
      return db.query<{ id: string }>(
        `insert into applications (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id`,
        Object.values(v),
      );
    };
    const [a] = await insert("11111111-1111-4111-8111-111111111111");
    await expect(insert("11111111-1111-4111-8111-111111111111")).rejects.toThrow();
    await expect(insert("22222222-2222-4222-8222-222222222222", { consent_to_share: false })).rejects.toThrow();
    await expect(insert("33333333-3333-4333-8333-333333333333", { status: "accepted" })).rejects.toThrow();

    const appt = (status = "proposed") =>
      db.query(
        `insert into appointments (application_id, mentor_id, slot_id, starts_at, ends_at, status, created_by)
         values ($1, 'm', 's1', '2026-10-01T15:00:00Z', '2026-10-01T15:30:00Z', $2, 'test')`,
        [a.id, status],
      );
    await appt();
    await expect(appt()).rejects.toThrow();
    await db.query(`update appointments set status = 'canceled' where application_id = $1`, [a.id]);
    await expect(appt()).resolves.toBeDefined();
  });
});

describe("database env detection (Vercel integrations)", () => {
  it("finds prefixed Neon/Supabase variables and ignores tooling and unpooled ones", async () => {
    const { findDatabaseUrl, databaseEnvNames } = await import("@/lib/db/client");
    expect(findDatabaseUrl({ STORAGE_DATABASE_URL: "postgresql://a/b", STORAGE_DATABASE_URL_UNPOOLED: "postgresql://c/d" })).toEqual({
      name: "STORAGE_DATABASE_URL",
      url: "postgresql://a/b",
    });
    expect(findDatabaseUrl({ NEON_POSTGRES_URL: "postgres://x/y" })?.name).toBe("NEON_POSTGRES_URL");
    expect(findDatabaseUrl({ DATABASE_URL: "postgres://main/db", STORAGE_DATABASE_URL: "postgres://other/db" })?.name).toBe("DATABASE_URL");
    expect(findDatabaseUrl({ TEST_POSTGRES_URL: "postgres://t/t", E2E_DATABASE_URL: "postgres://e/e" })).toBeNull();
    expect(findDatabaseUrl({ STORAGE_DATABASE_URL: "not-a-url" })).toBeNull();
    expect(databaseEnvNames({ STORAGE_DATABASE_URL: "postgres://secret@host/db", OTHER: "x" })).toEqual(["STORAGE_DATABASE_URL"]);
  });
});

describe("DATABASE_POOL_MAX", () => {
  it("falls back to 3 when missing, empty, zero or not a number — a pool of 0 would hang every query", async () => {
    const { poolMax, poolMaxWarning } = await import("@/lib/db/client");
    expect(poolMax({})).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "" })).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "  " })).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "0" })).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "abc" })).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "-2" })).toBe(3);
    expect(poolMax({ DATABASE_POOL_MAX: "5" })).toBe(5);
    expect(poolMax({ DATABASE_POOL_MAX: " 2 " })).toBe(2);
    expect(poolMax({ DATABASE_POOL_MAX: "500" })).toBe(20);
    expect(poolMaxWarning({})).toBeNull();
    expect(poolMaxWarning({ DATABASE_POOL_MAX: "4" })).toBeNull();
    expect(poolMaxWarning({ DATABASE_POOL_MAX: "" })).toMatch(/empty, so 3 is used/);
    expect(poolMaxWarning({ DATABASE_POOL_MAX: "0" })).toMatch(/invalid, so 3 is used/);
  });
});

describe("driver error messages (server logs, stored failure, DatabaseUnavailableError)", () => {
  it("uses the shared redaction: no URLs, credentials, quoted names, IPs or Neon endpoints", async () => {
    const { sanitizeDbMessage } = await import("@/lib/db/client");
    const { connectionValues } = await import("@/lib/security/redact");
    const cases = [
      'password authentication failed for user "neondb_owner"',
      "connect ECONNREFUSED [2600:1f16:abcd::12]:5432",
      "connect ETIMEDOUT 2600:1f16:abcd::12",
      "getaddrinfo ENOTFOUND ep-cool-darkness-123456.us-east-2.aws.neon.tech",
      "Endpoint ep-cool-darkness-123456 not found",
      "failed postgres://neondb_owner:hunter2@db.example.com/neondb",
      "connect ECONNREFUSED 10.0.0.12:5432",
    ];
    for (const message of cases) {
      const out = sanitizeDbMessage(message);
      for (const secret of ["neondb_owner", "hunter2", "2600:1f16", "ep-cool-darkness", "example.com", "10.0.0.12"]) {
        expect(out, message).not.toContain(secret);
      }
    }
    // Error codes and our own wording stay; the configured user and database go even unquoted.
    const known = connectionValues("postgres://founders_app:pw@db.internal:5432/founders_prod");
    const out = sanitizeDbMessage("ECONNRESET: role founders_app cannot reach founders_prod", known);
    expect(out).toContain("ECONNRESET");
    expect(out).not.toMatch(/founders_app|founders_prod/);
    expect(sanitizeDbMessage("x".repeat(500))).toHaveLength(300);
  });
});
