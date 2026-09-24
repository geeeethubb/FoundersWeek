/**
 * Small presentational pieces shared by the organizer dashboard and detail page.
 * Server-safe (no hooks); data arrives already resolved against content.
 */
import { AppointmentStatusBadge, AvailabilityBadge } from "@/components/ui/status";
import { AlertIcon, PickMark } from "@/components/ui/icons";
import type { ApplicationStatus } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import type { ResolvedAvailability } from "@/lib/organizer/directory";

/** Line swatch matching ApplicationStatusBadge's tone + line style. */
const STATUS_SWATCH: Record<ApplicationStatus, string> = {
  submitted: "border-paper/70 border-solid",
  under_review: "border-info border-dashed",
  selected: "border-accent border-dashed",
  waitlisted: "border-warning border-dotted",
  confirmed: "border-success border-solid",
  canceled: "border-danger border-solid",
  attended: "border-paper-subtle border-solid",
};

export function StatusSwatch({ status, className }: { status: ApplicationStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block w-4 border-t-2", STATUS_SWATCH[status], className)} />;
}

/** Ranked mentor preferences; rank 1 (first choice) carries the orange pick mark. */
export function PreferenceList({
  mentors,
  className,
  dense = false,
}: {
  mentors: { mentorId: string; rank: number; name: string; demo?: boolean }[];
  className?: string;
  dense?: boolean;
}) {
  return (
    <ol className={cn(dense ? "space-y-1" : "space-y-1.5", className)}>
      {mentors.map((m) => (
        <li key={m.mentorId} className="flex items-baseline gap-2">
          <span className="w-4 shrink-0 font-mono text-xs text-paper-subtle tabular">{m.rank}.</span>
          <span className={cn("min-w-0", m.rank === 1 ? "text-paper" : "text-paper-muted")}>
            {m.name}
            {m.rank === 1 ? (
              <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap font-mono text-[0.625rem] uppercase tracking-[0.08em] text-accent">
                <PickMark className="size-1.5" />
                1st choice
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Selected availability with its certainty badge (window / exact times forthcoming / proposed /
 * confirmed), grouped by mentor.
 */
export function AvailabilityList({
  items,
  showMentor = true,
  className,
}: {
  items: ResolvedAvailability[];
  showMentor?: boolean;
  className?: string;
}) {
  if (!items.length) return <InterestOnly className={className} />;
  const groups: { mentorId: string; mentorName: string; items: ResolvedAvailability[] }[] = [];
  for (const item of items) {
    const group = groups.find((g) => g.mentorId === item.mentorId);
    if (group) group.items.push(item);
    else groups.push({ mentorId: item.mentorId, mentorName: item.mentorName, items: [item] });
  }
  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((g) => (
        <div key={g.mentorId} className="min-w-0">
          {showMentor ? <p className="text-xs leading-5 text-paper-muted">{g.mentorName}</p> : null}
          <ul className="space-y-1.5">
            {g.items.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs leading-5 text-paper">{a.label}</span>
                {a.certainty ? (
                  <AvailabilityBadge kind={a.certainty} />
                ) : (
                  <span className="mono-label text-danger">No longer in content</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function InterestOnly({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm", className)}>
      <span className="mono-label inline-flex items-center gap-2 text-paper">
        <span aria-hidden className="inline-block w-4 border-t-2 border-dotted border-paper-muted" />
        Interest only
      </span>
      <span className="mt-0.5 block text-xs text-paper-subtle">No time selected</span>
    </p>
  );
}

export function DuplicateFlag({ count, className }: { count: number; className?: string }) {
  if (count < 2) return null;
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs text-warning", className)}>
      <AlertIcon className="size-3.5 shrink-0" />
      {count} applications from this email
    </p>
  );
}

/** Compact active-appointment line: badge + mentor + time. */
export function AppointmentLine({
  status,
  mentorName,
  when,
  className,
}: {
  status: "proposed" | "confirmed" | "canceled";
  mentorName: string;
  when: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <AppointmentStatusBadge status={status} />
      <p className="mt-1 text-xs leading-5 text-paper-muted">
        <span className="text-paper">{mentorName}</span> · <span className="font-mono">{when}</span>
      </p>
    </div>
  );
}

/**
 * Seat pips for a slot: solid green = confirmed, dashed amber = proposed (holds a seat),
 * hairline = open.
 */
export function SeatPips({
  capacity,
  confirmed,
  proposed,
  className,
}: {
  capacity: number;
  confirmed: number;
  proposed: number;
  className?: string;
}) {
  const shown = Math.max(capacity, confirmed + proposed);
  return (
    <span aria-hidden className={cn("inline-flex flex-wrap gap-1", className)}>
      {Array.from({ length: shown }, (_, i) => {
        const kind = i < confirmed ? "confirmed" : i < confirmed + proposed ? "proposed" : "open";
        return (
          <span
            key={i}
            className={cn(
              "size-3 rounded-[1px] border",
              kind === "confirmed" && "border-success bg-success",
              kind === "proposed" && "border-dashed border-warning bg-warning-soft",
              kind === "open" && "border-line-strong",
              i >= capacity && "border-danger",
            )}
          />
        );
      })}
    </span>
  );
}
