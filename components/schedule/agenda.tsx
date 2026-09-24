/**
 * The agenda: entries grouped by day under a day heading, in chronological rows. Rows whose exact
 * times intersect say so ("Overlaps with …"). Program blocks carry an expandable sub-session list.
 *
 * Props
 * - `groups`: day groups from `groupByDay()` (already filtered and sorted).
 * - `filters`: the active day and search, which decide whether program blocks start expanded
 *   (a single day, or a search that matched a sub-session) and which sessions are marked.
 *   Defaults to "All days", no search.
 * - `headshots`: mentor photos by id, for office-hours rows and mentors on stage.
 * - `className`: extra classes for the wrapper.
 *
 * Pure markup (no hooks); program toggles are small client islands.
 */
import type { ISODate } from "@/content/types";
import { agendaBlocks, type DayGroup } from "@/lib/schedule/filter";
import { dayLabels } from "@/lib/schedule/format";
import type { MentorHeadshots } from "@/lib/schedule/headshots";
import { defaultProgramOpen, matchingSessionIndexes } from "@/lib/schedule/program";
import { cn } from "@/lib/cn";
import { AgendaRow } from "./agenda-row";

export interface AgendaFilters {
  day: ISODate | null;
  q: string;
}

const NO_FILTERS: AgendaFilters = { day: null, q: "" };

export function Agenda({
  groups,
  filters = NO_FILTERS,
  headshots = {},
  className,
}: {
  groups: DayGroup[];
  filters?: AgendaFilters;
  headshots?: MentorHeadshots;
  className?: string;
}) {
  return (
    <div className={cn("space-y-14 md:space-y-16", className)}>
      {groups.map((group) => (
        <AgendaDay key={group.date} group={group} filters={filters} headshots={headshots} />
      ))}
    </div>
  );
}

function AgendaDay({ group, filters, headshots }: { group: DayGroup; filters: AgendaFilters; headshots: MentorHeadshots }) {
  const labels = dayLabels(group.date);
  const headingId = `day-${group.date}`;
  // Flatten overlap clusters back into chronological rows; each row names what it overlaps.
  const rows = agendaBlocks(group.entries).flatMap((block) =>
    block.kind === "single"
      ? [{ entry: block.entry, overlapsWith: [] }]
      : block.entries.map((entry) => ({ entry, overlapsWith: block.overlapsWith[entry.id] ?? [] })),
  );

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-2xl font-semibold tracking-tight text-text md:text-[1.75rem]">
        <time dateTime={group.date}>{labels.long}</time>
      </h2>
      <ol className="mt-4 divide-y divide-line border-t border-line-strong">
        {rows.map(({ entry, overlapsWith }) => (
          <li key={entry.id}>
            <AgendaRow
              entry={entry}
              headshots={headshots}
              overlapsWith={overlapsWith}
              programOpen={defaultProgramOpen(entry, filters)}
              sessionMatches={matchingSessionIndexes(entry, filters.q)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
