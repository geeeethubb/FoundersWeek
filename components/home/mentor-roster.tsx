/**
 * MentorRoster — the home hero's office-hours "manifest": every public mentor, always visible, at
 * equal weight (no carousel, no "see more"). Each row: MentorPortrait (orbit line-art + initials,
 * or the approved headshot) · index "01 / 04" · name (→ profile) · verified role and organization ·
 * availability with its certainty line style (dashed window, dotted forthcoming / in progress) ·
 * the mentor's CTA ("Apply to meet <first name>" or "Express interest"), which opens the
 * application on /office-hours with that mentor (and a single window) preselected.
 *
 * Props
 * - `mentors`: public mentors from `getMentors()`, in display order.
 * - `appearances`: `appearancesByMentor(entries, mentors)` — first Founders Week session per mentor
 *   (shown from the container's `@lg` width up).
 * - `applicationsOpen`: `site.applications.open`.
 * - `className`: extra classes for the <section>.
 *
 * Layout is driven by the roster's own width (container queries): stacked rows with a full-width
 * CTA on phones; portrait · identity · CTA from `@lg`. Server component.
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { DemoBadge, InvolvementBadge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AVAILABILITY_BORDER_CLASSES } from "@/components/ui/status";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import {
  appearanceShortLabel,
  availabilityHeadline,
  mentorCta,
  mentorIndexCaption,
  mentorProfileHref,
  type AppearanceView,
  type MentorCta,
} from "@/lib/mentors-view";
import { OFFICE_HOURS_FEATURED_RANK } from "@/lib/schedule/entries";
import { listText, rankNumeral } from "@/lib/schedule/format";
import { pad2, schedulingFirstNames } from "./home-model";

export function MentorRoster({
  mentors,
  appearances = {},
  applicationsOpen = true,
  className,
}: {
  mentors: Mentor[];
  appearances?: Record<string, AppearanceView[]>;
  applicationsOpen?: boolean;
  className?: string;
}) {
  const scheduling = schedulingFirstNames(mentors);
  const count = mentors.length;

  return (
    <section
      aria-labelledby="roster-heading"
      className={cn(
        "@container relative -mx-5 border-y border-line-strong bg-ink-850 sm:mx-0 sm:rounded-sm sm:border-x",
        className,
      )}
    >
      {/* Registration ticks — the portrait frame language, at panel scale. */}
      <span aria-hidden className="absolute -left-px -top-px hidden size-3 border-l-2 border-t-2 border-accent sm:block" />
      <span aria-hidden className="absolute -right-px -top-px hidden size-3 border-r-2 border-t-2 border-accent sm:block" />
      <span aria-hidden className="absolute -bottom-px -left-px hidden size-3 border-b-2 border-l-2 border-accent sm:block" />
      <span aria-hidden className="absolute -bottom-px -right-px hidden size-3 border-b-2 border-r-2 border-accent sm:block" />

      {/* Phones: title + count on one line, badge below. From @lg: title · badge ········ count. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5">
        <h2 id="roster-heading" className="mono-label order-1 flex items-center gap-2.5 text-paper">
          <span className="text-accent tabular">{rankNumeral(OFFICE_HOURS_FEATURED_RANK)}</span>
          <span aria-hidden className="h-px w-4 bg-line-strong" />
          Founders Office Hours
        </h2>
        <p className="mono-label order-2 ml-auto tabular text-paper-subtle @lg:order-3">
          {pad2(count)} {count === 1 ? "mentor" : "mentors"}
        </p>
        <span className="order-3 basis-full @lg:order-2 @lg:basis-auto">
          <InvolvementBadge involvement="hosted" />
        </span>
      </header>

      {count ? (
        <ol className="divide-y divide-line">
          {mentors.map((mentor, i) => (
            <RosterRow
              key={mentor.id}
              mentor={mentor}
              index={i}
              total={count}
              cta={mentorCta(mentor, { applicationsOpen })}
              appearance={appearances[mentor.id]?.[0] ?? null}
            />
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-paper-muted">
          Mentors are listed here as soon as they’re confirmed.
        </p>
      )}

      <footer className="border-t border-line px-5 py-4">
        <p className="text-[0.8125rem] leading-relaxed text-paper-muted">
          {scheduling.length ? (
            <>
              <span className="text-paper">
                {listText(scheduling)} {scheduling.length === 1 ? "is" : "are"} still scheduling
              </span>{" "}
              — express interest in the same application.{" "}
            </>
          ) : null}
          {APPLICATION_COPY.noReservation}
        </p>
      </footer>
    </section>
  );
}

function RosterRow({
  mentor,
  index,
  total,
  cta,
  appearance,
}: {
  mentor: Mentor;
  index: number;
  total: number;
  cta: MentorCta;
  appearance: AppearanceView | null;
}) {
  const href = mentorProfileHref(mentor.id);
  const h = availabilityHeadline(mentor);
  const inProgress = h.kind === "in-progress";

  return (
    <li className="group/row relative grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-3.5 px-5 py-4 @lg:grid-cols-[5rem_minmax(0,1fr)_auto] @lg:items-center @lg:gap-x-3.5">
      {/* Portrait + its index, like a specimen label. The portrait is a mouse shortcut to the
          profile; the name is the accessible link. */}
      <div className="self-start">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="block rounded-sm [&_svg]:transition-transform [&_svg]:duration-700 [&_svg]:ease-out group-hover/row:[&_svg]:scale-[1.06]"
        >
          <MentorPortrait
            id={mentor.id}
            name={mentor.name}
            headshot={mentor.headshot}
            size="md"
            priority
            className="transition-[border-color] duration-200 group-hover/row:border-paper/40"
          />
        </Link>
        <p className="mono-label mt-1.5 text-center tabular text-paper-subtle">{mentorIndexCaption(index, total)}</p>
      </div>

      <div className="min-w-0">
        <h3 className="font-wide text-[1.0625rem] font-bold leading-[1.15] tracking-[-0.02em] text-paper @md:text-lg">
          <Link
            href={href}
            className="rounded-xs decoration-accent decoration-2 underline-offset-[5px] transition-colors duration-150 hover:underline"
          >
            {mentor.name}
          </Link>
        </h3>
        {mentor.role || mentor.company ? (
          <p className="mt-1 text-[0.8125rem] leading-snug @md:text-sm">
            {mentor.role ? <span className="text-paper-muted">{mentor.role}</span> : null}
            {mentor.role && mentor.company ? (
              <>
                <span aria-hidden className="px-1.5 text-paper-subtle">
                  ·
                </span>
                <span className="sr-only">, </span>
              </>
            ) : null}
            {mentor.company ? <span className="text-paper">{mentor.company}</span> : null}
          </p>
        ) : null}
        {mentor.demo ? <DemoBadge className="mt-2" /> : null}

        {/* Availability — line style carries certainty. */}
        <div className={cn("mt-3 border-l-2 pl-2.5", AVAILABILITY_BORDER_CLASSES[h.kind])}>
          <p className={cn("mono-label", inProgress ? "text-paper-subtle" : "text-paper-muted")}>{h.label}</p>
          {/* Phones: date, then time on its own line. From @lg: one line, each part kept whole. */}
          <p className="mt-0.5 font-mono text-[0.8125rem] leading-snug tabular">
            {h.date ? (
              <>
                <time dateTime={h.dateTime ?? undefined} className="whitespace-nowrap text-paper">
                  {h.date}
                </time>
                <span className="hidden text-paper-subtle @lg:inline"> · </span>
                <span className="sr-only @lg:hidden">, </span>
                <span className="block whitespace-nowrap text-paper @lg:inline">{h.time}</span>
                {h.more > 0 ? <span className="whitespace-nowrap text-paper-subtle"> +{h.more} more</span> : null}
              </>
            ) : (
              <span className="text-paper-muted">{h.time}</span>
            )}
          </p>
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-2 @lg:col-span-1 @lg:items-end">
        <RosterCta cta={cta} name={mentor.name} />
        {appearance ? (
          <p className="hidden font-mono text-[0.6875rem] leading-4 text-paper-subtle @lg:block">
            <span aria-hidden className="text-accent">
              ◆{" "}
            </span>
            <Link
              href={appearance.href}
              className="rounded-xs underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:text-paper hover:decoration-paper/60"
            >
              {appearanceShortLabel(appearance)}
              <span className="sr-only"> — {appearance.title}</span>
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Orange-outline CTA: loud enough to find, quieter than the page's one solid primary button. */
function RosterCta({ cta, name, className }: { cta: MentorCta; name: string; className?: string }) {
  if (cta.href === null) {
    return (
      <span
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-sm border border-dashed border-line-strong px-4 text-sm text-paper-muted",
          className,
        )}
      >
        {cta.label}
      </span>
    );
  }
  return (
    <Link
      href={cta.href}
      className={cn(
        "group/cta inline-flex min-h-11 items-center justify-between gap-2.5 rounded-sm border border-line-accent px-4 text-sm font-semibold text-accent transition-colors duration-150 @lg:px-3.5",
        "hover:border-accent hover:bg-accent hover:text-accent-ink @lg:justify-center @lg:whitespace-nowrap",
        className,
      )}
    >
      <span>
        {cta.label}
        {cta.kind === "interest" ? <span className="sr-only"> in meeting {name}</span> : null}
      </span>
      <ArrowRightIcon className="size-4 shrink-0 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
    </Link>
  );
}
