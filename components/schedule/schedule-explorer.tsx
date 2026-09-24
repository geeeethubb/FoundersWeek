"use client";

/**
 * The Calendar (/schedule) explorer: day tabs, All/Picks, type chips, search (including program
 * sub-sessions and their people), live result summary and the chronological agenda.
 *
 * The URL is the single source of truth (lib/schedule/url.ts: day, view, type, q). Controls call
 * `router.replace(…, { scroll: false })`; `useOptimistic` shows the new state immediately while
 * the navigation settles, then falls back to whatever the URL says. Search filters as you type and
 * writes `q` to the URL after a short debounce.
 *
 * Props
 * - `entries`: every public ScheduleEntry (chronological). Filtering happens here, client-side.
 * - `days`: dates with entries (ascending) — one tab each.
 * - `partial`: the official schedule hasn't been fully added (site.week.scheduleCompleteness).
 * - `pendingMentors`: mentors with "Scheduling in progress" (public fields only).
 * - `calendarCount`: number of calendar-eligible entries (shows the "all confirmed events" .ics link).
 *
 * Program blocks start collapsed on "All days" and expanded when a single day is selected or a
 * search matches one of their sessions (see lib/schedule/program.ts `defaultProgramOpen`).
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import type { EventType, ISODate } from "@/content/types";
import { Button } from "@/components/ui/button";
import { DownloadIcon, FilterIcon, XIcon } from "@/components/ui/icons";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import {
  dayCounts,
  EVENT_TYPE_PLURALS,
  filterEntries,
  groupByDay,
  isDefaultFilters,
  relaxations,
  typeFacets,
  viewCounts,
  type Relaxation,
} from "@/lib/schedule/filter";
import { dayLabels, plural } from "@/lib/schedule/format";
import { pendingMentorMatches, type PendingMentor } from "@/lib/schedule/pending-mentors";
import {
  DEFAULT_SCHEDULE_FILTERS,
  parseScheduleFilters,
  scheduleQuery,
  type ScheduleFilters,
} from "@/lib/schedule/url";
import { TZ_LABEL } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Agenda } from "./agenda";
import { DayTabs, SearchField, TypeChips, ViewToggle } from "./explorer-controls";
import { PendingMentors } from "./pending-mentors";

const SEARCH_DEBOUNCE_MS = 250;

export interface ScheduleExplorerProps {
  entries: ScheduleEntry[];
  days: ISODate[];
  partial: boolean;
  pendingMentors: PendingMentor[];
  calendarCount: number;
}

export function ScheduleExplorer({ entries, days, partial, pendingMentors, calendarCount }: ScheduleExplorerProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/schedule";
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseScheduleFilters(searchParams, days), [searchParams, days]);
  const [optimistic, setOptimistic] = useOptimistic(urlFilters);
  const [, startTransition] = useTransition();

  // The search box is local state so typing never waits on navigation. `sync` tracks the last
  // q seen in the URL and the last q we pushed, so an outside change (Back, the header's
  // "Calendar" link) resets the box while our own debounced writes don't clobber newer typing.
  const [query, setQuery] = useState(urlFilters.q);
  const [sync, setSync] = useState({ url: urlFilters.q, pushed: urlFilters.q });
  if (urlFilters.q !== sync.url) {
    const external = urlFilters.q !== sync.pushed;
    setSync({ url: urlFilters.q, pushed: external ? urlFilters.q : sync.pushed });
    if (external) setQuery(urlFilters.q);
  }

  const filters: ScheduleFilters = useMemo(() => ({ ...optimistic, q: query }), [optimistic, query]);
  const latestFilters = useRef(filters);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latestFilters.current = filters;
  });
  useEffect(() => () => clearTimeout(searchTimer.current ?? undefined), []);

  const [panelOpen, setPanelOpen] = useState(() => urlFilters.types.length > 0 || urlFilters.view === "picks");

  function hrefFor(next: ScheduleFilters) {
    const qs = scheduleQuery(next);
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function navigate(next: ScheduleFilters) {
    const clean = { ...next, q: next.q.trim() };
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSync((s) => ({ ...s, pushed: clean.q }));
    startTransition(() => {
      setOptimistic(clean);
      router.replace(hrefFor(clean), { scroll: false });
    });
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => navigate({ ...latestFilters.current, q: value }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function selectDay(day: ISODate | null) {
    navigate({ ...filters, day });
    // If the agenda has scrolled under the sticky bar, bring the new day's start into view.
    const el = resultsRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  }

  function toggleType(type: EventType) {
    const types = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
    navigate({ ...filters, types });
  }

  function reset() {
    setQuery("");
    navigate(DEFAULT_SCHEDULE_FILTERS);
  }

  function apply(next: ScheduleFilters) {
    if (next.q !== query) setQuery(next.q);
    navigate(next);
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const results = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const groups = useMemo(() => groupByDay(results), [results]);
  const dCounts = useMemo(() => dayCounts(entries, days, filters), [entries, days, filters]);
  const vCounts = useMemo(() => viewCounts(entries, filters), [entries, filters]);
  const facets = useMemo(() => typeFacets(entries, filters), [entries, filters]);
  const filtered = !isDefaultFilters(filters);

  const visibleMentors = useMemo(() => {
    if (filters.types.length && !filters.types.includes("office-hours")) return [];
    if (filters.q.trim()) return pendingMentors.filter((m) => pendingMentorMatches(m, filters.q));
    // Pending mentors have no date yet, so they belong to the whole week, not a single day.
    return filters.day ? [] : pendingMentors;
  }, [pendingMentors, filters]);

  // Screen-reader announcement follows the committed URL (naturally debounced while typing).
  const announcement = useMemo(() => {
    const n = filterEntries(entries, urlFilters).length;
    return summaryText(n, entries.length, urlFilters, days.length);
  }, [entries, urlFilters, days.length]);

  const activeFilterCount = (filters.view === "picks" ? 1 : 0) + filters.types.length;

  return (
    <div>
      {/* Day tabs + view switch. Sticky under the site header on desktop. */}
      <div id="calendar" className="border-b border-line bg-ink-900 md:sticky md:top-[calc(4rem+1px)] md:z-30">
        <div className="mx-auto flex w-full max-w-[76rem] items-stretch justify-between gap-6 sm:px-8">
          <DayTabs
            days={days}
            active={filters.day}
            counts={dCounts}
            hrefFor={(day) => hrefFor({ ...filters, day })}
            onSelect={selectDay}
            className="-mb-px flex-1 px-2 sm:px-0 md:-mx-4 md:flex-none md:overflow-x-auto md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
          />
          <div className="hidden shrink-0 items-center md:flex">
            <ViewToggle view={filters.view} counts={vCounts} onChange={(view) => navigate({ ...filters, view })} />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 pt-6 md:flex-row md:items-start md:gap-6">
          <div className="flex gap-2 md:w-80 md:shrink-0">
            <SearchField
              value={query}
              onChange={onQueryChange}
              onSubmit={() => navigate({ ...filters })}
              onClear={() => apply({ ...filters, q: "" })}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              aria-expanded={panelOpen}
              aria-controls="schedule-filter-panel"
              onClick={() => setPanelOpen((o) => !o)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-sm border px-3.5 text-sm font-medium transition-colors md:hidden",
                panelOpen || activeFilterCount
                  ? "border-paper/35 text-paper"
                  : "border-line-strong text-paper-muted hover:text-paper",
              )}
            >
              <FilterIcon className="size-4" />
              Filters
              {activeFilterCount ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-xs bg-accent px-1 font-mono text-[0.6875rem] tabular text-accent-ink">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div
            id="schedule-filter-panel"
            className={cn(panelOpen ? "flex" : "hidden", "min-w-0 flex-col gap-3 md:flex md:flex-1 md:flex-row md:items-center")}
          >
            <ViewToggle
              view={filters.view}
              counts={vCounts}
              onChange={(view) => navigate({ ...filters, view })}
              className="w-full md:hidden"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <span className="mono-label hidden text-paper-subtle lg:inline">Type</span>
              <TypeChips facets={facets} selected={filters.types} onToggle={toggleType} />
            </div>
          </div>
        </div>

        {/* Result summary */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-line py-3">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.08em] tabular text-paper-muted">
            {summaryText(results.length, entries.length, filters, days.length)}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {calendarCount > 0 ? (
              <a
                href="/schedule/calendar.ics"
                download
                className="inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] text-paper-muted underline-offset-4 transition-colors hover:text-paper hover:underline md:min-h-8"
              >
                <DownloadIcon className="size-3.5" />
                <span>
                  All {calendarCount} confirmed events <span className="font-mono text-[0.75rem]">.ics</span>
                </span>
              </a>
            ) : null}
            <span className="mono-label hidden text-paper-subtle sm:inline">Times in {TZ_LABEL}</span>
            {filtered ? (
              <Button variant="ghost" size="sm" onClick={reset} className="-mr-2 text-paper">
                <XIcon className="size-3.5" />
                Reset filters
              </Button>
            ) : null}
          </div>
        </div>
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>

        {/* Agenda */}
        <div ref={resultsRef} className="scroll-mt-6 pt-10 md:scroll-mt-[calc(4rem+1px+4rem+1.5rem)] md:pt-12">
          {results.length ? (
            <Agenda groups={groups} filters={{ day: filters.day, q: filters.q }} />
          ) : (
            <EmptyState
              hasEntries={entries.length > 0}
              filters={filters}
              relaxations={relaxations(entries, filters)}
              partial={partial}
              onApply={apply}
              onReset={reset}
              mentorMatches={visibleMentors.length}
            />
          )}
          {visibleMentors.length ? <PendingMentors mentors={visibleMentors} className="mt-16" /> : null}
          {partial && results.length ? (
            <p className="mt-14 max-w-2xl border-l-2 border-dotted border-paper/35 pl-4 text-sm leading-relaxed text-paper-muted">
              More events will appear here as they’re confirmed. The official Founders Week schedule hasn’t been
              added to this calendar yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

function summaryText(count: number, total: number, filters: ScheduleFilters, dayCount: number): string {
  if (isDefaultFilters(filters)) {
    return `${plural(count, "entry", "entries")}${dayCount > 1 ? ` across ${plural(dayCount, "day", "days")}` : ""}`;
  }
  const parts = [`${count} of ${plural(total, "entry", "entries")}`];
  if (filters.day) parts.push(dayLabels(filters.day).short);
  if (filters.view === "picks") parts.push("Founders picks");
  if (filters.types.length) parts.push(filters.types.map((t) => EVENT_TYPE_PLURALS[t]).join(", "));
  if (filters.q.trim()) parts.push(`“${filters.q.trim()}”`);
  return parts.join(" · ");
}

function relaxationLabel(r: Relaxation, filters: ScheduleFilters): string {
  switch (r.dimension) {
    case "day":
      return "Show all days";
    case "view":
      return "Include events that aren’t picks";
    case "types":
      return filters.types.length === 1 ? `Remove “${EVENT_TYPE_PLURALS[filters.types[0]]}”` : "Clear type filters";
    case "q":
    default:
      return `Clear search “${filters.q.trim()}”`;
  }
}

function EmptyState({
  hasEntries,
  filters,
  relaxations: options,
  partial,
  onApply,
  onReset,
  mentorMatches,
}: {
  hasEntries: boolean;
  filters: ScheduleFilters;
  relaxations: Relaxation[];
  partial: boolean;
  onApply: (next: ScheduleFilters) => void;
  onReset: () => void;
  mentorMatches: number;
}) {
  if (!hasEntries) {
    return (
      <div className="rounded-sm border border-dotted border-line-strong px-6 py-12 md:px-10">
        <p className="mono-label text-paper-subtle">Calendar</p>
        <h2 className="mt-3 font-wide text-2xl font-bold tracking-[-0.025em] text-paper">Nothing listed yet</h2>
        <p className="mt-3 max-w-xl text-paper-muted">
          Events appear here as they’re confirmed.
          {partial ? " The official Founders Week schedule hasn’t been added to this calendar yet." : null}
        </p>
      </div>
    );
  }

  // "No workshops or talks among Founders picks on Friday, October 2 matching “zzz”."
  const what = filters.types.length
    ? filters.types.map((t) => EVENT_TYPE_PLURALS[t].toLowerCase()).join(" or ")
    : "entries";
  const scope = [
    filters.view === "picks" ? "among Founders picks" : null,
    filters.day ? `on ${dayLabels(filters.day).long}` : null,
    filters.q.trim() ? `matching “${filters.q.trim()}”` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-sm border border-dotted border-line-strong px-5 py-10 md:px-10 md:py-12">
      <p className="mono-label text-paper-subtle">No matches</p>
      <h2 className="mt-3 font-wide text-2xl font-bold tracking-[-0.025em] text-paper md:text-[1.75rem]">
        {mentorMatches ? "No calendar entries match" : "Nothing matches these filters"}
      </h2>
      <p className="mt-3 max-w-xl leading-relaxed text-paper-muted">
        No {what}
        {scope.length ? (
          <>
            {" "}
            <span className="text-paper">{scope.join(" ")}</span>
          </>
        ) : (
          " listed yet"
        )}
        .
        {mentorMatches ? " A matching mentor is still scheduling office hours — see below." : null}
      </p>

      {options.length ? (
        <div className="mt-7">
          <p className="mono-label text-paper-subtle">Try</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {options.map((r) => (
              <li key={r.dimension}>
                <button
                  type="button"
                  onClick={() => onApply(r.filters)}
                  disabled={r.count === 0}
                  className="inline-flex min-h-11 items-center gap-2.5 rounded-sm border border-line-strong px-3.5 text-sm text-paper transition-colors hover:border-paper/40 hover:bg-paper/[0.04] disabled:border-line disabled:text-paper-subtle md:min-h-10"
                >
                  {relaxationLabel(r, filters)}
                  <span className="font-mono text-[0.75rem] tabular text-paper-subtle">
                    {r.count === 0 ? "still 0" : plural(r.count, "result", "results")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={onReset}>
          Reset all filters
        </Button>
      </div>

      {partial ? (
        <p className="mt-8 max-w-xl border-t border-line pt-5 text-sm leading-relaxed text-paper-muted">
          This calendar is still growing: the official Founders Week schedule hasn’t been added yet, so some events
          may not be listed.
        </p>
      ) : null}
    </div>
  );
}
