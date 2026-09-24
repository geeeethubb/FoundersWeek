"use client";

/**
 * Step 01: choose mentors, a first choice, and times per mentor — all on one card per mentor.
 *
 * - Every mentor accepting applications is listed, always (no carousel, nothing hidden), with
 *   their portrait, verified role · organization and availability state.
 * - The whole card header toggles the mentor (a native checkbox; the "Add / Added" chip mirrors it).
 * - Selecting a mentor opens their card, tethered to the portrait: a "First choice" radio (once two
 *   or more are selected) and the times they've published, each drawn with its certainty line style
 *   (window: dashed · rough window: dotted · proposed: dashed amber · confirmed: solid green).
 * - Mentors still scheduling ("Scheduling in progress") take no time selection: the student is
 *   expressing interest, and Founders follows up once availability is finalized.
 * - Cards stay in directory order (never reorder under the cursor).
 */
import { Fragment, type FocusEvent } from "react";
import { DemoBadge } from "@/components/ui/badge";
import { FieldError, errorId } from "@/components/ui/field";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AVAILABILITY_BORDER_CLASSES, AvailabilityBadge, type AvailabilityKind } from "@/components/ui/status";
import type { Mentor } from "@/content/types";
import type { ApplicationCatalog, AvailabilityOption, CatalogMentor } from "@/lib/applications/catalog";
import type { OptionPresentation } from "@/lib/applications/option-presentation";
import { cn } from "@/lib/cn";
import { INTEREST_COPY } from "@/lib/mentors";
import { ChoiceIndicator, WRAPPED_FOCUS } from "./controls";
import {
  effectiveFirstChoice,
  fieldId,
  firstChoiceRadioId,
  mentorCheckboxId,
  mentorRowId,
  optionCheckboxId,
  splitPhrases,
  type FieldErrors,
  type FormState,
} from "./form-model";

export type OptionPresentations = Record<string, OptionPresentation>;

/** Verified public identity for a mentor card (from content; drafts never included). */
export interface ApplyMentorProfile {
  role: string | null;
  company: string | null;
  headshot: Mentor["headshot"];
}
export type ApplyMentorProfiles = Record<string, ApplyMentorProfile>;

/** Presentation for an option, falling back to the catalog's own wording. */
export function present(option: AvailabilityOption, presentations: OptionPresentations): OptionPresentation {
  return presentations[option.key] ?? { kind: option.certainty, label: option.label, detail: option.detail };
}

/** The most certain kind among a mentor's options, for the card's badge. */
export function mentorKind(mentor: CatalogMentor, presentations: OptionPresentations): AvailabilityKind {
  if (mentor.scheduling === "in-progress" || mentor.options.length === 0) return "in-progress";
  const all = mentor.options.map((o) => present(o, presentations).kind);
  for (const k of ["confirmed", "proposed", "window", "window-approx"] as const) if (all.includes(k)) return k;
  return "window";
}

function schedulingSummary(mentor: CatalogMentor, presentations: OptionPresentations): string {
  if (mentor.scheduling === "in-progress" || mentor.options.length === 0) {
    return "No time to pick yet — express interest";
  }
  if (mentor.options.length === 1) return present(mentor.options[0], presentations).label;
  const dates = [...new Set(mentor.options.map((o) => present(o, presentations).label.split(" · ")[0]))];
  return `${mentor.options.length} times · ${dates.join(", ")}`;
}

/** "CEO & Co-Founder · Samara Aerospace" — verified fields only; falls back to the catalog line. */
export function identityLine(mentor: Pick<CatalogMentor, "affiliation">, profile: ApplyMentorProfile | undefined): string | null {
  if (!profile) return mentor.affiliation;
  const parts = [profile.role, profile.company].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Text like "Thu, Oct 1 · 10:00–11:30 AM CT" that only wraps between phrases (after " ·" or " —"),
 * so a time never breaks across lines on a phone.
 */
export function Phrases({ text, className }: { text: string; className?: string }) {
  const parts = splitPhrases(text);
  return (
    <span className={className}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i ? " " : null}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** Calls `onLeave` when focus moves outside the element (group "blur"). */
function leaveHandler(onLeave: () => void) {
  return (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
  };
}

export function FirstChoiceTag({ className, hidden }: { className?: string; hidden?: boolean }) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xs border border-accent bg-accent-soft px-2 font-mono text-[0.6875rem] font-medium uppercase leading-none tracking-[0.08em] text-accent",
        className,
      )}
    >
      <StarMark className="size-2.5" />
      First choice
    </span>
  );
}

function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={className}>
      <path d="M5 0.6 6.2 3.8 9.4 5 6.2 6.2 5 9.4 3.8 6.2 0.6 5 3.8 3.8Z" fill="currentColor" />
    </svg>
  );
}

/** Visual state of the card's checkbox. The native checkbox (sr-only) carries the semantics. */
function AddChip({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-sm border font-mono text-[0.6875rem] font-medium uppercase leading-none tracking-[0.1em] transition-colors duration-150 sm:h-9 sm:w-auto sm:px-3",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-strong text-paper-muted group-hover/mentor:border-paper/35 group-hover/mentor:text-paper",
      )}
    >
      {selected ? <CheckIcon className="size-3.5" strokeWidth={2.25} /> : <PlusIcon className="size-3.5" />}
      <span className="hidden sm:inline">{selected ? "Added" : "Add"}</span>
    </span>
  );
}

export function MentorSection({
  catalog,
  presentations,
  profiles,
  state,
  errors,
  highlightId,
  onToggleMentor,
  onFirstChoice,
  onToggleOption,
  onGroupLeave,
}: {
  catalog: ApplicationCatalog;
  presentations: OptionPresentations;
  profiles: ApplyMentorProfiles;
  state: FormState;
  errors: FieldErrors;
  /** Mentor just added from a link on the page — briefly outlined. */
  highlightId: string | null;
  onToggleMentor: (mentorId: string, checked: boolean) => void;
  onFirstChoice: (mentorId: string) => void;
  onToggleOption: (key: string, checked: boolean) => void;
  onGroupLeave: (key: string) => void;
}) {
  const selectedCount = catalog.mentors.filter((m) => state.mentorIds.includes(m.id)).length;
  const firstChoice = effectiveFirstChoice(state);
  const chosen = new Set(state.availability);
  const total = catalog.mentors.length;
  const pad = (n: number) => String(n).padStart(2, "0");

  const mentorsError = errors.mentorIds;
  const firstChoiceError = errors.firstChoiceMentorId;
  const generalAvailabilityError = errors.availability;
  const needsFirstChoice = selectedCount >= 2 && !firstChoice;

  return (
    <div>
      <fieldset
        onBlur={leaveHandler(() => onGroupLeave("mentorIds"))}
        aria-describedby={
          cn(
            `${fieldId("mentorIds")}-hint`,
            mentorsError && errorId(fieldId("mentorIds")),
            firstChoiceError && errorId(fieldId("firstChoiceMentorId")),
          ) || undefined
        }
      >
        <legend className="sr-only">Which mentors would you like to meet?</legend>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p
            id={`${fieldId("mentorIds")}-hint`}
            className={cn("max-w-md text-sm leading-relaxed", needsFirstChoice ? "text-paper" : "text-paper-subtle")}
          >
            {needsFirstChoice
              ? "Mark one as your first choice — Founders considers it when matching."
              : "Add as many as you like. Adding a mentor opens their times."}
          </p>
          <p className="font-mono text-xs text-paper-muted tabular" aria-live="polite" aria-atomic="true">
            <span className={cn(selectedCount > 0 ? "text-accent" : "text-paper-muted")}>{pad(selectedCount)}</span>
            <span className="text-paper-subtle"> / {pad(total)}</span>
            <span className="sr-only"> mentors selected</span>
            <span aria-hidden className="text-paper-subtle">
              {" "}
              selected
            </span>
          </p>
        </div>

        <ul
          className={cn(
            "divide-y overflow-hidden rounded-sm border",
            mentorsError ? "divide-danger/30 border-danger/60" : "divide-line border-line-strong",
          )}
        >
          {catalog.mentors.map((mentor) => {
            const selected = state.mentorIds.includes(mentor.id);
            const isFirst = firstChoice === mentor.id;
            const profile = profiles[mentor.id];
            const identity = identityLine(mentor, profile);
            const kind = mentorKind(mentor, presentations);
            const errorKey = `availability.${mentor.id}`;
            const mentorError = errors[errorKey];
            const interestOnly = mentor.scheduling === "in-progress" || mentor.options.length === 0;
            const checkboxId = mentorCheckboxId(mentor.id);
            const showRadio = selected && selectedCount >= 2;
            const single = mentor.options.length === 1;

            return (
              <li
                key={mentor.id}
                id={mentorRowId(mentor.id)}
                className={cn(
                  "relative transition-[background-color,box-shadow] duration-700 ease-out",
                  selected ? "bg-ink-850" : "bg-transparent",
                  highlightId === mentor.id && "bg-accent-soft shadow-[inset_0_0_0_1px_var(--color-accent)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-accent transition-opacity duration-200",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />

                {/* Card header: the whole row toggles the mentor. */}
                <label
                  htmlFor={checkboxId}
                  className={cn(
                    "group/mentor relative flex cursor-pointer items-start gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5",
                    !selected && "hover:bg-paper/[0.025]",
                    WRAPPED_FOCUS,
                    "has-[input:focus-visible]:-outline-offset-2",
                  )}
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="peer sr-only"
                    checked={selected}
                    onChange={(e) => onToggleMentor(mentor.id, e.target.checked)}
                    aria-invalid={mentorsError ? true : undefined}
                  />
                  <MentorPortrait
                    id={mentor.id}
                    name={mentor.name}
                    headshot={profile?.headshot ?? null}
                    size="md"
                    className={cn(
                      "max-sm:size-14 transition-colors duration-200",
                      selected ? "border-accent/70" : "group-hover/mentor:border-paper/30",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 pt-0.5">
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="font-wide text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-paper sm:text-lg">
                            {mentor.name}
                          </span>
                          {isFirst ? <FirstChoiceTag hidden={showRadio} /> : null}
                          {mentor.demo ? <DemoBadge /> : null}
                        </span>
                        {identity ? (
                          <span className="mt-0.5 block text-sm leading-snug text-paper-muted">{identity}</span>
                        ) : null}
                      </span>
                      <AddChip selected={selected} />
                    </span>
                    <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <AvailabilityBadge kind={kind} />
                      <Phrases
                        text={schedulingSummary(mentor, presentations)}
                        className="font-mono text-xs leading-5 text-paper-subtle tabular"
                      />
                    </span>
                  </span>
                </label>

                {/* Expanded: first choice + times, tethered to the portrait. */}
                {selected ? (
                  <div className="animate-fade-up relative space-y-5 px-4 pb-5 sm:pb-6 sm:pl-[7.5rem] sm:pr-5">
                    <span
                      aria-hidden
                      className="absolute -top-3 bottom-8 left-[3.75rem] hidden w-0 border-l border-dashed border-accent/45 sm:block"
                    />
                    <span
                      aria-hidden
                      className="absolute bottom-[1.6rem] left-[calc(3.75rem-3.5px)] hidden size-2 rounded-full border border-accent bg-ink-850 sm:block"
                    />

                    {showRadio ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <label
                          htmlFor={firstChoiceRadioId(mentor.id)}
                          className={cn(
                            "relative inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm border px-3.5 py-2 text-sm transition-colors duration-150",
                            firstChoiceError ? "border-danger/60" : "border-line-strong hover:border-paper/30",
                            "has-[input:checked]:border-accent has-[input:checked]:bg-accent-soft",
                            WRAPPED_FOCUS,
                          )}
                        >
                          <input
                            id={firstChoiceRadioId(mentor.id)}
                            type="radio"
                            name="firstChoiceMentorId"
                            className="peer sr-only"
                            value={mentor.id}
                            checked={isFirst}
                            onChange={() => onFirstChoice(mentor.id)}
                            onBlur={() => onGroupLeave("firstChoiceMentorId")}
                            aria-describedby={firstChoiceError ? errorId(fieldId("firstChoiceMentorId")) : undefined}
                          />
                          <ChoiceIndicator type="radio" />
                          <span className="font-medium text-paper">
                            <span className="sr-only">{mentor.name}: </span>
                            First choice
                          </span>
                        </label>
                        <span className={cn("text-sm", isFirst ? "text-paper-muted" : "text-paper-subtle")}>
                          {isFirst
                            ? "Founders considers this when matching."
                            : firstChoice
                              ? `Switch your first choice to ${mentor.firstName}`
                              : `Make ${mentor.firstName} your first choice`}
                        </span>
                      </div>
                    ) : null}

                    {interestOnly ? (
                      <div className="rounded-sm border border-dotted border-line-strong bg-ink-900/60 px-4 py-3.5">
                        <p className="text-sm font-medium text-paper">No time to pick yet — you’re expressing interest.</p>
                        <p className="mt-1 text-sm leading-relaxed text-paper-muted">
                          {INTEREST_COPY.followUp} {INTEREST_COPY.noReservation}
                        </p>
                      </div>
                    ) : (
                      <fieldset
                        onBlur={leaveHandler(() => onGroupLeave(errorKey))}
                        aria-describedby={mentorError ? errorId(fieldId(errorKey)) : undefined}
                      >
                        <legend className="mb-3 flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-[0.9375rem] font-medium text-paper">
                            When could you meet {mentor.firstName}?
                          </span>
                          <span className="mono-label text-paper-subtle">
                            {single ? "Check it if it works" : "Select every time that works"}
                          </span>
                        </legend>
                        <ul className="space-y-2">
                          {mentor.options.map((option) => {
                            const id = optionCheckboxId(option.key);
                            const p = present(option, presentations);
                            return (
                              <li key={option.key}>
                                <label
                                  htmlFor={id}
                                  className={cn(
                                    "relative flex min-h-12 cursor-pointer items-start gap-3.5 rounded-sm border bg-ink-900 px-4 py-3.5 transition-colors duration-150",
                                    mentorError ? "border-danger/60" : AVAILABILITY_BORDER_CLASSES[p.kind],
                                    "hover:border-paper/35 has-[input:checked]:border-accent/80 has-[input:checked]:bg-ink-800",
                                    WRAPPED_FOCUS,
                                  )}
                                >
                                  <input
                                    id={id}
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={chosen.has(option.key)}
                                    onChange={(e) => onToggleOption(option.key, e.target.checked)}
                                    aria-invalid={mentorError ? true : undefined}
                                  />
                                  <ChoiceIndicator type="checkbox" className="mt-0.5" />
                                  <span className="min-w-0 flex-1">
                                    <AvailabilityBadge kind={p.kind} className="-mt-0.5" />
                                    <Phrases
                                      text={p.label}
                                      className="mt-2 block font-mono text-[0.9375rem] leading-snug text-paper tabular"
                                    />
                                    <span className="mt-1 block text-sm leading-snug text-paper-subtle">{p.detail}</span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        <FieldError id={fieldId(errorKey)}>{mentorError}</FieldError>
                      </fieldset>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <FieldError id={fieldId("mentorIds")}>{mentorsError}</FieldError>
        <FieldError id={fieldId("firstChoiceMentorId")}>{firstChoiceError}</FieldError>
        <FieldError id={fieldId("availability")}>{generalAvailabilityError}</FieldError>
      </fieldset>
    </div>
  );
}
