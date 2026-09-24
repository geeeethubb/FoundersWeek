/**
 * Renders the application's client components to static HTML (the server pass students first
 * receive) and checks what the model tests can't: labels and hints on screen, ARIA wiring of the
 * radio chips and the broad-availability field, and the confirmation after a replayed submit.
 */
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/office-hours",
}));

import { ApplicationForm } from "@/components/apply/application-form";
import { Confirmation } from "@/components/apply/confirmation";
import { ChoiceIndicator, RadioChip, WRAPPED_FOCUS } from "@/components/apply/controls";
import { ErrorSummary } from "@/components/apply/error-summary";
import { emptyFormState, type FormState } from "@/components/apply/form-model";
import { AvailabilityFields, type ApplyMentorProfiles } from "@/components/apply/mentor-section";
import { mentors } from "@/content/mentors";
import type { Mentor } from "@/content/types";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { STAGE_OPTIONS } from "@/lib/applications/constants";
import { presentOptions } from "@/lib/applications/option-presentation";
import { EMPTY_PREFILL, resolvePrefill } from "@/lib/applications/prefill";

function setup(list: Mentor[]) {
  const catalog = buildApplicationCatalog(list);
  const presentations = presentOptions(catalog, list);
  const profiles: ApplyMentorProfiles = Object.fromEntries(
    list.map((m) => [m.id, { role: m.role, company: m.company, headshot: m.headshot }]),
  );
  return { catalog, presentations, profiles };
}

const real = setup(mentors);
const { catalog } = real;

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
const fixture = setup([...mentors, DATE_ONLY_MENTOR]);

/** Text content with the few entities React emits decoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** The opening tag of the element with this id. */
function tagWithId(html: string, id: string): string {
  const tag = new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`).exec(html)?.[0];
  expect(tag, `element #${id}`).toBeTruthy();
  return tag!;
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function renderForm(prefill = EMPTY_PREFILL, { catalog, presentations, profiles } = real) {
  return renderToStaticMarkup(
    createElement(ApplicationForm, {
      catalog,
      emailDomains: ["illinois.edu"],
      presentations,
      profiles,
      prefill,
      draftKey: "test-draft",
      closed: null,
    }),
  );
}

function renderAvailability(overrides: Partial<FormState>, { catalog, presentations } = real) {
  return renderToStaticMarkup(
    createElement(AvailabilityFields, {
      catalog,
      presentations,
      state: { ...emptyFormState(), ...overrides },
      errors: {},
      onToggleOption: () => {},
      onNotesChange: () => {},
      onLeave: () => {},
    }),
  );
}

describe("the application form", () => {
  it("has three groups — About you, Your interests, Submit — and asks where the idea or startup is", () => {
    const html = renderForm();
    const titles = [...html.matchAll(/<h3 id="apply-group-[a-z]+-title"[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(titles).toEqual(["About you", "Your interests", "Submit"]);
    const t = text(html);
    expect(t).toContain("Where is your idea or startup right now?");
    expect(t).not.toContain("Where are you right now?");
    expect(t).not.toContain("Confirm and submit");
    // Each stage shows its description as the radio's description (its name stays the short label).
    for (const option of STAGE_OPTIONS) {
      const input = tagWithId(html, `apply-stage-${option.value}`);
      expect(attr(input, "aria-labelledby")).toBe(`apply-stage-${option.value}-label`);
      expect(attr(input, "aria-describedby")).toBe(`apply-stage-${option.value}-description`);
      const inner = (id: string) => new RegExp(`\\bid="${id}"[^>]*>([^<]*)<`).exec(html)?.[1];
      expect(inner(`apply-stage-${option.value}-label`)).toBe(option.label);
      expect(inner(`apply-stage-${option.value}-description`)).toBe(option.description);
    }
    // Only live regions that are used: no empty role="status" wrapper among the mentors.
    expect(html).not.toMatch(/<div role="status"><\/div>\s*<fieldset/);
    // The matching sentence lives once on the page, outside the application.
    expect(t).not.toContain("Founders will match students by interests and availability");
    // Plain punctuation: no em dashes in the form's copy.
    expect(t).not.toContain("—");
  });

  it("opens with a note for a preselected mentor", () => {
    const html = renderForm(resolvePrefill(catalog, { mentor: "vikram-lakhwara" }));
    expect(text(html)).toContain("Vikram “Vik” Lakhwara is selected below. Add anyone else you’d like to meet.");
    // Vik has no times yet: broad availability is required, and the hint says why.
    expect(text(html)).toContain("Needed because Vik’s times aren’t set yet.");
    expect(attr(tagWithId(html, "apply-availabilityNotes"), "aria-required")).toBe("true");
  });

  it("lists all six mentors in directory order, Rishab last with his role and company", () => {
    const html = renderForm();
    const ids = [...html.matchAll(/<input\b[^>]*\bid="apply-mentor-([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "elliott-notrica", "ron-lewis", "rishab-veldur"]);
    const row = new RegExp(`<li id="apply-mentor-row-rishab-veldur">.*?</li>`).exec(html)?.[0] ?? "";
    expect(text(row)).toBe("Rishab Veldur Co-Founder & CEO · Auvi Labs");
    // Nothing is ticked until a mentor is chosen.
    expect(html).not.toContain("apply-option-window-rishab-veldur-2026-10-01");
  });

  it("opens from Rishab's link with him selected, his Thu, Oct 1 window (12:00–5:00 PM CT) ticked, and the note optional", () => {
    const html = renderForm(resolvePrefill(catalog, { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" }));
    const t = text(html);
    expect(t).toContain(
      "Rishab Veldur is selected below, with “I can make Thu, Oct 1, 12:00–5:00 PM CT” ticked. Add anyone else you’d like to meet.",
    );
    expect(attr(tagWithId(html, "apply-mentor-rishab-veldur"), "checked")).toBe("");
    expect(attr(tagWithId(html, "apply-mentor-patrick-haddox"), "checked")).toBeNull();
    expect(attr(tagWithId(html, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBe("");
    expect(t).toContain("I can make Thu, Oct 1, 12:00–5:00 PM CT Rishab’s office-hours window");
    // His time is set, so his ticked window is enough: the note is optional, like with Patrick.
    expect(t).toContain(
      "Broad availability (optional) When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Not needed if you tick a time above.",
    );
    expect(t).not.toContain("Rishab’s times aren’t set yet");
    expect(t).not.toContain("exact time to be confirmed");
    expect(attr(tagWithId(html, "apply-availabilityNotes"), "aria-required")).toBeNull();
    // Only his Thu, Oct 1 time is offered: never Fri, Oct 2.
    expect(t).not.toContain("Oct 2");
  });

  it("opens from a date-only mentor's link (fixture) with the window ticked and the note required", () => {
    const html = renderForm(
      resolvePrefill(fixture.catalog, { mentor: "fixture-casey", window: "fixture-casey-2026-10-01" }),
      fixture,
    );
    const t = text(html);
    expect(t).toContain(
      "Casey Fixture is selected below, with “I can make Thu, Oct 1 (exact time to be confirmed)” ticked. Add anyone else you’d like to meet.",
    );
    expect(attr(tagWithId(html, "apply-mentor-fixture-casey"), "checked")).toBe("");
    expect(attr(tagWithId(html, "apply-mentor-rishab-veldur"), "checked")).toBeNull();
    expect(attr(tagWithId(html, "apply-option-window-fixture-casey-2026-10-01"), "checked")).toBe("");
    expect(t).toContain("I can make Thu, Oct 1 (exact time to be confirmed) Casey’s office-hours window");
    expect(t).toContain(
      "Needed because Casey’s times aren’t set yet. Casey has office hours on Thu, Oct 1, so include when you’re free that day.",
    );
    expect(attr(tagWithId(html, "apply-availabilityNotes"), "aria-required")).toBe("true");
    expect(t).not.toContain("Oct 2");
  });
});

describe("broad availability", () => {
  it("is required and says why when a selected mentor's times aren't set, even with another time ticked", () => {
    const html = renderAvailability({
      mentorIds: ["patrick-haddox", "vikram-lakhwara"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
    });
    const t = text(html);
    expect(t).toContain(
      "Broad availability When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Needed because Vik’s times aren’t set yet.",
    );
    expect(t).not.toContain("Not needed");
    expect(t).not.toMatch(/Broad availability \(optional\)/);
    expect(t).not.toContain("this week");
    const textarea = tagWithId(html, "apply-availabilityNotes");
    expect(attr(textarea, "aria-required")).toBe("true");
    expect(attr(textarea, "aria-describedby")).toBe("apply-availabilityNotes-hint");
  });

  it("is optional once a listed time is ticked and every selected mentor has times", () => {
    const html = renderAvailability({ mentorIds: ["patrick-haddox"], availability: ["window:patrick-haddox-2026-10-01-am"] });
    expect(text(html)).toContain("Broad availability (optional)");
    expect(text(html)).toContain("Not needed if you tick a time above.");
    expect(attr(tagWithId(html, "apply-availabilityNotes"), "aria-required")).toBeNull();

    const nothingTicked = renderAvailability({ mentorIds: ["patrick-haddox"] });
    expect(text(nothingTicked)).not.toContain("(optional) When");
    expect(attr(tagWithId(nothingTicked, "apply-availabilityNotes"), "aria-required")).toBe("true");
  });

  it("with Rishab, offers “I can make Thu, Oct 1, 12:00–5:00 PM CT” and, once it's ticked, makes the note optional", () => {
    const optional =
      "Broad availability (optional) When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Not needed if you tick a time above.";
    const html = renderAvailability({ mentorIds: ["rishab-veldur"], availability: ["window:rishab-veldur-2026-10-01"] });
    const t = text(html);
    expect(t).toBe(`Can you make these times? (optional) I can make Thu, Oct 1, 12:00–5:00 PM CT Rishab’s office-hours window ${optional}`);
    expect(attr(tagWithId(html, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBe("");
    const textarea = tagWithId(html, "apply-availabilityNotes");
    expect(attr(textarea, "aria-required")).toBeNull();
    expect(attr(textarea, "aria-describedby")).toBe("apply-availabilityNotes-hint");

    // Nothing ticked yet: the note is required until a time is ticked, and the hint says so.
    const nothingTicked = renderAvailability({ mentorIds: ["rishab-veldur"] });
    expect(text(nothingTicked)).toBe(
      "Can you make these times? (optional) I can make Thu, Oct 1, 12:00–5:00 PM CT Rishab’s office-hours window Broad availability When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Not needed if you tick a time above.",
    );
    expect(attr(tagWithId(nothingTicked, "apply-availabilityNotes"), "aria-required")).toBe("true");
    expect(attr(tagWithId(nothingTicked, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBeNull();

    // With Patrick's window ticked: both times listed, and Patrick's time is enough.
    const withPatrick = renderAvailability({
      mentorIds: ["rishab-veldur", "patrick-haddox"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
    });
    const tp = text(withPatrick);
    expect(tp).toBe(
      `Can you make these times? (optional) I can make Thu, Oct 1, 10:00–11:30 AM CT Patrick’s office-hours window I can make Thu, Oct 1, 12:00–5:00 PM CT Rishab’s office-hours window ${optional}`,
    );
    expect(attr(tagWithId(withPatrick, "apply-availabilityNotes"), "aria-required")).toBeNull();
    expect(attr(tagWithId(withPatrick, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBeNull();
    expect(attr(tagWithId(withPatrick, "apply-option-window-patrick-haddox-2026-10-01-am"), "checked")).toBe("");

    // Next to Vik (still scheduling), the note is required again, naming only Vik.
    const withVik = text(
      renderAvailability({ mentorIds: ["rishab-veldur", "vikram-lakhwara"], availability: ["window:rishab-veldur-2026-10-01"] }),
    );
    expect(withVik).toContain(
      "Broad availability When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Needed because Vik’s times aren’t set yet.",
    );
    expect(withVik).not.toContain("Rishab’s times");
    expect(withVik).not.toContain("office hours on");
  });

  it("with a date-only mentor (fixture), offers “I can make Thu, Oct 1 (exact time to be confirmed)” and still requires the note, pointing to that day", () => {
    const hint =
      "Broad availability When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Needed because Casey’s times aren’t set yet. Casey has office hours on Thu, Oct 1, so include when you’re free that day.";
    const html = renderAvailability({ mentorIds: ["fixture-casey"], availability: ["window:fixture-casey-2026-10-01"] }, fixture);
    const t = text(html);
    expect(t).toBe(`Can you make these times? (optional) I can make Thu, Oct 1 (exact time to be confirmed) Casey’s office-hours window ${hint}`);
    expect(attr(tagWithId(html, "apply-option-window-fixture-casey-2026-10-01"), "checked")).toBe("");
    const textarea = tagWithId(html, "apply-availabilityNotes");
    expect(attr(textarea, "aria-required")).toBe("true");
    expect(attr(textarea, "aria-describedby")).toBe("apply-availabilityNotes-hint");
    expect(t).not.toContain("Not needed");

    // With Patrick's window ticked too: both times listed, the note still required because of the date-only mentor.
    const withPatrick = renderAvailability(
      { mentorIds: ["fixture-casey", "patrick-haddox"], availability: ["window:patrick-haddox-2026-10-01-am"] },
      fixture,
    );
    const tp = text(withPatrick);
    expect(tp).toContain(
      "I can make Thu, Oct 1, 10:00–11:30 AM CT Patrick’s office-hours window I can make Thu, Oct 1 (exact time to be confirmed) Casey’s office-hours window",
    );
    expect(tp).toContain(hint);
    expect(attr(tagWithId(withPatrick, "apply-availabilityNotes"), "aria-required")).toBe("true");
    expect(attr(tagWithId(withPatrick, "apply-option-window-fixture-casey-2026-10-01"), "checked")).toBeNull();
  });
});

describe("radio chips", () => {
  const chip = (extra: { invalid?: boolean; errorMessageId?: string; description?: string }) => {
    const props: ComponentProps<typeof RadioChip> = {
      id: "apply-stage-idea",
      name: "stage",
      value: "idea",
      onChange: () => {},
      children: "Have an idea",
      ...extra,
    };
    return renderToStaticMarkup(createElement(RadioChip, props));
  };

  it("mark themselves invalid and point at the group's error", () => {
    const input = tagWithId(chip({ invalid: true, errorMessageId: "apply-stage-error" }), "apply-stage-idea");
    expect(attr(input, "aria-invalid")).toBe("true");
    expect(attr(input, "aria-describedby")).toBe("apply-stage-error");

    const valid = tagWithId(chip({ invalid: false, errorMessageId: "apply-stage-error" }), "apply-stage-idea");
    expect(attr(valid, "aria-invalid")).toBeNull();
    expect(attr(valid, "aria-describedby")).toBeNull();
  });

  it("keep the description out of the name", () => {
    const html = chip({ description: "An idea you want to pressure-test.", invalid: true, errorMessageId: "apply-stage-error" });
    const input = tagWithId(html, "apply-stage-idea");
    expect(attr(input, "aria-labelledby")).toBe("apply-stage-idea-label");
    expect(attr(input, "aria-describedby")).toBe("apply-stage-idea-description apply-stage-error");
    expect(text(html)).toBe("Have an idea An idea you want to pressure-test.");
  });

  it("use ≥3:1 borders and an accent-strong focus ring", () => {
    for (const type of ["checkbox", "radio"] as const) {
      const html = renderToStaticMarkup(createElement(ChoiceIndicator, { type }));
      expect(html).toContain("border-text-subtle");
      expect(html).not.toContain("border-line-strong");
    }
    expect(WRAPPED_FOCUS).toContain("outline-accent-strong");
    expect(WRAPPED_FOCUS.split(" ")).not.toContain("has-[input:focus-visible]:outline-accent");
  });
});

describe("error summary", () => {
  it("links are at least 44px tall", () => {
    const html = renderToStaticMarkup(
      createElement(ErrorSummary, {
        title: "Please fix the highlighted answers",
        items: [
          { key: "fullName", message: "Enter your full name.", targetId: "apply-fullName" },
          { key: "form", message: "Something went wrong.", targetId: null },
        ],
        onJump: () => {},
      }),
    );
    const link = /<a\b[^>]*href="#apply-fullName"[^>]*>/.exec(html)?.[0] ?? "";
    expect(attr(link, "class")?.split(" ")).toEqual(expect.arrayContaining(["inline-flex", "min-h-11", "items-center"]));
  });
});

describe("confirmation", () => {
  const base = {
    firstName: "Alex",
    email: "alex.edited@illinois.edu",
    statusUrl: "https://founders.example.edu/apply/status/abc.def",
    mentorNames: ["Patrick Haddox", "Ron Lewis"],
  };

  it("names the mentors after a new submission", () => {
    const t = text(renderToStaticMarkup(createElement(Confirmation, base)));
    expect(t).toContain("Application received");
    expect(t).toContain("Thanks, Alex. Your application to meet Patrick Haddox and Ron Lewis is saved.");
    expect(t).toContain("alex.edited@illinois.edu");
    expect(t).toContain("Save it to check your status any time. You don’t need an account, but anyone with the link can see your status.");
    expect(t).not.toContain("—");
  });

  it("after a replayed submit, repeats nothing from the (possibly edited) answers and points to the status link", () => {
    const html = renderToStaticMarkup(createElement(Confirmation, { ...base, replay: true }));
    const t = text(html);
    expect(t).toContain("Application received");
    expect(t).toContain("This application was already received");
    expect(t).toContain("Your private status link below shows what Founders received.");
    expect(t).toContain("the address on your application");
    for (const local of ["Patrick Haddox", "Ron Lewis", "Alex", "alex.edited@illinois.edu"]) expect(t).not.toContain(local);
    expect(html).toContain(`href="${base.statusUrl}"`);
    expect(attr(tagWithId(html, "apply-status-link"), "value")).toBe(base.statusUrl);
  });
});
