/**
 * Authorization sweep: EVERY route handler under app/api/organizer (discovered from the file
 * system, so new routes are covered automatically) must refuse applicant data without a valid
 * organizer session, and must not change anything.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __setDbForTests, createMemoryDbForTests, type Database } from "@/lib/db/client";
import { createSessionToken, SESSION_TTL_SECONDS } from "@/lib/organizer/session";
import { assignAppointment } from "@/lib/organizer/service";
import { insertApplication, slotMap } from "./organizer-fixtures";

const PASSWORD = "organizer-authz-password";
const ORIGIN = "http://localhost:3000";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];
type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

const SECRET_NAME = "Quinn Confidential";
const SECRET_EMAIL = "quinn.confidential@illinois.edu";
const SECRET_ANSWER = "A private answer that must never leak";

const ROUTES_DIR = path.join(process.cwd(), "app", "api", "organizer");

function findRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...findRoutes(path.join(dir, entry.name), rel));
    else if (/^route\.(ts|tsx|js)$/.test(entry.name)) out.push(prefix);
  }
  return out.sort();
}

const routes = findRoutes(ROUTES_DIR);
const modules = new Map<string, Partial<Record<Method, Handler>>>();

let db: Database;
let appId: string;
let appointmentId: string;

function sessionCookie(options: { password?: string; now?: Date; name?: string } = {}) {
  return `fw_organizer=${createSessionToken({ name: options.name ?? "Authz Tester", password: options.password ?? PASSWORD, now: options.now })}`;
}

/** Valid-looking input for each route, so the ONLY thing that can stop the request is auth. */
function requestFor(route: string, method: Method, init: { cookie?: string | null; origin?: string | null } = {}) {
  const url = new URL(`${ORIGIN}/api/organizer/${route.replace("[id]", route.startsWith("appointments") ? appointmentId : appId)}`);
  let body: unknown;
  if (route === "export") url.search = "q=quinn";
  if (route === "applications/[id]") body = { status: "under_review", organizerNotes: "tampered" };
  if (route === "appointments") body = { applicationId: appId, slotId: "demo-avery-slot-1430" };
  if (route === "appointments/[id]") body = { action: "cancel" };
  if (route === "session") body = { name: "Intruder", password: "not-the-password" };
  const headers = new Headers({ host: "localhost:3000", "x-forwarded-for": `10.1.${METHODS.indexOf(method)}.${routes.indexOf(route)}` });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.origin) headers.set("origin", init.origin);
  const hasBody = method !== "GET" && body !== undefined;
  if (hasBody) headers.set("content-type", "application/json");
  return new Request(url, { method, headers, body: hasBody ? JSON.stringify(body) : undefined });
}

function context(route: string): { params: Promise<Record<string, string>> } {
  const id = route.startsWith("appointments") ? appointmentId : appId;
  const params: Record<string, string> = route.includes("[id]") ? { id } : {};
  return { params: Promise.resolve(params) };
}

async function snapshot() {
  const [app] = await db.query<{ status: string; organizer_notes: string; updated_at: unknown }>(
    `select status, organizer_notes, updated_at from applications where id = $1`,
    [appId],
  );
  const appts = await db.query<{ id: string; status: string }>(`select id, status from appointments order by id`);
  const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from application_activity`);
  return JSON.stringify({ app, appts, activity: n });
}

function expectNoApplicantData(text: string) {
  expect(text).not.toContain(SECRET_NAME);
  expect(text).not.toContain(SECRET_EMAIL);
  expect(text).not.toContain(SECRET_ANSWER);
  expect(text.toLowerCase()).not.toContain("quinn");
}

beforeAll(async () => {
  db = await createMemoryDbForTests();
  __setDbForTests(db);
  for (const route of routes) {
    // Resolved at runtime (the route list comes from the file system).
    const specifier = `@/app/api/organizer/${route}/route`;
    modules.set(route, (await import(/* @vite-ignore */ specifier)) as Partial<Record<Method, Handler>>);
  }
  appId = await insertApplication(db, { fullName: SECRET_NAME, email: SECRET_EMAIL, mentors: ["demo-avery-sample"] });
  await db.query(`update applications set working_on = $2, question = $2 where id = $1`, [appId, SECRET_ANSWER]);
  const { appointment } = await assignAppointment(
    db,
    { applicationId: appId, slotId: "demo-avery-slot-1400" },
    { actor: "Setup", slots: slotMap() },
  );
  appointmentId = appointment.id;
});

beforeEach(() => {
  vi.stubEnv("ORGANIZER_PASSWORD", PASSWORD);
  vi.stubEnv("SHOW_DEMO_CONTENT", "true");
});

afterAll(() => {
  __setDbForTests(undefined);
  vi.unstubAllEnvs();
});

describe("organizer API route inventory", () => {
  it("finds every organizer route handler (update this list when adding one — it's then swept below)", () => {
    expect(routes).toEqual(["applications/[id]", "appointments", "appointments/[id]", "export", "session"]);
    for (const route of routes) {
      const exported = METHODS.filter((m) => typeof modules.get(route)?.[m] === "function");
      expect(exported.length, route).toBeGreaterThan(0);
    }
  });
});

const dataRoutes = () => routes.filter((r) => r !== "session");

describe("applicant data is never readable or writable without a session", () => {
  const now = new Date();
  const credentials: [string, () => string | null][] = [
    ["no cookie", () => null],
    ["a tampered cookie", () => sessionCookie().replace(/.$/, (c) => (c === "A" ? "B" : "A"))],
    ["a cookie from a rotated password", () => sessionCookie({ password: "the-previous-password-2025" })],
    [
      "an expired cookie",
      () => sessionCookie({ now: new Date(now.getTime() - (SESSION_TTL_SECONDS + 60) * 1000) }),
    ],
    ["a forged unsigned cookie", () => `fw_organizer=${Buffer.from(JSON.stringify({ v: 1, name: "x" })).toString("base64url")}.AAAA`],
  ];

  it.each(credentials)("every data route and method answers 401 with %s — and changes nothing", async (_label, cookie) => {
    const before = await snapshot();
    let checked = 0;
    for (const route of dataRoutes()) {
      for (const method of METHODS) {
        const handler = modules.get(route)?.[method];
        if (!handler) continue;
        // Same-origin browser request (passes CSRF) and a header-less client (curl): both need a session.
        for (const origin of [ORIGIN, null]) {
          const res = await handler(requestFor(route, method, { cookie: cookie(), origin }), context(route));
          const text = await res.text();
          expect(res.status, `${method} /api/organizer/${route}`).toBe(401);
          expect(JSON.parse(text)).toMatchObject({ ok: false, error: "unauthorized" });
          expect(res.headers.get("cache-control")).toBe("no-store");
          expectNoApplicantData(text);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
    expect(await snapshot()).toBe(before);
  });

  it("mutations from another origin are refused (403) even with a valid session", async () => {
    const before = await snapshot();
    for (const route of routes) {
      for (const method of METHODS.filter((m) => m !== "GET")) {
        const handler = modules.get(route)?.[method];
        if (!handler) continue;
        const res = await handler(
          requestFor(route, method, { cookie: sessionCookie(), origin: "https://evil.example" }),
          context(route),
        );
        const text = await res.text();
        expect(res.status, `${method} /api/organizer/${route}`).toBe(403);
        expectNoApplicantData(text);
      }
    }
    expect(await snapshot()).toBe(before);
  });

  it("every route is disabled (503) when no organizer password is configured, even with an old cookie", async () => {
    const cookie = sessionCookie();
    vi.stubEnv("ORGANIZER_PASSWORD", "");
    for (const route of routes) {
      for (const method of METHODS) {
        const handler = modules.get(route)?.[method];
        if (!handler || (route === "session" && method === "DELETE")) continue;
        const res = await handler(requestFor(route, method, { cookie, origin: ORIGIN }), context(route));
        const text = await res.text();
        expect(res.status, `${method} /api/organizer/${route}`).toBe(503);
        expectNoApplicantData(text);
      }
    }
  });

  it("the sign-in route never returns applicant data (wrong password → 401, sign-out → no data)", async () => {
    const session = modules.get("session")!;
    const wrong = await session.POST!(requestFor("session", "POST", { origin: ORIGIN }), context("session"));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expectNoApplicantData(await wrong.text());
    const out = await session.DELETE!(requestFor("session", "DELETE", { origin: ORIGIN }), context("session"));
    expectNoApplicantData(await out.text());
  });

  it("the same requests succeed with a valid session (so the sweep would catch a missing check)", async () => {
    const exportRes = await modules.get("export")!.GET!(requestFor("export", "GET", { cookie: sessionCookie() }), context("export"));
    expect(exportRes.status).toBe(200);
    expect(await exportRes.text()).toContain(SECRET_EMAIL);
    const patch = await modules.get("applications/[id]")!.PATCH!(
      requestFor("applications/[id]", "PATCH", { cookie: sessionCookie(), origin: ORIGIN }),
      context("applications/[id]"),
    );
    expect(patch.status).toBe(200);
  });
});
