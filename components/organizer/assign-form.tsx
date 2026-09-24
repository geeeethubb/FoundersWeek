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
  /** Why this slot can't be chosen (full, already assigned, overlaps another appointment). */
  disabledReason: string | null;
}

export interface AssignGroup {
  mentorId: string;
  /** e.g. "Avery Sample · 1st choice" */
  label: string;
  /** The student listed this mentor. */
  preferred: boolean;
  options: AssignOption[];
}

/** Propose an appointment: slots grouped by mentor, preferred mentors first. */
export function AssignForm({
  applicationId,
  groups,
  hasActiveAppointment = false,
}: {
  applicationId: string;
  groups: AssignGroup[];
  /** Already has a proposed/confirmed appointment: an extra one is possible but not the next step. */
  hasActiveAppointment?: boolean;
}) {
  const id = useId();
  // Preselect the first open slot of a mentor the student asked for — only when nothing is scheduled
  // yet; otherwise make the organizer choose deliberately.
  const firstOpen = hasActiveAppointment
    ? undefined
    : groups
        .filter((g) => g.preferred)
        .flatMap((g) => g.options)
        .find((o) => !o.disabledReason);
  const [slotId, setSlotId] = useState(firstOpen?.slotId ?? "");
  const [done, setDone] = useState<string | null>(null);
  const { send, error, setError, pending } = useOrganizerRequest();
  const selected = groups.flatMap((g) => g.options).find((o) => o.slotId === slotId);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setDone(null);
        if (!slotId) {
          setError("Choose a slot to propose.");
          return;
        }
        const ok = await send("/api/organizer/appointments", "POST", { applicationId, slotId });
        if (ok) {
          setDone(`Proposed ${selected?.label ?? "the appointment"}.`);
          setSlotId("");
        }
      }}
    >
      <label htmlFor={`${id}-slot`} className="mb-2 block text-sm font-medium text-text">
        Slot
      </label>
      <div className="relative">
        <select
          id={`${id}-slot`}
          value={slotId}
          onChange={(e) => {
            setSlotId(e.target.value);
            setError(null);
            setDone(null);
          }}
          aria-describedby={`${id}-msg`}
          className="field-control cursor-pointer appearance-none pr-9 sm:text-sm"
        >
          <option value="">Choose a slot…</option>
          {groups.map((g) => (
            <optgroup key={g.mentorId} label={g.label}>
              {g.options.map((o) => (
                <option key={o.slotId} value={o.slotId} disabled={Boolean(o.disabledReason)}>
                  {o.label} · {o.status === "confirmed" ? "Confirmed" : "Proposed"} ·{" "}
                  {o.disabledReason ?? `${o.capacity - o.used} of ${o.capacity} open`}
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
        ) : selected?.status === "proposed" ? (
          <p className="mt-2 text-xs text-text-subtle">
            This time isn’t confirmed with the mentor yet. You can still propose it now and confirm it later.
          </p>
        ) : null}
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
        Proposing holds a seat and moves new applications to “Selected”. Email the student to confirm.
      </p>
    </form>
  );
}
