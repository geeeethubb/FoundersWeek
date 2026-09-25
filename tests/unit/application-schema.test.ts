import { describe, expect, it } from "vitest";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import type { Mentor } from "@/content/types";
import { buildApplicationCatalog, mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { LIMITS } from "@/lib/applications/constants";
import {
  createApplicationSchema,
  emptyApplicationValues,
  stripControlChars,
  toFieldErrors,
} from "@/lib/applications/schema";

const catalog = buildApplicationCatalog([...mentors, ...demoMentors]);
const schema = createApplicationSchema({ catalog, emailDomains: ["illinois.edu"] });

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
const fixtureCatalog = buildApplicationCatalog([...mentors, DATE_ONLY_MENTOR]);
const fixtureSchema = createApplicationSchema({ catalog: fixtureCatalog, emailDomains: ["illinois.edu"] });

function valid(overrides: Partial<ReturnType<typeof emptyApplicationValues>> = {}) {
  return {
    ...emptyApplicationValues("5b0f3e2a-9a51-4b5e-8f7e-1d2c3b4a5968"),
    fullName: "Alex Student",
    email: "Alex@Illinois.edu",
    year: "junior",
    major: "Computer Engineering",
    participation: "individual",
    stage: "building",
    workingOn: "A satellite telemetry dashboard for student rocketry teams.",
    question: "How do I find my first paying customers in aerospace?",
    mentorIds: ["patrick-haddox"],
    firstChoiceMentorId: "patrick-haddox",
    availability: ["window:patrick-haddox-2026-10-01-am"],
    acknowledgeNoGuarantee: true,
    consentToShare: true,
    elapsedMs: 20000,
    ...overrides,
  };
}

describe("application catalog", () => {
  it("offers windows for mentors without slots and nothing for mentors still scheduling", () => {
    const byId = Object.fromEntries(catalog.mentors.map((m) => [m.id, m]));
    expect(byId["patrick-haddox"].scheduling).toBe("available");
    expect(byId["patrick-haddox"].options.map((o) => o.key)).toEqual(["window:patrick-haddox-2026-10-01-am"]);
    // Arnav's window became exact on Sept 24 (same id, so existing applications still match it).
    expect(byId["arnav-mishra"].options.map((o) => [o.key, o.label, o.timeKnown])).toEqual([
      ["window:arnav-mishra-2026-10-02-am", "Fri, Oct 2 · 10:00–11:30 AM CT", true],
    ]);
    // A part-of-day window (fixture) keeps its display label.
    const rough: Mentor = {
      ...DATE_ONLY_MENTOR,
      id: "fixture-riley",
      name: "Riley Fixture",
      firstName: "Riley",
      availability: [
        {
          id: "fixture-riley-2026-10-02-am",
          date: "2026-10-02",
          time: { kind: "part-of-day", part: "morning", before: "12:00" },
          label: "Friday morning, before noon · Exact window pending",
        },
      ],
    };
    expect(buildApplicationCatalog([rough]).mentors[0].options[0].label).toBe(
      "Fri, Oct 2 · Friday morning, before noon · Exact window pending",
    );
    // Ron's window became exact on Sept 24: Thu, Oct 1, 2:30–4:30 PM CT.
    expect(byId["ron-lewis"].scheduling).toBe("available");
    expect(byId["ron-lewis"].options.map((o) => [o.key, o.label, o.timeKnown])).toEqual([
      ["window:ron-lewis-2026-10-01-pm", "Thu, Oct 1 · 2:30–4:30 PM CT", true],
    ]);
    expect(byId["vikram-lakhwara"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["elliott-notrica"]).toMatchObject({ scheduling: "in-progress", options: [] });
    // Demo mentor with slots: slots replace the window.
    expect(byId["demo-avery-sample"].options.map((o) => o.kind)).toEqual(["slot", "slot"]);
    expect(byId["demo-jordan-placeholder"].options[0].certainty).toBe("proposed");
  });

  it("lists the six real mentors, Rishab last, with his one Thu, Oct 1 window at 12:00–5:00 PM CT (time known)", () => {
    expect(catalog.mentors.filter((m) => !m.demo).map((m) => m.id)).toEqual([
      "patrick-haddox",
      "arnav-mishra",
      "vikram-lakhwara",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
    const rishab = catalog.mentors.find((m) => m.id === "rishab-veldur")!;
    expect(rishab.scheduling).toBe("available");
    expect(rishab.options).toHaveLength(1);
    expect(rishab.options[0]).toMatchObject({
      key: "window:rishab-veldur-2026-10-01",
      kind: "window",
      certainty: "window",
      date: "2026-10-01",
      label: "Thu, Oct 1 · 12:00–5:00 PM CT",
      timeKnown: true,
    });
    // Every option (real windows, demo windows and slots) has a known time.
    const all = catalog.mentors.flatMap((m) => m.options);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((o) => !o.timeKnown).map((o) => o.key)).toEqual([]);
  });

  it("marks a date-only window (the fixture mentor's Thu, Oct 1) as time not known", () => {
    const casey = fixtureCatalog.mentors.find((m) => m.id === "fixture-casey")!;
    expect(casey.scheduling).toBe("available");
    expect(casey.options).toHaveLength(1);
    expect(casey.options[0]).toMatchObject({
      key: "window:fixture-casey-2026-10-01",
      kind: "window",
      certainty: "window",
      date: "2026-10-01",
      label: "Thu, Oct 1 · Exact time to be confirmed",
      timeKnown: false,
    });
    // Every other option has a known time.
    const others = fixtureCatalog.mentors.filter((m) => m.id !== "fixture-casey").flatMap((m) => m.options);
    expect(others.length).toBeGreaterThan(0);
    expect(others.filter((o) => !o.timeKnown).map((o) => o.key)).toEqual([]);
  });

  it("needs broad availability exactly for mentors without a known time (Vik, Elliott; not Ron or Rishab)", () => {
    expect(catalog.mentors.filter((m) => mentorNeedsBroadAvailability(m)).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "elliott-notrica",
    ]);
    // A mentor with only a date-only window needs it too.
    expect(fixtureCatalog.mentors.filter((m) => mentorNeedsBroadAvailability(m)).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "elliott-notrica",
      "fixture-casey",
    ]);
    // No options at all counts as "no known time".
    expect(mentorNeedsBroadAvailability({ options: [] })).toBe(true);
    const dateOnlyWindow = fixtureCatalog.mentors.find((m) => m.id === "fixture-casey")!.options[0];
    const rishabWindow = catalog.mentors.find((m) => m.id === "rishab-veldur")!.options[0];
    const patrickWindow = catalog.mentors.find((m) => m.id === "patrick-haddox")!.options[0];
    expect(mentorNeedsBroadAvailability({ options: [dateOnlyWindow] })).toBe(true);
    // One timed option is enough to not need it.
    expect(
      mentorNeedsBroadAvailability({ options: [dateOnlyWindow, { ...dateOnlyWindow, key: "window:x", timeKnown: true }] }),
    ).toBe(false);
    expect(mentorNeedsBroadAvailability({ options: [rishabWindow] })).toBe(false);
    expect(mentorNeedsBroadAvailability({ options: [patrickWindow] })).toBe(false);
  });
});

describe("Rishab (Thu, Oct 1, 12:00–5:00 PM CT)", () => {
  const RISHAB_WINDOW = "window:rishab-veldur-2026-10-01";
  const PATRICK_WINDOW = "window:patrick-haddox-2026-10-01-am";
  const rishab = { mentorIds: ["rishab-veldur"], firstChoiceMentorId: "rishab-veldur" };

  it("accepts his window ticked alone (no broad-availability note needed), with a note, and the note alone", () => {
    const alone = schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "" }));
    expect(alone.success).toBe(true);
    if (alone.success) {
      expect(alone.data.mentorIds).toEqual(["rishab-veldur"]);
      expect(alone.data.availability).toEqual([RISHAB_WINDOW]);
      expect(alone.data.availabilityNotes).toBe("");
    }
    // Whitespace trims to nothing, and the ticked window is still enough.
    expect(schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "  \n " })).success).toBe(true);
    const r = schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "Free after 3 PM on Thursday" }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mentorIds).toEqual(["rishab-veldur"]);
      expect(r.data.availability).toEqual([RISHAB_WINDOW]);
      expect(r.data.availabilityNotes).toBe("Free after 3 PM on Thursday");
    }
    expect(schema.safeParse(valid({ ...rishab, availability: [], availabilityNotes: "Thursday afternoon" })).success).toBe(true);
  });

  it("with nothing ticked and no note, gives the general rule (he isn't named as “not set”)", () => {
    const r = schema.safeParse(valid({ ...rishab, availability: [], availabilityNotes: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week (or pick one of the listed times).",
      });
    }
  });

  it("with Patrick's window ticked and no note, passes (both have set times); so do both windows", () => {
    expect(
      schema.safeParse(
        valid({
          mentorIds: ["rishab-veldur", "patrick-haddox"],
          firstChoiceMentorId: "rishab-veldur",
          availability: [PATRICK_WINDOW],
          availabilityNotes: "",
        }),
      ).success,
    ).toBe(true);
    const both = schema.safeParse(
      valid({
        mentorIds: ["patrick-haddox", "rishab-veldur"],
        firstChoiceMentorId: "patrick-haddox",
        availability: [PATRICK_WINDOW, RISHAB_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(both.success).toBe(true);
    if (both.success) expect(both.data.availability).toEqual([PATRICK_WINDOW, RISHAB_WINDOW]);
  });

  it("with mentors still scheduling, names only them (Vik, Elliott), in the order chosen", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["vikram-lakhwara", "rishab-veldur", "elliott-notrica"],
        firstChoiceMentorId: "rishab-veldur",
        availability: [RISHAB_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Vik and Elliott’s times aren’t set yet.",
      });
    }
    const all = schema.safeParse(
      valid({
        mentorIds: ["elliott-notrica", "ron-lewis", "rishab-veldur", "vikram-lakhwara"],
        firstChoiceMentorId: "rishab-veldur",
        availability: [RISHAB_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(all.success).toBe(false);
    if (!all.success) {
      // Ron has a set time now (Thu 2:30–4:30 PM), so he's never named, ticked or not.
      expect(toFieldErrors(all.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Elliott and Vik’s times aren’t set yet.",
      });
    }
  });

  it("rejects a Fri, Oct 2 window for him and his window without choosing him", () => {
    const oct2 = schema.safeParse(
      valid({ ...rishab, availability: ["window:rishab-veldur-2026-10-02"], availabilityNotes: "Thursday" }),
    );
    expect(oct2.success).toBe(false);
    if (!oct2.success) expect(Object.keys(toFieldErrors(oct2.error))).toEqual(["availability"]);
    const stray = schema.safeParse(valid({ availability: [PATRICK_WINDOW, RISHAB_WINDOW] }));
    expect(stray.success).toBe(false);
    if (!stray.success) expect(Object.keys(toFieldErrors(stray.error))).toEqual(["availability"]);
  });
});

describe("a mentor with a date-only window (fixture: Thu, Oct 1, exact time to be confirmed)", () => {
  const DATE_ONLY_WINDOW = "window:fixture-casey-2026-10-01";
  const PATRICK_WINDOW = "window:patrick-haddox-2026-10-01-am";
  const casey = { mentorIds: ["fixture-casey"], firstChoiceMentorId: "fixture-casey" };

  it("needs the broad-availability note even with the window ticked, and the error names the mentor", () => {
    const r = fixtureSchema.safeParse(valid({ ...casey, availability: [DATE_ONLY_WINDOW], availabilityNotes: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Casey’s times aren’t set yet.",
      });
    }
    // Whitespace isn't an answer.
    expect(
      fixtureSchema.safeParse(valid({ ...casey, availability: [DATE_ONLY_WINDOW], availabilityNotes: "  \n " })).success,
    ).toBe(false);
  });

  it("accepts the window with a note, and the note alone", () => {
    const r = fixtureSchema.safeParse(
      valid({ ...casey, availability: [DATE_ONLY_WINDOW], availabilityNotes: "Free after 3 PM on Thursday" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mentorIds).toEqual(["fixture-casey"]);
      expect(r.data.availability).toEqual([DATE_ONLY_WINDOW]);
      expect(r.data.availabilityNotes).toBe("Free after 3 PM on Thursday");
    }
    expect(fixtureSchema.safeParse(valid({ ...casey, availability: [], availabilityNotes: "Thursday afternoon" })).success).toBe(
      true,
    );
  });

  it("with Patrick's window ticked and no note, still errors naming that mentor (not Patrick)", () => {
    const r = fixtureSchema.safeParse(
      valid({
        mentorIds: ["fixture-casey", "patrick-haddox"],
        firstChoiceMentorId: "fixture-casey",
        availability: [PATRICK_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Casey’s times aren’t set yet.",
      });
    }
    // Both windows ticked: same answer.
    const both = fixtureSchema.safeParse(
      valid({
        mentorIds: ["patrick-haddox", "fixture-casey"],
        firstChoiceMentorId: "patrick-haddox",
        availability: [PATRICK_WINDOW, DATE_ONLY_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(both.success).toBe(false);
    if (!both.success) {
      expect(toFieldErrors(both.error).availabilityNotes).toBe(
        "Tell us when you’re generally free during Founders Week. Casey’s times aren’t set yet.",
      );
    }
    expect(
      fixtureSchema.safeParse(
        valid({
          mentorIds: ["fixture-casey", "patrick-haddox"],
          firstChoiceMentorId: "fixture-casey",
          availability: [PATRICK_WINDOW],
          availabilityNotes: "Anytime Thursday afternoon",
        }),
      ).success,
    ).toBe(true);
  });

  it("names the mentor with the mentors still scheduling, in the order chosen (Rishab never)", () => {
    const r = fixtureSchema.safeParse(
      valid({
        mentorIds: ["vikram-lakhwara", "fixture-casey", "rishab-veldur", "elliott-notrica"],
        firstChoiceMentorId: "fixture-casey",
        availability: [DATE_ONLY_WINDOW, "window:rishab-veldur-2026-10-01"],
        availabilityNotes: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Vik, Casey and Elliott’s times aren’t set yet.",
      });
    }
  });

  it("rejects the window without choosing its mentor", () => {
    const stray = fixtureSchema.safeParse(valid({ availability: [PATRICK_WINDOW, DATE_ONLY_WINDOW] }));
    expect(stray.success).toBe(false);
    if (!stray.success) expect(Object.keys(toFieldErrors(stray.error))).toEqual(["availability"]);
    // And it only exists in the fixture catalog, never in the real one.
    const real = schema.safeParse(valid({ ...casey, availability: [DATE_ONLY_WINDOW], availabilityNotes: "Thursday" }));
    expect(real.success).toBe(false);
    if (!real.success) expect(Object.keys(toFieldErrors(real.error))).toEqual(["mentorIds"]);
  });
});

describe("application schema", () => {
  it("accepts a valid application and normalizes email", () => {
    const r = schema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("alex@illinois.edu");
  });

  it("never blocks on mentors whose schedule is pending: broad availability is enough", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["elliott-notrica", "vikram-lakhwara"],
        firstChoiceMentorId: "vikram-lakhwara",
        availability: [],
        availabilityNotes: "Thursday mornings, anytime Friday",
      }),
    );
    expect(r.success).toBe(true);
    // Elliott is scheduling too: broad availability is what lets Founders match him.
    expect(
      schema.safeParse(
        valid({
          mentorIds: ["elliott-notrica"],
          firstChoiceMentorId: "elliott-notrica",
          availability: [],
          availabilityNotes: "Free after 2 PM most days",
        }),
      ).success,
    ).toBe(true);
    // With Patrick's window ticked, Elliott still needs the broad answer (his times aren't set).
    const withWindow = schema.safeParse(
      valid({
        mentorIds: ["elliott-notrica", "patrick-haddox"],
        firstChoiceMentorId: "elliott-notrica",
        availability: ["window:patrick-haddox-2026-10-01-am"],
        availabilityNotes: "",
      }),
    );
    expect(withWindow.success).toBe(false);
    if (!withWindow.success) {
      expect(toFieldErrors(withWindow.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Elliott’s times aren’t set yet.",
      });
    }
    expect(
      schema.safeParse(
        valid({
          mentorIds: ["elliott-notrica", "patrick-haddox"],
          firstChoiceMentorId: "elliott-notrica",
          availability: ["window:patrick-haddox-2026-10-01-am"],
          availabilityNotes: "Anytime Friday",
        }),
      ).success,
    ).toBe(true);
  });

  it("checks link length after adding https:// and names every pending mentor", () => {
    const long = "a".repeat(LIMITS.link - 8) + ".com"; // fits raw, too long once https:// is added
    const r = schema.safeParse(valid({ link: long }));
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).link).toMatch(/Keep links under/);
    const pending = schema.safeParse(
      valid({
        mentorIds: ["vikram-lakhwara", "elliott-notrica", "ron-lewis"],
        firstChoiceMentorId: "ron-lewis",
        availability: [],
        availabilityNotes: " ",
      }),
    );
    expect(pending.success).toBe(false);
    if (!pending.success) {
      expect(toFieldErrors(pending.error).availabilityNotes).toBe(
        "Tell us when you’re generally free during Founders Week. Vik and Elliott’s times aren’t set yet.",
      );
    }
  });

  it("requires either a ticked window or broad availability (error key availabilityNotes)", () => {
    // Only Ron (his window not ticked), nothing about availability → one clear error on the
    // broad-availability answer.
    const ronOnly = schema.safeParse(
      valid({ mentorIds: ["ron-lewis"], firstChoiceMentorId: "ron-lewis", availability: [], availabilityNotes: "" }),
    );
    expect(ronOnly.success).toBe(false);
    if (!ronOnly.success) {
      expect(Object.keys(toFieldErrors(ronOnly.error))).toEqual(["availabilityNotes"]);
      expect(toFieldErrors(ronOnly.error).availabilityNotes).toMatch(/generally free/);
    }
    // Whitespace isn't an answer.
    expect(
      schema.safeParse(valid({ mentorIds: ["ron-lewis"], firstChoiceMentorId: "ron-lewis", availability: [], availabilityNotes: "   " }))
        .success,
    ).toBe(false);
    // Known windows are optional: Arnav selected, his window not ticked, broad availability given.
    expect(
      schema.safeParse(
        valid({
          mentorIds: ["ron-lewis", "arnav-mishra"],
          firstChoiceMentorId: "ron-lewis",
          availability: [],
          availabilityNotes: "Anytime Friday",
        }),
      ).success,
    ).toBe(true);
    // A ticked window alone is enough.
    expect(schema.safeParse(valid({ availabilityNotes: "" })).success).toBe(true);
    // Over-long broad availability is rejected.
    const long = schema.safeParse(valid({ availabilityNotes: "x".repeat(401) }));
    expect(long.success).toBe(false);
    if (!long.success) expect(Object.keys(toFieldErrors(long.error))).toContain("availabilityNotes");
  });

  it("rejects non-Illinois emails, >100 words, unknown mentors, and missing consent", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ email: "alex@gmail.com" }, "email"],
      [{ workingOn: Array(101).fill("word").join(" ") }, "workingOn"],
      [{ mentorIds: ["nobody"], firstChoiceMentorId: "nobody" }, "mentorIds"],
      // Events are never mentors.
      [{ mentorIds: ["dan-caruso-fireside-chat"], firstChoiceMentorId: "dan-caruso-fireside-chat" }, "mentorIds"],
      [
        { mentorIds: ["happy-hour-at-legends-with-arnav-mishra"], firstChoiceMentorId: "happy-hour-at-legends-with-arnav-mishra" },
        "mentorIds",
      ],
      [{ mentorIds: ["founders-week-afterparty"], firstChoiceMentorId: "founders-week-afterparty" }, "mentorIds"],
      // A time that isn't Elliott's (he has none yet).
      [
        { mentorIds: ["elliott-notrica"], firstChoiceMentorId: "elliott-notrica", availability: ["window:patrick-haddox-2026-10-01-am"] },
        "availability",
      ],
      [{ firstChoiceMentorId: "arnav-mishra" }, "firstChoiceMentorId"],
      [{ availability: ["window:arnav-mishra-2026-10-02-am"] }, "availability"],
      [{ acknowledgeNoGuarantee: false }, "acknowledgeNoGuarantee"],
      [{ consentToShare: false }, "consentToShare"],
      [{ link: "javascript:alert(1)" }, "link"],
      [{ year: "" }, "year"],
    ];
    for (const [override, field] of cases) {
      const r = schema.safeParse(valid(override as never));
      expect(r.success, field).toBe(false);
      if (!r.success) expect(Object.keys(toFieldErrors(r.error)), field).toContain(field);
    }
  });

  it("accepts exactly 100 words and normalizes bare links", () => {
    const r = schema.safeParse(valid({ question: Array(100).fill("w").join(" "), link: "example.com/deck" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.link).toBe("https://example.com/deck");
  });

  it("rejects a link over the limit with its own message (the form no longer truncates it)", () => {
    const r = schema.safeParse(valid({ link: `https://example.com/${"a".repeat(LIMITS.link)}` }));
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error)).toEqual({ link: `Keep links under ${LIMITS.link} characters.` });
  });
});

describe("control characters pasted into answers", () => {
  const NUL = String.fromCharCode(0);
  const BELL = String.fromCharCode(7);
  const ESC = String.fromCharCode(27);
  const DEL = String.fromCharCode(127);
  const C1 = String.fromCharCode(0x85);
  const JUNK = [NUL, BELL, ESC, DEL, C1];
  /** Any control character left over (tab and line feed allowed). */
  const hasControl = (v: string) => [...v].some((c) => /\p{Cc}/u.test(c) && c !== "\t" && c !== "\n");

  it("strips every control character except tabs and line breaks, and normalizes CRLF", () => {
    expect(stripControlChars(`a${NUL}b${BELL}c${ESC}d${DEL}e${C1}f`)).toBe("abcdef");
    expect(stripControlChars("line one\r\nline two\rline three\n\tindented")).toBe("line one\nline two\nline three\n\tindented");
    // Ordinary text (curly quotes, accents, emoji-free Unicode) is untouched.
    expect(stripControlChars("Café “MVP” – ready")).toBe("Café “MVP” – ready");
  });

  it("removes them from every free-text answer (NUL included) before storing", () => {
    const r = schema.safeParse(
      valid({
        fullName: `Alex${NUL} Student${BELL}`,
        email: `Alex${NUL}@Illinois.edu`,
        major: `Computer${NUL} Engineering`,
        participation: "team",
        teamName: `Orbit${ESC}`,
        teammates: `Priya${NUL} Shah`,
        workingOn: `A satellite${NUL} telemetry dashboard.${DEL}`,
        question: `${C1}How do I find${NUL} my first customers?\r\nAnd price it?`,
        availabilityNotes: `Thursday${NUL} mornings`,
        link: `example.com/deck${NUL}`,
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    const d = r.data;
    expect(d).toMatchObject({
      fullName: "Alex Student",
      email: "alex@illinois.edu",
      major: "Computer Engineering",
      teamName: "Orbit",
      teammates: "Priya Shah",
      workingOn: "A satellite telemetry dashboard.",
      question: "How do I find my first customers?\nAnd price it?",
      availabilityNotes: "Thursday mornings",
      link: "https://example.com/deck",
    });
    for (const value of Object.values(d)) {
      if (typeof value === "string") expect(hasControl(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("strips before the length, word and required checks", () => {
    // Exactly at the limit once the NULs are gone.
    const name = "a".repeat(LIMITS.fullName);
    expect(schema.safeParse(valid({ fullName: `${name}${NUL.repeat(20)}` })).success).toBe(true);
    const chars = "b".repeat(LIMITS.longAnswerChars);
    expect(schema.safeParse(valid({ workingOn: `${NUL}${chars}${NUL}` })).success).toBe(true);
    // Stray control characters between words aren't words: the limit counts only real ones.
    const words = `${Array(LIMITS.longAnswerWords).fill("w").join(" ")} ${NUL} ${BELL}`;
    expect(schema.safeParse(valid({ question: words })).success).toBe(true);
    expect(schema.safeParse(valid({ question: `${words} w` })).success).toBe(false);
    // Control characters alone are no answer: the required messages show, not a crash.
    const blank = schema.safeParse(valid({ fullName: JUNK.join(""), question: `${NUL} ${BELL}` }));
    expect(blank.success).toBe(false);
    if (!blank.success) {
      expect(toFieldErrors(blank.error)).toEqual({
        fullName: "Enter your full name.",
        question: "Tell us the question or challenge you’d like help with.",
      });
    }
    // Broad availability made only of control characters doesn't count as an answer either.
    const notes = schema.safeParse(
      valid({ mentorIds: ["ron-lewis"], firstChoiceMentorId: "ron-lewis", availability: [], availabilityNotes: NUL.repeat(3) }),
    );
    expect(notes.success).toBe(false);
    if (!notes.success) expect(Object.keys(toFieldErrors(notes.error))).toEqual(["availabilityNotes"]);
  });
});
