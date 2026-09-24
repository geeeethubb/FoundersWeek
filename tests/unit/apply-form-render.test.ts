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
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { STAGE_OPTIONS } from "@/lib/applications/constants";
import { presentOptions } from "@/lib/applications/option-presentation";
import { EMPTY_PREFILL, resolvePrefill } from "@/lib/applications/prefill";

const catalog = buildApplicationCatalog(mentors);
const presentations = presentOptions(catalog, mentors);
const profiles: ApplyMentorProfiles = Object.fromEntries(
  mentors.map((m) => [m.id, { role: m.role, company: m.company, headshot: m.headshot }]),
);

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

function renderForm(prefill = EMPTY_PREFILL) {
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

function renderAvailability(overrides: Partial<FormState>) {
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

  it("opens from Rishab's link with him selected, his Thu, Oct 1 window ticked, and the note required", () => {
    const html = renderForm(resolvePrefill(catalog, { mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" }));
    const t = text(html);
    expect(t).toContain(
      "Rishab Veldur is selected below, with “I can make Thu, Oct 1 (exact time to be confirmed)” ticked. Add anyone else you’d like to meet.",
    );
    expect(attr(tagWithId(html, "apply-mentor-rishab-veldur"), "checked")).toBe("");
    expect(attr(tagWithId(html, "apply-mentor-patrick-haddox"), "checked")).toBeNull();
    expect(attr(tagWithId(html, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBe("");
    expect(t).toContain("I can make Thu, Oct 1 (exact time to be confirmed) Rishab’s office-hours window");
    expect(t).toContain(
      "Needed because Rishab’s times aren’t set yet. Rishab has office hours on Thu, Oct 1, so include when you’re free that day.",
    );
    expect(attr(tagWithId(html, "apply-availabilityNotes"), "aria-required")).toBe("true");
    // Only his Thu, Oct 1 time is offered: never Fri, Oct 2.
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

  it("with Rishab, offers “I can make Thu, Oct 1 (exact time to be confirmed)” and still requires the note, pointing to that day", () => {
    const hint =
      "Broad availability When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday. Needed because Rishab’s times aren’t set yet. Rishab has office hours on Thu, Oct 1, so include when you’re free that day.";
    const html = renderAvailability({ mentorIds: ["rishab-veldur"], availability: ["window:rishab-veldur-2026-10-01"] });
    const t = text(html);
    expect(t).toBe(`Can you make these times? (optional) I can make Thu, Oct 1 (exact time to be confirmed) Rishab’s office-hours window ${hint}`);
    expect(attr(tagWithId(html, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBe("");
    const textarea = tagWithId(html, "apply-availabilityNotes");
    expect(attr(textarea, "aria-required")).toBe("true");
    expect(attr(textarea, "aria-describedby")).toBe("apply-availabilityNotes-hint");
    expect(t).not.toContain("Not needed");

    // With Patrick's window ticked too: both times listed, the note still required because of Rishab.
    const withPatrick = renderAvailability({
      mentorIds: ["rishab-veldur", "patrick-haddox"],
      availability: ["window:patrick-haddox-2026-10-01-am"],
    });
    const tp = text(withPatrick);
    expect(tp).toContain(
      "I can make Thu, Oct 1, 10:00–11:30 AM CT Patrick’s office-hours window I can make Thu, Oct 1 (exact time to be confirmed) Rishab’s office-hours window",
    );
    expect(tp).toContain(hint);
    expect(attr(tagWithId(withPatrick, "apply-availabilityNotes"), "aria-required")).toBe("true");
    expect(attr(tagWithId(withPatrick, "apply-option-window-rishab-veldur-2026-10-01"), "checked")).toBeNull();
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
