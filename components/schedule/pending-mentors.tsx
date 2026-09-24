/**
 * "Scheduling in progress" block for mentors with no published times yet (they have no calendar
 * entries). Dotted frame = scheduling in progress (the site's line-style convention). Each mentor
 * gets an "Express interest" link into the office-hours application with that mentor preselected
 * (/office-hours?mentor=<id>#apply); copy makes clear it doesn't reserve anything.
 *
 * Props
 * - `mentors`: PendingMentor[] (public fields only, from lib/schedule/pending-mentors.ts).
 * - `className`: extra classes for the wrapper.
 */
import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge } from "@/components/ui/status";
import { INTEREST_COPY } from "@/lib/mentors";
import type { PendingMentor } from "@/lib/schedule/pending-mentors";
import { mentorProfileHref } from "@/lib/schedule/program";
import { cn } from "@/lib/cn";

export function PendingMentors({ mentors, className }: { mentors: PendingMentor[]; className?: string }) {
  if (!mentors.length) return null;
  return (
    <section
      aria-labelledby="pending-mentors-heading"
      className={cn("rounded-sm border border-dotted border-line-strong bg-ink-850/50 px-5 py-6 md:px-7 md:py-7", className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="mono-label text-paper-muted">Office hours</p>
        <AvailabilityBadge kind="in-progress" />
      </div>
      <h2
        id="pending-mentors-heading"
        className="mt-3 font-wide text-xl font-semibold tracking-[-0.02em] text-paper md:text-[1.375rem]"
      >
        {mentors.length === 1 ? "One more mentor is finalizing availability" : "More mentors are finalizing availability"}
      </h2>
      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-paper-muted">
        You can express interest now, without choosing a time. {INTEREST_COPY.followUp}{" "}
        {INTEREST_COPY.noReservation}
      </p>

      <ul className="mt-5 divide-y divide-line border-y border-line">
        {mentors.map((m) => (
          <li key={m.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-paper">
                  <Link
                    href={mentorProfileHref(m.id)}
                    className="underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-paper"
                  >
                    {m.name}
                  </Link>
                  {m.demo ? <DemoBadge /> : null}
                </p>
                {m.affiliation ? <p className="text-sm text-paper-muted">{m.affiliation}</p> : null}
              </div>
            </div>
            <ButtonLink href={m.href} variant="secondary" className="w-full shrink-0 sm:w-auto">
              {m.ctaLabel}
              <span className="sr-only"> — {m.name}</span>
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
