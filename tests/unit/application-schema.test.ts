import { describe, expect, it } from "vitest";
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
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
    // Demo mentor with slots: slots replace the window.
    expect(byId["demo-avery-sample"].options.map((o) => o.kind)).toEqual(["slot", "slot"]);
    expect(byId["demo-jordan-placeholder"].options[0].certainty).toBe("proposed");
  });
});

describe("application schema", () => {
  it("accepts a valid application and normalizes email", () => {
    const r = schema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("alex@illinois.edu");
  });

  it("lets students express interest in mentors still scheduling without choosing a time", () => {
    const r = schema.safeParse(
      valid({
        mentorIds: ["ron-lewis", "vikram-lakhwara"],
        firstChoiceMentorId: "vikram-lakhwara",
        availability: [],
      }),
    );
    expect(r.success).toBe(true);
  });

  it("still requires a time for mentors with published availability", () => {
    const r = schema.safeParse(
      valid({ mentorIds: ["ron-lewis", "arnav-mishra"], firstChoiceMentorId: "ron-lewis", availability: [] }),
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error)["availability.arnav-mishra"]).toMatch(/Arnav/);
  });

  it("rejects non-Illinois emails, >100 words, unknown mentors, and missing consent", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ email: "alex@gmail.com" }, "email"],
      [{ workingOn: Array(101).fill("word").join(" ") }, "workingOn"],
      [{ mentorIds: ["nobody"], firstChoiceMentorId: "nobody" }, "mentorIds"],
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
