"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import { useOrganizerRequest } from "./use-organizer-request";

/**
 * Confirm / Cancel for one appointment. Cancel asks for a second click (inline, no dialog).
 * `confirmBlockedReason` disables Confirm with an explanation (e.g. the slot time itself
 * isn't confirmed with the mentor yet) — the API enforces the same rule.
 */
export function AppointmentActions({
  appointmentId,
  status,
  confirmBlockedReason,
}: {
  appointmentId: string;
  status: "proposed" | "confirmed";
  confirmBlockedReason: string | null;
}) {
  const { send, error, pending } = useOrganizerRequest();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const url = `/api/organizer/appointments/${appointmentId}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {status === "proposed" ? (
          <Button
            size="sm"
            variant="primary"
            disabled={pending || Boolean(confirmBlockedReason)}
            onClick={() => send(url, "PATCH", { action: "confirm" })}
            className="max-sm:h-11 max-sm:flex-1"
          >
            Confirm
          </Button>
        ) : null}
        {confirmingCancel ? (
          <>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={async () => {
                const ok = await send(url, "PATCH", { action: "cancel" });
                if (ok) setConfirmingCancel(false);
              }}
              className="max-sm:h-11 max-sm:flex-1"
            >
              {pending ? "Canceling…" : "Yes, cancel it"}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmingCancel(false)} className="max-sm:h-11">
              Keep
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
            className="max-sm:h-11 max-sm:flex-1"
          >
            Cancel appointment
          </Button>
        )}
      </div>
      <div aria-live="polite" className="text-sm">
        {error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 text-danger">
            <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : status === "proposed" && confirmBlockedReason ? (
          <p className="mt-2 text-xs text-warning">{confirmBlockedReason}</p>
        ) : confirmingCancel ? (
          <p className="mt-2 text-xs text-paper-subtle">This frees the seat. The student’s status is updated if needed.</p>
        ) : null}
      </div>
    </div>
  );
}
