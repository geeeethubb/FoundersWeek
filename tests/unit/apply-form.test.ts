import { describe, expect, it, vi } from "vitest";
import {
  FIELD_ORDER,
  FORM_GROUPS,
  applyLinkAction,
  broadAvailabilityGuidance,
  createValidator,
  effectiveAvailability,
  effectiveFirstChoice,
  emptyFormState,
  focusTargetId,
  joinNames,
  knownTimes,
  mentorsWithoutTimes,
  mergeAnnouncement,
  newIdempotencyKey,
  noticeAfterRemoval,
  orderErrors,
  prefillFromSearch,
  prefillNote,
  prefillNotice,
  removesUrlSelection,
  samePrefill,
  toSubmissionValues,
  withoutPrefillParams,
  type FormState,
  type SelectionNotice,
} from "@/components/apply/form-model";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { describeWait, isSubmitSuccess } from "@/lib/applications/api-contract";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import {
  DRAFT_TTL_MS,
  blankDraftValues,
  draftStorageKey,
  isBlankDraft,
  parseDraft,
  serializeDraft,
  toDraftValues,
} from "@/lib/applications/draft";
import { presentOptions } from "@/lib/applications/option-presentation";
import {
  EMPTY_PREFILL,
  mergePrefill,
  mergeSearchParams,
  prefillParamsFrom,
  prefillParamsKey,
  resolvePrefill,
} from "@/lib/applications/prefill";
import { buildAcknowledgmentEmail, sendApplicationAcknowledgment } from "@/lib/email/acknowledgment";

const catalog = buildApplicationCatalog(mentors);
const demoCatalog = buildApplicationCatalog([...mentors, ...demoMentors]);
const presentations = presentOptions(catalog, mentors);

function state(overrides: Partial<FormState> = {}): FormState {
  return { ...emptyFormState(), ...overrides };
}

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
  availabilityNotes: "Thursday mornings, anytime Friday",
  link: "https://example.com",
  acknowledgeNoGuarantee: true,
  consentToShare: true,
});

describe("prefill from deep links", () => {
  it("preselects a mentor and a matching window", () => {
    expect(resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" })).toEqual({
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am"],
      referrerMentorId: "patrick-haddox",
    });
  });

  it("preselects mentors whose schedule is pending, and infers the mentor from a window alone", () => {
    expect(resolvePrefill(catalog, { mentor: "ron-lewis" })).toMatchObject({ mentorIds: ["ron-lewis"], availability: [] });
    expect(resolvePrefill(catalog, { mentor: "elliott-notrica" })).toEqual({
      mentorIds: ["elliott-notrica"],
      firstChoiceMentorId: "elliott-notrica",
      availability: [],
      referrerMentorId: "elliott-notrica",
    });
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

  it("preselects Rishab and ticks his Thu, Oct 1 window from his “Apply to meet Rishab” link", () => {
    const rishab = {
      mentorIds: ["rishab-veldur"],
      firstChoiceMentorId: "rishab-veldur",
      availability: ["window:rishab-veldur-2026-10-01"],
      referrerMentorId: "rishab-veldur",
    };
    expect(resolvePrefill(catalog, { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" })).toEqual(rishab);
    // The CTA's exact query string (as the page reads it from the URL).
    expect(prefillFromSearch(catalog, "?mentor=rishab-veldur&window=rishab-veldur-2026-10-01")).toEqual(rishab);
    // The window alone identifies him.
    expect(resolvePrefill(catalog, { window: "rishab-veldur-2026-10-01" })).toEqual(rishab);
    // Just the mentor: preselected, nothing ticked.
    expect(resolvePrefill(catalog, { mentor: "rishab-veldur" })).toEqual({ ...rishab, availability: [] });
    // He has no office hours on Fri, Oct 2: a made-up window for that day is ignored.
    expect(resolvePrefill(catalog, { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-02" })).toEqual({
      ...rishab,
      availability: [],
    });
    expect(prefillNote(catalog, rishab, presentations)).toBe(
      "Rishab Veldur is selected below, with “I can make Thu, Oct 1 (exact time to be confirmed)” ticked. Add anyone else you’d like to meet.",
    );
    expect(prefillNotice(catalog, rishab, presentations, 0)).toEqual({
      id: 0,
      kind: "top",
      message:
        "Rishab Veldur is selected below, with “I can make Thu, Oct 1 (exact time to be confirmed)” ticked. Add anyone else you’d like to meet.",
      mentorId: "rishab-veldur",
      optionKey: "window:rishab-veldur-2026-10-01",
    });
  });

  it("explains the initial preselection in one line", () => {
    expect(prefillNote(catalog, resolvePrefill(catalog, { mentor: "elliott-notrica" }), presentations)).toBe(
      "Elliott Notrica is selected below. Add anyone else you’d like to meet.",
    );
    expect(
      prefillNote(
        catalog,
        resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" }),
        presentations,
      ),
    ).toBe(
      "Patrick Haddox is selected below, with “I can make Thu, Oct 1, 10:00–11:30 AM CT” ticked. Add anyone else you’d like to meet.",
    );
    expect(prefillNote(catalog, EMPTY_PREFILL, presentations)).toBeNull();
  });
});

describe("prefill merge while the form is open (or into a restored draft)", () => {
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
    expect(next.availabilityNotes).toBe("Thursday mornings, anytime Friday");

    const two = { ...next, firstChoiceMentorId: "arnav-mishra" };
    expect(mergeSearchParams(two, catalog, { mentor: "vikram-lakhwara" }).state.firstChoiceMentorId).toBe("arnav-mishra");
  });

  it("ticks a time for a mentor who is already chosen, without duplicating anything", () => {
    const withPatrick = { ...answered, mentorIds: ["patrick-haddox"], firstChoiceMentorId: "patrick-haddox" };
    const first = mergeSearchParams(withPatrick, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    });
    expect(first.state.mentorIds).toEqual(["patrick-haddox"]);
    expect(first.state.availability).toEqual(["window:patrick-haddox-2026-10-01-am"]);
    expect(first.outcome).toMatchObject({ mentorAdded: false, optionAdded: "window:patrick-haddox-2026-10-01-am" });
    expect(mergeAnnouncement(catalog, first.outcome!, presentations)).toBe(
      "“I can make Thu, Oct 1, 10:00–11:30 AM CT” is ticked for Patrick Haddox.",
    );
    const again = mergeSearchParams(first.state, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    });
    expect(again.changed).toBe(false);
    expect(again.state).toBe(first.state);
    expect(again.outcome).toMatchObject({ mentorAdded: false, optionAdded: null, madeFirstChoice: false });
  });

  it("ignores invalid parameters and mismatched options entirely", () => {
    // Events are not office-hours options — there is no application for Dan Caruso's fireside chat,
    // Arnav's happy hour at Legends, or the canceled Saturday afterparty.
    for (const params of [
      {},
      { mentor: "nobody" },
      { mentor: "dan-caruso" },
      { mentor: "dan-caruso-fireside-chat" },
      { mentor: "happy-hour-at-legends-with-arnav-mishra" },
      { window: "happy-hour-at-legends-with-arnav-mishra" },
      { mentor: "founders-week-afterparty" },
      { window: "nope" },
      { slot: "demo-avery-slot-1400" },
    ]) {
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

  it("adds mentors whose schedule is pending (Vik, Elliott) without asking for a time", () => {
    const withPatrick = {
      ...answered,
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am"],
    };
    const vik = mergeSearchParams(withPatrick, catalog, { mentor: "vikram-lakhwara", window: "nope" });
    expect(vik.state).toEqual({
      ...withPatrick,
      mentorIds: ["patrick-haddox", "vikram-lakhwara"],
      referrerMentorId: "vikram-lakhwara",
    });
    expect(mergeAnnouncement(catalog, vik.outcome!, presentations)).toBe("Vikram “Vik” Lakhwara added to your mentors.");

    const elliott = mergeSearchParams(answered, catalog, { mentor: "elliott-notrica" });
    expect(elliott.state).toEqual({
      ...answered,
      mentorIds: ["elliott-notrica"],
      firstChoiceMentorId: "elliott-notrica",
      availability: [],
      referrerMentorId: "elliott-notrica",
    });
    expect(mergeAnnouncement(catalog, elliott.outcome!, presentations)).toBe(
      "Elliott Notrica added to your mentors. Elliott is your first choice.",
    );
    // A made-up window for him is ignored: he has no times yet.
    const withWindow = mergeSearchParams(answered, catalog, { mentor: "elliott-notrica", window: "elliott-notrica-2026-10-01-am" });
    expect(withWindow.state.availability).toEqual([]);
    expect(withWindow.outcome?.optionAdded).toBeNull();
  });

  it("reads and keys URL parameters (first value wins)", () => {
    const sp = new URLSearchParams("mentor=ron-lewis&mentor=x&utm_source=ig");
    expect(prefillParamsFrom(sp)).toEqual({ mentor: "ron-lewis" });
    expect(prefillParamsKey({ mentor: "ron-lewis" })).toBe("ron-lewis||");
    expect(prefillParamsKey({ mentor: ["a", "b"], window: "w" })).toBe("a|w|");
    expect(prefillParamsKey({})).toBe("||");
  });

  it("announces what changed in plain language", () => {
    const withRon = mergeSearchParams(answered, catalog, { mentor: "ron-lewis" }).state;
    const patrick = mergeSearchParams(withRon, catalog, {
      mentor: "patrick-haddox",
      window: "patrick-haddox-2026-10-01-am",
    }).outcome!;
    expect(mergeAnnouncement(catalog, patrick, presentations)).toBe(
      "Patrick Haddox added to your mentors. “I can make Thu, Oct 1, 10:00–11:30 AM CT” is ticked.",
    );
    const same = mergeSearchParams(withRon, catalog, { mentor: "ron-lewis" }).outcome!;
    expect(mergeAnnouncement(catalog, same, presentations)).toBe("Ron Lewis is already in your mentors.");
  });

  it("adds Rishab with his Thu, Oct 1 window (time to be confirmed) next to answers already given", () => {
    const { state: next, outcome, changed } = mergeSearchParams(answered, catalog, {
      mentor: "rishab-veldur",
      window: "rishab-veldur-2026-10-01",
    });
    expect(changed).toBe(true);
    expect(next).toEqual({
      ...answered,
      mentorIds: ["rishab-veldur"],
      firstChoiceMentorId: "rishab-veldur",
      availability: ["window:rishab-veldur-2026-10-01"],
      referrerMentorId: "rishab-veldur",
    });
    expect(mergeAnnouncement(catalog, outcome!, presentations)).toBe(
      "Rishab Veldur added to your mentors. “I can make Thu, Oct 1 (exact time to be confirmed)” is ticked. Rishab is your first choice.",
    );
    // Added after Patrick: Patrick stays first choice, both windows are ticked.
    const withPatrick = {
      ...answered,
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am"],
    };
    const both = mergeSearchParams(withPatrick, catalog, { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" });
    expect(both.state).toMatchObject({
      mentorIds: ["patrick-haddox", "rishab-veldur"],
      firstChoiceMentorId: "patrick-haddox",
      availability: ["window:patrick-haddox-2026-10-01-am", "window:rishab-veldur-2026-10-01"],
    });
    expect(mergeAnnouncement(catalog, both.outcome!, presentations)).toBe(
      "Rishab Veldur added to your mentors. “I can make Thu, Oct 1 (exact time to be confirmed)” is ticked.",
    );
  });
});

describe("form model", () => {
  const validate = createValidator(catalog, ["illinois.edu"]);
  const submit = (s: FormState) => validate(toSubmissionValues(s, catalog, { idempotencyKey: newIdempotencyKey(), elapsedMs: 5000 }));

  it("is one form in three groups, in order, with every schema field placed once", () => {
    expect(FORM_GROUPS.map((g) => g.title)).toEqual(["About you", "Your interests", "Submit"]);
    expect(FIELD_ORDER).toEqual([
      "fullName",
      "email",
      "year",
      "major",
      "participation",
      "teamName",
      "teammates",
      "mentorIds",
      "firstChoiceMentorId",
      "availability",
      "availabilityNotes",
      "stage",
      "workingOn",
      "question",
      "link",
      "acknowledgeNoGuarantee",
      "consentToShare",
    ]);
    expect(new Set(FIELD_ORDER).size).toBe(FIELD_ORDER.length);
  });

  it("lists every missing answer on an empty submit, including the availability rule", () => {
    const errors = submit(state());
    expect(Object.keys(errors).sort()).toEqual(
      [
        "fullName",
        "email",
        "year",
        "major",
        "mentorIds",
        "availabilityNotes",
        "stage",
        "workingOn",
        "question",
        "acknowledgeNoGuarantee",
        "consentToShare",
      ].sort(),
    );
    // A first choice needs mentors to pick from — "Choose at least one mentor" covers it.
    expect(errors.firstChoiceMentorId).toBeUndefined();
  });

  it("requires broad availability for mentors without times, else a ticked window OR broad availability", () => {
    // Only Ron (schedule pending) and nothing about availability → the availability error, together
    // with the other field errors.
    const ronOnly = submit(state({ mentorIds: ["ron-lewis"] }));
    expect(ronOnly.availabilityNotes).toBe(
      "Tell us when you’re generally free during Founders Week. Ron’s times aren’t set yet.",
    );
    expect(ronOnly.fullName).toBeDefined();
    expect(Object.keys(submit({ ...answered, mentorIds: ["ron-lewis"], availabilityNotes: "" }))).toEqual(["availabilityNotes"]);
    // Broad availability is enough.
    expect(submit({ ...answered, mentorIds: ["ron-lewis"] })).toEqual({});
    // Ticking Patrick's window doesn't cover Ron, whose times aren't set: the note is still needed.
    const patrickAndRon = {
      ...answered,
      mentorIds: ["patrick-haddox", "ron-lewis"],
      firstChoiceMentorId: "ron-lewis",
      availability: ["window:patrick-haddox-2026-10-01-am"],
    };
    expect(submit({ ...patrickAndRon, availabilityNotes: "" })).toEqual({
      availabilityNotes: "Tell us when you’re generally free during Founders Week. Ron’s times aren’t set yet.",
    });
    expect(submit(patrickAndRon)).toEqual({});
    // With only mentors who have times, a ticked window is enough (no broad availability needed)…
    expect(
      submit({
        ...answered,
        mentorIds: ["patrick-haddox", "arnav-mishra"],
        firstChoiceMentorId: "arnav-mishra",
        availability: ["window:patrick-haddox-2026-10-01-am"],
        availabilityNotes: "",
      }),
    ).toEqual({});
    // …and with nothing ticked and no note, the general rule applies.
    expect(
      submit({
        ...answered,
        mentorIds: ["patrick-haddox", "arnav-mishra"],
        firstChoiceMentorId: "arnav-mishra",
        availabilityNotes: "",
      }).availabilityNotes,
    ).toBe("Tell us when you’re generally free during Founders Week (or pick one of the listed times).");
    // Windows are optional: Patrick and Arnav selected, nothing ticked, broad availability given.
    expect(
      submit({ ...answered, mentorIds: ["patrick-haddox", "arnav-mishra"], firstChoiceMentorId: "arnav-mishra" }),
    ).toEqual({});
    // Every pending mentor at once, no time needed.
    const pending = submit({ ...answered, mentorIds: ["vikram-lakhwara", "elliott-notrica", "ron-lewis"] });
    expect(Object.keys(pending)).toEqual(["firstChoiceMentorId"]);
  });

  it("asks for broad availability with Rishab even when his Thu, Oct 1 window is ticked (its time isn't set)", () => {
    const RISHAB_WINDOW = "window:rishab-veldur-2026-10-01";
    const NAMES_RISHAB = "Tell us when you’re generally free during Founders Week. Rishab’s times aren’t set yet.";
    const rishab = { ...answered, mentorIds: ["rishab-veldur"], availability: [RISHAB_WINDOW] };
    expect(submit({ ...rishab, availabilityNotes: "" })).toEqual({ availabilityNotes: NAMES_RISHAB });
    expect(submit({ ...rishab, availabilityNotes: "   " })).toEqual({ availabilityNotes: NAMES_RISHAB });
    expect(submit(rishab)).toEqual({});
    // His window is optional: the note alone is enough.
    expect(submit({ ...rishab, availability: [] })).toEqual({});
    // With Patrick's (timed) window ticked, Rishab still needs the note.
    const withPatrick = {
      ...answered,
      mentorIds: ["rishab-veldur", "patrick-haddox"],
      firstChoiceMentorId: "rishab-veldur",
      availability: ["window:patrick-haddox-2026-10-01-am"],
    };
    expect(submit({ ...withPatrick, availabilityNotes: "" })).toEqual({ availabilityNotes: NAMES_RISHAB });
    expect(submit({ ...withPatrick, availability: [...withPatrick.availability, RISHAB_WINDOW], availabilityNotes: "" })).toEqual({
      availabilityNotes: NAMES_RISHAB,
    });
    expect(submit(withPatrick)).toEqual({});
    // Names every mentor without set times, in the order chosen.
    expect(
      submit({ ...answered, mentorIds: ["ron-lewis", "rishab-veldur"], firstChoiceMentorId: "ron-lewis", availabilityNotes: "" }),
    ).toEqual({ availabilityNotes: "Tell us when you’re generally free during Founders Week. Ron and Rishab’s times aren’t set yet." });
    // On an otherwise empty submit the Rishab error shows up together with the rest.
    const empty = submit(state({ mentorIds: ["rishab-veldur"], availability: [RISHAB_WINDOW] }));
    expect(empty.availabilityNotes).toBe(NAMES_RISHAB);
    expect(empty.fullName).toBe("Enter your full name.");
  });

  it("ignores a ticked window once its mentor is deselected", () => {
    const s = {
      ...answered,
      mentorIds: ["ron-lewis"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
      availabilityNotes: "",
    };
    expect(toSubmissionValues(s, catalog, { idempotencyKey: "k", elapsedMs: 1 }).availability).toEqual([]);
    expect(Object.keys(submit(s))).toEqual(["availabilityNotes"]);
  });

  it("offers an “I can make …” time only for selected mentors with a published window", () => {
    expect(knownTimes(state({ mentorIds: ["ron-lewis", "vikram-lakhwara", "elliott-notrica"] }), catalog)).toEqual([]);
    expect(
      knownTimes(state({ mentorIds: ["ron-lewis", "arnav-mishra", "patrick-haddox"] }), catalog).map((t) => [
        t.mentor.id,
        t.option.key,
        presentations[t.option.key].phrase,
      ]),
    ).toEqual([
      // Directory order, not selection order.
      ["patrick-haddox", "window:patrick-haddox-2026-10-01-am", "Thu, Oct 1, 10:00–11:30 AM CT"],
      ["arnav-mishra", "window:arnav-mishra-2026-10-02-am", "Fri, Oct 2, morning (before noon CT)"],
    ]);
    // Rishab's date is set (time still to be confirmed): one "I can make …" option, on Thu, Oct 1 only.
    expect(
      knownTimes(state({ mentorIds: ["rishab-veldur", "ron-lewis", "patrick-haddox"] }), catalog).map((t) => [
        t.mentor.id,
        t.option.key,
        presentations[t.option.key].phrase,
      ]),
    ).toEqual([
      ["patrick-haddox", "window:patrick-haddox-2026-10-01-am", "Thu, Oct 1, 10:00–11:30 AM CT"],
      ["rishab-veldur", "window:rishab-veldur-2026-10-01", "Thu, Oct 1 (exact time to be confirmed)"],
    ]);
    expect(focusTargetId("availability", state({ mentorIds: ["rishab-veldur"] }), catalog)).toBe(
      "apply-option-window-rishab-veldur-2026-10-01",
    );
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
    const ordered = orderErrors({ consentToShare: "c", availabilityNotes: "a", fullName: "n", mentorIds: "m", form: "f" }).map(
      ([k]) => k,
    );
    expect(ordered).toEqual(["fullName", "mentorIds", "availabilityNotes", "consentToShare", "form"]);
    const s = state({ mentorIds: ["arnav-mishra", "ron-lewis"] });
    expect(focusTargetId("fullName", s, catalog)).toBe("apply-fullName");
    expect(focusTargetId("stage", s, catalog)).toBe("apply-stage-exploring");
    expect(focusTargetId("participation", s, catalog)).toBe("apply-participation-individual");
    expect(focusTargetId("availabilityNotes", s, catalog)).toBe("apply-availabilityNotes");
    expect(focusTargetId("availability", s, catalog)).toBe("apply-option-window-arnav-mishra-2026-10-02-am");
    expect(focusTargetId("availability", state({ mentorIds: ["ron-lewis"] }), catalog)).toBe("apply-availabilityNotes");
    expect(focusTargetId("firstChoiceMentorId", s, catalog)).toBe("apply-first-choice-arnav-mishra");
    expect(focusTargetId("mentorIds", state(), catalog)).toBe("apply-mentor-patrick-haddox");
    expect(focusTargetId("idempotencyKey", s, catalog)).toBeNull();
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

describe("broad availability (hint and requiredness mirror the schema's rule)", () => {
  const validate = createValidator(catalog, ["illinois.edu"]);
  const PATRICK_WINDOW = "window:patrick-haddox-2026-10-01-am";
  const ASK = "When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday.";

  it("is needed whenever a selected mentor has no times yet — and says who, never “not needed”", () => {
    expect(
      mentorsWithoutTimes(state({ mentorIds: ["ron-lewis", "patrick-haddox", "vikram-lakhwara", "arnav-mishra"] }), catalog).map(
        (m) => m.id,
      ),
    ).toEqual(["ron-lewis", "vikram-lakhwara"]);
    // Patrick's window is ticked, but Vik's times aren't set: the note is still needed.
    const vik = broadAvailabilityGuidance(
      state({ mentorIds: ["patrick-haddox", "vikram-lakhwara"], availability: [PATRICK_WINDOW] }),
      catalog,
    );
    expect(vik).toEqual({ required: true, hint: `${ASK} Needed because Vik’s times aren’t set yet.` });
    expect(vik.hint).not.toMatch(/Not needed/);
    expect(vik.hint).not.toMatch(/\b(his|her)\b/);
    expect(
      broadAvailabilityGuidance(state({ mentorIds: ["vikram-lakhwara", "elliott-notrica", "ron-lewis"] }), catalog).hint,
    ).toBe(`${ASK} Needed because Vik, Elliott and Ron’s times aren’t set yet.`);
    expect(joinNames([])).toBe("");
    expect(joinNames(["Vik", "Ron"])).toBe("Vik and Ron");
  });

  it("counts Rishab as a mentor without set times and points to his day, Thu, Oct 1", () => {
    const RISHAB_WINDOW = "window:rishab-veldur-2026-10-01";
    const OCT_1 = "Rishab has office hours on Thu, Oct 1, so include when you’re free that day.";
    expect(
      mentorsWithoutTimes(
        state({ mentorIds: ["rishab-veldur", "patrick-haddox", "ron-lewis", "arnav-mishra", "vikram-lakhwara"] }),
        catalog,
      ).map((m) => m.id),
    ).toEqual(["rishab-veldur", "ron-lewis", "vikram-lakhwara"]);
    const alone = broadAvailabilityGuidance(state({ mentorIds: ["rishab-veldur"] }), catalog);
    expect(alone).toEqual({ required: true, hint: `${ASK} Needed because Rishab’s times aren’t set yet. ${OCT_1}` });
    // Ticking his window doesn't make the note optional: the time on that day isn't set.
    expect(broadAvailabilityGuidance(state({ mentorIds: ["rishab-veldur"], availability: [RISHAB_WINDOW] }), catalog)).toEqual(alone);
    // Nor does Patrick's window.
    expect(
      broadAvailabilityGuidance(
        state({ mentorIds: ["patrick-haddox", "rishab-veldur"], availability: [PATRICK_WINDOW, RISHAB_WINDOW] }),
        catalog,
      ),
    ).toEqual(alone);
    // Named in the order chosen, next to mentors who are still scheduling.
    expect(broadAvailabilityGuidance(state({ mentorIds: ["vikram-lakhwara", "rishab-veldur"] }), catalog)).toEqual({
      required: true,
      hint: `${ASK} Needed because Vik and Rishab’s times aren’t set yet. ${OCT_1}`,
    });
    // Never suggests Rishab has office hours on Fri, Oct 2.
    expect(alone.hint).not.toMatch(/Oct 2|Friday, October 2/);
    expect(alone.hint).not.toMatch(/\b(his|her)\b/);
  });

  it("is optional only once a listed time is ticked and every selected mentor has times", () => {
    const patrick = state({ mentorIds: ["patrick-haddox"] });
    expect(broadAvailabilityGuidance(patrick, catalog)).toEqual({
      required: true,
      hint: `${ASK} Not needed if you tick a time above.`,
    });
    expect(broadAvailabilityGuidance({ ...patrick, availability: [PATRICK_WINDOW] }, catalog).required).toBe(false);
    // A ticked time of a deselected mentor doesn't count.
    expect(
      broadAvailabilityGuidance(state({ mentorIds: ["arnav-mishra"], availability: [PATRICK_WINDOW] }), catalog).required,
    ).toBe(true);
    expect(broadAvailabilityGuidance(state(), catalog)).toEqual({ required: true, hint: ASK });
    // Asks about Founders Week, not "this week" (students apply before it starts).
    expect(ASK).not.toMatch(/this week/);
  });

  it("agrees with the schema: required exactly when leaving it blank is an error, naming the same mentors", () => {
    const ids = catalog.mentors.map((m) => m.id);
    const combos = [
      ...ids.map((id) => [id]),
      ["patrick-haddox", "arnav-mishra"],
      ["patrick-haddox", "ron-lewis"],
      ["arnav-mishra", "vikram-lakhwara", "elliott-notrica"],
      ["ron-lewis", "vikram-lakhwara"],
      ["rishab-veldur", "patrick-haddox"],
      ["patrick-haddox", "arnav-mishra", "rishab-veldur"],
      ["rishab-veldur", "elliott-notrica"],
      ids,
    ];
    expect(ids).toHaveLength(6);
    for (const mentorIds of combos) {
      for (const availability of [
        [],
        [PATRICK_WINDOW],
        ["window:arnav-mishra-2026-10-02-am"],
        ["window:rishab-veldur-2026-10-01"],
        [PATRICK_WINDOW, "window:rishab-veldur-2026-10-01"],
      ]) {
        const s = { ...answered, mentorIds, firstChoiceMentorId: mentorIds[0], availability, availabilityNotes: "" };
        const errors = validate(toSubmissionValues(s, catalog, { idempotencyKey: newIdempotencyKey(), elapsedMs: 5000 }));
        const guidance = broadAvailabilityGuidance(s, catalog);
        expect(guidance.required, `${mentorIds.join("+")} / ${availability.join()}`).toBe("availabilityNotes" in errors);
        const pending = mentorsWithoutTimes(s, catalog).map((m) => m.firstName);
        if (pending.length) {
          const who = `${joinNames(pending)}’s times aren’t set yet`;
          expect(errors.availabilityNotes).toContain(who);
          expect(guidance.hint).toContain(who);
        }
      }
    }
  });
});

describe("links on the page while the application is open", () => {
  const ORIGIN = "https://founders.example.edu";
  const act = (href: string, current: string, canMerge = true) =>
    applyLinkAction(href, `${ORIGIN}${current}`, catalog, { canMerge });

  it("a fragment-only “#apply” (the hero button) only scrolls — it never re-adds the URL's mentor", () => {
    expect(act("#apply", "/office-hours?mentor=patrick-haddox#apply")).toEqual({ kind: "scroll" });
    expect(act("#apply", "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply")).toEqual({
      kind: "scroll",
    });
    expect(act("#apply", "/office-hours#apply")).toEqual({ kind: "scroll" });
    // A changed hash: the browser's own jump to #apply (still no merge).
    expect(act("#apply", "/office-hours?mentor=patrick-haddox")).toEqual({ kind: "navigate" });
  });

  it("merges a mentor link to the URL we're already on; links that change the URL navigate", () => {
    expect(act("/office-hours?mentor=ron-lewis#apply", "/office-hours?mentor=ron-lewis#apply")).toEqual({
      kind: "merge",
      params: { mentor: "ron-lewis" },
    });
    expect(
      act(
        "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
        "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
      ),
    ).toEqual({ kind: "merge", params: { mentor: "arnav-mishra", window: "arnav-mishra-2026-10-02-am" } });
    // A different selection changes the URL: merged when the URL changes.
    expect(act("/office-hours?mentor=arnav-mishra#apply", "/office-hours?mentor=ron-lewis#apply")).toEqual({
      kind: "navigate",
    });
    // The header's Apply link drops the parameters: a navigation that merges nothing.
    expect(act("/office-hours#apply", "/office-hours?mentor=ron-lewis#apply")).toEqual({ kind: "navigate" });
    expect(act("/office-hours#apply", "/office-hours#apply")).toEqual({ kind: "scroll" });
    // Not the application's anchor, another page, another site, or not on the page yet.
    expect(act("#apply-fullName", "/office-hours#apply")).toEqual({ kind: "navigate" });
    expect(act("/office-hours/ron-lewis", "/office-hours#apply")).toEqual({ kind: "navigate" });
    expect(act("https://elsewhere.example/office-hours?mentor=ron-lewis#apply", "/office-hours?mentor=ron-lewis#apply")).toEqual({
      kind: "navigate",
    });
    expect(act("/office-hours?mentor=ron-lewis#apply", "/office-hours/ron-lewis")).toEqual({ kind: "navigate" });
  });

  it("merges Rishab's “Apply to meet Rishab” link (mentor and Thu, Oct 1 window) on the same URL", () => {
    const href = "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply";
    expect(act(href, href)).toEqual({
      kind: "merge",
      params: { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" },
    });
    expect(act(href, "/office-hours?mentor=patrick-haddox#apply")).toEqual({ kind: "navigate" });
  });

  it("unknown mentors and a submitted application don't swallow the scroll", () => {
    expect(act("/office-hours?mentor=nobody#apply", "/office-hours?mentor=nobody#apply")).toEqual({ kind: "scroll" });
    expect(act("/office-hours?mentor=ron-lewis#apply", "/office-hours?mentor=ron-lewis#apply", false)).toEqual({
      kind: "scroll",
    });
  });
});

describe("removing a mentor (or time) a link preselected", () => {
  const PATRICK_WINDOW = "window:patrick-haddox-2026-10-01-am";

  it("drops the URL's parameters only when what's removed came from them", () => {
    const search = "?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am";
    expect(removesUrlSelection(catalog, search, { mentorId: "patrick-haddox" })).toBe(true);
    expect(removesUrlSelection(catalog, search, { optionKey: PATRICK_WINDOW })).toBe(true);
    expect(removesUrlSelection(catalog, search, { mentorId: "ron-lewis" })).toBe(false);
    expect(removesUrlSelection(catalog, "", { mentorId: "patrick-haddox" })).toBe(false);
    expect(removesUrlSelection(catalog, "?mentor=nobody", { mentorId: "nobody" })).toBe(false);
    // `?window=…` alone preselects its mentor.
    expect(removesUrlSelection(catalog, "?window=arnav-mishra-2026-10-02-am", { mentorId: "arnav-mishra" })).toBe(true);
    // Rishab's link: unticking him (or his Thu, Oct 1 window) drops its parameters.
    const rishab = "?mentor=rishab-veldur&window=rishab-veldur-2026-10-01";
    expect(removesUrlSelection(catalog, rishab, { mentorId: "rishab-veldur" })).toBe(true);
    expect(removesUrlSelection(catalog, rishab, { optionKey: "window:rishab-veldur-2026-10-01" })).toBe(true);
    expect(removesUrlSelection(catalog, rishab, { mentorId: "patrick-haddox" })).toBe(false);
    expect(removesUrlSelection(catalog, rishab, { optionKey: PATRICK_WINDOW })).toBe(false);
    expect(
      withoutPrefillParams(`https://founders.example.edu/office-hours${rishab}&utm_source=ig#apply`),
    ).toBe("/office-hours?utm_source=ig#apply");

    expect(withoutPrefillParams("https://founders.example.edu/office-hours?mentor=ron-lewis#apply")).toBe("/office-hours#apply");
    expect(
      withoutPrefillParams(
        "https://founders.example.edu/office-hours?mentor=patrick-haddox&window=w&slot=s&utm_source=ig#apply",
      ),
    ).toBe("/office-hours?utm_source=ig#apply");
  });

  it("a restore follows the URL, not an older first render — the removed mentor stays removed", () => {
    // The page as first rendered (e.g. restored from the router cache on Back) still preselects Patrick…
    const cached = resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" });
    // …but the student removed him, which dropped the parameters from the URL.
    const live = prefillFromSearch(catalog, "");
    expect(samePrefill(live, cached)).toBe(false);
    expect(samePrefill(prefillFromSearch(catalog, "?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am"), cached)).toBe(
      true,
    );
    const draft = { ...answered, mentorIds: ["ron-lewis"], firstChoiceMentorId: "ron-lewis" };
    expect(mergePrefill(draft, live)).toEqual({ state: draft, outcome: null, changed: false });
    expect(prefillNotice(catalog, live, presentations, 1)).toBeNull();
  });
});

describe("selection notices", () => {
  it("go away when the mentor (or time) they announce is removed", () => {
    const top = prefillNotice(
      catalog,
      resolvePrefill(catalog, { mentor: "patrick-haddox", window: "patrick-haddox-2026-10-01-am" }),
      presentations,
      0,
    )!;
    expect(top).toEqual({
      id: 0,
      kind: "top",
      message:
        "Patrick Haddox is selected below, with “I can make Thu, Oct 1, 10:00–11:30 AM CT” ticked. Add anyone else you’d like to meet.",
      mentorId: "patrick-haddox",
      optionKey: "window:patrick-haddox-2026-10-01-am",
    });
    expect(noticeAfterRemoval(top, { mentorId: "patrick-haddox" })).toBeNull();
    expect(noticeAfterRemoval(top, { optionKey: "window:patrick-haddox-2026-10-01-am" })).toBeNull();
    expect(noticeAfterRemoval(top, { mentorId: "ron-lewis" })).toBe(top);

    const merge: SelectionNotice = {
      id: 3,
      kind: "merge",
      message: "Ron Lewis added to your mentors.",
      mentorId: "ron-lewis",
      optionKey: null,
    };
    expect(noticeAfterRemoval(merge, { mentorId: "ron-lewis" })).toBeNull();
    expect(noticeAfterRemoval(merge, { optionKey: "window:patrick-haddox-2026-10-01-am" })).toBe(merge);
    expect(noticeAfterRemoval(null, { mentorId: "ron-lewis" })).toBeNull();
    expect(prefillNotice(catalog, EMPTY_PREFILL, presentations, 0)).toBeNull();
  });
});

describe("in-progress drafts (sessionStorage)", () => {
  const now = Date.UTC(2026, 8, 30, 15, 0, 0);
  const key = "5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968";
  const withChoices = {
    ...answered,
    mentorIds: ["patrick-haddox", "ron-lewis"],
    firstChoiceMentorId: "ron-lewis",
    availability: ["window:patrick-haddox-2026-10-01-am"],
    referrerMentorId: "patrick-haddox",
    nickname: "bot filled this",
  };

  it("is keyed per site", () => {
    expect(draftStorageKey({ shortName: "Founders Week", year: 2026 })).toBe(
      "founders-week-2026:office-hours-application:v1",
    );
  });

  it("round-trips every answer and the form session, but never the honeypot", () => {
    const raw = serializeDraft({ key, startedAt: now - 60_000, values: toDraftValues(withChoices) }, now);
    expect(raw).not.toContain("nickname");
    expect(raw).not.toContain("bot filled this");
    const draft = parseDraft(raw, catalog, now + 1000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nickname, ...expected } = withChoices;
    expect(draft).toEqual({ key, startedAt: now - 60_000, values: expected });
  });

  it("drops anything that no longer matches the catalog or the form's options", () => {
    const raw = JSON.stringify({
      v: 1,
      savedAt: now,
      key: "not-a-uuid",
      startedAt: now + 99_999,
      values: {
        ...toDraftValues(withChoices),
        mentorIds: ["patrick-haddox", "dan-caruso-fireside-chat", "patrick-haddox", 42],
        firstChoiceMentorId: "dan-caruso-fireside-chat",
        availability: ["window:patrick-haddox-2026-10-01-am", "window:happy-hour-at-legends-with-arnav-mishra"],
        year: "wizard",
        stage: "unicorn",
        participation: "crowd",
        referrerMentorId: "founders-week-afterparty",
        acknowledgeNoGuarantee: "yes",
        fullName: "x".repeat(10_000),
      },
    });
    const draft = parseDraft(raw, catalog, now);
    expect(draft).not.toBeNull();
    expect(draft!.key).toBeNull();
    expect(draft!.startedAt).toBe(now);
    expect(draft!.values).toMatchObject({
      mentorIds: ["patrick-haddox"],
      firstChoiceMentorId: "",
      availability: ["window:patrick-haddox-2026-10-01-am"],
      year: "",
      stage: "",
      participation: "individual",
      referrerMentorId: "",
      acknowledgeNoGuarantee: false,
    });
    expect(draft!.values.fullName.length).toBeLessThanOrEqual(200);
  });

  it("keeps Rishab and his Thu, Oct 1 window, but drops a Fri, Oct 2 window he doesn't have", () => {
    const raw = JSON.stringify({
      v: 1,
      savedAt: now,
      key,
      startedAt: now,
      values: {
        ...toDraftValues({ ...answered, mentorIds: ["rishab-veldur"], firstChoiceMentorId: "rishab-veldur" }),
        availability: ["window:rishab-veldur-2026-10-02", "window:rishab-veldur-2026-10-01"],
      },
    });
    expect(parseDraft(raw, catalog, now)!.values).toMatchObject({
      mentorIds: ["rishab-veldur"],
      firstChoiceMentorId: "rishab-veldur",
      availability: ["window:rishab-veldur-2026-10-01"],
    });
  });

  it("ignores missing, malformed, expired, future, other-version and blank drafts", () => {
    const good = serializeDraft({ key, startedAt: now, values: toDraftValues(withChoices) }, now);
    expect(parseDraft(null, catalog, now)).toBeNull();
    expect(parseDraft("{nope", catalog, now)).toBeNull();
    expect(parseDraft("[]", catalog, now)).toBeNull();
    expect(parseDraft(good, catalog, now + DRAFT_TTL_MS + 1)).toBeNull();
    expect(parseDraft(good, catalog, now - 1)).toBeNull();
    expect(parseDraft(good.replace('"v":1', '"v":2'), catalog, now)).toBeNull();
    expect(parseDraft(serializeDraft({ key, startedAt: now, values: blankDraftValues() }, now), catalog, now)).toBeNull();
    expect(isBlankDraft(blankDraftValues())).toBe(true);
    expect(isBlankDraft({ ...blankDraftValues(), fullName: "   " })).toBe(true);
    expect(isBlankDraft({ ...blankDraftValues(), mentorIds: ["ron-lewis"] })).toBe(false);
    expect(isBlankDraft({ ...blankDraftValues(), participation: "team" })).toBe(false);
  });

  it("restores first, then merges the URL's mentor on top — nothing typed is lost", () => {
    const raw = serializeDraft({ key, startedAt: now, values: toDraftValues({ ...answered, mentorIds: ["patrick-haddox"] }) }, now);
    const draft = parseDraft(raw, catalog, now)!;
    const merged = mergePrefill({ ...draft.values, nickname: "" }, resolvePrefill(catalog, { mentor: "ron-lewis" }));
    expect(merged.state).toMatchObject({
      fullName: "Alex Student",
      availabilityNotes: "Thursday mornings, anytime Friday",
      mentorIds: ["patrick-haddox", "ron-lewis"],
      firstChoiceMentorId: "patrick-haddox",
    });
  });
});

describe("application catalog", () => {
  it("offers exactly the six mentors; Vik, Elliott and Ron have no times yet; no event is an option", () => {
    expect(catalog.mentors.map((m) => m.id)).toEqual([
      "patrick-haddox",
      "arnav-mishra",
      "vikram-lakhwara",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
    const byId = Object.fromEntries(catalog.mentors.map((m) => [m.id, m]));
    expect(byId["ron-lewis"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["vikram-lakhwara"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["elliott-notrica"]).toEqual({
      id: "elliott-notrica",
      name: "Elliott Notrica",
      firstName: "Elliott",
      affiliation: "Founder & CEO, Symbio Bioculinary",
      demo: false,
      scheduling: "in-progress",
      options: [],
    });
    expect(byId["patrick-haddox"].options.map((o) => o.key)).toEqual(["window:patrick-haddox-2026-10-01-am"]);
    expect(byId["arnav-mishra"].options.map((o) => o.key)).toEqual(["window:arnav-mishra-2026-10-02-am"]);
    expect(byId["vikram-lakhwara"].affiliation).toBe("Founder & Managing Member, Stakehouse");
    // No event of any kind is an application option: not Dan Caruso's fireside chat, not Arnav's
    // happy hour at Legends, not the canceled Saturday afterparty.
    expect(JSON.stringify(catalog)).not.toMatch(/caruso|afterparty|happy hour|legends|partiful|HERE Apartments/i);
  });

  it("gives Rishab one date-only window on Thu, Oct 1 (time not known); every other option has a known time", () => {
    const byId = Object.fromEntries(catalog.mentors.map((m) => [m.id, m]));
    expect(byId["rishab-veldur"]).toEqual({
      id: "rishab-veldur",
      name: "Rishab Veldur",
      firstName: "Rishab",
      affiliation: "Co-Founder & CEO, Auvi Labs",
      demo: false,
      scheduling: "available",
      options: [
        {
          key: "window:rishab-veldur-2026-10-01",
          kind: "window",
          id: "rishab-veldur-2026-10-01",
          mentorId: "rishab-veldur",
          certainty: "window",
          date: "2026-10-01",
          label: "Thu, Oct 1 · Exact time to be confirmed",
          detail: "Availability window. Exact times to be announced.",
          timeKnown: false,
        },
      ],
    });
    // Only Thu, Oct 1 for him: never Fri, Oct 2 (he's at Founders Week that day, but not for office hours).
    expect(JSON.stringify(byId["rishab-veldur"])).not.toMatch(/2026-10-02|Oct 2/);
    expect(
      catalog.mentors.map((m) => [m.id, m.options.map((o) => o.timeKnown)]),
    ).toEqual([
      ["patrick-haddox", [true]],
      ["arnav-mishra", [true]],
      ["vikram-lakhwara", []],
      ["elliott-notrica", []],
      ["ron-lewis", []],
      ["rishab-veldur", [false]],
    ]);
    // Demo slots and windows are timed too.
    expect(demoCatalog.mentors.filter((m) => m.demo).flatMap((m) => m.options.map((o) => o.timeKnown))).not.toContain(false);
  });
});

describe("option presentation", () => {
  it("labels windows and slots, with a sentence form for “I can make …”", () => {
    const p = presentOptions(demoCatalog, [...mentors, ...demoMentors]);
    expect(p["window:patrick-haddox-2026-10-01-am"]).toEqual({
      kind: "window",
      label: "Thu, Oct 1 · 10:00–11:30 AM CT",
      phrase: "Thu, Oct 1, 10:00–11:30 AM CT",
      detail: "Exact appointment times will be set within this window.",
    });
    expect(p["window:arnav-mishra-2026-10-02-am"]).toMatchObject({
      kind: "window-approx",
      label: "Fri, Oct 2 · Morning, before noon CT",
      phrase: "Fri, Oct 2, morning (before noon CT)",
    });
    expect(p["slot:demo-avery-slot-1400"]).toMatchObject({ kind: "confirmed", detail: "In person · Demo Hall, Room 202" });
    expect(p["slot:demo-avery-slot-1400"].phrase).not.toContain("·");
    expect(p["slot:demo-jordan-slot-1500"]).toMatchObject({ kind: "proposed", detail: "Not yet confirmed by Jordan · Virtual" });
  });

  it("reads Rishab's date-only window as “Thu, Oct 1 (exact time to be confirmed)”", () => {
    expect(presentations["window:rishab-veldur-2026-10-01"]).toEqual({
      kind: "window-approx",
      label: "Thu, Oct 1 · Exact time to be confirmed",
      phrase: "Thu, Oct 1 (exact time to be confirmed)",
      detail: "We’ll share the exact time once it’s set. Tell us below when you’re free that day.",
    });
    // Exactly one option per mentor with times: Patrick, Arnav, Rishab.
    expect(Object.keys(presentations)).toEqual([
      "window:patrick-haddox-2026-10-01-am",
      "window:arnav-mishra-2026-10-02-am",
      "window:rishab-veldur-2026-10-01",
    ]);
  });
});

describe("api contract", () => {
  it("only treats ok responses with an id and status link as success", () => {
    expect(isSubmitSuccess({ ok: true })).toBe(false);
    expect(isSubmitSuccess({ ok: true, id: "x", statusUrl: "https://evil.example" })).toBe(false);
    expect(isSubmitSuccess({ ok: false, id: "x", statusUrl: "/apply/status/x.y" })).toBe(false);
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
    siteName: "Founders Week",
    orgName: "Founders – Illinois Entrepreneurs",
    mentors: [
      { name: "Ron Lewis", schedulingInProgress: true },
      { name: "Patrick Haddox", schedulingInProgress: false },
    ],
  };

  it("is a receipt, not an acceptance, and escapes HTML", () => {
    const { subject, text, html } = buildAcknowledgmentEmail(input);
    expect(subject).toMatch(/received/i);
    expect(text).toContain("doesn’t reserve a time slot");
    expect(text).toContain("email selected students to confirm");
    expect(text).toContain("Thanks for applying for office hours during Founders Week.");
    expect(text).toContain("- Ron Lewis (first choice, scheduling in progress)\n- Patrick Haddox\n");
    expect(text).toContain("Founders will follow up once availability is finalized.");
    expect(text).toContain(input.statusUrl);
    expect(text).not.toMatch(/accepted|congratulations|confirmed for/i);
    expect(html).toContain("&lt;Alex&gt;");
    expect(html).not.toContain("<Alex>");
    // Signed by the org, with no em dashes anywhere.
    expect(text.endsWith("Best,\nFounders – Illinois Entrepreneurs")).toBe(true);
    expect(html).toContain("Best,<br>Founders – Illinois Entrepreneurs");
    expect(`${subject}${text}${html}`).not.toContain("—");
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
