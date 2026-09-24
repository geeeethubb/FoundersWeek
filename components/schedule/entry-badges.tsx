/**
 * Badge cluster for a schedule entry, in a fixed order so rows scan consistently:
 * involvement (Hosted / Co-hosted / Supported by Founders / Part of Founders Week) → related event
 * → certainty (status, or availability for office hours) → demo → Founders pick.
 *
 * Props
 * - `entry`: the ScheduleEntry.
 * - `showPick`: render the Founders pick marker (default true).
 * - `showStatus`: render the status/availability badge (default true).
 * - `className`: extra classes for the wrapper.
 */
import { DemoBadge, InvolvementBadge, PickBadge, RelatedBadge, StatusBadge } from "@/components/ui/badge";
import { AvailabilityBadge } from "@/components/ui/status";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { entryAvailabilityKind } from "@/lib/schedule/format";
import { cn } from "@/lib/cn";

export function EntryBadges({
  entry,
  showPick = true,
  showStatus = true,
  className,
}: {
  entry: ScheduleEntry;
  showPick?: boolean;
  showStatus?: boolean;
  className?: string;
}) {
  const isOfficeHours = entry.kind === "office-hours";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
      {entry.involvement ? <InvolvementBadge involvement={entry.involvement} /> : null}
      {entry.related ? <RelatedBadge /> : null}
      {showStatus ? (
        isOfficeHours ? (
          <AvailabilityBadge kind={entryAvailabilityKind(entry)} />
        ) : entry.status !== "confirmed" ? (
          <StatusBadge status={entry.status} />
        ) : null
      ) : null}
      {entry.demo ? <DemoBadge /> : null}
      {showPick && entry.foundersPick ? <PickBadge className="ml-1" /> : null}
    </div>
  );
}
