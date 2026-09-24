import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import { isSubmitSuccess } from "@/lib/applications/api-contract";
import { getApplicationStatusView } from "@/lib/applications/repository";
import { getApplicationRateLimits, handleApplicationSubmission, type SubmitDeps } from "@/lib/applications/submit";
import type { SubmissionState } from "@/lib/applications/submission-state";
import {
  __setDbForTests,
  createMemoryDbForTests,
  DatabaseUnavailableError,
  type Database,
} from "@/lib/db/client";
import { verifyStatusToken } from "@/lib/security/status-token";

const ORIGIN = "http://localhost:3000";
let db: Database;
let ipCounter = 0;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    fullName: "Alex Student",
    email: "Alex.Student@Illinois.edu",
    year: "junior",
    major: "Computer Engineering",
    participation: "individual",
    teamName: "",
    teammates: "",
    stage: "building",
    workingOn: "A telemetry dashboard for student rocketry teams.",
    question: "How do I find my first paying customers in aerospace?",
    mentorIds: ["patrick-haddox", "arnav-mishra"],
    firstChoiceMentorId: "arnav-mishra",
    availability: ["window:patrick-haddox-2026-10-01-am", "window:arnav-mishra-2026-10-02-am"],
    availabilityNotes: "Class until 10:50 on Thursday",
    link: "example.com/deck",
    acknowledgeNoGuarantee: true,
    consentToShare: true,
    referrerMentorId: "patrick-haddox",
    nickname: "",
    elapsedMs: 45_000,
    ...overrides,
  };
}

function post(body: unknown, init: { headers?: Record<string, string>; raw?: string } = {}) {
  ipCounter += 1;
  return new Request(`${ORIGIN}/api/applications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      host: "localhost:3000",
      "user-agent": "vitest",
      "x-forwarded-for": `203.0.113.${ipCounter % 250}`,
      ...init.headers,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

const openState: SubmissionState = { open: true, deadline: null };
const scheduled: Promise<unknown>[] = [];
const sendAcknowledgment = vi.fn(async () => undefined);

function deps(extra: Partial<SubmitDeps> = {}): Partial<SubmitDeps> {
  return {
    getSubmissionState: async () => openState,
    getMentors: () => mentors,
    getSite: () => site,
    schedule: (task) => {
      scheduled.push(task());
    },
    sendAcknowledgment,
    siteUrl: () => ORIGIN,
    env: {},
    ...extra,
  };
}

async function count(table: string): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.n;
}

beforeAll(async () => {
  db = await createMemoryDbForTests();
  __setDbForTests(db);
});

afterAll(() => __setDbForTests(undefined));

beforeEach(async () => {
  await db.query(`truncate applications, rate_limit_events cascade`);
  sendAcknowledgment.mockClear();
  scheduled.length = 0;
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/applications", () => {
  it("persists the application, mentors (ranked), availability and activity in one go, then returns 201", async () => {
    const payload = validPayload();
    const res = await handleApplicationSubmission(post(payload), deps());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(isSubmitSuccess(body)).toBe(true);
    expect(body.replay).toBe(false);

    const token = body.statusUrl.replace("/apply/status/", "");
    expect(verifyStatusToken(token)).toBe(body.id);

    const [app] = await db.query<Record<string, unknown>>(`select * from applications where id = $1`, [body.id]);
    expect(app).toMatchObject({
      full_name: "Alex Student",
      email: "alex.student@illinois.edu",
      email_normalized: "alex.student@illinois.edu",
      status: "submitted",
      first_choice_mentor_id: "arnav-mishra",
      referrer_mentor_id: "patrick-haddox",
      link_url: "https://example.com/deck",
      availability_notes: "Class until 10:50 on Thursday",
      team_name: null,
      user_agent: "vitest",
    });
    expect(String(app.submitted_ip_hash)).toHaveLength(32);
    expect(String(app.submitted_ip_hash)).not.toContain("203.0.113");

    const ranked = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
      [body.id],
    );
    expect(ranked).toEqual([
      { mentor_id: "arnav-mishra", rank: 1 },
      { mentor_id: "patrick-haddox", rank: 2 },
    ]);
    const availability = await db.query<{ mentor_id: string; option_kind: string; option_id: string }>(
      `select mentor_id, option_kind, option_id from application_availability where application_id = $1 order by mentor_id`,
      [body.id],
    );
    expect(availability).toEqual([
      { mentor_id: "arnav-mishra", option_kind: "window", option_id: "arnav-mishra-2026-10-02-am" },
      { mentor_id: "patrick-haddox", option_kind: "window", option_id: "patrick-haddox-2026-10-01-am" },
    ]);
    const activity = await db.query<{ actor: string; action: string }>(
      `select actor, action from application_activity where application_id = $1`,
      [body.id],
    );
    expect(activity).toEqual([{ actor: "applicant", action: "submitted" }]);

    // Acknowledgment is scheduled after commit with an absolute status link.
    await Promise.all(scheduled);
    expect(sendAcknowledgment).toHaveBeenCalledTimes(1);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      {
        to: "alex.student@illinois.edu",
        firstName: "Alex",
        statusUrl: `${ORIGIN}${body.statusUrl}`,
        mentors: [
          { name: "Arnav Mishra", schedulingInProgress: false },
          { name: "Patrick Haddox", schedulingInProgress: false },
        ],
      },
    ]);
  });

  it("replays the same idempotency key without storing a second row or sending a second email", async () => {
    const payload = validPayload();
    const first = await (await handleApplicationSubmission(post(payload), deps())).json();
    const res = await handleApplicationSubmission(post(payload), deps());
    expect(res.status).toBe(200);
    const second = await res.json();
    expect(second).toMatchObject({ ok: true, id: first.id, replay: true, statusUrl: first.statusUrl });
    expect(await count("applications")).toBe(1);
    expect(await count("application_mentors")).toBe(2);
    await Promise.all(scheduled);
    expect(sendAcknowledgment).toHaveBeenCalledTimes(1);
  });

  it("handles concurrent double submits with one row", async () => {
    const payload = validPayload();
    const responses = await Promise.all([
      handleApplicationSubmission(post(payload), deps()),
      handleApplicationSubmission(post(payload), deps()),
    ]);
    const bodies = await Promise.all(responses.map((r) => r.json()));
    expect(bodies.every((b) => b.ok === true)).toBe(true);
    expect(new Set(bodies.map((b) => b.id)).size).toBe(1);
    expect(await count("applications")).toBe(1);
  });

  it("stores an interest-only application (mentor still scheduling) with zero availability rows", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["ron-lewis"],
          firstChoiceMentorId: "ron-lewis",
          availability: [],
          referrerMentorId: "ron-lewis",
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(await count("application_availability")).toBe(0);
    const [m] = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1`,
      [body.id],
    );
    expect(m).toEqual({ mentor_id: "ron-lewis", rank: 1 });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      { mentors: [{ name: "Ron Lewis", schedulingInProgress: true }] },
    ]);
  });

  it("stores an interest-only application for Ron and Vik: ranked preferences, zero availability rows", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["ron-lewis", "vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: [],
          referrerMentorId: "ron-lewis",
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const ranked = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
      [id],
    );
    expect(ranked).toEqual([
      { mentor_id: "vikram-lakhwara", rank: 1 },
      { mentor_id: "ron-lewis", rank: 2 },
    ]);
    expect(await count("application_availability")).toBe(0);
    const [app] = await db.query<{ first_choice_mentor_id: string }>(
      `select first_choice_mentor_id from applications where id = $1`,
      [id],
    );
    expect(app.first_choice_mentor_id).toBe("vikram-lakhwara");
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      {
        mentors: [
          { name: "Vikram “Vik” Lakhwara", schedulingInProgress: true },
          { name: "Ron Lewis", schedulingInProgress: true },
        ],
      },
    ]);
  });

  it("stores Patrick's window + Ron (first choice Ron) with Ron ranked first and one availability row", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["patrick-haddox", "ron-lewis"],
          firstChoiceMentorId: "ron-lewis",
          availability: ["window:patrick-haddox-2026-10-01-am"],
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const ranked = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
      [id],
    );
    expect(ranked).toEqual([
      { mentor_id: "ron-lewis", rank: 1 },
      { mentor_id: "patrick-haddox", rank: 2 },
    ]);
    const availability = await db.query<{ mentor_id: string; option_kind: string; option_id: string }>(
      `select mentor_id, option_kind, option_id from application_availability where application_id = $1`,
      [id],
    );
    expect(availability).toEqual([
      { mentor_id: "patrick-haddox", option_kind: "window", option_id: "patrick-haddox-2026-10-01-am" },
    ]);
    const [app] = await db.query<{ first_choice_mentor_id: string }>(
      `select first_choice_mentor_id from applications where id = $1`,
      [id],
    );
    expect(app.first_choice_mentor_id).toBe("ron-lewis");
  });

  it("rejects times that don't belong to a selected mentor, and anything that isn't a mentor (no Dan Caruso)", async () => {
    // Patrick's window without choosing Patrick.
    const stray = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["ron-lewis"],
          firstChoiceMentorId: "ron-lewis",
          availability: ["window:patrick-haddox-2026-10-01-am"],
        }),
      ),
      deps(),
    );
    expect(stray.status).toBe(400);
    expect((await stray.json()).fieldErrors).toHaveProperty("availability");

    // The Dan Caruso fireside chat is an event, not an office-hours mentor: no application exists.
    for (const mentorIds of [["dan-caruso"], ["ron-lewis", "dan-caruso"]]) {
      const res = await handleApplicationSubmission(
        post(validPayload({ mentorIds, firstChoiceMentorId: mentorIds[0], availability: [] })),
        deps(),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).fieldErrors).toHaveProperty("mentorIds");
    }
    expect(await count("applications")).toBe(0);
  });

  it("returns 400 with field errors for invalid answers and stores nothing", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          email: "alex@gmail.com",
          fullName: "",
          mentorIds: ["patrick-haddox"],
          firstChoiceMentorId: "patrick-haddox",
          availability: [],
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "validation" });
    expect(body.fieldErrors).toHaveProperty("email");
    expect(body.fieldErrors).toHaveProperty("fullName");
    expect(body.fieldErrors["availability.patrick-haddox"]).toMatch(/Patrick/);
    expect(await count("applications")).toBe(0);
  });

  it("rejects honeypot and too-fast submissions with 400, storing nothing and never claiming success", async () => {
    for (const override of [{ nickname: "bot" }, { elapsedMs: 800 }, { elapsedMs: undefined }]) {
      const res = await handleApplicationSubmission(post(validPayload(override)), deps());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBe("rejected");
    }
    expect(await count("applications")).toBe(0);
    expect(sendAcknowledgment).not.toHaveBeenCalled();
  });

  it("rejects cross-origin posts, non-JSON bodies and oversized bodies", async () => {
    const cross = await handleApplicationSubmission(
      post(validPayload(), { headers: { origin: "https://evil.example" } }),
      deps(),
    );
    expect(cross.status).toBe(403);
    const crossSite = await handleApplicationSubmission(
      post(validPayload(), { headers: { "sec-fetch-site": "cross-site" } }),
      deps(),
    );
    expect(crossSite.status).toBe(403);

    const form = await handleApplicationSubmission(
      post(null, { headers: { "content-type": "application/x-www-form-urlencoded" }, raw: "a=b" }),
      deps(),
    );
    expect(form.status).toBe(415);

    const huge = await handleApplicationSubmission(
      post(null, { raw: JSON.stringify(validPayload({ teammates: "x".repeat(40_000) })) }),
      deps(),
    );
    expect(huge.status).toBe(413);

    const broken = await handleApplicationSubmission(post(null, { raw: "{not json" }), deps());
    expect(broken.status).toBe(400);
    expect(await count("applications")).toBe(0);
  });

  it("answers 403 when applications are closed and 503 when storage isn't configured", async () => {
    const closed: SubmissionState = {
      open: false,
      reason: "deadline-passed",
      title: "The application deadline has passed",
      message: "Thanks for your interest — the office-hours application is closed.",
      organizerHint: null,
      deadline: null,
      opensAt: null,
    };
    const res = await handleApplicationSubmission(post(validPayload()), deps({ getSubmissionState: async () => closed }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: "closed", title: closed.title });

    const unconfigured: SubmissionState = { ...closed, reason: "not-configured", title: "Not yet", message: "Soon." };
    const res2 = await handleApplicationSubmission(
      post(validPayload()),
      deps({ getSubmissionState: async () => unconfigured }),
    );
    expect(res2.status).toBe(503);
    expect(await count("applications")).toBe(0);
  });

  it("rate limits per IP and per email with 429 + Retry-After (limits configurable via env)", async () => {
    expect(getApplicationRateLimits({})).toEqual({ perIpPerHour: 10, perEmailPerDay: 5 });
    expect(
      getApplicationRateLimits({ APPLICATION_RATE_LIMIT_PER_HOUR: "3", APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "nope" }),
    ).toEqual({ perIpPerHour: 3, perEmailPerDay: 5 });

    const ipHeaders = { "x-forwarded-for": "198.51.100.7" };
    const env = { APPLICATION_RATE_LIMIT_PER_HOUR: "2", APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "50" };
    for (let i = 0; i < 2; i++) {
      const ok = await handleApplicationSubmission(
        post(validPayload({ email: `ip${i}@illinois.edu` }), { headers: ipHeaders }),
        deps({ env }),
      );
      expect(ok.status).toBe(201);
    }
    const limited = await handleApplicationSubmission(
      post(validPayload({ email: "ip3@illinois.edu" }), { headers: ipHeaders }),
      deps({ env }),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).ok).toBe(false);

    // Per email, across different IPs.
    const emailEnv = { APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "1" };
    expect((await handleApplicationSubmission(post(validPayload({ email: "same@illinois.edu" })), deps({ env: emailEnv }))).status).toBe(201);
    const again = await handleApplicationSubmission(post(validPayload({ email: "SAME@illinois.edu" })), deps({ env: emailEnv }));
    expect(again.status).toBe(429);
    expect(await count("applications")).toBe(3);
  });

  it("never reports success when persistence fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: Database = {
      kind: "pglite",
      query: (text, params) => db.query(text, params),
      transaction: async () => {
        throw Object.assign(new Error("disk full"), { code: "53100" });
      },
    };
    const res = await handleApplicationSubmission(post(validPayload()), deps({ getDb: async () => failing }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(await count("applications")).toBe(0);
    // Logs carry no answers or emails.
    expect(errorSpy.mock.calls.flat().join(" ")).not.toMatch(/illinois|Alex|rocketry/i);

    const down = await handleApplicationSubmission(
      post(validPayload()),
      deps({
        getDb: async () => {
          throw new DatabaseUnavailableError("unreachable", "Could not connect");
        },
      }),
    );
    expect(down.status).toBe(503);
    expect((await down.json()).ok).toBe(false);
  });

  it("rolls back every row when a later insert in the transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Break the activity table so the last insert in the transaction fails.
    await db.query(`alter table application_activity rename to application_activity_broken`);
    try {
      const res = await handleApplicationSubmission(post(validPayload()), deps());
      expect(res.status).toBe(500);
      expect((await res.json()).ok).toBe(false);
      expect(await count("applications")).toBe(0);
      expect(await count("application_mentors")).toBe(0);
    } finally {
      await db.query(`alter table application_activity_broken rename to application_activity`);
    }
  });
});

describe("status page data", () => {
  it("returns status, first name and ranked mentors — never email or answers", async () => {
    const res = await handleApplicationSubmission(post(validPayload()), deps());
    const { id } = await res.json();
    const view = await getApplicationStatusView(db, id);
    expect(view).toMatchObject({
      id,
      status: "submitted",
      firstName: "Alex",
      mentors: [
        { mentorId: "arnav-mishra", rank: 1 },
        { mentorId: "patrick-haddox", rank: 2 },
      ],
      appointments: [],
    });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/illinois\.edu|Student|rocketry|customers|Computer Engineering/);
    expect(await getApplicationStatusView(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("includes active appointments only", async () => {
    const res = await handleApplicationSubmission(post(validPayload()), deps());
    const { id } = await res.json();
    await db.query(
      `insert into appointments (application_id, mentor_id, slot_id, starts_at, ends_at, status, created_by)
       values ($1, 'patrick-haddox', 's-live', '2026-10-01T15:00:00Z', '2026-10-01T15:20:00Z', 'confirmed', 'test'),
              ($1, 'patrick-haddox', 's-old', '2026-10-01T15:30:00Z', '2026-10-01T15:50:00Z', 'canceled', 'test')`,
      [id],
    );
    const view = await getApplicationStatusView(db, id);
    expect(view?.appointments).toEqual([
      expect.objectContaining({ slotId: "s-live", status: "confirmed", startsAt: "2026-10-01T15:00:00.000Z" }),
    ]);
  });
});
