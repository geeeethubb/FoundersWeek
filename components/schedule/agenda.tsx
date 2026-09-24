/**
 * The agenda: entries grouped by day under a strong day header, in chronological rows.
 * Entries whose exact times intersect are drawn as one cluster with a bracket in the gutter
 * ("Overlap · 2 at once") and a per-row "Overlaps with …" line. Program blocks carry an
 * expandable sub-session timeline.
 *
 * Props
 * - `groups`: day groups from `groupByDay()` (already filtered and sorted).
 * - `filters`: the active day and search, which decide whether program blocks start expanded
 *   (a single day, or a search that matched a sub-session) and which sessions are marked "Match".
 *   Defaults to "All days", no search.
 * - `className`: extra classes for the wrapper.
 *
 * Pure markup (no hooks); program toggles are small client islands.
 */
import type { ISODate } from "@/content/types";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { agendaBlocks, type AgendaBlock, type DayGroup, type OverlapRef } from "@/lib/schedule/filter";
import { dayLabels, plural } from "@/lib/schedule/format";
import { defaultProgramOpen, matchingSessionIndexes } from "@/lib/schedule/program";
import { formatTimeRange } from "@/lib/time";
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
  className,
}: {
  groups: DayGroup[];
  filters?: AgendaFilters;
  className?: string;
}) {
  return (
    <div className={cn("space-y-14 md:space-y-16", className)}>
      {groups.map((group) => (
        <AgendaDay key={group.date} group={group} filters={filters} />
      ))}
    </div>
  );
}

function Row({ entry, filters, overlapsWith }: { entry: ScheduleEntry; filters: AgendaFilters; overlapsWith?: OverlapRef[] }) {
  return (
    <AgendaRow
      entry={entry}
      overlapsWith={overlapsWith}
      programOpen={defaultProgramOpen(entry, filters)}
      sessionMatches={matchingSessionIndexes(entry, filters.q)}
    />
  );
}

function AgendaDay({ group, filters }: { group: DayGroup; filters: AgendaFilters }) {
  const labels = dayLabels(group.date);
  const blocks = agendaBlocks(group.entries);
  const overlapClusters = blocks.filter((b) => b.kind === "overlap").length;
  const headingId = `day-${group.date}`;

  return (
    <section aria-labelledby={headingId}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line-strong pb-4">
        <div>
          <p className="mono-label tabular text-paper-muted">
            <time dateTime={group.date}>{labels.mono}</time>
          </p>
          <h2
            id={headingId}
            className="mt-2 font-wide text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-paper md:text-[2.125rem]"
          >
            {labels.long}
          </h2>
        </div>
        <p className="mono-label tabular text-paper-subtle">
          {plural(group.entries.length, "entry", "entries")}
          {overlapClusters ? (
            <>
              {" "}
              · <span className="text-warning">{plural(overlapClusters, "overlap", "overlaps")}</span>
            </>
          ) : null}
        </p>
      </header>

      <ol className="divide-y divide-line">
        {blocks.map((block) =>
          block.kind === "single" ? (
            <li key={block.entry.id} className="pl-4 md:pl-5">
              <Row entry={block.entry} filters={filters} />
            </li>
          ) : (
            <OverlapCluster key={block.entries[0].id} block={block} filters={filters} />
          ),
        )}
      </ol>
    </section>
  );
}

function OverlapCluster({
  block,
  filters,
}: {
  block: Extract<AgendaBlock, { kind: "overlap" }>;
  filters: AgendaFilters;
}) {
  const range = block.start && block.end ? formatTimeRange(block.start, block.end) : null;
  return (
    <li className="relative pl-4 md:pl-5">
      {/* Bracket spanning the clustered rows, in the lane left of the time gutter (above the rows'
          raised featured surface, which reaches back over this lane). */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-0 top-[1.625rem] z-[1] w-2 rounded-l-xs border-y border-l border-warning/75 md:w-2.5"
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em]">
        <span className="text-warning">Overlap · {block.maxConcurrent} at once</span>
        {range ? <span className="tabular text-paper-subtle">{range} CT</span> : null}
        <span className="sr-only">— {block.entries.length} entries in this block have times that overlap.</span>
      </p>
      <ol className="divide-y divide-line/70">
        {block.entries.map((entry) => (
          <li key={entry.id}>
            <Row entry={entry} filters={filters} overlapsWith={block.overlapsWith[entry.id]} />
          </li>
        ))}
      </ol>
    </li>
  );
}
