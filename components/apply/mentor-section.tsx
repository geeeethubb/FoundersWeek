"use client";

/**
 * The "who and when" part of the application:
 *
 * - `MentorPicker`: every mentor accepting applications, always listed (nothing hidden), as a
 *   compact selectable row — portrait, name, role · company and a checkbox.
 * - `FirstChoicePicker`: once two or more mentors are selected, which one comes first
 *   (one mentor is automatically the first choice).
 * - `AvailabilityFields`: an optional "I can make …" checkbox for each published time of a
 *   selected mentor, plus one broad-availability answer. Either is enough — except that a selected
 *   mentor whose times aren't set yet always needs the broad answer (the shared schema's rule).
 *   The session length (`site.officeHours`) is said once: under the listed times ("if you're
 *   matched, Founders will email you a specific session time inside the window you picked"), or at
 *   the end of the broad-availability hint when no times are listed.
 */
import type { FocusEvent } from "react";
import { DemoBadge } from "@/components/ui/badge";
import { FieldError, errorId, hintId } from "@/components/ui/field";
import { MentorPortrait } from "@/components/ui/portrait";
import type { Mentor } from "@/content/types";
import type { ApplicationCatalog, AvailabilityOption, CatalogMentor } from "@/lib/applications/catalog";
import { LIMITS, SESSION_COPY, type SessionLength } from "@/lib/applications/constants";
import type { OptionPresentation } from "@/lib/applications/option-presentation";
import { cn } from "@/lib/cn";
import { ChoiceIndicator, CheckboxRow, Hint, Label, RadioChip, TextAreaField, WRAPPED_FOCUS } from "./controls";
import {
  broadAvailabilityGuidance,
  effectiveFirstChoice,
  fieldId,
  firstChoiceRadioId,
  knownTimes,
  mentorCheckboxId,
  mentorRowId,
  optionCheckboxId,
  selectedMentors,
  type FieldErrors,
  type FormState,
} from "./form-model";

export type OptionPresentations = Record<string, OptionPresentation>;

/** Verified public identity for a mentor row (from content; drafts never included). */
export interface ApplyMentorProfile {
  role: string | null;
  company: string | null;
  headshot: Mentor["headshot"];
}
export type ApplyMentorProfiles = Record<string, ApplyMentorProfile>;

/** Presentation for an option, falling back to the catalog's own wording. */
export function present(option: AvailabilityOption, presentations: OptionPresentations): OptionPresentation {
  return (
    presentations[option.key] ?? {
      kind: option.certainty,
      label: option.label,
      phrase: option.label.replace(" · ", ", "),
      detail: option.detail,
    }
  );
}

/** "CEO & Co-Founder · Samara Aerospace" — verified fields only; falls back to the catalog line. */
export function identityLine(mentor: Pick<CatalogMentor, "affiliation">, profile: ApplyMentorProfile | undefined): string | null {
  if (!profile) return mentor.affiliation;
  const parts = [profile.role, profile.company].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Calls `onLeave` when focus moves outside the element (group "blur"). */
function leaveHandler(onLeave: () => void) {
  return (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
  };
}

// ---------------------------------------------------------------------------
// Mentors
// ---------------------------------------------------------------------------

export function MentorPicker({
  catalog,
  profiles,
  state,
  error,
  highlightId,
  onToggle,
  onLeave,
}: {
  catalog: ApplicationCatalog;
  profiles: ApplyMentorProfiles;
  state: FormState;
  error?: string;
  /** Mentor just added from a link on the page — briefly highlighted. */
  highlightId: string | null;
  onToggle: (mentorId: string, checked: boolean) => void;
  onLeave: () => void;
}) {
  const id = fieldId("mentorIds");
  return (
    <fieldset onBlur={leaveHandler(onLeave)} aria-describedby={cn(hintId(id), error && errorId(id)) || undefined}>
      <Label as="legend">Who would you like to meet?</Label>
      <Hint id={id}>Pick one or more. One application covers all of them.</Hint>
      <ul className="mt-3 grid gap-2">
        {catalog.mentors.map((mentor) => {
          const selected = state.mentorIds.includes(mentor.id);
          const profile = profiles[mentor.id];
          const identity = identityLine(mentor, profile);
          const checkboxId = mentorCheckboxId(mentor.id);
          return (
            <li key={mentor.id} id={mentorRowId(mentor.id)}>
              <label
                htmlFor={checkboxId}
                className={cn(
                  "relative flex min-h-16 cursor-pointer items-center gap-4 rounded-md border px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200",
                  selected ? "border-accent bg-accent-soft/50" : "border-line bg-surface hover:border-line-strong",
                  highlightId === mentor.id && "shadow-[0_0_0_3px_rgb(255_150_0_/_0.28)]",
                  "has-[input:disabled]:cursor-not-allowed",
                  WRAPPED_FOCUS,
                )}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  className="peer sr-only"
                  checked={selected}
                  onChange={(e) => onToggle(mentor.id, e.target.checked)}
                  aria-invalid={error ? true : undefined}
                />
                {/* Decorative here: the name is right next to it (and names the checkbox). */}
                <MentorPortrait
                  id={mentor.id}
                  name={mentor.name}
                  headshot={profile?.headshot ? { ...profile.headshot, alt: "" } : null}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold leading-snug text-text">{mentor.name}</span>
                    {mentor.demo ? <DemoBadge /> : null}
                  </span>
                  {identity ? <span className="mt-0.5 block text-sm leading-snug text-text-muted">{identity}</span> : null}
                </span>
                <ChoiceIndicator type="checkbox" className="ml-1" />
              </label>
            </li>
          );
        })}
      </ul>
      <FieldError id={id}>{error}</FieldError>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// First choice
// ---------------------------------------------------------------------------

export function FirstChoicePicker({
  catalog,
  state,
  error,
  onChoose,
  onLeave,
}: {
  catalog: ApplicationCatalog;
  state: FormState;
  error?: string;
  onChoose: (mentorId: string) => void;
  onLeave: () => void;
}) {
  const mentors = selectedMentors(state, catalog);
  if (mentors.length < 2) return null;
  const first = effectiveFirstChoice(state);
  const id = fieldId("firstChoiceMentorId");
  return (
    <fieldset
      onBlur={leaveHandler(onLeave)}
      aria-describedby={cn(hintId(id), error && errorId(id)) || undefined}
      className="animate-fade-up"
    >
      <Label as="legend">First choice</Label>
      <Hint id={id}>Who would you most like to meet?</Hint>
      <div className="mt-3 flex flex-wrap gap-2">
        {mentors.map((mentor) => (
          <RadioChip
            key={mentor.id}
            id={firstChoiceRadioId(mentor.id)}
            name="firstChoiceMentorId"
            value={mentor.id}
            checked={first === mentor.id}
            onChange={() => onChoose(mentor.id)}
            invalid={Boolean(error)}
            errorMessageId={errorId(id)}
          >
            {mentor.name}
          </RadioChip>
        ))}
      </div>
      <FieldError id={id}>{error}</FieldError>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export function AvailabilityFields({
  catalog,
  presentations,
  state,
  errors,
  officeHours,
  onToggleOption,
  onNotesChange,
  onLeave,
}: {
  catalog: ApplicationCatalog;
  presentations: OptionPresentations;
  state: FormState;
  errors: FieldErrors;
  /** The session rule (`site.officeHours`). */
  officeHours: SessionLength;
  onToggleOption: (key: string, checked: boolean) => void;
  onNotesChange: (value: string) => void;
  onLeave: (key: "availability" | "availabilityNotes") => void;
}) {
  const times = knownTimes(state, catalog);
  const chosen = new Set(state.availability);
  const groupId = fieldId("availability");
  const broad = broadAvailabilityGuidance(state, catalog);
  const windowsOnly = times.every(({ option }) => option.kind === "window");
  return (
    <div className="space-y-6">
      {times.length ? (
        <fieldset
          className="animate-fade-up"
          onBlur={leaveHandler(() => onLeave("availability"))}
          aria-describedby={cn(hintId(groupId), errors.availability && errorId(groupId)) || undefined}
        >
          <Label as="legend" optional>
            Can you make these times?
          </Label>
          <Hint id={groupId}>{SESSION_COPY.formTimes(officeHours, windowsOnly)}</Hint>
          <div className="mt-2">
            {times.map(({ mentor, option }) => {
              const p = present(option, presentations);
              return (
                <CheckboxRow
                  key={option.key}
                  id={optionCheckboxId(option.key)}
                  checked={chosen.has(option.key)}
                  onChange={(e) => onToggleOption(option.key, e.target.checked)}
                  description={`${mentor.firstName}’s office-hours ${option.kind === "slot" ? "time" : "window"}`}
                >
                  I can make {p.phrase}
                </CheckboxRow>
              );
            })}
          </div>
          <FieldError id={groupId}>{errors.availability}</FieldError>
        </fieldset>
      ) : null}
      <TextAreaField
        id={fieldId("availabilityNotes")}
        label="Broad availability"
        optional={!broad.required}
        aria-required={broad.required || undefined}
        hint={times.length ? broad.hint : `${broad.hint} ${SESSION_COPY.formLength(officeHours)}`}
        value={state.availabilityNotes}
        maxLength={LIMITS.availabilityNotes}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={() => onLeave("availabilityNotes")}
        error={errors.availabilityNotes}
      />
    </div>
  );
}
