/**
 * MentorPreviewList — all office-hours mentors, compact and at equal weight, for the home page.
 *
 * Props
 * - `mentors`: public Mentor records (from `getMentors()` in a server component), in display order.
 *   Every mentor passed is shown — pass them all (the lineup is never hidden behind a click).
 * - `appearances` (optional): Founders Week sessions per mentor id, e.g.
 *   `appearancesByMentor(getScheduleEntries(), mentors)` from lib/mentors-view.ts. When given, each
 *   card adds a line like "Speaking Fri, Oct 2 · 1:55 PM" linking to the calendar entry.
 * - `applicationsOpen`: site.applications.open. Default true. When false, CTAs read "Applications closed".
 * - `headingLevel`: element for each mentor's name. Default "h3" (use "h4" under an h3).
 * - `showExpertise`: show each mentor's verified expertise line (tablet and up). Default false —
 *   keeps the home preview compact.
 * - `density`: "compact" (square portraits, default) · "default" (the 4:5 portraits of /office-hours).
 * - `priority`: portraits are above the fold (eager headshots). Default false.
 * - `className`: extra classes for the list.
 *
 * Each card: MentorPortrait (orbit line-art + initials, or the approved headshot; caption "01 / 04") ·
 * name (links to the profile) + verified role and organization · availability "ticket" (window with
 * its time, or "Scheduling in progress") · CTA "Apply to meet <first name>" / "Express interest" →
 * /office-hours?mentor=<id>[&window=<id>]#apply · "Full profile".
 * Layout: 2 × 2 below `lg` (all four visible at 390px, no horizontal scrolling), four columns from
 * `lg`. Server-safe (no hooks, no '@/content').
 */
import type { Mentor } from "@/content/types";
import type { AppearanceView } from "@/lib/mentors-view";
import { MentorLineup } from "./mentor-lineup";

export function MentorPreviewList({
  mentors,
  appearances,
  applicationsOpen = true,
  headingLevel = "h3",
  showExpertise = false,
  density = "compact",
  priority = false,
  className,
}: {
  mentors: Mentor[];
  appearances?: Record<string, AppearanceView[]>;
  applicationsOpen?: boolean;
  headingLevel?: "h3" | "h4";
  showExpertise?: boolean;
  density?: "default" | "compact";
  priority?: boolean;
  className?: string;
}) {
  return (
    <MentorLineup
      mentors={mentors}
      appearances={appearances}
      applicationsOpen={applicationsOpen}
      headingLevel={headingLevel}
      showExpertise={showExpertise}
      density={density}
      priority={priority}
      className={className}
    />
  );
}
