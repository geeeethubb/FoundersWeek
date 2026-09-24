/**
 * "How to read this calendar" — a native <details> legend for involvement badges, the
 * solid/dashed/dotted certainty convention, featured numerals, program blocks, picks, overlaps
 * and demo items.
 *
 * Props
 * - `showDemo`: include the Demo badge (only when demo content is visible).
 * - `className`: extra classes for the <details> element.
 */
import { DemoBadge, InvolvementBadge, PickBadge, RelatedBadge } from "@/components/ui/badge";
import { ChevronDownIcon } from "@/components/ui/icons";
import { INVOLVEMENT_DESCRIPTIONS, INVOLVEMENT_ORDER } from "@/lib/schedule/entries";
import type { Certainty } from "@/lib/schedule/format";
import { cn } from "@/lib/cn";
import { CERTAINTY_BORDER, FeaturedMark } from "./time-gutter";

const CERTAINTY_ROWS: { line: Certainty; title: string; body: string }[] = [
  { line: "solid", title: "Solid · confirmed", body: "Date, time and place confirmed by the organizer." },
  {
    line: "dashed",
    title: "Dashed · planned or window",
    body: "Announced but pending confirmation, or a mentor’s availability window — not an appointment.",
  },
  {
    line: "dotted",
    title: "Dotted · time forthcoming",
    body: "Time not announced yet, or exact times are still forthcoming.",
  },
];

export function ScheduleLegend({ showDemo = false, className }: { showDemo?: boolean; className?: string }) {
  return (
    <details className={cn("group/legend", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-paper transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
        <span>How to read this calendar</span>
        <ChevronDownIcon className="size-4 text-paper-subtle transition-transform duration-200 group-open/legend:rotate-180" />
      </summary>

      <div className="space-y-6 pb-2 pt-4">
        <div>
          <p className="mono-label text-paper-subtle">Founders’ involvement</p>
          <ul className="mt-3 space-y-3">
            {INVOLVEMENT_ORDER.map((k) => (
              <li key={k} className="grid gap-1.5">
                <span>
                  <InvolvementBadge involvement={k} />
                </span>
                <span className="text-[0.8125rem] leading-relaxed text-paper-muted">{INVOLVEMENT_DESCRIPTIONS[k]}</span>
              </li>
            ))}
            <li className="grid gap-1.5">
              <span>
                <RelatedBadge />
              </span>
              <span className="text-[0.8125rem] leading-relaxed text-paper-muted">
                Related to Founders Week, outside the official program.
              </span>
            </li>
            <li className="text-[0.8125rem] leading-relaxed text-paper-muted">No badge: listed for reference only.</li>
          </ul>
        </div>

        <div>
          <p className="mono-label text-paper-subtle">Line style = certainty</p>
          <ul className="mt-3 space-y-3">
            {CERTAINTY_ROWS.map((row) => (
              <li key={row.line} className="grid grid-cols-[1.25rem_1fr] gap-3">
                <span aria-hidden className={cn("mt-1 h-8 border-l-2 border-paper/45", CERTAINTY_BORDER[row.line])} />
                <span>
                  <span className="block text-[0.8125rem] font-medium text-paper">{row.title}</span>
                  <span className="block text-[0.8125rem] leading-relaxed text-paper-muted">{row.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mono-label text-paper-subtle">Markers</p>
          <ul className="mt-3 space-y-3 text-[0.8125rem] leading-relaxed text-paper-muted">
            <li className="grid gap-1.5">
              <FeaturedMark rank={1} />
              <span>
                Founders’ priorities, numbered in order and shown at the top of the calendar. Their time rule turns
                orange.
              </span>
            </li>
            <li className="grid gap-1.5">
              <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-paper">
                <span aria-hidden>▾ </span>Sessions
              </span>
              <span>A program block with timed sessions inside. Expand it to see who speaks when.</span>
            </li>
            <li className="grid gap-1.5">
              <PickBadge />
              <span>Recommended by Founders.</span>
            </li>
            <li className="grid gap-1.5">
              <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-warning">
                Overlap · 2 at once
              </span>
              <span>Entries whose times overlap are bracketed together so you can choose.</span>
            </li>
            {showDemo ? (
              <li className="grid gap-1.5">
                <span>
                  <DemoBadge />
                </span>
                <span>Fictional preview content. Never shown on the live site.</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </details>
  );
}
