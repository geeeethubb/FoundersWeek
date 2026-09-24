"use client";

/**
 * The Calendar (/schedule) explorer: day tabs, All/Picks, type chips, search (including program
 * sub-sessions and their people), a one-line result summary and the chronological agenda.
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
 * - `pendingMentors`: mentors with "Scheduling in progress" (public fields only); shown when a
 *   search matches them, since they have no calendar rows yet.
 * - `calendarCount`: number of calendar-eligible entries (shows the "all confirmed events" .ics link).
 * - `headshots`: mentor photos by id (office-hours rows, mentors on stage).
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
  type Relaxation,
} from "@/lib/schedule/filter";
import { dayLabels, plural } from "@/lib/schedule/format";
import type { MentorHeadshots } from "@/lib/schedule/headshots";
import { pendingMentorMatches, type PendingMentor } from "@/lib/schedule/pending-mentors";
import {
  DEFAULT_SCHEDULE_FILTERS,
  parseScheduleFilters,
  scheduleQuery,
  type ScheduleFilters,
} from "@/lib/schedule/url";
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
  headshots?: MentorHeadshots;
}

export function ScheduleExplorer({
  entries,
  days,
  partial,
  pendingMentors,
  calendarCount,
  headshots = {},
}: ScheduleExplorerProps) {
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
  const facets = useMemo(() => typeFacets(entries, filters), [entries, filters]);
  const filtered = !isDefaultFilters(filters);

  // Mentors still scheduling have no calendar rows; a search for them lists them after the agenda.
  const matchingMentors = useMemo(() => {
    if (!filters.q.trim()) return [];
    if (filters.types.length && !filters.types.includes("office-hours")) return [];
    return pendingMentors.filter((m) => pendingMentorMatches(m, filters.q));
  }, [pendingMentors, filters]);

  // Screen-reader announcement follows the committed URL (naturally debounced while typing).
  const announcement = useMemo(() => {
    const n = filterEntries(entries, urlFilters).length;
    return summaryText(n, entries.length, urlFilters, days.length);
  }, [entries, urlFilters, days.length]);

  const activeFilterCount = (filters.view === "picks" ? 1 : 0) + filters.types.length;

  return (
    <div>
      {/* Day tabs. Sticky under the site header on desktop. */}
      <div id="calendar" className="border-b border-line bg-surface md:sticky md:top-[calc(4.5rem+1px)] md:z-30">
        <div className="mx-auto w-full max-w-[76rem] sm:px-8">
          <DayTabs
            days={days}
            active={filters.day}
            counts={dCounts}
            hrefFor={(day) => hrefFor({ ...filters, day })}
            onSelect={selectDay}
            className="-mb-px px-2 sm:px-0 md:-mx-4 md:overflow-x-auto md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 pt-6 md:pt-8 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex gap-2 lg:w-80 lg:shrink-0">
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
                panelOpen || activeFilterCount ? "border-text-subtle text-text" : "border-line-strong text-text-muted hover:text-text",
              )}
            >
              <FilterIcon className="size-4" />
              Filters
              {activeFilterCount ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold tabular text-accent-ink">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div
            id="schedule-filter-panel"
            className={cn(panelOpen ? "flex" : "hidden", "min-w-0 flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-5")}
          >
            <ViewToggle view={filters.view} onChange={(view) => navigate({ ...filters, view })} className="w-full md:w-auto" />
            <TypeChips facets={facets} selected={filters.types} onToggle={toggleType} />
          </div>
        </div>

        {/* Result summary */}
        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-text-muted">
          <p className="tabular">{summaryText(results.length, entries.length, filters, days.length)}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {filtered ? (
              <Button variant="ghost" size="sm" onClick={reset} className="-ml-2 min-h-11 text-text md:min-h-8">
                <XIcon className="size-3.5" />
                Reset filters
              </Button>
            ) : null}
            {calendarCount > 0 ? (
              <a
                href="/schedule/calendar.ics"
                download
                className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 transition-colors hover:text-text hover:underline md:min-h-8"
              >
                <DownloadIcon className="size-4" />
                Add all confirmed events to your calendar
                <span className="sr-only"> (.ics file, {plural(calendarCount, "event", "events")})</span>
              </a>
            ) : null}
          </div>
        </div>
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>

        {/* Agenda */}
        <div ref={resultsRef} className="scroll-mt-40 pt-8 md:scroll-mt-[calc(4.5rem+1px+4rem+1.5rem)] md:pt-10">
          {results.length ? (
            <Agenda groups={groups} filters={{ day: filters.day, q: filters.q }} headshots={headshots} />
          ) : (
            <EmptyState
              hasEntries={entries.length > 0}
              filters={filters}
              relaxations={relaxations(entries, filters)}
              partial={partial}
              onApply={apply}
              onReset={reset}
              mentorMatches={matchingMentors.length}
            />
          )}
          {matchingMentors.length ? <PendingMentors mentors={matchingMentors} className="mt-14" /> : null}
          {partial && results.length ? (
            <p className="mt-14 max-w-2xl text-sm leading-relaxed text-text-muted">
              More events will show up here as they’re confirmed. The official Founders Week schedule hasn’t been
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
    return `${plural(count, "event", "events")}${dayCount > 1 ? ` over ${plural(dayCount, "day", "days")}` : ""}`;
  }
  const parts = [`${count} of ${plural(total, "event", "events")}`];
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
      <div className="rounded-md border border-line bg-surface-subtle px-6 py-10 md:px-10">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Nothing listed yet</h2>
        <p className="mt-2 max-w-xl leading-relaxed text-text-muted">
          Events show up here as they’re confirmed.
          {partial ? " The official Founders Week schedule hasn’t been added to this calendar yet." : null}
        </p>
      </div>
    );
  }

  // "No workshops or talks among Founders picks on Friday, October 2 matching “zzz”."
  const what = filters.types.length
    ? filters.types.map((t) => EVENT_TYPE_PLURALS[t].toLowerCase()).join(" or ")
    : "events";
  const scope = [
    filters.view === "picks" ? "among Founders picks" : null,
    filters.day ? `on ${dayLabels(filters.day).long}` : null,
    filters.q.trim() ? `matching “${filters.q.trim()}”` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-md border border-line bg-surface-subtle px-5 py-8 md:px-10 md:py-10">
      <h2 className="text-2xl font-semibold tracking-tight text-text">
        {mentorMatches ? "No calendar events match" : "Nothing matches these filters"}
      </h2>
      <p className="mt-2 max-w-xl leading-relaxed text-text-muted">
        No {what}
        {scope.length ? ` ${scope.join(" ")}` : " listed yet"}.
        {mentorMatches ? " A matching office-hours mentor is listed below." : null}
      </p>

      {options.length ? (
        <ul aria-label="Ways to widen your search" className="mt-6 flex flex-wrap gap-2">
          {options.map((r) => (
            <li key={r.dimension}>
              <button
                type="button"
                onClick={() => onApply(r.filters)}
                disabled={r.count === 0}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-text transition-colors hover:border-text-subtle disabled:border-line disabled:text-text-subtle md:min-h-10"
              >
                {relaxationLabel(r, filters)}
                <span className="font-normal text-text-subtle">
                  {r.count === 0 ? "(still none)" : `(${plural(r.count, "result", "results")})`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        <Button variant="secondary" onClick={onReset} className="min-h-11 bg-surface">
          Reset all filters
        </Button>
      </div>
    </div>
  );
}
