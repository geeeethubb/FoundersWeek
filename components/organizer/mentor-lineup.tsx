import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import type { OrganizerDirectory } from "@/lib/organizer/directory";
import { organizersHref, type ApplicationFilters } from "@/lib/organizer/filters";
import type { MentorInterest, SlotUsage } from "@/lib/organizer/queries";
import { describeTime, formatDate } from "@/lib/time";

/**
 * Desktop column count for `count` mentors: every mentor in one row when there are five or
 * fewer; otherwise the width (5, 4 or 3 across) that leaves the fewest empty places in the
 * last row, preferring wider rows on a tie. Five mentors → five across; seven → four across.
 */
export function lineupColumns(count: number): 2 | 3 | 4 | 5 {
  if (count <= 5) return Math.max(2, count) as 2 | 3 | 4 | 5;
  let best: 3 | 4 | 5 = 5;
  let bestEmpty = Number.POSITIVE_INFINITY;
  for (const cols of [5, 4, 3] as const) {
    const empty = (cols - (count % cols)) % cols;
    if (empty < bestEmpty) {
      best = cols;
      bestEmpty = empty;
    }
  }
  return best;
}

// Static class names so Tailwind generates them.
const LG_COLUMNS: Record<2 | 3 | 4 | 5, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/**
 * Demand at a glance: every mentor with their headshot, how many active applications list them
 * (and as first choice), their windows, and how many of their sessions are booked (plus how many
 * sessions they agreed to host, when content says). Each card filters the list by that mentor
 * (select again to clear). All mentors are always shown.
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
  const columns = lineupColumns(directory.mentors.length);
  const vertical = columns === 5;

  return (
    <nav aria-label="Applications by mentor">
      <ul className={cn("grid gap-3 sm:grid-cols-2 md:grid-cols-3", LG_COLUMNS[columns])}>
        {directory.mentors.map((m) => {
          const active = filters.mentor === m.id;
          const n = interest.get(m.id) ?? { any: 0, first: 0 };
          // Sessions: explicit content slots and sessions generated from exact windows.
          const slots = directory.slots.filter((s) => s.mentorId === m.id);
          const windows = directory.windows.filter((w) => w.mentorId === m.id);
          const seats = slots.reduce(
            (acc, s) => {
              const u = usage.get(s.id) ?? { proposed: 0, confirmed: 0 };
              return { used: acc.used + u.proposed + u.confirmed, capacity: acc.capacity + s.capacity };
            },
            { used: 0, capacity: 0 },
          );
          const scheduling: React.ReactNode = windows.length
            ? windows.map((w, wi) => (
                // Date and time never break internally ("10:00–11:30 / AM").
                <span key={w.id}>
                  {wi ? " · " : null}
                  <span className="whitespace-nowrap">{formatDate(w.date, "short")}</span>
                  {" · "}
                  <span className="whitespace-nowrap">{describeTime(w.time).bare}</span>
                </span>
              ))
            : slots.length
              ? null
              : "Scheduling in progress";
          const sessions = slots.length
            ? [
                `${slots.length} session${slots.length === 1 ? "" : "s"} · ${seats.used}/${seats.capacity} booked`,
                // e.g. Patrick: three sessions fit his window, but he's hosting one or two.
                m.sessionCount ? `hosting ${m.sessionCount.charAt(0).toLowerCase()}${m.sessionCount.slice(1)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : windows.length
              ? "No sessions yet"
              : null;
          const href = organizersHref({ ...filters, mentor: active ? null : m.id, firstChoiceOnly: false });

          return (
            <li key={m.id}>
              <Link
                href={href}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex h-full gap-3 rounded-md border p-4 transition-[border-color,box-shadow,background-color] duration-150",
                  vertical && "lg:flex-col",
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-line-strong hover:shadow-sm",
                )}
              >
                <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold leading-snug text-text group-hover:underline group-hover:underline-offset-4">
                      {m.name}
                    </span>
                    {m.demo ? <DemoBadge /> : null}
                  </span>
                  <span className="mt-1.5 text-sm text-text-muted">
                    <span className={cn("font-semibold tabular", n.any ? "text-text" : "text-text-subtle")}>{n.any}</span>{" "}
                    interested · <span className={n.first ? "font-medium text-text" : undefined}>{n.first} first choice</span>
                  </span>
                  {scheduling ? <span className="mt-1 text-xs leading-5 text-text-subtle">{scheduling}</span> : null}
                  {sessions ? (
                    <span className={cn("text-xs leading-5 text-text-subtle tabular", !scheduling && "mt-1")}>{sessions}</span>
                  ) : null}
                  <span className="sr-only">
                    {active ? " (filtering by this mentor; select to show all mentors)" : " (show applications that list this mentor)"}
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
