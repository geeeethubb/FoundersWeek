/**
 * WeekStrip — the week at a glance (Mon Sep 28 – Sat Oct 3): weekday, date, how many entries, and
 * which of Founders' priorities happen that day, with the same numerals as the Featured band
 * ("01 Office hours" Thu/Fri, "02 Dan Caruso — Fireside Chat" Mon, "03 How to Make $10K/Month in
 * College" Tue). Each day links to /schedule?day=<date>.
 *
 * Props
 * - `entries`: every public ScheduleEntry (counts and priorities come from these; canceled entries
 *   are not counted).
 * - `days`: dates to show, ascending (usually `getScheduleDays()`).
 * - `activeDay`: highlight one day (optional).
 * - `className`: extra classes for the <nav>.
 *
 * Server-friendly (no hooks). Hairline grid: two columns on phones (three rows), one column per day
 * from `sm`. Priority names wrap to at most two lines.
 */
import Link from "next/link";
import type { ISODate } from "@/content/types";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { featuredDayMarks } from "@/lib/schedule/featured";
import { plural, rankNumeral } from "@/lib/schedule/format";
import { scheduleHref } from "@/lib/schedule/url";
import { dateParts } from "@/lib/time";
import { cn } from "@/lib/cn";

export interface WeekStripProps {
  entries: ScheduleEntry[];
  days: ISODate[];
  activeDay?: ISODate | null;
  className?: string;
}

export function WeekStrip({ entries, days, activeDay = null, className }: WeekStripProps) {
  if (!days.length) return null;
  return (
    <nav aria-label="Founders Week by day" className={cn("min-w-0", className)}>
      <ol
        className="grid grid-cols-2 gap-px border-y border-line bg-line sm:[grid-template-columns:repeat(var(--days),minmax(0,1fr))]"
        style={{ "--days": days.length } as React.CSSProperties}
      >
        {days.map((day) => {
          const p = dateParts(day);
          const live = entries.filter((e) => e.date === day && e.status !== "canceled");
          const marks = featuredDayMarks(live, day);
          const active = day === activeDay;
          return (
            <li key={day} className="flex min-w-0 bg-ink-900">
              <Link
                href={scheduleHref({ day })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group relative flex w-full min-w-0 flex-col gap-3 px-3.5 py-4 transition-colors duration-150 sm:gap-4 sm:px-5 sm:py-5",
                  active ? "bg-paper/[0.04]" : "hover:bg-paper/[0.03]",
                  "after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-accent after:transition-transform after:duration-200",
                  active ? "after:scale-x-100" : "after:scale-x-0 group-hover:after:scale-x-100",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="mono-label text-paper-muted">{p.weekdayShort}</span>
                  <span className="mono-label tabular text-paper-subtle">{p.monthShort}</span>
                </span>
                <span className="font-wide text-[2.25rem] font-bold leading-none tracking-[-0.04em] text-paper tabular sm:text-[2.5rem]">
                  <time dateTime={day}>{p.dayPadded}</time>
                  <span className="sr-only">
                    {" "}
                    {p.weekdayLong}, {p.monthLong} {p.day}
                  </span>
                </span>
                <span className="font-mono text-[0.75rem] tabular text-paper-muted">
                  {plural(live.length, "entry", "entries")}
                </span>
                {marks.length ? (
                  <ul className="-mt-1 space-y-1.5">
                    {marks.map((m) => (
                      <li key={m.rank} className="flex min-w-0 items-start gap-1.5 font-mono text-[0.6875rem] leading-4">
                        <span aria-hidden className="mt-1.5 size-1 shrink-0 rotate-45 bg-accent" />
                        <span className="font-medium tabular tracking-[0.08em] text-accent">{rankNumeral(m.rank)}</span>
                        <span className="line-clamp-3 min-w-0 text-paper sm:line-clamp-2">{m.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
