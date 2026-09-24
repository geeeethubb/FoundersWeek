"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon, ChevronDownIcon } from "@/components/ui/icons";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/applications/constants";
import { useOrganizerRequest } from "./use-organizer-request";

const NEEDS_CONFIRMED_APPOINTMENT: ApplicationStatus[] = ["confirmed", "attended"];

const HINTS: Partial<Record<ApplicationStatus, string>> = {
  under_review: "No appointment needed.",
  selected: "No appointment needed yet. Email the student, then propose a time once there’s a slot for it.",
  waitlisted: "No appointment needed.",
  canceled: "Also cancels this application’s active appointments.",
};

/**
 * Change an application's status. Confirmed/Attended need a confirmed appointment: when there
 * isn't one, `confirmBlockedReason` explains why (e.g. the mentor has no slots yet) and Save is
 * disabled for those choices. The API enforces the same rule.
 */
export function StatusForm({
  applicationId,
  status,
  confirmBlockedReason,
}: {
  applicationId: string;
  status: ApplicationStatus;
  /** Why Confirmed/Attended can't be chosen right now; null when a confirmed appointment exists. */
  confirmBlockedReason: string | null;
}) {
  const id = useId();
  const [value, setValue] = useState<ApplicationStatus>(status);
  const [saved, setSaved] = useState(false);
  // Status can also change from other actions (assigning, confirming): follow the server.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    setValue(status);
  }
  const { send, error, setError, pending } = useOrganizerRequest();
  const changed = value !== status;
  const blocked = changed && NEEDS_CONFIRMED_APPOINTMENT.includes(value) && Boolean(confirmBlockedReason);
  const hint = !changed ? null : blocked ? confirmBlockedReason : HINTS[value] ?? null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        if (!changed || blocked) return;
        const ok = await send(`/api/organizer/applications/${applicationId}`, "PATCH", { status: value });
        if (ok) setSaved(true);
      }}
    >
      <label htmlFor={`${id}-status`} className="sr-only">
        Application status
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            id={`${id}-status`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value as ApplicationStatus);
              setSaved(false);
              setError(null);
            }}
            aria-describedby={`${id}-msg`}
            className="field-control cursor-pointer appearance-none pr-9"
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
                {confirmBlockedReason && NEEDS_CONFIRMED_APPOINTMENT.includes(s) && s !== status
                  ? " (needs a confirmed appointment)"
                  : ""}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
        </div>
        <Button
          type="submit"
          variant={changed && !blocked ? "primary" : "secondary"}
          className="h-[2.875rem]"
          disabled={!changed || blocked || pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <div id={`${id}-msg`} aria-live="polite" className="text-sm">
        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-danger">
            <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : hint ? (
          <p className={blocked ? "mt-2 flex items-start gap-1.5 text-warning" : "mt-2 text-text-muted"}>
            {blocked ? <AlertIcon className="mt-0.5 size-3.5 shrink-0" /> : null}
            <span>{hint}</span>
          </p>
        ) : saved ? (
          <p className="mt-2 text-success">Status saved.</p>
        ) : null}
      </div>
    </form>
  );
}
