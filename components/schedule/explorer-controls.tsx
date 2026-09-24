/**
 * Controls for the calendar explorer: day tabs, All/Picks view switch, type chips and search.
 * Presentational only — state lives in the URL and is managed by ScheduleExplorer.
 * (Imported by the "use client" explorer, so these render as client components.)
 */
import type { CSSProperties, MouseEvent } from "react";
import type { ISODate } from "@/content/types";
import { CheckIcon, PickMark, SearchIcon, XIcon } from "@/components/ui/icons";
import type { TypeFacet } from "@/lib/schedule/filter";
import { dayLabels } from "@/lib/schedule/format";
import { dateParts } from "@/lib/time";
import { cn } from "@/lib/cn";

/** Let modified clicks (new tab/window) through to the browser; handle plain clicks in-page. */
function isPlainClick(e: MouseEvent) {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);
}

// ---------------------------------------------------------------------------
// Day tabs
// ---------------------------------------------------------------------------

/**
 * "All days" + one tab per day. Below `md` the tabs share the width equally (a 7-column grid for
 * the six-day week: weekday over the day number), so every day is visible at 390px without a
 * hidden horizontal scroll; from `md` they read "Mon / Sep 28" in a row.
 */
export function DayTabs({
  days,
  active,
  counts,
  hrefFor,
  onSelect,
  className,
}: {
  days: ISODate[];
  active: ISODate | null;
  counts: { all: number; byDay: Record<ISODate, number> };
  hrefFor: (day: ISODate | null) => string;
  onSelect: (day: ISODate | null) => void;
  className?: string;
}) {
  const items: { day: ISODate | null; top: string; main: string; short: string; srPrefix: string; count: number }[] = [
    { day: null, top: "Week", main: "All days", short: "All", srPrefix: "", count: counts.all },
    ...days.map((d) => {
      const l = dayLabels(d);
      const p = dateParts(d);
      return { day: d, top: l.weekday, main: l.monthDay, short: String(p.day), srPrefix: `${p.monthShort} `, count: counts.byDay[d] ?? 0 };
    }),
  ];
  return (
    <nav aria-label="Calendar days" className={cn("min-w-0", className)}>
      <ul
        className="grid items-stretch [grid-template-columns:repeat(var(--tabs),minmax(0,1fr))] md:flex"
        style={{ "--tabs": items.length } as CSSProperties}
      >
        {items.map((item) => {
          const current = item.day === active;
          return (
            <li key={item.day ?? "all"} className="flex min-w-0 md:shrink-0">
              <a
                href={hrefFor(item.day)}
                aria-current={current ? "true" : undefined}
                onClick={(e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  onSelect(item.day);
                }}
                className={cn(
                  "group relative flex min-h-14 w-full flex-col items-center justify-center px-1 transition-colors duration-150 md:min-h-16 md:items-start md:px-4",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:bg-accent after:transition-transform after:duration-200",
                  current ? "text-paper after:scale-x-100" : "text-paper-muted hover:text-paper after:scale-x-0",
                )}
              >
                <span className={cn("mono-label", current ? "text-accent" : "text-paper-subtle group-hover:text-paper-muted")}>
                  {item.top}
                </span>
                <span className="mt-1 flex items-baseline gap-1 whitespace-nowrap md:gap-2">
                  <span className="text-[0.9375rem] font-medium tabular md:hidden">
                    {item.srPrefix ? <span className="sr-only">{item.srPrefix}</span> : null}
                    {item.short}
                  </span>
                  <span className="hidden text-[0.9375rem] font-medium md:inline">{item.main}</span>
                  <span aria-hidden className={cn("font-mono text-[0.6875rem] tabular md:text-[0.75rem]", current ? "text-paper" : "text-paper-subtle")}>
                    {item.count}
                  </span>
                  <span className="sr-only">
                    {" "}
                    — {item.count} {item.count === 1 ? "entry" : "entries"}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// View switch
// ---------------------------------------------------------------------------

export function ViewToggle({
  view,
  counts,
  onChange,
  className,
}: {
  view: "all" | "picks";
  counts: { all: number; picks: number };
  onChange: (view: "all" | "picks") => void;
  className?: string;
}) {
  const options = [
    { value: "all" as const, label: "All events", count: counts.all },
    { value: "picks" as const, label: "Founders picks", count: counts.picks },
  ];
  return (
    <div
      role="group"
      aria-label="View"
      className={cn("inline-flex shrink-0 items-stretch rounded-sm border border-line-strong p-0.5", className)}
    >
      {options.map((o) => {
        const pressed = view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xs px-3 text-sm md:min-h-10 font-medium transition-colors duration-150",
              pressed ? "bg-ink-700 text-paper" : "text-paper-muted hover:bg-paper/[0.04] hover:text-paper",
            )}
          >
            {o.value === "picks" ? <PickMark className="size-2 text-accent" /> : null}
            {o.label}
            <span className={cn("font-mono text-[0.75rem] tabular", pressed ? "text-paper-muted" : "text-paper-subtle")}>
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type chips
// ---------------------------------------------------------------------------

export function TypeChips({
  facets,
  selected,
  onToggle,
  className,
}: {
  facets: TypeFacet[];
  selected: string[];
  onToggle: (type: TypeFacet["type"]) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Filter by type" className={cn("flex flex-wrap gap-2", className)}>
      {facets.map((f) => {
        const pressed = selected.includes(f.type);
        const empty = f.count === 0;
        return (
          <button
            key={f.type}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(f.type)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-sm border px-3 md:min-h-10 text-sm transition-colors duration-150",
              pressed
                ? "border-accent bg-accent-soft text-paper"
                : empty
                  ? "border-line text-paper-subtle hover:border-line-strong hover:text-paper-muted"
                  : "border-line-strong text-paper-muted hover:border-paper/35 hover:text-paper",
            )}
          >
            {pressed ? <CheckIcon className="-ml-0.5 size-3.5 text-accent" /> : null}
            {f.label}
            <span className={cn("font-mono text-[0.75rem] tabular", pressed ? "text-paper" : "text-paper-subtle")}>
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function SearchField({
  value,
  onChange,
  onSubmit,
  onClear,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="schedule-search" className="sr-only">
        Search the calendar
      </label>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-paper-subtle" />
      <input
        id="schedule-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onClear();
          }
        }}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        maxLength={100}
        className="field-control h-11 pl-10 pr-11 text-[0.9375rem] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {/* Placeholder that fits the field at every width (a native placeholder can't be responsive). */}
      {value ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-10 right-3 flex items-center truncate text-[0.9375rem] text-paper-subtle"
        >
          <span className="truncate sm:hidden">Search the calendar</span>
          <span className="hidden truncate sm:inline">Search events, speakers, sessions</span>
        </span>
      )}
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xs text-paper-subtle transition-colors hover:bg-paper/[0.06] hover:text-paper"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Clear search</span>
        </button>
      ) : null}
    </form>
  );
}
