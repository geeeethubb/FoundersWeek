/**
 * Building blocks shared by the mentor sections on /office-hours and the profile page
 * (/office-hours/[id]). All server-safe; every value comes from public, verified mentor data.
 *
 * - `ProfileSection` — hairline-topped section with a mono label rail on the left (md+).
 *   Props: `id`, `label`, `badge` (e.g. a Draft badge beside the label), `children`, `className`.
 * - `ExpertiseList` — verified expertise, each item with its basis ("Basis — Founders Showcase
 *   panelist"). Props: `items`, `draft`, `size` ("md" | "lg"), `layout` ("split" | "stacked").
 * - `AppearanceList` — Founders Week sessions the mentor speaks at, linking to the calendar entry.
 *   Props: `appearances` (AppearanceView[]), `size`.
 * - `AvailabilityBlocks` — each window as a bordered time block (line style from
 *   AVAILABILITY_BORDER_CLASSES) with its specific slots nested inside; or the dotted
 *   "Scheduling in progress" block. Props: `mentor`.
 * - `SessionDetailsList` — format / length / location / sessions ("To be confirmed" when unknown)
 *   plus the public session note. Props: `session`, `layout` ("list" — label/value rows · "grid" —
 *   a 2 × 2 block that fits narrow columns), `showNote`.
 * - `SourcesNote` — footnote listing where the profile's facts came from. Props: `sources`.
 */
import Link from "next/link";
import type { Mentor, SourceRef } from "@/content/types";
import { DraftBadge } from "@/components/ui/badge";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { MetaRow } from "@/components/ui/primitives";
import { AVAILABILITY_BORDER_CLASSES, AvailabilityBadge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { INTEREST_COPY } from "@/lib/mentors";
import {
  availabilityView,
  sessionDetails,
  type AppearanceView,
  type ExpertiseItem,
  type SlotView,
  type WindowView,
} from "@/lib/mentors-view";
import { dateParts, formatDate } from "@/lib/time";

export function ProfileSection({
  id,
  label,
  badge,
  children,
  className,
}: {
  id: string;
  label: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid scroll-mt-28 gap-4 border-t border-line py-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8 md:py-10",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start">
        <h2 id={id} className="mono-label pt-0.5 text-paper-subtle">
          {label}
        </h2>
        {badge}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Expertise
// ---------------------------------------------------------------------------

export function ExpertiseList({
  items,
  draft = false,
  size = "md",
  layout = "split",
  className,
}: {
  items: ExpertiseItem[];
  draft?: boolean;
  size?: "md" | "lg";
  /** "split": label | basis side by side from `sm` · "stacked": basis under the label (narrow columns). */
  layout?: "split" | "stacked";
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className={cn(
            "grid gap-x-6 gap-y-1 py-3",
            layout === "split" && "sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:items-baseline",
          )}
        >
          <p
            className={cn(
              "flex items-baseline gap-3 leading-snug text-paper",
              size === "lg" ? "text-base md:text-lg" : "text-[0.9375rem]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 -translate-y-0.5 rotate-45",
                draft ? "border border-warning" : "bg-accent",
              )}
            />
            <span>{item.label}</span>
          </p>
          <p
            className={cn(
              "pl-[1.125rem] font-mono text-xs leading-snug text-paper-subtle",
              layout === "split" && "sm:pl-0",
            )}
          >
            <span className="text-paper-subtle">Basis</span>
            <span aria-hidden className="px-1.5">
              —
            </span>
            <span className="text-paper-muted">{item.basis}</span>
          </p>
        </li>
      ))}
      {draft ? (
        <li className="py-2">
          <DraftBadge />
        </li>
      ) : null}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Founders Week appearances
// ---------------------------------------------------------------------------

export function AppearanceList({
  appearances,
  size = "md",
  className,
}: {
  appearances: AppearanceView[];
  size?: "md" | "lg";
  className?: string;
}) {
  if (appearances.length === 0) return null;
  return (
    <ul className={cn("space-y-3", className)}>
      {appearances.map((a) => (
        <li key={a.key} className="relative rounded-sm border border-line bg-ink-850/60 px-4 py-3.5 sm:px-5">
          <p className="font-mono text-xs leading-snug text-paper-muted tabular">
            <time dateTime={a.dateTime}>
              <span className="text-paper">{a.dateShort}</span>
              {a.timeLabel ? <span> · {a.timeLabel}</span> : null}
            </time>
          </p>
          <p
            className={cn(
              "mt-1.5 font-wide font-semibold leading-snug tracking-[-0.01em] text-paper",
              size === "lg" ? "text-base md:text-lg" : "text-[0.9375rem]",
            )}
          >
            <Link
              href={a.href}
              className="group/app rounded-xs decoration-accent decoration-2 underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline"
            >
              {a.title}
              <ArrowRightIcon className="ml-1.5 inline size-3.5 -translate-y-px text-accent transition-transform duration-150 group-hover/app:translate-x-0.5" />
            </Link>
          </p>
          <p className="mt-1 text-[0.8125rem] leading-snug text-paper-subtle">
            {[a.roleLabel, a.context, a.venue].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** Calendar-stamp date: "THU / 01 / OCT". */
function DateStamp({ date }: { date: string }) {
  const p = dateParts(date);
  return (
    <time dateTime={date} className="flex w-12 shrink-0 flex-col items-start leading-none sm:w-14">
      <span className="sr-only">{formatDate(date, "long")}</span>
      <span aria-hidden className="mono-label text-paper-subtle">
        {p.weekdayShort}
      </span>
      <span
        aria-hidden
        className="mt-1.5 font-wide text-[1.75rem] font-bold tracking-[-0.03em] text-paper tabular sm:text-[2rem]"
      >
        {p.dayPadded}
      </span>
      <span aria-hidden className="mono-label mt-1.5 text-paper-muted">
        {p.monthShort}
      </span>
    </time>
  );
}

function SlotRow({ slot }: { slot: SlotView }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xs border bg-ink-900/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        AVAILABILITY_BORDER_CLASSES[slot.kind],
      )}
    >
      <div className="min-w-0">
        <p className="font-mono text-[0.9375rem] text-paper tabular">
          <time dateTime={`${slot.date}T${slot.start}`}>{slot.timeLabel}</time>
        </p>
        <p className="mt-1 text-[0.8125rem] leading-snug text-paper-subtle">
          {[slot.capacityLabel, slot.where].filter(Boolean).join(" · ")}
        </p>
      </div>
      <AvailabilityBadge kind={slot.kind} className="self-start sm:self-center" />
    </li>
  );
}

function WindowBlock({ window: w, firstName }: { window: WindowView; firstName: string }) {
  return (
    <li className={cn("@container rounded-sm border p-4 sm:p-5", AVAILABILITY_BORDER_CLASSES[w.kind])}>
      <div className="flex gap-4 sm:gap-5">
        <DateStamp date={w.date} />
        <div className="min-w-0 flex-1">
          {/* Certainty first, then the time — sized to the block, so it never breaks mid-phrase. */}
          <AvailabilityBadge kind={w.kind} />
          <p className="mt-2.5 font-mono text-[0.9375rem] leading-snug text-paper tabular @sm:text-lg">{w.timeLabel}</p>
          {w.note ? (
            <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-paper-muted">{w.note}</p>
          ) : null}
          {w.slots.length ? (
            <div className="mt-5">
              <p className="mono-label mb-2.5 text-paper-subtle">
                {w.slots.length === 1 ? "Specific time" : "Specific times"}
              </p>
              <ul className="space-y-2" aria-label={`Specific times with ${firstName} on ${w.dateLong}`}>
                {w.slots.map((slot) => (
                  <SlotRow key={slot.id} slot={slot} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AvailabilityBlocks({ mentor }: { mentor: Pick<Mentor, "firstName" | "availability" | "slots"> }) {
  const view = availabilityView(mentor);
  if (view.status === "in-progress") {
    return (
      <div className={cn("rounded-sm border p-4 sm:p-5", AVAILABILITY_BORDER_CLASSES["in-progress"])}>
        <AvailabilityBadge kind="in-progress" />
        <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-paper">
          {mentor.firstName}’s availability isn’t finalized yet. You can express interest now without choosing a time.
        </p>
        <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-paper-muted">
          {INTEREST_COPY.followUp} {INTEREST_COPY.noReservation}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {view.windows.map((w) => (
        <WindowBlock key={w.id} window={w} firstName={mentor.firstName} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Session details
// ---------------------------------------------------------------------------

export function SessionDetailsList({
  session,
  layout = "list",
  showNote = true,
}: {
  session: Mentor["session"];
  layout?: "list" | "grid";
  showNote?: boolean;
}) {
  const rows = sessionDetails(session);
  return (
    <div>
      {layout === "grid" ? (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line">
          {rows.map((row) => (
            <div key={row.label} className="bg-ink-900 px-3.5 py-3">
              <dt className="mono-label text-paper-subtle">{row.label}</dt>
              <dd className={cn("mt-1 text-sm leading-snug", row.known ? "text-paper" : "text-paper-subtle")}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="border-b border-line">
          {rows.map((row) => (
            <MetaRow key={row.label} label={row.label} className="first:border-t-0 first:pt-0">
              <span className={row.known ? "text-paper" : "text-paper-subtle"}>{row.value}</span>
            </MetaRow>
          ))}
        </dl>
      )}
      {showNote && session.note ? (
        <p className="mt-4 max-w-prose text-[0.9375rem] leading-relaxed text-paper-muted">{session.note}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export function SourcesNote({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="space-y-2 text-[0.8125rem] leading-relaxed text-paper-subtle">
      {sources.map((s, i) => (
        <li key={`${s.label}-${i}`}>
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-paper-muted underline decoration-line-strong underline-offset-4 hover:text-paper hover:decoration-paper/60"
            >
              {s.label}
              <ArrowUpRightIcon className="size-3" />
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          ) : (
            <span className="text-paper-muted">{s.label}</span>
          )}
          {s.note ? <span> — {s.note}</span> : null}
          {s.checked ? (
            <span className="font-mono">
              {" "}
              · Checked{" "}
              <time dateTime={s.checked}>
                {formatDate(s.checked, "month-day")}, {dateParts(s.checked).year}
              </time>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
