/**
 * Small presentational pieces shared by the organizer dashboard and detail page.
 * Server-safe (no hooks); data arrives already resolved against content.
 */
import { AppointmentStatusBadge, AvailabilityBadge } from "@/components/ui/status";
import { AlertIcon, PickMark } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { ResolvedAvailability } from "@/lib/organizer/directory";

/** A setting name, file path or command inside organizer copy. */
export function Code({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("rounded-xs bg-surface-muted px-1 py-px text-[0.8125rem] font-medium text-charcoal", className)}>
      {children}
    </code>
  );
}

/** "First choice" marker: a small orange dot plus accessible, readable text. */
export function FirstChoiceMark({ label = "1st choice", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-accent-strong", className)}>
      <PickMark className="size-1.5" />
      {label}
    </span>
  );
}

/** Ranked mentor preferences; rank 1 (first choice) is marked. */
export function PreferenceList({
  mentors,
  className,
}: {
  mentors: { mentorId: string; rank: number; name: string }[];
  className?: string;
}) {
  return (
    <ol className={cn("space-y-1.5", className)}>
      {mentors.map((m) => (
        <li key={m.mentorId} className="flex items-baseline gap-2 text-sm">
          <span className="w-4 shrink-0 text-text-subtle tabular">{m.rank}.</span>
          <span className={cn("min-w-0", m.rank === 1 ? "font-medium text-text" : "text-text-muted")}>
            {m.name}
            {m.rank === 1 ? <FirstChoiceMark className="ml-2" /> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Selected availability with its certainty badge (availability window / exact times forthcoming /
 * proposed slot / confirmed slot), grouped by mentor.
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
          {showMentor ? <p className="text-xs font-medium text-text-subtle">{g.mentorName}</p> : null}
          <ul className="mt-1 space-y-2">
            {g.items.map((a) => (
              <li key={a.key} className="min-w-0">
                <p className="text-sm leading-snug text-text tabular">{a.label}</p>
                {a.certainty ? (
                  <AvailabilityBadge kind={a.certainty} className="mt-1" />
                ) : (
                  <p className="mt-0.5 text-xs font-medium text-danger">No longer listed in content</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The student chose a mentor but no time (their mentor may still be scheduling). */
export function InterestOnly({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium text-text">Interest only</span>
      <span className="block text-xs text-text-subtle">No time selected</span>
    </p>
  );
}

export function DuplicateFlag({ count, className }: { count: number; className?: string }) {
  if (count < 2) return null;
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-warning", className)}>
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
      <p className="mt-1 text-sm leading-snug text-text-muted">
        <span className="font-medium text-text">{mentorName}</span>
        <span className="block text-xs text-text-subtle tabular">{when}</span>
      </p>
    </div>
  );
}

/**
 * Seats for a slot: filled green = confirmed, amber = proposed (holds a seat), outline = open,
 * red outline = over capacity. Decorative — the seat count is always given as text next to it.
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
              "size-3 rounded-full border",
              kind === "confirmed" && "border-success bg-success",
              kind === "proposed" && "border-accent bg-accent",
              kind === "open" && "border-line-strong bg-surface",
              i >= capacity && "border-danger",
            )}
          />
        );
      })}
    </span>
  );
}
