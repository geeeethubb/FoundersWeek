/**
 * Founders Office Hours at the top of the calendar: who students can meet (every public mentor,
 * with photo and company, linking to their profile — including mentors still scheduling, who have
 * no calendar rows yet) and how to apply (one "Apply for Office Hours" button → /office-hours#apply).
 * The agenda below stays strictly chronological; office-hours windows also appear there by date.
 *
 * Props
 * - `mentors`: public mentors (`getMentors()`), in display order.
 * - `className`: extra classes for the <section>.
 *
 * Server component (no hooks).
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { DemoBadge, InvolvementBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { PRIMARY_CTA_LABEL, schedulingStatus } from "@/lib/mentors";
import { applyHref } from "@/lib/schedule/entries";
import { listText } from "@/lib/schedule/format";
import { mentorProfileHref } from "@/lib/schedule/program";
import { cn } from "@/lib/cn";
import { balancedColumns } from "@/lib/columns";
import { numberWord } from "@/lib/words";

// Literal class names so Tailwind generates them; the count comes from the data (balancedColumns).
const LG_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/** "One application covers all six mentors. Appointments are limited. Times for Vik, Elliott and Ron are still being set." */
export function officeHoursCardLede(mentors: Pick<Mentor, "firstName" | "availability" | "slots">[]): string {
  const n = mentors.length;
  const count = numberWord(n);
  const covers =
    n === 1 ? "One application is all it takes." : n === 2 ? "One application covers both mentors." : `One application covers all ${count} mentors.`;
  const scheduling = mentors.filter((m) => schedulingStatus(m) === "in-progress").map((m) => m.firstName);
  const pending = scheduling.length ? ` Times for ${listText(scheduling)} are still being set.` : "";
  return `${covers} Appointments are limited.${pending}`;
}

export function OfficeHoursCard({ mentors, className }: { mentors: Mentor[]; className?: string }) {
  if (!mentors.length) return null;
  return (
    <section
      aria-labelledby="calendar-office-hours"
      className={cn("rounded-md border border-line bg-surface p-5 sm:p-6 md:p-8", className)}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="max-w-2xl">
          <InvolvementBadge involvement="hosted" />
          <h2 id="calendar-office-hours" className="mt-3 text-2xl font-semibold tracking-tight text-text md:text-[1.75rem]">
            Founders Office Hours
          </h2>
          <p className="mt-2 leading-relaxed text-text-muted">{officeHoursCardLede(mentors)}</p>
          {/* Phones: every face and first name on one line (the full list below is for wider screens). */}
          <div className="mt-4 flex items-center gap-3 sm:hidden">
            <span aria-hidden className="flex shrink-0 -space-x-2">
              {mentors.map((m) => (
                <MentorPortrait key={m.id} id={m.id} name={m.name} headshot={m.headshot} size="xs" className="ring-2 ring-surface" />
              ))}
            </span>
            <p className="min-w-0 text-sm leading-snug text-text-muted">{listText(mentors.map((m) => m.firstName))}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:shrink-0">
          <ButtonLink href={applyHref()} size="lg" className="w-full sm:w-auto">
            {PRIMARY_CTA_LABEL}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
          <Link
            href="/office-hours"
            className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
          >
            Meet the mentors
          </Link>
        </div>
      </div>

      <ul
        aria-label="Office-hours mentors"
        className={cn("mt-7 hidden gap-x-6 gap-y-4 sm:grid sm:grid-cols-2", LG_COLUMNS[balancedColumns(mentors.length)])}
      >
        {mentors.map((m) => (
          <li key={m.id} className="min-w-0">
            <Link href={mentorProfileHref(m.id)} className="group/mentor flex min-h-11 items-start gap-3 rounded-sm pr-1">
              <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" />
              <span className="min-w-0 pt-0.5 leading-snug">
                <span className="block font-medium text-text underline decoration-transparent underline-offset-4 transition-colors group-hover/mentor:decoration-accent">
                  {m.name}
                </span>
                {m.company ? <span className="block text-sm text-text-muted">{m.company}</span> : null}
                {m.demo ? <DemoBadge className="mt-1" /> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
