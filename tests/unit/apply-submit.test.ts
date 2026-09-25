import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationStatusPage from "@/app/apply/status/[token]/page";
import { mentors } from "@/content/mentors";
import type { Mentor } from "@/content/types";
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

/**
 * Synthetic mentor (not real content) with a date-only window: the date is set, the time isn't.
 * No real mentor has one now that Rishab's Thu, Oct 1 window has a time, but the path stays for
 * future mentors, so it keeps its coverage here.
 */
const DATE_ONLY_MENTOR: Mentor = {
  id: "fixture-casey",
  name: "Casey Fixture",
  firstName: "Casey",
  role: null,
  company: null,
  headshot: null,
  bio: null,
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
  availability: [
    { id: "fixture-casey-2026-10-01", date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" },
  ],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [],
};

/**
 * Synthetic mentor (not real content) whose times aren't set at all: no windows or slots
 * (scheduling in progress). Vik is the only real one now that Elliott has windows, so this keeps
 * the coverage of several such mentors in one application.
 */
const SCHEDULING_MENTOR: Mentor = {
  ...DATE_ONLY_MENTOR,
  id: "fixture-morgan",
  name: "Morgan Fixture",
  firstName: "Morgan",
  availability: [],
};

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
        // Reads as "office hours during Founders Week" in the email.
        siteName: site.shortName,
        // The email says how long a session is, from the same rule the site uses.
        officeHours: site.officeHours,
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
          mentorIds: ["vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: [],
          referrerMentorId: "vikram-lakhwara",
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
    expect(m).toEqual({ mentor_id: "vikram-lakhwara", rank: 1 });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      { mentors: [{ name: "Vikram “Vik” Lakhwara", schedulingInProgress: true }] },
    ]);
  });

  it("stores an interest-only application for Vik and another mentor still scheduling (fixture): ranked preferences, zero availability rows", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["fixture-morgan", "vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: [],
          referrerMentorId: "fixture-morgan",
        }),
      ),
      deps({ getMentors: () => [...mentors, SCHEDULING_MENTOR] }),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const ranked = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
      [id],
    );
    expect(ranked).toEqual([
      { mentor_id: "vikram-lakhwara", rank: 1 },
      { mentor_id: "fixture-morgan", rank: 2 },
    ]);
    expect(await count("application_availability")).toBe(0);
    const [app] = await db.query<{ first_choice_mentor_id: string; referrer_mentor_id: string }>(
      `select first_choice_mentor_id, referrer_mentor_id from applications where id = $1`,
      [id],
    );
    expect(app).toEqual({ first_choice_mentor_id: "vikram-lakhwara", referrer_mentor_id: "fixture-morgan" });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      {
        mentors: [
          { name: "Vikram “Vik” Lakhwara", schedulingInProgress: true },
          { name: "Morgan Fixture", schedulingInProgress: true },
        ],
      },
    ]);
  });

  it("stores interest in Vik (scheduling in progress) as first choice next to Patrick's window", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["patrick-haddox", "vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: ["window:patrick-haddox-2026-10-01-am"],
          referrerMentorId: "vikram-lakhwara",
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
      { mentor_id: "patrick-haddox", rank: 2 },
    ]);
    // Only Patrick has a time; Vik is interest only.
    const availability = await db.query<{ mentor_id: string; option_kind: string; option_id: string }>(
      `select mentor_id, option_kind, option_id from application_availability where application_id = $1`,
      [id],
    );
    expect(availability).toEqual([
      { mentor_id: "patrick-haddox", option_kind: "window", option_id: "patrick-haddox-2026-10-01-am" },
    ]);
    const [app] = await db.query<{ first_choice_mentor_id: string; referrer_mentor_id: string }>(
      `select first_choice_mentor_id, referrer_mentor_id from applications where id = $1`,
      [id],
    );
    expect(app).toEqual({ first_choice_mentor_id: "vikram-lakhwara", referrer_mentor_id: "vikram-lakhwara" });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      {
        mentors: [
          { name: "Vikram “Vik” Lakhwara", schedulingInProgress: true },
          { name: "Patrick Haddox", schedulingInProgress: false },
        ],
      },
    ]);
  });

  it("stores an Elliott application: any one of his three windows is enough without a note, and he isn't “scheduling in progress”", async () => {
    const ELLIOTT_WINDOWS = ["elliott-notrica-2026-09-30-am", "elliott-notrica-2026-09-30-pm", "elliott-notrica-2026-10-01-pm"];
    const ids: string[] = [];
    for (const window of ELLIOTT_WINDOWS) {
      const res = await handleApplicationSubmission(
        post(
          validPayload({
            email: `elliott.${ids.length}@illinois.edu`,
            mentorIds: ["elliott-notrica"],
            firstChoiceMentorId: "elliott-notrica",
            availability: [`window:${window}`],
            availabilityNotes: "",
            referrerMentorId: "elliott-notrica",
          }),
        ),
        deps(),
      );
      expect(res.status, window).toBe(201);
      const { id } = await res.json();
      expect(
        await db.query(`select mentor_id, option_kind, option_id from application_availability where application_id = $1`, [id]),
        window,
      ).toEqual([{ mentor_id: "elliott-notrica", option_kind: "window", option_id: window }]);
      ids.push(id);
    }
    // All three at once: one row each.
    const all = await handleApplicationSubmission(
      post(
        validPayload({
          email: "elliott.all@illinois.edu",
          mentorIds: ["elliott-notrica"],
          firstChoiceMentorId: "elliott-notrica",
          availability: ELLIOTT_WINDOWS.map((w) => `window:${w}`),
          availabilityNotes: "",
        }),
      ),
      deps(),
    );
    expect(all.status).toBe(201);
    const { id: allId } = await all.json();
    expect(
      await db.query<{ option_id: string }>(
        `select option_id from application_availability where application_id = $1 order by option_id`,
        [allId],
      ),
    ).toEqual(ELLIOTT_WINDOWS.map((option_id) => ({ option_id })));
    expect(await count("applications")).toBe(4);
    await Promise.all(scheduled);
    expect(sendAcknowledgment).toHaveBeenCalledTimes(4);
    for (const call of sendAcknowledgment.mock.calls) {
      expect(call).toMatchObject([{ mentors: [{ name: "Elliott Notrica", schedulingInProgress: false }] }]);
    }
    // Applying reserves nothing.
    expect(await getApplicationStatusView(db, ids[0])).toMatchObject({
      status: "submitted",
      mentors: [{ mentorId: "elliott-notrica", rank: 1 }],
      appointments: [],
    });

    // Nothing ticked and no note: the general rule, never "Elliott’s times aren’t set yet".
    const nothing = await handleApplicationSubmission(
      post(validPayload({ mentorIds: ["elliott-notrica"], firstChoiceMentorId: "elliott-notrica", availability: [], availabilityNotes: "" })),
      deps(),
    );
    expect(nothing.status).toBe(400);
    expect((await nothing.json()).fieldErrors).toEqual({
      availabilityNotes: "Tell us when you’re generally free during Founders Week (or pick one of the listed times).",
    });
    // A window he doesn't have is refused.
    const madeUp = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["elliott-notrica"],
          firstChoiceMentorId: "elliott-notrica",
          availability: ["window:elliott-notrica-2026-10-01-am"],
        }),
      ),
      deps(),
    );
    expect(madeUp.status).toBe(400);
    expect(Object.keys((await madeUp.json()).fieldErrors)).toEqual(["availability"]);
    expect(await count("applications")).toBe(4);
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

  it("stores a Ron application with his Thu, Oct 1 window (2:30–4:30 PM CT) ticked and no note: he isn't “scheduling in progress”", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["ron-lewis"],
          firstChoiceMentorId: "ron-lewis",
          availability: ["window:ron-lewis-2026-10-01-pm"],
          availabilityNotes: "",
          referrerMentorId: "ron-lewis",
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(
      await db.query(`select mentor_id, option_kind, option_id from application_availability where application_id = $1`, [id]),
    ).toEqual([{ mentor_id: "ron-lewis", option_kind: "window", option_id: "ron-lewis-2026-10-01-pm" }]);
    const [app] = await db.query<{ availability_notes: string | null; referrer_mentor_id: string }>(
      `select availability_notes, referrer_mentor_id from applications where id = $1`,
      [id],
    );
    expect(app).toEqual({ availability_notes: null, referrer_mentor_id: "ron-lewis" });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([{ mentors: [{ name: "Ron Lewis", schedulingInProgress: false }] }]);
    // Applying reserves nothing.
    expect(await getApplicationStatusView(db, id)).toMatchObject({
      status: "submitted",
      mentors: [{ mentorId: "ron-lewis", rank: 1 }],
      appointments: [],
    });
    // Nothing is published for him on Oct 4: a made-up window for that day is refused.
    const oct4 = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["ron-lewis"],
          firstChoiceMentorId: "ron-lewis",
          availability: ["window:ron-lewis-2026-10-04"],
        }),
      ),
      deps(),
    );
    expect(oct4.status).toBe(400);
    expect(Object.keys((await oct4.json()).fieldErrors)).toEqual(["availability"]);
    expect(await count("applications")).toBe(1);
  });

  it("stores a Rishab application: his mentor row, his Thu, Oct 1 window row and the optional broad-availability note", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["rishab-veldur"],
          firstChoiceMentorId: "rishab-veldur",
          availability: ["window:rishab-veldur-2026-10-01"],
          availabilityNotes: "Free after 3 PM on Thursday",
          referrerMentorId: "rishab-veldur",
        }),
      ),
      deps(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(isSubmitSuccess(body)).toBe(true);
    const ranked = await db.query<{ mentor_id: string; rank: number }>(
      `select mentor_id, rank from application_mentors where application_id = $1 order by rank`,
      [body.id],
    );
    expect(ranked).toEqual([{ mentor_id: "rishab-veldur", rank: 1 }]);
    const availability = await db.query<{ mentor_id: string; option_kind: string; option_id: string }>(
      `select mentor_id, option_kind, option_id from application_availability where application_id = $1`,
      [body.id],
    );
    expect(availability).toEqual([
      { mentor_id: "rishab-veldur", option_kind: "window", option_id: "rishab-veldur-2026-10-01" },
    ]);
    const [app] = await db.query<{ first_choice_mentor_id: string; referrer_mentor_id: string; availability_notes: string }>(
      `select first_choice_mentor_id, referrer_mentor_id, availability_notes from applications where id = $1`,
      [body.id],
    );
    expect(app).toEqual({
      first_choice_mentor_id: "rishab-veldur",
      referrer_mentor_id: "rishab-veldur",
      availability_notes: "Free after 3 PM on Thursday",
    });
    expect(await count("applications")).toBe(1);
    expect(await count("application_mentors")).toBe(1);
    expect(await count("application_availability")).toBe(1);
    // His window is published, so he isn't "scheduling in progress" in the receipt.
    await Promise.all(scheduled);
    expect(sendAcknowledgment).toHaveBeenCalledTimes(1);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      { mentors: [{ name: "Rishab Veldur", schedulingInProgress: false }] },
    ]);
    // Applying reserves nothing: the status view lists him, with no appointment.
    expect(await getApplicationStatusView(db, body.id)).toMatchObject({
      status: "submitted",
      mentors: [{ mentorId: "rishab-veldur", rank: 1 }],
      appointments: [],
    });
  });

  it("stores Rishab + Patrick (Rishab first) with both windows, ranked", async () => {
    const res = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["patrick-haddox", "rishab-veldur"],
          firstChoiceMentorId: "rishab-veldur",
          availability: ["window:patrick-haddox-2026-10-01-am", "window:rishab-veldur-2026-10-01"],
          availabilityNotes: "Thursday afternoon",
          referrerMentorId: "rishab-veldur",
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
      { mentor_id: "rishab-veldur", rank: 1 },
      { mentor_id: "patrick-haddox", rank: 2 },
    ]);
    const availability = await db.query<{ mentor_id: string; option_kind: string; option_id: string }>(
      `select mentor_id, option_kind, option_id from application_availability where application_id = $1 order by mentor_id`,
      [id],
    );
    expect(availability).toEqual([
      { mentor_id: "patrick-haddox", option_kind: "window", option_id: "patrick-haddox-2026-10-01-am" },
      { mentor_id: "rishab-veldur", option_kind: "window", option_id: "rishab-veldur-2026-10-01" },
    ]);
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      {
        mentors: [
          { name: "Rishab Veldur", schedulingInProgress: false },
          { name: "Patrick Haddox", schedulingInProgress: false },
        ],
      },
    ]);
  });

  it("accepts Rishab's window ticked alone, with no note (his time is set, like Patrick's)", async () => {
    const cases: [string[], string[]][] = [
      [["rishab-veldur"], ["window:rishab-veldur-2026-10-01"]],
      [["rishab-veldur", "patrick-haddox"], ["window:patrick-haddox-2026-10-01-am"]],
    ];
    const ids: string[] = [];
    for (const [mentorIds, availability] of cases) {
      const res = await handleApplicationSubmission(
        post(validPayload({ mentorIds, firstChoiceMentorId: "rishab-veldur", availability, availabilityNotes: "" })),
        deps(),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(isSubmitSuccess(body)).toBe(true);
      ids.push(body.id);
    }
    expect(await count("applications")).toBe(2);
    const [alone, withPatrick] = ids;
    expect(
      await db.query(`select mentor_id, option_kind, option_id from application_availability where application_id = $1`, [alone]),
    ).toEqual([{ mentor_id: "rishab-veldur", option_kind: "window", option_id: "rishab-veldur-2026-10-01" }]);
    expect(
      await db.query(`select mentor_id, option_kind, option_id from application_availability where application_id = $1`, [
        withPatrick,
      ]),
    ).toEqual([{ mentor_id: "patrick-haddox", option_kind: "window", option_id: "patrick-haddox-2026-10-01-am" }]);
    // No note given: nothing stored for it.
    expect(
      await db.query(`select availability_notes from applications where id in ($1, $2)`, ids),
    ).toEqual([{ availability_notes: null }, { availability_notes: null }]);
  });

  it("rejects Rishab with nothing ticked and no note, names only mentors still scheduling, and refuses Fri, Oct 2", async () => {
    const nothing = await handleApplicationSubmission(
      post(validPayload({ mentorIds: ["rishab-veldur"], firstChoiceMentorId: "rishab-veldur", availability: [], availabilityNotes: "" })),
      deps(),
    );
    expect(nothing.status).toBe(400);
    const nothingBody = await nothing.json();
    expect(nothingBody).toMatchObject({ ok: false, error: "validation" });
    expect(nothingBody.fieldErrors).toEqual({
      availabilityNotes: "Tell us when you’re generally free during Founders Week (or pick one of the listed times).",
    });
    // His ticked window doesn't cover Vik, whose times aren't set: only Vik is named (Elliott's times are set).
    const withVik = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["rishab-veldur", "elliott-notrica", "vikram-lakhwara"],
          firstChoiceMentorId: "rishab-veldur",
          availability: ["window:rishab-veldur-2026-10-01"],
          availabilityNotes: "",
        }),
      ),
      deps(),
    );
    expect(withVik.status).toBe(400);
    expect((await withVik.json()).fieldErrors).toEqual({
      availabilityNotes: "Tell us when you’re generally free during Founders Week. Vik’s times aren’t set yet.",
    });
    // He has no office hours on Fri, Oct 2.
    const oct2 = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["rishab-veldur"],
          firstChoiceMentorId: "rishab-veldur",
          availability: ["window:rishab-veldur-2026-10-02"],
        }),
      ),
      deps(),
    );
    expect(oct2.status).toBe(400);
    expect(Object.keys((await oct2.json()).fieldErrors)).toEqual(["availability"]);
    expect(await count("applications")).toBe(0);
    expect(sendAcknowledgment).not.toHaveBeenCalled();
  });

  it("rejects a date-only mentor (fixture) without a broad-availability note, even with that window or Patrick's ticked", async () => {
    const withFixture = () => deps({ getMentors: () => [...mentors, DATE_ONLY_MENTOR] });
    for (const [mentorIds, availability] of [
      [["fixture-casey"], ["window:fixture-casey-2026-10-01"]],
      [["fixture-casey", "patrick-haddox"], ["window:patrick-haddox-2026-10-01-am"]],
    ]) {
      const res = await handleApplicationSubmission(
        post(validPayload({ mentorIds, firstChoiceMentorId: "fixture-casey", availability, availabilityNotes: "" })),
        withFixture(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ ok: false, error: "validation" });
      expect(body.fieldErrors).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Casey’s times aren’t set yet.",
      });
    }
    expect(await count("applications")).toBe(0);
    expect(sendAcknowledgment).not.toHaveBeenCalled();

    // With the note it's stored, window row included; the mentor has a date, so isn't "scheduling in progress".
    const ok = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["fixture-casey"],
          firstChoiceMentorId: "fixture-casey",
          availability: ["window:fixture-casey-2026-10-01"],
          availabilityNotes: "Free after 3 PM on Thursday",
        }),
      ),
      withFixture(),
    );
    expect(ok.status).toBe(201);
    const { id } = await ok.json();
    expect(
      await db.query(`select mentor_id, option_kind, option_id from application_availability where application_id = $1`, [id]),
    ).toEqual([{ mentor_id: "fixture-casey", option_kind: "window", option_id: "fixture-casey-2026-10-01" }]);
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([
      { mentors: [{ name: "Casey Fixture", schedulingInProgress: false }] },
    ]);
    // The fixture is never a mentor in the real content.
    const real = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["fixture-casey"],
          firstChoiceMentorId: "fixture-casey",
          availability: [],
          availabilityNotes: "Thursday",
        }),
      ),
      deps(),
    );
    expect(real.status).toBe(400);
    expect(Object.keys((await real.json()).fieldErrors)).toEqual(["mentorIds"]);
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

    // Events are not office-hours mentors: no application exists for the Dan Caruso fireside chat,
    // Arnav's happy hour at Legends, or the canceled Saturday afterparty.
    for (const mentorIds of [
      ["dan-caruso"],
      ["ron-lewis", "dan-caruso"],
      ["dan-caruso-fireside-chat"],
      ["happy-hour-at-legends-with-arnav-mishra"],
      ["arnav-mishra", "happy-hour-at-legends-with-arnav-mishra"],
      ["founders-week-afterparty"],
    ]) {
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
    expect(await count("applications")).toBe(0);
  });

  it("stores answers with a pasted NUL (or other control characters) cleanly instead of failing with a 500", async () => {
    const NUL = String.fromCharCode(0);
    const BELL = String.fromCharCode(7);
    // Postgres can't store U+0000 in text at all (22021): this is why the schema strips it first.
    await expect(db.query("select $1::text as t", [`a${NUL}b`])).rejects.toThrow();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const payload = validPayload({
      fullName: `Alex${NUL} Student`,
      major: `Computer${NUL} Engineering`,
      participation: "team",
      teamName: `Orbit${BELL}`,
      teammates: `Priya${NUL} Shah`,
      workingOn: `A telemetry${NUL} dashboard for student rocketry teams.`,
      question: `How do I find my first${NUL} paying customers?${NUL}`,
      availabilityNotes: `Class until 10:50${NUL} on Thursday`,
      link: `example.com/deck${NUL}`,
    });
    const res = await handleApplicationSubmission(post(payload), deps());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(isSubmitSuccess(body)).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();

    const [app] = await db.query<Record<string, unknown>>(
      `select full_name, major, team_name, teammates, working_on, question, availability_notes, link_url
         from applications where id = $1`,
      [body.id],
    );
    expect(app).toEqual({
      full_name: "Alex Student",
      major: "Computer Engineering",
      team_name: "Orbit",
      teammates: "Priya Shah",
      working_on: "A telemetry dashboard for student rocketry teams.",
      question: "How do I find my first paying customers?",
      availability_notes: "Class until 10:50 on Thursday",
      link_url: "https://example.com/deck",
    });
    await Promise.all(scheduled);
    expect(sendAcknowledgment.mock.calls[0]).toMatchObject([{ firstName: "Alex" }]);
  });

  it("requires a ticked window or broad availability — and stores broad availability alone (pending mentor)", async () => {
    // Vik's schedule is pending: no window to tick. Without broad availability → 400, nothing stored.
    const missing = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: [],
          availabilityNotes: "",
        }),
      ),
      deps(),
    );
    expect(missing.status).toBe(400);
    const body = await missing.json();
    expect(body).toMatchObject({ ok: false, error: "validation" });
    expect(body.fieldErrors).toEqual({
      availabilityNotes: "Tell us when you’re generally free during Founders Week. Vik’s times aren’t set yet.",
    });
    expect(await count("applications")).toBe(0);

    // With broad availability it's stored — the text is kept for organizers, no availability rows.
    const ok = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["vikram-lakhwara"],
          firstChoiceMentorId: "vikram-lakhwara",
          availability: [],
          availabilityNotes: "Thursday mornings, anytime Friday",
        }),
      ),
      deps(),
    );
    expect(ok.status).toBe(201);
    const { id } = await ok.json();
    const [app] = await db.query<{ availability_notes: string }>(`select availability_notes from applications where id = $1`, [id]);
    expect(app.availability_notes).toBe("Thursday mornings, anytime Friday");
    expect(await count("application_availability")).toBe(0);

    // A ticked window alone (no broad availability) is enough too.
    const windowOnly = await handleApplicationSubmission(
      post(
        validPayload({
          mentorIds: ["patrick-haddox"],
          firstChoiceMentorId: "patrick-haddox",
          availability: ["window:patrick-haddox-2026-10-01-am"],
          availabilityNotes: "",
        }),
      ),
      deps(),
    );
    expect(windowOnly.status).toBe(201);
    expect(await count("applications")).toBe(2);
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
      message: "Thanks for your interest. The office-hours application is now closed.",
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
    expect(getApplicationRateLimits({})).toEqual({ perIpPerHour: 60, perEmailPerDay: 5 });
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
    const limitedBody = await limited.json();
    expect(limitedBody.ok).toBe(false);
    // A first-time applicant on busy campus Wi-Fi isn't told they sent "several applications".
    expect(limitedBody.message).toMatch(/from your network/);

    // Per email, across different IPs.
    const emailEnv = { APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "1" };
    expect((await handleApplicationSubmission(post(validPayload({ email: "same@illinois.edu" })), deps({ env: emailEnv }))).status).toBe(201);
    const again = await handleApplicationSubmission(post(validPayload({ email: "SAME@illinois.edu" })), deps({ env: emailEnv }));
    expect(again.status).toBe(429);
    expect((await again.json()).message).toMatch(/already sent several applications today/);
    expect(await count("applications")).toBe(3);
  });

  it("only saved applications count toward the per-email limit (failed saves don't)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "1" };
    // The application insert fails; everything else (including the rate-limit bookkeeping) works.
    const failingInsert: Database = {
      kind: "pglite",
      query: (text, params) => db.query(text, params),
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({
            query: (text, params) => {
              if (/insert into applications\b/.test(text)) throw Object.assign(new Error("boom"), { code: "XX000" });
              return tx.query(text, params);
            },
          }),
        ),
    };
    for (let i = 0; i < 3; i++) {
      const res = await handleApplicationSubmission(
        post(validPayload({ email: "retry@illinois.edu" })),
        deps({ env, getDb: async () => failingInsert }),
      );
      expect(res.status).toBe(500);
    }
    expect(await count("applications")).toBe(0);
    // Three failed tries later, the student can still submit.
    const ok = await handleApplicationSubmission(post(validPayload({ email: "retry@illinois.edu" })), deps({ env }));
    expect(ok.status).toBe(201);
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

  it("the status page says once how long a session is while there's no appointment yet", async () => {
    const res = await handleApplicationSubmission(post(validPayload()), deps());
    const { id, statusUrl } = await res.json();
    const params = Promise.resolve({ token: String(statusUrl).replace("/apply/status/", "") });
    const pageText = async () =>
      renderToStaticMarkup(await ApplicationStatusPage({ params }))
        .replace(/<[^>]+>/g, " ")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ");

    const minutes = site.officeHours.sessionMinutes;
    const waiting = await pageText();
    expect(waiting).toContain(`No appointment yet. If you’re matched, your ${minutes}-minute session will show up here.`);
    expect(waiting.split(`${minutes}-minute`).length - 1).toBe(1);
    expect(waiting).not.toMatch(/break between sessions|\b(one|two|three|\d+) sessions\b/i);
    // Never the email or answers.
    expect(waiting).not.toMatch(/illinois\.edu|rocketry|customers/);

    // Once there's an appointment, its own time says it all: the line gives way.
    await db.query(
      `insert into appointments (application_id, mentor_id, slot_id, starts_at, ends_at, status, created_by)
       values ($1, 'patrick-haddox', 'patrick-haddox-2026-10-01-am-1000', '2026-10-01T15:00:00Z', '2026-10-01T15:25:00Z', 'confirmed', 'test')`,
      [id],
    );
    const booked = await pageText();
    expect(booked).not.toContain("No appointment yet");
    expect(booked).toContain("Thursday, October 1 · 10:00–10:25 AM CT");
  });
});
