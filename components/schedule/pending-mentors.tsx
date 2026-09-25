/**
 * Office-hours mentors with no published times yet ("Scheduling in progress") who match a calendar
 * search. They have no calendar rows, so a search for "Stakehouse" or "Vik" would otherwise
 * come back empty. Each links to their profile and into the office-hours application with that
 * mentor preselected (/office-hours?mentor=<id>#apply); copy makes clear it reserves nothing.
 *
 * Props
 * - `mentors`: PendingMentor[] (public fields only, from lib/schedule/pending-mentors.ts).
 * - `className`: extra classes for the wrapper.
 */
import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MentorPortrait } from "@/components/ui/portrait";
import { INTEREST_COPY, SCHEDULING_IN_PROGRESS_LABEL } from "@/lib/mentors";
import type { PendingMentor } from "@/lib/schedule/pending-mentors";
import { mentorProfileHref } from "@/lib/schedule/program";

export function PendingMentors({ mentors, className }: { mentors: PendingMentor[]; className?: string }) {
  if (!mentors.length) return null;
  return (
    <section aria-labelledby="pending-mentors-heading" className={className}>
      <h2 id="pending-mentors-heading" className="text-xl font-semibold tracking-tight text-text">
        {mentors.length === 1 ? "Office-hours mentor" : "Office-hours mentors"}
      </h2>
      <p className="mt-1.5 max-w-[65ch] text-[0.9375rem] leading-relaxed text-text-muted">
        {SCHEDULING_IN_PROGRESS_LABEL}. You can apply now without picking a time. {INTEREST_COPY.followUp}{" "}
        {INTEREST_COPY.noReservation}
      </p>

      <ul className="mt-4 divide-y divide-line border-t border-line-strong">
        {mentors.map((m) => (
          <li key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" />
              <div className="min-w-0 leading-snug">
                <p className="flex flex-wrap items-center gap-2 font-medium text-text">
                  <Link
                    href={mentorProfileHref(m.id)}
                    className="underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
                  >
                    {m.name}
                  </Link>
                  {m.demo ? <DemoBadge /> : null}
                </p>
                {m.affiliation ? <p className="text-sm text-text-muted">{m.affiliation}</p> : null}
              </div>
            </div>
            <ButtonLink href={m.href} variant="secondary" className="min-h-11 w-full shrink-0 sm:w-auto">
              {m.ctaLabel}
              <span className="sr-only"> ({m.name})</span>
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
