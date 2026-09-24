import { describe, expect, it } from "vitest";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { buildApplicationCatalog, mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { LIMITS } from "@/lib/applications/constants";
import { createApplicationSchema, emptyApplicationValues, toFieldErrors } from "@/lib/applications/schema";

const catalog = buildApplicationCatalog([...mentors, ...demoMentors]);
const schema = createApplicationSchema({ catalog, emailDomains: ["illinois.edu"] });

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
    expect(byId["arnav-mishra"].options[0].label).toBe("Fri, Oct 2 · Friday morning, before noon · Exact window pending");
    expect(byId["ron-lewis"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["vikram-lakhwara"]).toMatchObject({ scheduling: "in-progress", options: [] });
    expect(byId["elliott-notrica"]).toMatchObject({ scheduling: "in-progress", options: [] });
    // Demo mentor with slots: slots replace the window.
    expect(byId["demo-avery-sample"].options.map((o) => o.kind)).toEqual(["slot", "slot"]);
    expect(byId["demo-jordan-placeholder"].options[0].certainty).toBe("proposed");
  });

  it("lists the six real mentors, Rishab last, with his one Thu, Oct 1 window marked as time not known", () => {
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
      label: "Thu, Oct 1 · Exact time to be confirmed",
      timeKnown: false,
    });
    // Every other option (real windows, demo windows and slots) has a known time.
    const others = catalog.mentors.filter((m) => m.id !== "rishab-veldur").flatMap((m) => m.options);
    expect(others.length).toBeGreaterThan(0);
    expect(others.filter((o) => !o.timeKnown).map((o) => o.key)).toEqual([]);
  });

  it("needs broad availability exactly for mentors without a known time (Vik, Elliott, Ron, Rishab)", () => {
    expect(catalog.mentors.filter((m) => mentorNeedsBroadAvailability(m)).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
    // No options at all counts as "no known time".
    expect(mentorNeedsBroadAvailability({ options: [] })).toBe(true);
    const rishabWindow = catalog.mentors.find((m) => m.id === "rishab-veldur")!.options[0];
    const patrickWindow = catalog.mentors.find((m) => m.id === "patrick-haddox")!.options[0];
    // One timed option is enough to not need it.
    expect(mentorNeedsBroadAvailability({ options: [rishabWindow, { ...rishabWindow, key: "window:x", timeKnown: true }] })).toBe(
      false,
    );
    expect(mentorNeedsBroadAvailability({ options: [patrickWindow] })).toBe(false);
  });
});

describe("Rishab (Thu, Oct 1, exact time to be confirmed)", () => {
  const RISHAB_WINDOW = "window:rishab-veldur-2026-10-01";
  const PATRICK_WINDOW = "window:patrick-haddox-2026-10-01-am";
  const rishab = { mentorIds: ["rishab-veldur"], firstChoiceMentorId: "rishab-veldur" };

  it("needs the broad-availability note even with his window ticked, and the error names him", () => {
    const r = schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Rishab’s times aren’t set yet.",
      });
    }
    // Whitespace isn't an answer.
    expect(schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "  \n " })).success).toBe(false);
  });

  it("accepts his window with a note, and the note alone", () => {
    const r = schema.safeParse(valid({ ...rishab, availability: [RISHAB_WINDOW], availabilityNotes: "Free after 3 PM on Thursday" }));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mentorIds).toEqual(["rishab-veldur"]);
      expect(r.data.availability).toEqual([RISHAB_WINDOW]);
      expect(r.data.availabilityNotes).toBe("Free after 3 PM on Thursday");
    }
    expect(schema.safeParse(valid({ ...rishab, availability: [], availabilityNotes: "Thursday afternoon" })).success).toBe(true);
  });

  it("with Patrick's window ticked and no note, still errors naming Rishab (not Patrick)", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["rishab-veldur", "patrick-haddox"],
        firstChoiceMentorId: "rishab-veldur",
        availability: [PATRICK_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Rishab’s times aren’t set yet.",
      });
    }
    // Both windows ticked: same answer.
    const both = schema.safeParse(
      valid({
        mentorIds: ["patrick-haddox", "rishab-veldur"],
        firstChoiceMentorId: "patrick-haddox",
        availability: [PATRICK_WINDOW, RISHAB_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(both.success).toBe(false);
    if (!both.success) {
      expect(toFieldErrors(both.error).availabilityNotes).toBe(
        "Tell us when you’re generally free during Founders Week. Rishab’s times aren’t set yet.",
      );
    }
    expect(
      schema.safeParse(
        valid({
          mentorIds: ["rishab-veldur", "patrick-haddox"],
          firstChoiceMentorId: "rishab-veldur",
          availability: [PATRICK_WINDOW],
          availabilityNotes: "Anytime Thursday afternoon",
        }),
      ).success,
    ).toBe(true);
  });

  it("names him with the mentors still scheduling, in the order chosen", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["vikram-lakhwara", "rishab-veldur", "ron-lewis"],
        firstChoiceMentorId: "rishab-veldur",
        availability: [RISHAB_WINDOW],
        availabilityNotes: "",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(toFieldErrors(r.error)).toEqual({
        availabilityNotes: "Tell us when you’re generally free during Founders Week. Vik, Rishab and Ron’s times aren’t set yet.",
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

describe("application schema", () => {
  it("accepts a valid application and normalizes email", () => {
    const r = schema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("alex@illinois.edu");
  });

  it("never blocks on mentors whose schedule is pending: broad availability is enough", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["ron-lewis", "vikram-lakhwara"],
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
        "Tell us when you’re generally free during Founders Week. Vik, Elliott and Ron’s times aren’t set yet.",
      );
    }
  });

  it("requires either a ticked window or broad availability (error key availabilityNotes)", () => {
    // Only Ron, nothing about availability → one clear error on the broad-availability answer.
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
});
