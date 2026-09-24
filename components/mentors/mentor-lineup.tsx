/**
 * MentorLineup — every office-hours mentor at equal weight, always visible (no carousel, no
 * "see more"). The centerpiece of /office-hours; `MentorPreviewList` (home page) wraps it.
 *
 * Props
 * - `mentors`: public Mentor records (from `getMentors()`), in display order. All are shown.
 * - `applicationsOpen`: site.applications.open. Default true. When false, CTAs read "Applications closed".
 * - `appearances`: optional Founders Week sessions per mentor id (`appearancesByMentor()` in
 *   lib/mentors-view.ts). When given, each card adds a "Speaking Fri, Oct 2 · 1:55 PM" line that
 *   links to the calendar entry.
 * - `headingLevel`: element for each mentor's name. Default "h3".
 * - `priority`: portraits are above the fold (eager headshots). Default false.
 * - `showExpertise`: show the verified-expertise line (from `md` up). Default true.
 * - `density`: "default" (4:5 portraits — the /office-hours centerpiece) · "compact" (square
 *   portraits, for previews such as the home page). Default "default".
 * - `className`: extra classes for the list.
 *
 * Card anatomy (rows align across a row of cards with CSS subgrid):
 *   portrait (MentorPortrait fluid, caption "01 / 04") · name + verified role/organization ·
 *   availability "ticket" (line style = certainty: dashed window, dotted forthcoming/in progress) ·
 *   [Founders Week appearance] · [verified expertise] · CTA ("Apply to meet <first name>" /
 *   "Express interest" → /office-hours?mentor=<id>[&window=<id>]#apply) + "Full profile".
 * Layout: 2 × 2 compact cards below `lg` (all four visible at 390px, no horizontal scrolling);
 * four equal columns divided by hairlines from `lg`. Server-safe (no hooks, no '@/content').
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { DemoBadge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AVAILABILITY_BORDER_CLASSES } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import {
  appearanceShortLabel,
  availabilityHeadline,
  expertiseSummary,
  mentorCta,
  mentorIndexCaption,
  mentorProfileHref,
  type AppearanceView,
  type MentorCta,
} from "@/lib/mentors-view";

/** The mentor's availability as a small bordered "ticket" whose line style carries certainty. */
export function AvailabilityTicket({
  mentor,
  className,
}: {
  mentor: Pick<Mentor, "availability" | "slots">;
  className?: string;
}) {
  const h = availabilityHeadline(mentor);
  const inProgress = h.kind === "in-progress";
  return (
    <div className={cn("rounded-xs border px-3 py-2.5", AVAILABILITY_BORDER_CLASSES[h.kind], className)}>
      <p className={cn("mono-label", inProgress ? "text-paper-subtle" : "text-paper-muted")}>{h.label}</p>
      <p className="mt-1.5 font-mono text-[0.8125rem] leading-snug text-paper tabular">
        {h.date ? (
          <>
            <time dateTime={h.dateTime ?? undefined} className="block">
              {h.date}
            </time>
            <span className="block">
              {h.time}
              {h.more > 0 ? <span className="text-paper-subtle"> +{h.more} more</span> : null}
            </span>
          </>
        ) : (
          <span className="block text-paper-muted">{h.time}</span>
        )}
      </p>
    </div>
  );
}

/** Full-width CTA for a lineup card. Two-line labels in the narrow 2-up columns keep one height. */
export function LineupCta({ cta, name, className }: { cta: MentorCta; name: string; className?: string }) {
  if (cta.href === null) {
    return (
      <span
        className={cn(
          "flex min-h-[3.25rem] w-full items-center rounded-sm border border-dashed border-line-strong px-3 py-2 text-sm text-paper-muted sm:min-h-12",
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
        "group/cta flex min-h-[3.25rem] w-full items-center justify-between gap-2 rounded-sm bg-accent px-3 py-2 text-left text-[0.8125rem] font-semibold leading-tight text-accent-ink transition-colors duration-150 hover:bg-accent-hover sm:min-h-12 sm:px-4 sm:text-sm",
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

// Rows per card: portrait · identity · availability · [appearance] · [expertise] · actions.
const ROW_SPAN: Record<number, string> = { 4: "row-span-4", 5: "row-span-5", 6: "row-span-6" };

export function MentorLineup({
  mentors,
  applicationsOpen = true,
  appearances,
  headingLevel: Heading = "h3",
  priority = false,
  showExpertise = true,
  density = "default",
  className,
}: {
  mentors: Mentor[];
  applicationsOpen?: boolean;
  appearances?: Record<string, AppearanceView[]>;
  headingLevel?: "h2" | "h3" | "h4";
  priority?: boolean;
  showExpertise?: boolean;
  density?: "default" | "compact";
  className?: string;
}) {
  if (mentors.length === 0) return null;
  const compact = density === "compact";
  const withAppearances = Boolean(appearances);
  const rows = 4 + (withAppearances ? 1 : 0) + (showExpertise ? 1 : 0);

  return (
    // Row gap stays 0: each card is a subgrid, and a parent row gap would open inside every card.
    // Columns: every card gets the same side padding (the list bleeds by that padding) so all four
    // portraits are exactly the same size; hairlines divide the columns on desktop.
    <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-0 sm:gap-x-5 lg:-mx-5 lg:grid-cols-4 lg:gap-x-0 xl:-mx-6", className)}>
      {mentors.map((mentor, i) => {
        const cta = mentorCta(mentor, { applicationsOpen });
        const href = mentorProfileHref(mentor.id);
        const expertise = showExpertise ? expertiseSummary(mentor) : null;
        const firstAppearance = appearances?.[mentor.id]?.[0] ?? null;
        return (
          <li
            key={mentor.id}
            className={cn(
              "group/card grid min-w-0 grid-rows-subgrid gap-y-0",
              ROW_SPAN[rows],
              "lg:border-l lg:border-line lg:px-5 lg:[&:nth-child(4n+1)]:border-l-transparent xl:px-6",
            )}
          >
            {/* Portrait — a mouse shortcut to the profile; the name below is the accessible link. */}
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden
              className={cn(
                "block rounded-sm [&_svg]:transition-transform [&_svg]:duration-700 [&_svg]:ease-out group-hover/card:[&_svg]:scale-[1.035]",
                // Compact: a square frame; the portrait fills it (width and height both set).
                compact && "aspect-square self-start",
              )}
            >
              <MentorPortrait
                id={mentor.id}
                name={mentor.name}
                headshot={mentor.headshot}
                size="fluid"
                caption={mentorIndexCaption(i, mentors.length)}
                priority={priority}
                className={cn(
                  "transition-[border-color] duration-200 group-hover/card:border-paper/40",
                  compact && "h-full",
                )}
              />
            </Link>

            {/* Identity */}
            <div className="min-w-0 pt-4">
              <Heading className="font-wide text-base font-bold leading-[1.15] tracking-[-0.02em] text-paper sm:text-lg xl:text-xl">
                <Link
                  href={href}
                  className="rounded-xs decoration-accent decoration-2 underline-offset-[5px] transition-colors duration-150 hover:underline"
                >
                  {mentor.name}
                </Link>
              </Heading>
              {mentor.role || mentor.company ? (
                <p className="mt-1.5 text-[0.8125rem] leading-snug sm:text-sm">
                  {mentor.role ? <span className="block text-paper-muted">{mentor.role}</span> : null}
                  {mentor.role && mentor.company ? <span className="sr-only">, </span> : null}
                  {mentor.company ? <span className="block text-paper">{mentor.company}</span> : null}
                </p>
              ) : null}
              {mentor.demo ? <DemoBadge className="mt-2" /> : null}
            </div>

            {/* Availability */}
            <div className="pt-4">
              <AvailabilityTicket mentor={mentor} />
            </div>

            {/* Founders Week appearance (optional row) */}
            {withAppearances ? (
              <div className="min-w-0">
                {firstAppearance ? (
                  <p className="hidden pt-3 font-mono text-xs leading-snug text-paper-muted sm:block">
                    <span className="text-accent" aria-hidden>
                      ◆{" "}
                    </span>
                    <Link
                      href={firstAppearance.href}
                      className="underline decoration-line-strong underline-offset-4 hover:text-paper hover:decoration-paper/60"
                    >
                      {appearanceShortLabel(firstAppearance)}
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Verified expertise (tablet and up — the compact 2-up cards stay short) */}
            {showExpertise ? (
              <div className="min-w-0">
                {expertise ? (
                  <p className="hidden pt-4 text-sm leading-relaxed text-paper-muted md:block">
                    <span className="mono-label mb-1 block text-paper-subtle">Expertise</span>
                    {expertise}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Actions — the bottom padding separates rows of cards (2 × 2 on small screens). */}
            <div className="flex flex-col gap-0.5 self-end pt-5 pb-10">
              <LineupCta cta={cta} name={mentor.name} />
              <Link
                href={href}
                className="mono-label inline-flex h-11 items-center gap-1.5 self-start rounded-xs text-paper-muted transition-colors duration-150 hover:text-paper"
              >
                Full profile<span className="sr-only">: {mentor.name}</span>
                <ArrowRightIcon className="size-3" />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
