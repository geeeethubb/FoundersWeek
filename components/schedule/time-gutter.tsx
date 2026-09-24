/**
 * The agenda's time column. Big tabular start time with AM/PM and the end time underneath
 * (desktop), or a single inline line (mobile). Rough times read "Morning / before noon";
 * unannounced times read "Time forthcoming".
 *
 * The left rule encodes certainty with line style: solid = confirmed, dashed = planned or an
 * availability window, dotted = time forthcoming / approximate. Canceled entries get a red rule.
 * Featured entries (Founders' priorities: office hours, Dan Caruso, the Sep 29 panel) keep their
 * line style but the rule turns Illinois orange, with their priority numeral ("02 · Featured")
 * above the time — the same numeral as in the Featured band at the top of the calendar.
 * (Purely visual — the row's badges carry the same information as text.)
 *
 * Props
 * - `entry`: the ScheduleEntry.
 * - `className`: extra classes for the wrapper.
 */
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { entryCertainty, gutterTime, rankNumeral, type Certainty } from "@/lib/schedule/format";
import { cn } from "@/lib/cn";

export const CERTAINTY_BORDER: Record<Certainty, string> = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
};

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  solid: "Confirmed time",
  dashed: "Planned time or availability window",
  dotted: "Time forthcoming or approximate",
};

/** Featured entries (not canceled) get the accent treatment. */
export function isFeatured(entry: Pick<ScheduleEntry, "featuredRank" | "status">): boolean {
  return entry.featuredRank !== null && entry.status !== "canceled";
}

/** "02 · Featured" — mono index numeral in accent. */
export function FeaturedMark({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium uppercase leading-4 tracking-[0.12em] text-accent tabular",
        className,
      )}
    >
      <span>{rankNumeral(rank)}</span>
      <span aria-hidden className="h-px w-2.5 bg-accent/60" />
      <span>Featured</span>
    </span>
  );
}

export function TimeGutter({ entry, className }: { entry: ScheduleEntry; className?: string }) {
  const g = gutterTime(entry);
  const certainty = entryCertainty(entry);
  const canceled = entry.status === "canceled";
  const featured = isFeatured(entry);
  const start = entry.time.kind === "exact" ? entry.time.start : null;
  const end = entry.time.kind === "exact" ? (entry.time.end ?? null) : null;

  return (
    <div
      className={cn(
        "border-l-2 pl-3 md:pl-4",
        CERTAINTY_BORDER[certainty],
        canceled ? "border-danger/55" : featured ? "border-accent" : "border-paper/35",
        className,
      )}
    >
      {featured ? <FeaturedMark rank={entry.featuredRank!} className="mb-1.5 md:mb-3" /> : null}
      {g.kind === "exact" ? (
        <p className="flex flex-wrap items-baseline gap-x-1.5 font-mono tabular md:flex-col md:gap-0">
          <span className="flex items-baseline gap-1">
            <time
              dateTime={`${entry.date}T${start}`}
              className={cn(
                "text-[0.9375rem] font-medium tracking-[-0.02em] md:text-[1.625rem] md:leading-none md:tracking-[-0.04em]",
                canceled ? "text-paper-muted line-through decoration-danger/60" : "text-paper",
              )}
            >
              {g.primary}
            </time>
            <span className="text-[0.75rem] font-medium text-paper-muted md:text-[0.8125rem]">{g.period}</span>
          </span>
          {g.secondary && end ? (
            <time dateTime={`${entry.date}T${end}`} className="text-[0.8125rem] text-paper-muted md:mt-2.5">
              {/* "8:00 AM – 5:30 PM" inline on phones; "–5:30 PM" under the start from md. */}
              <span className="mr-1.5 md:mr-0">–</span>
              {g.secondary.replace(/^–/, "")}
            </time>
          ) : null}
        </p>
      ) : g.kind === "part-of-day" ? (
        <p className="flex flex-wrap items-baseline gap-x-2 md:flex-col md:gap-0">
          <span className="font-mono text-[0.9375rem] font-medium uppercase tracking-[0.02em] text-paper md:text-lg md:leading-none">
            {g.primary}
          </span>
          {g.secondary ? (
            <span className="font-mono text-[0.8125rem] text-paper-muted md:mt-2.5">{g.secondary}</span>
          ) : null}
        </p>
      ) : (
        <p className="font-mono text-[0.9375rem] font-medium uppercase leading-snug tracking-[0.02em] text-paper md:text-base md:leading-[1.15]">
          {g.primary}
        </p>
      )}
    </div>
  );
}
