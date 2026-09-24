import Link from "next/link";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import type { OrganizerDirectory } from "@/lib/organizer/directory";
import { organizersHref, type ApplicationFilters } from "@/lib/organizer/filters";
import type { MentorInterest, SlotUsage } from "@/lib/organizer/queries";
import { describeTime, formatDate } from "@/lib/time";

/**
 * Demand at a glance: every mentor with portrait, how many active applications list them
 * (and as first choice), and where their scheduling stands. Each cell filters the list by that
 * mentor (select again to clear). All mentors are always shown.
 */
export function MentorLineup({
  directory,
  interest,
  usage,
  filters,
}: {
  directory: OrganizerDirectory;
  interest: ReadonlyMap<string, MentorInterest>;
  usage: ReadonlyMap<string, SlotUsage>;
  filters: ApplicationFilters;
}) {
  const count = directory.mentors.length;
  // Keep rows full: 4 → four across, 6 → three across.
  const cols = count % 4 === 0 ? "lg:grid-cols-4" : count % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  return (
    <nav aria-label="Applications by mentor">
      <ul className={cn("grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2", cols)}>
        {directory.mentors.map((m, i) => {
          const active = filters.mentor === m.id;
          const n = interest.get(m.id) ?? { any: 0, first: 0 };
          const slots = directory.slots.filter((s) => s.mentorId === m.id);
          const windows = directory.windows.filter((w) => w.mentorId === m.id);
          const seats = slots.reduce(
            (acc, s) => {
              const u = usage.get(s.id) ?? { proposed: 0, confirmed: 0 };
              return { used: acc.used + u.proposed + u.confirmed, capacity: acc.capacity + s.capacity };
            },
            { used: 0, capacity: 0 },
          );
          // Line style = certainty: solid slots, dashed windows, dotted still scheduling.
          const scheduling: { line: string; text: React.ReactNode } = slots.length
            ? { line: "border-solid border-paper-muted", text: `${slots.length} slot${slots.length === 1 ? "" : "s"} · ${seats.used}/${seats.capacity} seats` }
            : windows.length
              ? {
                  line: "border-dashed border-paper-muted",
                  // Date and time never break internally ("10:00–11:30 / AM").
                  text: windows.map((w, wi) => (
                    <span key={w.id}>
                      {wi ? " · " : null}
                      <span className="whitespace-nowrap">{formatDate(w.date, "short")}</span>
                      {" · "}
                      <span className="whitespace-nowrap">{describeTime(w.time).bare}</span>
                    </span>
                  )),
                }
              : { line: "border-dotted border-paper-subtle", text: "Scheduling in progress" };
          const href = organizersHref({ ...filters, mentor: active ? null : m.id, firstChoiceOnly: false });

          return (
            <li key={m.id} className="bg-ink-900">
              <Link
                href={href}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group relative flex h-full gap-3.5 px-4 py-4 transition-colors duration-150",
                  active ? "bg-ink-800" : "hover:bg-ink-850",
                )}
              >
                {active ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
                <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-paper group-hover:underline group-hover:underline-offset-4">
                      {m.name}
                    </span>
                    <span className="mono-label shrink-0 text-paper-subtle tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <span className="mt-1 flex items-baseline gap-2">
                    <span className={cn("font-wide text-2xl font-bold leading-none tracking-[-0.03em] tabular", n.any ? "text-paper" : "text-paper-subtle")}>
                      {n.any}
                    </span>
                    <span className="text-xs text-paper-muted">
                      interested
                      <span className="text-paper-subtle"> · </span>
                      <span className={n.first ? "text-accent" : undefined}>{n.first} first choice</span>
                    </span>
                  </span>
                  <span className="mt-2 flex items-start gap-2 text-xs leading-5 text-paper-muted">
                    <span aria-hidden className={cn("mt-2.5 inline-block w-3 shrink-0 border-t-2", scheduling.line)} />
                    <span className="min-w-0 font-mono text-[0.6875rem] tracking-[0.01em]">{scheduling.text}</span>
                  </span>
                  <span className="sr-only">
                    {active ? " — filtering by this mentor; select to show all mentors" : " — show applications listing this mentor"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
