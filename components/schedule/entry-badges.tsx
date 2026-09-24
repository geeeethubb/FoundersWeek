/**
 * Labels for a schedule entry, in a fixed order so rows scan consistently:
 * Founders' involvement (Hosted / Co-hosted / Supported by Founders / Part of Founders Week) →
 * "Related event" → status (Planned, Canceled…; office hours show their availability kind) →
 * demo → Founders pick. Confirmed events carry no status label — confirmed is the default.
 *
 * Props
 * - `entry`: the ScheduleEntry.
 * - `showPick`: render the "Founders pick" marker (default true; never on office hours, which are
 *   already labeled "Hosted by Founders").
 * - `showStatus`: render the status/availability label (default true).
 * - `showWeek`: render "Part of Founders Week" (default true). The calendar hides it: the official
 *   program is the default there, so only Founders' involvement and related events get a label.
 * - `className`: extra classes for the wrapper.
 *
 * Renders nothing when there is no label to show.
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
  showWeek = true,
  className,
}: {
  entry: ScheduleEntry;
  showPick?: boolean;
  showStatus?: boolean;
  showWeek?: boolean;
  className?: string;
}) {
  const isOfficeHours = entry.kind === "office-hours";
  const involvement = entry.involvement && (showWeek || entry.involvement !== "week") ? entry.involvement : null;
  const status = !showStatus ? null : isOfficeHours ? "availability" : entry.status !== "confirmed" ? "status" : null;
  const pick = showPick && entry.foundersPick && !isOfficeHours;
  if (!involvement && !entry.related && !status && !entry.demo && !pick) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
      {involvement ? <InvolvementBadge involvement={involvement} /> : null}
      {entry.related ? <RelatedBadge /> : null}
      {status === "availability" ? <AvailabilityBadge kind={entryAvailabilityKind(entry)} /> : null}
      {status === "status" ? <StatusBadge status={entry.status} /> : null}
      {entry.demo ? <DemoBadge /> : null}
      {pick ? <PickBadge className="ml-1" /> : null}
    </div>
  );
}
