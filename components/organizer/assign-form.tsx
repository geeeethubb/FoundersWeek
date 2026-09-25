"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon, ChevronDownIcon } from "@/components/ui/icons";
import { useOrganizerRequest } from "./use-organizer-request";

export interface AssignOption {
  slotId: string;
  label: string;
  status: "proposed" | "confirmed";
  capacity: number;
  used: number;
  /** A session generated from the mentor's window (vs. an explicit slot in content). */
  generated: boolean;
  /** Why this slot can't be chosen (full, already assigned, overlaps another appointment). */
  disabledReason: string | null;
  /** Inside a window (or is a slot) the student ticked in their application. */
  picked?: boolean;
}

export interface AssignGroup {
  mentorId: string;
  /** e.g. "Avery Sample · 1st choice" */
  label: string;
  /** The student listed this mentor. */
  preferred: boolean;
  /**
   * Shown when one of this mentor's sessions is selected, e.g. a mentor hosting one or two
   * sessions while their window fits three.
   */
  note?: string | null;
  options: AssignOption[];
}

/** "Thu, Oct 1 · 12:00–12:25 PM CT · 1 of 1 open" (explicit slots also say Confirmed/Proposed). */
export function assignOptionText(o: AssignOption): string {
  return [
    o.label,
    o.generated ? null : o.status === "confirmed" ? "Confirmed" : "Proposed",
    o.disabledReason ?? `${o.capacity - o.used} of ${o.capacity} open`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Propose an appointment: sessions grouped by mentor, preferred mentors first. */
export function AssignForm({
  applicationId,
  groups,
  ruleText,
  hasActiveAppointment = false,
}: {
  applicationId: string;
  groups: AssignGroup[];
  /** The session rule from site settings, e.g. "Each session is 25 minutes, with a 5-minute break between sessions." */
  ruleText: string;
  /** Already has a proposed/confirmed appointment: an extra one is possible but not the next step. */
  hasActiveAppointment?: boolean;
}) {
  const id = useId();
  // Preselect the first open session of a mentor the student asked for, preferring a time inside a
  // window they ticked (a mentor can have several windows). Only when nothing is scheduled yet;
  // otherwise make the organizer choose deliberately.
  const preferredOpen = groups.filter((g) => g.preferred).flatMap((g) => g.options).filter((o) => !o.disabledReason);
  const firstOpen = hasActiveAppointment ? undefined : (preferredOpen.find((o) => o.picked) ?? preferredOpen[0]);
  const [slotId, setSlotId] = useState(firstOpen?.slotId ?? "");
  const [done, setDone] = useState<string | null>(null);
  const { send, error, setError, pending } = useOrganizerRequest();
  const selected = groups.flatMap((g) => g.options).find((o) => o.slotId === slotId);
  const selectedGroup = groups.find((g) => g.options.some((o) => o.slotId === slotId));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setDone(null);
        if (!slotId) {
          setError("Choose a session to propose.");
          return;
        }
        const ok = await send("/api/organizer/appointments", "POST", { applicationId, slotId });
        if (ok) {
          setDone(`Proposed ${selected?.label ?? "the appointment"}.`);
          setSlotId("");
        }
      }}
    >
      <label htmlFor={`${id}-slot`} className="block text-sm font-medium text-text">
        Time slot
      </label>
      <p id={`${id}-rule`} className="mt-1 mb-2 text-xs leading-relaxed text-text-subtle">
        {ruleText} One application (a student or a team) per session.
      </p>
      <div className="relative">
        <select
          id={`${id}-slot`}
          value={slotId}
          onChange={(e) => {
            setSlotId(e.target.value);
            setError(null);
            setDone(null);
          }}
          aria-describedby={`${id}-rule ${id}-msg`}
          className="field-control cursor-pointer appearance-none pr-9 sm:text-sm"
        >
          <option value="">Choose a session…</option>
          {groups.map((g) => (
            <optgroup key={g.mentorId} label={g.label}>
              {g.options.map((o) => (
                <option key={o.slotId} value={o.slotId} disabled={Boolean(o.disabledReason)}>
                  {assignOptionText(o)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
      </div>
      <div id={`${id}-msg`} aria-live="polite" className="text-sm">
        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-danger">
            <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : done ? (
          <p className="mt-2 text-success">{done}</p>
        ) : (
          <>
            {selectedGroup?.note ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-text">
                <AlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>{selectedGroup.note}</span>
              </p>
            ) : null}
            {selected?.status === "proposed" ? (
              <p className="mt-2 text-xs text-text-subtle">
                This time isn’t confirmed with the mentor yet. You can still propose it now and confirm it later.
              </p>
            ) : null}
          </>
        )}
      </div>
      <Button
        type="submit"
        variant={hasActiveAppointment ? "secondary" : "primary"}
        className="mt-3 w-full max-sm:h-11"
        disabled={pending || !slotId}
      >
        {pending ? "Proposing…" : hasActiveAppointment ? "Propose another appointment" : "Propose appointment"}
      </Button>
      <p className="mt-2 text-xs text-text-subtle">
        Proposing holds the seat and moves new applications to “Selected”. Email the student to confirm.
      </p>
    </form>
  );
}
