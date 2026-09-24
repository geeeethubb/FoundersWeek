import { describe, expect, it, vi } from "vitest";
import {
  SECTIONS,
  createValidator,
  effectiveAvailability,
  effectiveFirstChoice,
  focusTargetId,
  mergeAnnouncement,
  newIdempotencyKey,
  orderErrors,
  prefillNote,
  requiredProgress,
  sectionProgress,
  splitPhrases,
  toSubmissionValues,
  type FormState,
} from "@/components/apply/form-model";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { describeWait, isSubmitSuccess } from "@/lib/applications/api-contract";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { presentOptions } from "@/lib/applications/option-presentation";
import {
  EMPTY_PREFILL,
  mergePrefill,
  mergeSearchParams,
  prefillParamsFrom,
  prefillParamsKey,
  resolvePrefill,
} from "@/lib/applications/prefill";
import { emptyApplicationValues } from "@/lib/applications/schema";
import { buildAcknowledgmentEmail, sendApplicationAcknowledgment } from "@/lib/email/acknowledgment";

const catalog = buildApplicationCatalog(mentors);
const demoCatalog = buildApplicationCatalog([...mentors, ...demoMentors]);

function state(overrides: Partial<FormState> = {}): FormState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, elapsedMs, ...empty } = emptyApplicationValues("");
  return { ...empty, ...overrides };
}

describe("prefill from deep links", () => {
  it("preselects a mentor and a matching window", () => {
    expect(resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" })).toEqual({
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am"],
      referrerMentorId: "patrick-haddox",
    });
  });

  it("supports interest-only mentors and infers the mentor from a window alone", () => {
    expect(resolvePrefill(catalog, { mentor: "ron-lewis" })).toMatchObject({ mentorIds: ["ron-lewis"], availability: [] });
    expect(resolvePrefill(catalog, { window: "arnav-mishra-2026-10-02-am" })).toMatchObject({
      mentorIds: ["arnav-mishra"],
      availability: ["window:arnav-mishra-2026-10-02-am"],
    });
  });

  it("ignores anything that doesn't match the catalog", () => {
    expect(resolvePrefill(catalog, { mentor: "nobody" })).toEqual(EMPTY_PREFILL);
    expect(resolvePrefill(catalog, { mentor: "nobody", window: "patrick-haddox-2026-10-01-am" })).toEqual(EMPTY_PREFILL);
    expect(resolvePrefill(catalog, { mentor: "arnav-mishra", window: "patrick-haddox-2026-10-01-am" })).toMatchObject({
      mentorIds: ["arnav-mishra"],
      availability: [],
    });
    expect(resolvePrefill(catalog, { mentor: ["ron-lewis", "x"] })).toMatchObject({ mentorIds: ["ron-lewis"] });
    // Demo mentors don't exist in production content.
    expect(resolvePrefill(catalog, { mentor: "demo-avery-sample", slot: "demo-avery-slot-1400" })).toEqual(EMPTY_PREFILL);
    expect(resolvePrefill(demoCatalog, { slot: "demo-avery-slot-1400" })).toMatchObject({
      mentorIds: ["demo-avery-sample"],
      availability: ["slot:demo-avery-slot-1400"],
    });
  });
});

describe("prefill merge while the form is open", () => {
  const presentations = presentOptions(catalog, mentors);
  const answered = state({
    fullName: "Alex Student",
    email: "alex@illinois.edu",
    year: "junior",
    major: "Computer Engineering",
    participation: "team",
    teamName: "Orbit",
    teammates: "Priya Shah",
    stage: "building",
    workingOn: "Telemetry for rocketry teams.",
    question: "How do I find my first customers?",
    availabilityNotes: "Class until 10:50 on Thursday",
    link: "https://example.com",
    acknowledgeNoGuarantee: true,
    consentToShare: true,
  });

  it("adds a mentor without clearing any other answer, and makes it first choice when there is none", () => {
    const { state: next, outcome, changed } = mergeSearchParams(answered, catalog, { mentor: "ron-lewis" });
    expect(changed).toBe(true);
    expect(next).toEqual({
      ...answered,
      mentorIds: ["ron-lewis"],
      firstChoiceMentorId: "ron-lewis",
      availability: [],
      referrerMentorId: "ron-lewis",
    });
    expect(outcome).toEqual({ mentorId: "ron-lewis", mentorAdded: true, madeFirstChoice: true, optionAdded: null });
  });

  it("keeps an existing first choice (explicit or single-mentor) and adds a valid window", () => {
    const withPatrick = {
      ...answered,
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "",
      referrerMentorId: "patrick-haddox",
    };
    const { state: next, outcome } = mergeSearchParams(withPatrick, catalog, {
      mentor: "arnav-mishra",
      window: "arnav-mishra-2026-10-02-am",
    });
    expect(next.mentorIds).toEqual(["patrick-haddox", "arnav-mishra"]);
    // Patrick was the implicit first choice (only mentor) — now explicit, not replaced.
    expect(next.firstChoiceMentorId).toBe("patrick-haddox");
    expect(next.availability).toEqual(["window:arnav-mishra-2026-10-02-am"]);
    // The original referrer is kept.
    expect(next.referrerMentorId).toBe("patrick-haddox");
    expect(outcome).toMatchObject({
      mentorAdded: true,
      madeFirstChoice: false,
      optionAdded: "window:arnav-mishra-2026-10-02-am",
    });
    expect(next.fullName).toBe("Alex Student");
    expect(next.teamName).toBe("Orbit");

    const two = { ...next, firstChoiceMentorId: "arnav-mishra" };
    expect(mergeSearchParams(two, catalog, { mentor: "vikram-lakhwara" }).state.firstChoiceMentorId).toBe("arnav-mishra");
  });

  it("selects a time for a mentor who is already chosen, without duplicating anything", () => {
    const withPatrick = { ...answered, mentorIds: ["patrick-haddox"], firstChoiceMentorId: "patrick-haddox" };
    const first = mergeSearchParams(withPatrick, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    });
    expect(first.state.mentorIds).toEqual(["patrick-haddox"]);
    expect(first.state.availability).toEqual(["window:patrick-haddox-2026-10-01-am"]);
    expect(first.outcome).toMatchObject({ mentorAdded: false, optionAdded: "window:patrick-haddox-2026-10-01-am" });
    const again = mergeSearchParams(first.state, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    });
    expect(again.changed).toBe(false);
    expect(again.state).toBe(first.state);
    expect(again.outcome).toMatchObject({ mentorAdded: false, optionAdded: null, madeFirstChoice: false });
  });

  it("ignores invalid parameters and mismatched options entirely", () => {
    // Dan Caruso's event is not an office-hours option — there is no application for it.
    for (const params of [{}, { mentor: "nobody" }, { mentor: "dan-caruso" }, { window: "nope" }, { slot: "demo-avery-slot-1400" }]) {
      const r = mergeSearchParams(answered, catalog, params);
      expect(r).toEqual({ state: answered, outcome: null, changed: false });
      expect(r.state).toBe(answered);
    }
    // A window that belongs to someone else adds the mentor but not the foreign window.
    const r = mergeSearchParams(answered, catalog, { mentor: "arnav-mishra", window: "patrick-haddox-2026-10-01-am" });
    expect(r.state.mentorIds).toEqual(["arnav-mishra"]);
    expect(r.state.availability).toEqual([]);
    expect(mergePrefill(answered, EMPTY_PREFILL).changed).toBe(false);
  });

  it("adds a mentor still scheduling (Vik) as interest only, keeping the first choice and every answer", () => {
    const withPatrick = {
      ...answered,
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am"],
    };
    const { state: next, outcome } = mergeSearchParams(withPatrick, catalog, { mentor: "vikram-lakhwara", window: "nope" });
    expect(next).toEqual({ ...withPatrick, mentorIds: ["patrick-haddox", "vikram-lakhwara"], referrerMentorId: "vikram-lakhwara" });
    expect(outcome).toEqual({ mentorId: "vikram-lakhwara", mentorAdded: true, madeFirstChoice: false, optionAdded: null });
    expect(mergeAnnouncement(catalog, outcome!, presentations)).toBe(
      "Vikram “Vik” Lakhwara added to your mentors. Scheduling is in progress, so there’s no time to pick — you’re expressing interest.",
    );
  });

  it("reads and keys URL parameters (first value wins)", () => {
    const sp = new URLSearchParams("mentor=ron-lewis&mentor=x&utm_source=ig");
    expect(prefillParamsFrom(sp)).toEqual({ mentor: "ron-lewis" });
    expect(prefillParamsKey({ mentor: "ron-lewis" })).toBe("ron-lewis||");
    expect(prefillParamsKey({ mentor: ["a", "b"], window: "w" })).toBe("a|w|");
    expect(prefillParamsKey({})).toBe("||");
  });

  it("announces what changed in plain language", () => {
    const added = mergeSearchParams(answered, catalog, { mentor: "ron-lewis" }).outcome!;
    expect(mergeAnnouncement(catalog, added, presentations)).toBe(
      "Ron Lewis added to your mentors. Ron is your first choice. Scheduling is in progress, so there’s no time to pick — you’re expressing interest.",
    );
    const withRon = mergeSearchParams(answered, catalog, { mentor: "ron-lewis" }).state;
    const patrick = mergeSearchParams(withRon, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    }).outcome!;
    expect(mergeAnnouncement(catalog, patrick, presentations)).toBe(
      "Patrick Haddox added to your mentors. Thu, Oct 1 · 10:00–11:30 AM CT selected.",
    );
    const same = mergeSearchParams(withRon, catalog, { mentor: "ron-lewis" }).outcome!;
    expect(mergeAnnouncement(catalog, same, presentations)).toBe("Ron Lewis is already in your mentors.");
  });

  it("explains the initial prefill", () => {
    expect(prefillNote(catalog, resolvePrefill(catalog, { mentor: "vikram-lakhwara" }), presentations)).toMatch(
      /^Vikram “Vik” Lakhwara is preselected\. Scheduling is still in progress/,
    );
    expect(
      prefillNote(
        catalog,
        resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" }),
        presentations,
      ),
    ).toBe(
      "Patrick Haddox is preselected, with Thu, Oct 1 · 10:00–11:30 AM CT. Add more mentors if you like — one application covers them all.",
    );
    expect(prefillNote(catalog, EMPTY_PREFILL, presentations)).toBeNull();
  });
});

describe("form model", () => {
  const validate = createValidator(catalog, ["illinois.edu"]);

  it("surfaces per-mentor availability errors together with other field errors", () => {
    const errors = validate(
      toSubmissionValues(state({ mentorIds: ["patrick-haddox"] }), catalog, {
        idempotencyKey: newIdempotencyKey(),
        elapsedMs: 5000,
      }),
    );
    expect(errors.fullName).toBeDefined();
    expect(errors["availability.patrick-haddox"]).toMatch(/Patrick/);
  });

  it("needs no time for mentors still scheduling", () => {
    const errors = validate(
      toSubmissionValues(state({ mentorIds: ["ron-lewis", "vikram-lakhwara"] }), catalog, {
        idempotencyKey: newIdempotencyKey(),
        elapsedMs: 5000,
      }),
    );
    expect(Object.keys(errors).filter((k) => k.startsWith("availability"))).toEqual([]);
    // Two mentors and no explicit first choice.
    expect(errors.firstChoiceMentorId).toBeDefined();
  });

  it("derives the first choice and drops availability of deselected mentors", () => {
    expect(effectiveFirstChoice({ mentorIds: ["ron-lewis"], firstChoiceMentorId: "" })).toBe("ron-lewis");
    expect(effectiveFirstChoice({ mentorIds: ["ron-lewis", "arnav-mishra"], firstChoiceMentorId: "patrick-haddox" })).toBe("");
    expect(
      effectiveAvailability(
        { mentorIds: ["arnav-mishra"], availability: ["window:patrick-haddox-2026-10-01-am", "window:arnav-mishra-2026-10-02-am"] },
        catalog,
      ),
    ).toEqual(["window:arnav-mishra-2026-10-02-am"]);
    const values = toSubmissionValues(state({ participation: "individual", teamName: "Kept in state" }), catalog, {
      idempotencyKey: "k",
      elapsedMs: 1,
    });
    expect(values.teamName).toBe("");
  });

  it("orders summary errors like the form and maps them to focus targets", () => {
    const ordered = orderErrors(
      { consentToShare: "c", "availability.arnav-mishra": "a", fullName: "n", "availability.patrick-haddox": "p" },
      ["patrick-haddox", "arnav-mishra"],
    ).map(([k]) => k);
    // Mentors are step 01, so their errors lead the summary.
    expect(ordered).toEqual(["availability.patrick-haddox", "availability.arnav-mishra", "fullName", "consentToShare"]);
    const s = state({ mentorIds: ["arnav-mishra"] });
    expect(focusTargetId("fullName", s, catalog)).toBe("apply-fullName");
    expect(focusTargetId("stage", s, catalog)).toBe("apply-stage-exploring");
    expect(focusTargetId("availability.arnav-mishra", s, catalog)).toBe("apply-option-window-arnav-mishra-2026-10-02-am");
    expect(focusTargetId("firstChoiceMentorId", s, catalog)).toBe("apply-first-choice-arnav-mishra");
    expect(focusTargetId("idempotencyKey", s, catalog)).toBeNull();
  });

  it("puts mentors first and counts five required steps", () => {
    expect(SECTIONS.map((x) => x.id)).toEqual(["mentors", "about", "team", "project", "links", "confirm"]);
    expect(SECTIONS.map((x) => x.index)).toEqual(["01", "02", "03", "04", "05", "06"]);
    const empty = state();
    const progress = sectionProgress(
      empty,
      validate(toSubmissionValues(empty, catalog, { idempotencyKey: newIdempotencyKey(), elapsedMs: 5000 })),
    );
    // "Solo or team" defaults to individually, so it starts complete.
    expect(requiredProgress(progress)).toEqual({ done: 1, total: 5 });
  });

  it("reports section progress", () => {
    const progress = sectionProgress(state(), validate(toSubmissionValues(state(), catalog, { idempotencyKey: newIdempotencyKey(), elapsedMs: 5000 })));
    expect(Object.fromEntries(progress.map((p) => [p.id, p.complete]))).toEqual({
      about: false,
      team: true,
      project: false,
      mentors: false,
      links: true,
      confirm: false,
    });
  });

  it("creates v4 UUIDs even without crypto.randomUUID", () => {
    const original = crypto.randomUUID;
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      expect(newIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(typeof original).toBe("function");
  });
});

describe("application catalog", () => {
  it("offers exactly the four mentors; Ron and Vik take no time selection; no event (Dan Caruso) is an option", () => {
    expect(catalog.mentors.map((m) => m.id)).toEqual(["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"]);
    const byId = Object.fromEntries(catalog.mentors.map((m) => [m.id, m]));
    expect(byId["ron-lewis"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["vikram-lakhwara"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["patrick-haddox"].options.map((o) => o.key)).toEqual(["window:patrick-haddox-2026-10-01-am"]);
    expect(byId["arnav-mishra"].options.map((o) => o.key)).toEqual(["window:arnav-mishra-2026-10-02-am"]);
    // Vik's title is unverified, so only his organization is shown.
    expect(byId["vikram-lakhwara"].affiliation).toBe("Stakehouse");
    expect(JSON.stringify(catalog)).not.toMatch(/caruso|afterparty/i);
  });

  it("wraps labels only between phrases", () => {
    expect(splitPhrases("Thu, Oct 1 · 10:00–11:30 AM CT")).toEqual(["Thu, Oct 1 ·", "10:00–11:30 AM CT"]);
    expect(splitPhrases("No time to pick yet — express interest")).toEqual(["No time to pick yet —", "express interest"]);
    expect(splitPhrases("Fri, Oct 2 · Morning, before noon CT")).toEqual(["Fri, Oct 2 ·", "Morning, before noon CT"]);
  });
});

describe("option presentation", () => {
  it("labels windows and slots without repeating the badge", () => {
    const p = presentOptions(demoCatalog, [...mentors, ...demoMentors]);
    expect(p["window:patrick-haddox-2026-10-01-am"]).toEqual({
      kind: "window",
      label: "Thu, Oct 1 · 10:00–11:30 AM CT",
      detail: "Exact appointment times will be set within this window.",
    });
    expect(p["window:arnav-mishra-2026-10-02-am"]).toMatchObject({
      kind: "window-approx",
      label: "Fri, Oct 2 · Morning, before noon CT",
    });
    expect(p["slot:demo-avery-slot-1400"]).toMatchObject({ kind: "confirmed", detail: "In person · Demo Hall, Room 202" });
    expect(p["slot:demo-jordan-slot-1500"]).toMatchObject({ kind: "proposed", detail: "Not yet confirmed by Jordan · Virtual" });
  });
});

describe("api contract", () => {
  it("only treats ok responses with an id and status link as success", () => {
    expect(isSubmitSuccess({ ok: true })).toBe(false);
    expect(isSubmitSuccess({ ok: true, id: "x", statusUrl: "https://evil.example" })).toBe(false);
    expect(isSubmitSuccess({ ok: true, id: "x", statusUrl: "/apply/status/x.y", replay: false })).toBe(true);
    expect(describeWait(30)).toBe("a minute or two");
    expect(describeWait(1200)).toBe("about 20 minutes");
    expect(describeWait(86_000)).toBe("about 24 hours");
  });
});

describe("acknowledgment email", () => {
  const input = {
    applicationId: "11111111-1111-4111-8111-111111111111",
    to: "alex@illinois.edu",
    firstName: "<Alex>",
    statusUrl: "https://example.com/apply/status/abc.def",
    siteName: "Founders × Founders Week",
    orgName: "Founders – Illinois Entrepreneurs",
    mentors: [
      { name: "Ron Lewis", schedulingInProgress: true },
      { name: "Patrick Haddox", schedulingInProgress: false },
    ],
  };

  it("is a receipt, not an acceptance, and escapes HTML", () => {
    const { subject, text, html } = buildAcknowledgmentEmail(input);
    expect(subject).toMatch(/received/i);
    expect(text).toContain("does not reserve a time slot");
    expect(text).toContain("email selected students to confirm");
    expect(text).toContain("Ron Lewis (first choice) — scheduling in progress");
    expect(text).toContain("Founders will follow up once availability is finalized.");
    expect(text).toContain(input.statusUrl);
    expect(text).not.toMatch(/accepted|congratulations|confirmed for/i);
    expect(html).toContain("&lt;Alex&gt;");
    expect(html).not.toContain("<Alex>");
  });

  it("posts to Resend with a timeout and idempotency key; skips when unconfigured; never throws", async () => {
    expect(await sendApplicationAcknowledgment(input, { config: null })).toMatchObject({ reason: "not-configured" });

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    const ok = await sendApplicationAcknowledgment(input, {
      config: { apiKey: "re_test", from: "Founders <hi@example.com>", replyTo: null },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(ok).toEqual({ ok: true, id: "email_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(`application-ack-${input.applicationId}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["alex@illinois.edu"] });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const failed = await sendApplicationAcknowledgment(input, {
      config: { apiKey: "re_test", from: "hi@example.com", replyTo: null },
      fetchImpl: failing as unknown as typeof fetch,
    });
    expect(failed).toMatchObject({ ok: false, reason: "network" });
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("alex@illinois.edu");
    errorSpy.mockRestore();
  });
});
