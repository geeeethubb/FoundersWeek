/**
 * Route-handler authorization. Handlers are called directly with Request objects; the session is
 * read from the Cookie header, so no Next request context is needed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as patchApplication } from "@/app/api/organizer/applications/[id]/route";
import { POST as postAppointment } from "@/app/api/organizer/appointments/route";
import { PATCH as patchAppointment } from "@/app/api/organizer/appointments/[id]/route";
import { GET as exportCsv } from "@/app/api/organizer/export/route";
import { DELETE as logout, POST as login } from "@/app/api/organizer/session/route";
import { __setDbForTests, createMemoryDbForTests, type Database } from "@/lib/db/client";
import { createSessionToken, ORGANIZER_LOGIN_LIMITS } from "@/lib/organizer/session";
import { insertApplication } from "./organizer-fixtures";

const PASSWORD = "organizer-test-password";
const ORIGIN = "http://localhost:3000";
let db: Database;
let appId: string;

function cookieFor(password = PASSWORD, name = "Route Tester") {
  return `fw_organizer=${createSessionToken({ name, password })}`;
}

function req(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string | null; origin?: string | null; ip?: string } = {},
) {
  const headers = new Headers({ host: "localhost:3000" });
  if (init.cookie !== null) headers.set("cookie", init.cookie ?? cookieFor());
  if (init.origin !== null && init.method && init.method !== "GET") headers.set("origin", init.origin ?? ORIGIN);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.ip) headers.set("x-forwarded-for", init.ip);
  return new Request(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  db = await createMemoryDbForTests();
  __setDbForTests(db);
});

afterAll(() => {
  __setDbForTests(undefined);
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  vi.stubEnv("ORGANIZER_PASSWORD", PASSWORD);
  vi.stubEnv("SHOW_DEMO_CONTENT", "true");
  appId = await insertApplication(db, { fullName: "=Route Student", mentors: ["ron-lewis"] });
});

describe("organizer API authorization", () => {
  it("export: 401 without a session, 401 with a tampered or stale session, 200 with a valid one", async () => {
    expect((await exportCsv(req("/api/organizer/export", { cookie: null }))).status).toBe(401);
    const tampered = cookieFor().replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect((await exportCsv(req("/api/organizer/export", { cookie: tampered }))).status).toBe(401);
    expect((await exportCsv(req("/api/organizer/export", { cookie: cookieFor("an-old-password-123") }))).status).toBe(401);

    const res = await exportCsv(req("/api/organizer/export?mentor=ron-lewis"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="founders-week-applications-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([...buf.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(buf.slice(3));
    expect(text.startsWith("id,submitted_at,status,full_name,email,")).toBe(true);
    expect(text).toContain(",'=Route Student,");
  });

  it("mutations: 403 from another origin (even with a valid session), 401 without a session", async () => {
    const body = { status: "under_review" };
    const bad = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body, origin: "https://evil.example" }),
      params(appId),
    );
    expect(bad.status).toBe(403);
    const crossSite = new Request(`${ORIGIN}/api/organizer/appointments`, {
      method: "POST",
      headers: { host: "localhost:3000", cookie: cookieFor(), "sec-fetch-site": "cross-site", "content-type": "application/json" },
      body: JSON.stringify({ applicationId: appId, slotId: "demo-avery-slot-1430" }),
    });
    expect((await postAppointment(crossSite)).status).toBe(403);

    const anon = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body, cookie: null }),
      params(appId),
    );
    expect(anon.status).toBe(401);
    expect(
      (await postAppointment(req("/api/organizer/appointments", { method: "POST", body: {}, cookie: null }))).status,
    ).toBe(401);
    expect(
      (await patchAppointment(req(`/api/organizer/appointments/${appId}`, { method: "PATCH", body: { action: "confirm" }, cookie: null }), params(appId)))
        .status,
    ).toBe(401);
  });

  it("mutations succeed with a valid session and record the organizer's name", async () => {
    const res = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body: { status: "under_review" } }),
      params(appId),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: true, application: { status: "under_review" } });
    const [log] = await db.query<{ actor: string }>(`select actor from application_activity where application_id = $1`, [appId]);
    expect(log.actor).toBe("Route Tester");

    const created = await postAppointment(
      req("/api/organizer/appointments", { method: "POST", body: { applicationId: appId, slotId: "demo-avery-slot-1430" } }),
    );
    expect(created.status).toBe(201);
    const { appointment } = (await created.json()) as { appointment: { id: string } };
    const confirmed = await patchAppointment(
      req(`/api/organizer/appointments/${appointment.id}`, { method: "PATCH", body: { action: "confirm" } }),
      params(appointment.id),
    );
    expect(confirmed.status).toBe(200);
  });

  it("validates input and maps rule violations to 400/404/409 JSON", async () => {
    const invalid = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body: { status: "accepted" } }),
      params(appId),
    );
    expect(invalid.status).toBe(400);
    const extra = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body: { status: "selected", email: "x@y.z" } }),
      params(appId),
    );
    expect(extra.status).toBe(400);
    const missing = await patchApplication(
      req(`/api/organizer/applications/not-a-uuid`, { method: "PATCH", body: { status: "selected" } }),
      params("not-a-uuid"),
    );
    expect(missing.status).toBe(404);
    const unknownSlot = await postAppointment(
      req("/api/organizer/appointments", { method: "POST", body: { applicationId: appId, slotId: "no-such-slot" } }),
    );
    expect(unknownSlot.status).toBe(404);
    const conflict = await patchApplication(
      req(`/api/organizer/applications/${appId}`, { method: "PATCH", body: { status: "confirmed" } }),
      params(appId),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ ok: false, error: "needs_confirmed_appointment" });
  });

  it("503s every organizer endpoint when sign-in is disabled", async () => {
    vi.stubEnv("ORGANIZER_PASSWORD", "");
    expect((await exportCsv(req("/api/organizer/export"))).status).toBe(503);
    expect((await login(req("/api/organizer/session", { method: "POST", body: { name: "A", password: "x" } }))).status).toBe(503);
  });
});

describe("sessions through the API (generated from windows)", () => {
  it("assigns one application per 25-minute session, confirms it, and exports the session time", async () => {
    const email = "session.route@illinois.edu";
    const first = await insertApplication(db, {
      fullName: "Session Route",
      email,
      mentors: ["rishab-veldur"],
      availability: ["window:rishab-veldur-2026-10-01"],
    });
    const second = await insertApplication(db, { mentors: ["rishab-veldur"] });
    const slotId = "rishab-veldur-2026-10-01-1200";

    const created = await postAppointment(req("/api/organizer/appointments", { method: "POST", body: { applicationId: first, slotId } }));
    expect(created.status).toBe(201);
    const { appointment } = (await created.json()) as { appointment: { id: string; startsAt: string; endsAt: string } };
    expect(appointment).toMatchObject({ startsAt: "2026-10-01T17:00:00.000Z", endsAt: "2026-10-01T17:25:00.000Z" });

    const full = await postAppointment(req("/api/organizer/appointments", { method: "POST", body: { applicationId: second, slotId } }));
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({ ok: false, error: "slot_full" });

    const confirmed = await patchAppointment(
      req(`/api/organizer/appointments/${appointment.id}`, { method: "PATCH", body: { action: "confirm" } }),
      params(appointment.id),
    );
    expect(confirmed.status).toBe(200);

    const res = await exportCsv(req(`/api/organizer/export?q=${encodeURIComponent(email)}`));
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain("Rishab Veldur: Thu, Oct 1 · 12:00–12:25 PM CT (confirmed)");
    expect(csv).toContain("Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)");

    // Leave no Rishab applications behind for the filtered-export test below.
    await db.query(`delete from applications where id = any($1::uuid[])`, [[first, second]]);
  });
});

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, CRLF rows, CR/LF inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

describe("CSV export sanitization (through the route)", () => {
  it("neutralizes =, +, -, @, TAB and CR prefixes in every applicant-controlled cell", async () => {
    const id = await insertApplication(db, { fullName: "placeholder", email: "csv.sanitize@illinois.edu", mentors: ["ron-lewis"] });
    const hostile = {
      full_name: '=HYPERLINK("https://evil.example","click")',
      major: "+SUM(1,2)",
      team_name: "-2+3",
      teammates: "@cmd|' /C calc'!A0",
      working_on: "\tTab-led answer",
      question: "\rCR-led answer",
      availability_notes: "   =indented formula",
      organizer_notes: "@notes",
      link_url: "-1",
    } as const;
    await db.query(
      `update applications set participation = 'team', full_name = $2, major = $3, team_name = $4, teammates = $5,
         working_on = $6, question = $7, availability_notes = $8, organizer_notes = $9, link_url = $10 where id = $1`,
      [id, ...Object.values(hostile)],
    );

    const res = await exportCsv(req("/api/organizer/export?q=csv.sanitize"));
    expect(res.status).toBe(200);
    const text = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()).slice(3));
    const [header, ...rows] = parseCsv(text);
    expect(rows).toHaveLength(1);
    const cell = (column: string) => rows[0][header.indexOf(column)];

    expect(cell("full_name")).toBe(`'${hostile.full_name}`);
    expect(cell("major")).toBe("'+SUM(1,2)");
    expect(cell("team_name")).toBe("'-2+3");
    expect(cell("teammates")).toBe("'@cmd|' /C calc'!A0");
    expect(cell("working_on")).toBe("'\tTab-led answer");
    expect(cell("question")).toBe("'\rCR-led answer");
    expect(cell("availability_notes")).toBe("'   =indented formula");
    expect(cell("organizer_notes")).toBe("'@notes");
    expect(cell("link")).toBe("'-1");
    // No cell anywhere in the file starts a formula.
    for (const r of [header, ...rows]) {
      for (const value of r) expect(value).not.toMatch(/^(?:[\t\r]|\s*[=+\-@])/);
    }
  });
});

describe("CSV export filtered to Rishab (through the route)", () => {
  it("exports only applications listing Rishab, with his Oct 1 12:00–5:00 PM window and the student's availability notes", async () => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    const first = await insertApplication(db, {
      fullName: "Rishab Export First",
      email: "rishab.export.first@illinois.edu",
      mentors: ["rishab-veldur", "patrick-haddox"],
      availability: ["window:rishab-veldur-2026-10-01"],
      createdAt: "2026-09-24T15:00:00Z",
    });
    await db.query(`update applications set availability_notes = $2 where id = $1`, [first, "Thu Oct 1 after 2 PM"]);
    const second = await insertApplication(db, {
      fullName: "Rishab Export Second",
      email: "rishab.export.second@illinois.edu",
      mentors: ["patrick-haddox", "rishab-veldur"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
      createdAt: "2026-09-24T16:00:00Z",
    });

    const read = async (query: string) => {
      const res = await exportCsv(req(`/api/organizer/export?${query}`));
      expect(res.status).toBe(200);
      const [header, ...rows] = parseCsv(new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()).slice(3)));
      return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    };

    const rows = await read("mentor=rishab-veldur");
    expect(rows.map((r) => [r.id, r.full_name])).toEqual([
      [second, "Rishab Export Second"],
      [first, "Rishab Export First"],
    ]);
    expect(rows[1]).toMatchObject({
      status: "Submitted",
      first_choice: "Rishab Veldur",
      preferred_mentors: "1. Rishab Veldur; 2. Patrick Haddox",
      availability: "Rishab Veldur: Thu, Oct 1 · 12:00–5:00 PM CT (window)",
      availability_notes: "Thu Oct 1 after 2 PM",
      appointments: "",
    });
    expect(rows[0]).toMatchObject({
      first_choice: "Patrick Haddox",
      preferred_mentors: "1. Patrick Haddox; 2. Rishab Veldur",
      availability: "Patrick Haddox: Thu, Oct 1 · 10:00–11:30 AM CT (window)",
    });

    // First choice only, and by his window: just the first application.
    expect((await read("mentor=rishab-veldur&choice=first")).map((r) => r.id)).toEqual([first]);
    expect((await read("availability=window:rishab-veldur-2026-10-01")).map((r) => r.id)).toEqual([first]);
    // Oct 2 isn't one of his office-hours windows: dropped, so the export isn't silently empty.
    const unknownWindow = await read("mentor=rishab-veldur&availability=window:rishab-veldur-2026-10-02");
    expect(unknownWindow.map((r) => r.id)).toEqual([second, first]);
  });
});

describe("organizer sign-in", () => {
  it("sets a strict httpOnly cookie on success and rejects wrong passwords", async () => {
    const wrong = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: "nope" }, cookie: null, ip: "10.0.0.1" }),
    );
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const ok = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: PASSWORD }, cookie: null, ip: "10.0.0.1" }),
    );
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^fw_organizer=[^;]+\.[^;]+;/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");

    // The issued cookie authorizes requests.
    const token = cookie.split(";")[0];
    expect((await exportCsv(req("/api/organizer/export", { cookie: token }))).status).toBe(200);

    const out = await logout(req("/api/organizer/session", { method: "DELETE", cookie: token }));
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects cross-origin sign-in and invalid bodies", async () => {
    const cross = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: PASSWORD }, origin: "https://evil.example", cookie: null }),
    );
    expect(cross.status).toBe(403);
    const invalid = await login(req("/api/organizer/session", { method: "POST", body: { password: PASSWORD }, cookie: null, ip: "10.0.0.9" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ fieldErrors: { name: expect.any(String) } });
  });

  it("rate limits sign-in attempts per IP (8 per 15 minutes)", async () => {
    const attempt = (password: string) =>
      login(req("/api/organizer/session", { method: "POST", body: { name: "Sam", password }, cookie: null, ip: "10.0.0.2" }));
    for (let i = 0; i < 8; i++) expect((await attempt("wrong-password")).status).toBe(401);
    const limited = await attempt(PASSWORD);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: "rate_limited" });
    // Another IP is unaffected.
    const other = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: PASSWORD }, cookie: null, ip: "10.0.0.3" }),
    );
    expect(other.status).toBe(200);
  });

  it("doesn't let a handful of networks lock every organizer out (shared limit 300 per 15 minutes)", async () => {
    expect(ORGANIZER_LOGIN_LIMITS).toEqual({ perIp: 8, all: 300, windowSeconds: 15 * 60 });
    // Eight networks each use up their own 8 attempts: 64 failures, more than the old shared limit of 50.
    for (let n = 1; n <= 8; n++) {
      for (let i = 0; i < ORGANIZER_LOGIN_LIMITS.perIp; i++) {
        const res = await login(
          req("/api/organizer/session", { method: "POST", body: { name: "Guess", password: "wrong-password" }, cookie: null, ip: `10.9.0.${n}` }),
        );
        expect(res.status).toBe(401);
      }
    }
    // An organizer on another network can still sign in.
    const organizer = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: PASSWORD }, cookie: null, ip: "10.9.1.1" }),
    );
    expect(organizer.status).toBe(200);
    // The noisy networks stay limited.
    const noisy = await login(
      req("/api/organizer/session", { method: "POST", body: { name: "Sam", password: PASSWORD }, cookie: null, ip: "10.9.0.1" }),
    );
    expect(noisy.status).toBe(429);
  });
});
