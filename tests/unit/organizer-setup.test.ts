/**
 * Deployment readiness without secrets: GET /api/health and the organizer "Setup" checklist
 * (shown on the sign-in page before anyone signs in, and on the dashboard).
 *
 * - /api/health never returns applicant data, secret values, connection strings or hosts.
 * - The checklist renders each check (ok/not ok, status, fix) and nothing sensitive.
 * - A missing APP_SECRET or ORGANIZER_PASSWORD is explained ("nobody can sign in") and organizer
 *   APIs refuse cleanly (503) instead of failing with an error.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Driver failures are recorded by lib/db/client when a real Postgres connection fails. Tests can
// stand in a specific failure (a Postgres error naming the user, database and host) to check that
// none of it reaches /api/health or the sign-in page's Setup checklist.
const failureOverride = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return {
    ...mod,
    lastDatabaseFailure: () => (failureOverride.value as ReturnType<typeof mod.lastDatabaseFailure>) ?? mod.lastDatabaseFailure(),
  };
});

import { GET as health } from "@/app/api/health/route";
import { GET as exportCsv } from "@/app/api/organizer/export/route";
import { POST as login } from "@/app/api/organizer/session/route";
import { SetupChecklist, SignInUnavailable, signInBlockers } from "@/components/organizer/setup-checklist";
import { __setDbForTests, createMemoryDbForTests, type Database } from "@/lib/db/client";
import { authorizeOrganizerRequest } from "@/lib/organizer/auth";
import { redactDatabaseDetail } from "@/lib/organizer/data-store";
import { describeDataStore, type DataStoreStatus } from "@/lib/organizer/data-store-view";
import { connectionValues, redactConnectionDetails } from "@/lib/security/redact";
import { diagnostic, getSetupStatus, type SetupStatus } from "@/lib/setup-status";
import { insertApplication } from "./organizer-fixtures";

const APP_SECRET = "Zq8vN3kT1pW6yR0sL4mX9cB2hJ7dF5gA-app-secret-value";
const PASSWORD = "organizer-setup-password-7Hq2";
const DB_URL = "postgres://founders_admin:hunter2-db-password@db.abcdefghijkl.supabase.co:6543/postgres";
const APPLICANT = {
  fullName: "Riley Setupcheck",
  email: "riley.setupcheck@illinois.edu",
  answer: "A confidential answer about my startup idea",
};
const ORIGIN = "http://localhost:3000";

let db: Database;

/** Anything that looks like a credential, connection string, host or long random token. */
const SECRET_LOOKING = [
  /:\/\//, // any URL / connection string
  /[^\s@]+@[^\s@]+/, // user@host, user:pass@host, emails
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // IPv4
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|dev|app|cloud)\b/i, // host names
  /(password|secret|token|key)\s*[=:]\s*\S/i, // key=value secrets
  /[A-Za-z0-9_+/=-]{28,}/, // long opaque tokens
];

function expectNothingSensitive(text: string) {
  for (const value of [APP_SECRET, PASSWORD, DB_URL, "hunter2", "founders_admin", "supabase.co", "abcdefghijkl"]) {
    expect(text).not.toContain(value);
  }
  for (const value of Object.values(APPLICANT)) expect(text).not.toContain(value);
  expect(text.toLowerCase()).not.toContain("riley");
  for (const pattern of SECRET_LOOKING) expect(text, String(pattern)).not.toMatch(pattern);
}

function markup(status: SetupStatus, dataStore?: DataStoreStatus) {
  return renderToStaticMarkup(createElement(SetupChecklist, { status, dataStore }));
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

beforeAll(async () => {
  db = await createMemoryDbForTests();
  const id = await insertApplication(db, { fullName: APPLICANT.fullName, email: APPLICANT.email, mentors: ["ron-lewis"] });
  await db.query(`update applications set working_on = $2, question = $2 where id = $1`, [id, APPLICANT.answer]);
});

beforeEach(() => {
  vi.stubEnv("APP_SECRET", APP_SECRET);
  vi.stubEnv("ORGANIZER_PASSWORD", PASSWORD);
  vi.stubEnv("DATABASE_URL", DB_URL);
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("DATABASE_SCHEMA", "");
  __setDbForTests(db);
});

afterEach(() => {
  __setDbForTests(undefined);
  vi.unstubAllEnvs();
  failureOverride.value = null;
});

afterAll(() => {
  __setDbForTests(undefined);
});

describe("GET /api/health", () => {
  it("reports readiness with no applicant data and no secret-looking values", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const raw = await res.text();
    const body = JSON.parse(raw) as { applications: string; checks: { key: string; ok: boolean; status: string; fix: string | null }[] };

    expect(Object.keys(body).sort()).toEqual(["applications", "build", "checks"]);
    expect(body.applications).toBe("open");
    expect(body.checks.map((c) => c.key)).toEqual(["app-secret", "database", "organizer-password", "applications-switch"]);
    for (const check of body.checks) {
      expect(Object.keys(check).sort()).toEqual(["fix", "key", "ok", "status"]);
      expect(check.ok).toBe(true);
      expect(check.fix).toBeNull();
    }
    // The database is named by the variable that configured it, never by its URL or host.
    expect(body.checks.find((c) => c.key === "database")!.status).toBe("ok (Postgres via DATABASE_URL)");
    expectNothingSensitive(raw);
  });

  it("explains missing and too-short settings without echoing any value", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "short-secret-value");
    vi.stubEnv("ORGANIZER_PASSWORD", "tooshort");
    vi.stubEnv("DATABASE_URL", "");
    __setDbForTests(undefined);

    const raw = await (await health()).text();
    const body = JSON.parse(raw) as { applications: string; checks: { key: string; ok: boolean; status: string; fix: string | null }[] };
    expect(body.applications).toBe("not-ready");
    const by = Object.fromEntries(body.checks.map((c) => [c.key, c]));
    expect(by["app-secret"]).toMatchObject({ ok: false, status: "too short (needs at least 32 characters)" });
    expect(by["database"]).toMatchObject({ ok: false, status: expect.stringMatching(/^missing/) });
    expect(by["organizer-password"]).toMatchObject({ ok: false, status: "too short (needs at least 12 characters)" });
    for (const key of ["app-secret", "database", "organizer-password"]) expect(by[key].fix).toBeTruthy();
    expect(raw).not.toContain("short-secret-value");
    expect(raw).not.toContain("tooshort");
    expectNothingSensitive(raw);
  });

  it("reports an unreachable database without its connection string, user or host", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://founders_admin:hunter2-db-password@127.0.0.1:1/founders");
    __setDbForTests(undefined);
    const raw = await (await health()).text();
    const database = (JSON.parse(raw) as { checks: { key: string; ok: boolean; status: string }[] }).checks.find(
      (c) => c.key === "database",
    )!;
    expect(database).toMatchObject({ ok: false, status: expect.stringMatching(/^could not connect/) });
    expect(raw).not.toContain("127.0.0.1");
    expectNothingSensitive(raw);
  });
});

describe("database diagnostics never name the user, database, host or addresses", () => {
  // Shaped like real driver and Postgres errors (Neon, Supabase, PgBouncer, Node's net module).
  const USER = "neondb_owner";
  const DATABASE = "founders_prod";
  const DRIVER_ERRORS = [
    `password authentication failed for user "${USER}"`,
    `database "${DATABASE}" does not exist`,
    `role "${USER}" is not permitted to log in`,
    `no pg_hba.conf entry for host "2600:1f18:4c1:ab00::5", user "${USER}", database "${DATABASE}", SSL off`,
    "connect ECONNREFUSED 2600:1f18:4c1:ab00::5:5432",
    "connect ECONNREFUSED [2600:1f18:4c1:ab00::5]:5432",
    "connect ETIMEDOUT 10.20.30.40:5432",
    "connect ECONNREFUSED ::ffff:10.20.30.40:5432",
    "getaddrinfo ENOTFOUND ep-cool-darkness-123456.us-east-2.aws.neon.tech",
    "getaddrinfo ENOTFOUND db.abcdefghijklmnop.supabase.co",
    "Tenant or user not found: postgres.abcdefghijklmnop",
    `no such user: ${USER}`,
    `FATAL: terminating connection for user ${USER}`,
    `connection to server at "db.internal.example" (10.0.0.7), port 5432 failed: user=${USER} dbname=${DATABASE}`,
  ];
  const LEAKS = [
    USER,
    DATABASE,
    "2600:1f18",
    "ab00::5",
    "10.20.30.40",
    "10.0.0.7",
    "neon.tech",
    "ep-cool-darkness",
    "supabase.co",
    "abcdefghijklmnop",
    "db.internal.example",
  ];
  const IPV6 = /(?:^|[^0-9a-z:])(?:[0-9a-f]{0,4}:){2,}[0-9a-f]{1,4}/i;
  const known = connectionValues(`postgres://${USER}:hunter2-db-password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/${DATABASE}`);

  it("redacts every identifying part of driver errors, with or without the configured URL", () => {
    expect(known).toEqual({ user: USER, database: DATABASE, host: "ep-cool-darkness-123456.us-east-2.aws.neon.tech" });
    for (const message of DRIVER_ERRORS) {
      for (const redacted of [diagnostic(message), diagnostic(message, known), redactConnectionDetails(message)]) {
        for (const leak of LEAKS) expect(redacted, `${message} → ${redacted}`).not.toContain(leak);
        expect(redacted, `${message} → ${redacted}`).not.toMatch(IPV6);
        expect(redacted, `${message} → ${redacted}`).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
      }
    }
    // What's left still says what went wrong.
    expect(diagnostic(DRIVER_ERRORS[0])).toBe('password authentication failed for user "[hidden]"');
    expect(diagnostic(DRIVER_ERRORS[1])).toBe('database "[hidden]" does not exist');
    expect(diagnostic(DRIVER_ERRORS[4])).toBe("connect ECONNREFUSED [host hidden]");
    expect(diagnostic(DRIVER_ERRORS[8])).toBe("getaddrinfo ENOTFOUND [host hidden]");
    // An unquoted user name is caught by the literal value from the configured URL.
    expect(diagnostic(`role ${USER} cannot log in`, known)).toBe("role [hidden] cannot log in");
    // Our own wording, stages, codes and timings stay readable.
    for (const kept of [
      "Could not connect to the database: connect ECONNREFUSED",
      "Checking the database schema timed out after 12s",
      "Run npm run db:migrate and check the database user's permissions.",
      "Neon (pooled), port 5432, DNS 2 IPv4 / 0 IPv6, TCP ok in 20ms, SSL reply S; TLS ok 41ms; startup → auth request 10",
      "Supabase direct host (IPv6 only, so Vercel can’t reach it; use the pooler URI)",
      "startup → error 28P01: connect 12ms, closed 13ms",
    ]) {
      expect(diagnostic(kept)).toBe(kept);
    }
  });

  it("GET /api/health keeps the provider, stage and error code but none of the connection details", async () => {
    vi.stubEnv("DATABASE_URL", `postgres://${USER}:hunter2-db-password@127.0.0.1:1/${DATABASE}`);
    __setDbForTests(undefined);
    failureOverride.value = {
      stage: "connect",
      code: "28P01",
      message: DRIVER_ERRORS.join("; "),
      at: "2026-09-24T17:00:00.000Z",
      trace: ["connect 3ms", `closed 9ms`],
    };
    const raw = await (await health()).text();
    const database = (JSON.parse(raw) as { checks: { key: string; ok: boolean; status: string }[] }).checks.find(
      (c) => c.key === "database",
    )!;
    expect(database.ok).toBe(false);
    expect(database.status).toMatch(
      /^could not connect \(using DATABASE_URL; connect step \(28P01\): password authentication failed for user "\[hidden\]"; database "\[hidden\]" does not exist;/,
    );
    expect(database.status).toContain("trace [connect 3ms, closed 9ms]");
    expect(database.status).toMatch(/probe: other host, port 1, /);
    for (const leak of [...LEAKS, "127.0.0.1", "hunter2"]) expect(raw).not.toContain(leak);
    expect(database.status).not.toMatch(IPV6);
    expectNothingSensitive(raw);

    // The sign-in page's Setup checklist shows the same (redacted) status.
    const t = text(markup(await getSetupStatus()));
    expect(t).toContain("password authentication failed for user");
    for (const leak of [...LEAKS, "127.0.0.1"]) expect(t).not.toContain(leak);
    expectNothingSensitive(t);
  });

  it("drops an error code that isn't a plain code", async () => {
    vi.stubEnv("DATABASE_URL", `postgres://${USER}:hunter2-db-password@127.0.0.1:1/${DATABASE}`);
    __setDbForTests(undefined);
    failureOverride.value = { stage: "check", code: `role ${USER}`, message: "x", at: "2026-09-24T17:00:00.000Z" };
    const status = (await getSetupStatus()).checks.find((c) => c.key === "database")!.status;
    expect(status).toContain("check step: x;");
    expect(status).not.toContain(USER);
  });

  it("redacts the dashboard hint and the sign-in page's database detail too", () => {
    vi.stubEnv("DATABASE_URL", `postgres://${USER}:hunter2-db-password@127.0.0.1:1/${DATABASE}`);
    const detail = `Could not connect to the database: ${DRIVER_ERRORS.join("; ")}; role ${USER} cannot log in`;
    const redacted = redactDatabaseDetail(detail);
    for (const leak of LEAKS) expect(redacted).not.toContain(leak);
    expect(redacted).toContain("Could not connect to the database:");
    const hint = describeDataStore({
      persistence: { ready: false, reason: "unreachable", detail },
      provider: "postgres",
      schema: "0001_init",
      showHints: true,
      checkedAt: "2026-09-24T17:00:00.000Z",
      known,
    }).hint!;
    for (const leak of LEAKS) expect(hint).not.toContain(leak);
    expect(hint).not.toMatch(IPV6);
    expect(hint.endsWith("See README → Database.")).toBe(true);
  });
});

describe("Setup checklist (sign-in page and dashboard)", () => {
  it("lists every check with its status, and fixes only where something is wrong", async () => {
    vi.stubEnv("ORGANIZER_PASSWORD", "");
    const status = await getSetupStatus();
    const html = markup(status);
    const t = text(html);
    expect(html).toContain('id="setup"');
    expect(html).toContain("<h2");
    for (const title of ["Signing secret", "Application database", "Organizer password", "Applications switch"]) {
      expect(t).toContain(title);
    }
    for (const setting of ["APP_SECRET", "DATABASE_URL or POSTGRES_URL", "ORGANIZER_PASSWORD", "applications.open in content/site.ts"]) {
      expect(t).toContain(setting);
    }
    expect(t).toContain("1 of 4 needs attention");
    expect(t).toContain("OK (Postgres via DATABASE_URL)");
    expect(t).toContain("Missing");
    expect(t).toContain("Add ORGANIZER_PASSWORD (12+ characters)");
    // Screen-reader row status: only the failing row needs attention (plus the "1 of 4" summary).
    expect(t.match(/Organizer password needs attention/g)).toHaveLength(1);
    expect(t.match(/needs attention/g)).toHaveLength(2);
    expect(t.match(/\) is OK/g)).toHaveLength(3);
    expectNothingSensitive(t);
    expectNothingSensitive(html.replace(/(class|id|aria-[a-z]+)="[^"]*"/g, ""));
  });

  it("shows the dashboard's data store line, redacted, and says when all checks pass", async () => {
    const status = await getSetupStatus();
    const dataStore = describeDataStore({
      persistence: { ready: false, reason: "unreachable", detail: `Could not connect: ${DB_URL}` },
      provider: "supabase",
      schema: "0001_init",
      showHints: true,
      checkedAt: "2026-09-24T17:00:00.000Z",
    });
    const t = text(markup(status, dataStore));
    expect(t).toContain("All 4 checks pass");
    expect(t).toContain("Database not connected");
    expect(t).toContain("Supabase · Postgres");
    expect(t).toContain("[connection string hidden]");
    expectNothingSensitive(t);
  });

  it("explains that nobody can sign in while APP_SECRET or ORGANIZER_PASSWORD is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "");
    vi.stubEnv("ORGANIZER_PASSWORD", "");
    const status = await getSetupStatus();
    const blockers = signInBlockers(status);
    expect(blockers.map((b) => b.key).sort()).toEqual(["app-secret", "organizer-password"]);

    const t = text(renderToStaticMarkup(createElement(SignInUnavailable, { blockers })));
    expect(t).toContain("Sign-in isn’t available yet");
    expect(t).toContain("Nobody can sign in until APP_SECRET and ORGANIZER_PASSWORD are set correctly");
    expect(t).toContain("needs both the organizer password and the signing secret");
    expect(t).toContain("See Setup for the fix");

    // Only one missing → singular wording; a healthy deployment has no blockers.
    vi.stubEnv("APP_SECRET", APP_SECRET);
    const one = signInBlockers(await getSetupStatus());
    expect(one.map((b) => b.key)).toEqual(["organizer-password"]);
    expect(text(renderToStaticMarkup(createElement(SignInUnavailable, { blockers: one })))).toContain(
      "Nobody can sign in until ORGANIZER_PASSWORD is set correctly",
    );
    vi.stubEnv("ORGANIZER_PASSWORD", PASSWORD);
    expect(signInBlockers(await getSetupStatus())).toEqual([]);

    // In development the fixed dev secret keeps sign-in working (reported, not blocking).
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_SECRET", "");
    const dev = await getSetupStatus();
    expect(dev.checks.find((c) => c.key === "app-secret")).toMatchObject({ ok: true, status: "missing (development fallback in use)" });
    expect(signInBlockers(dev)).toEqual([]);
  });
});

describe("organizer APIs without a signing secret", () => {
  it("refuse with 503 (never an error page, never data) when APP_SECRET is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "");
    const request = new Request(`${ORIGIN}/api/organizer/export`, {
      headers: { host: "localhost:3000", cookie: "fw_organizer=forged.token" },
    });
    const auth = authorizeOrganizerRequest(request, { mutation: false });
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.response.status).toBe(503);

    const exportRes = await exportCsv(request);
    expect(exportRes.status).toBe(503);
    expectNothingSensitive(await exportRes.text());

    const signIn = await login(
      new Request(`${ORIGIN}/api/organizer/session`, {
        method: "POST",
        headers: { host: "localhost:3000", origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ name: "Setup Tester", password: PASSWORD }),
      }),
    );
    expect(signIn.status).toBe(503);
    expect(signIn.headers.get("set-cookie")).toBeNull();
    expect(await signIn.json()).toMatchObject({ ok: false, error: "organizer_disabled" });
  });
});
