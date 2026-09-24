/**
 * OtherMentors — the rest of the lineup at the end of a mentor profile, so every mentor stays one
 * click away (and one application covers them all).
 *
 * Props
 * - `mentors`: public Mentor records to list (typically every mentor except the current one).
 * - `applicationsOpen`: site.applications.open.
 * - `title`: section heading. Default "More Founders Office Hours".
 * - `className`: extra classes for the section.
 *
 * Hairline-divided columns: small portrait · name (links to the profile) · verified role and
 * organization · availability in one mono line · the mentor's CTA (→ /office-hours?mentor=<id>…#apply).
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import { availabilityHeadline, mentorAffiliation, mentorCta, mentorProfileHref } from "@/lib/mentors-view";

export function OtherMentors({
  mentors,
  applicationsOpen,
  title = "More Founders Office Hours",
  className,
}: {
  mentors: Mentor[];
  applicationsOpen: boolean;
  title?: string;
  className?: string;
}) {
  if (mentors.length === 0) return null;
  return (
    <section
      aria-labelledby="other-mentors-heading"
      className={cn("border-t border-line-strong py-12 md:py-16", className)}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2
          id="other-mentors-heading"
          className="font-wide text-xl font-bold tracking-[-0.02em] text-paper md:text-2xl"
        >
          {title}
        </h2>
        <Link
          href="/office-hours#mentors"
          className="mono-label inline-flex h-10 items-center gap-1.5 rounded-xs text-paper-muted transition-colors duration-150 hover:text-paper"
        >
          All mentors
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>
      <ul
        className={cn(
          "grid gap-px overflow-hidden rounded-sm border border-line bg-line",
          mentors.length === 4 || mentors.length === 2
            ? "md:grid-cols-2"
            : mentors.length >= 3
              ? "md:grid-cols-3"
              : null,
        )}
      >
        {mentors.map((mentor) => {
          const cta = mentorCta(mentor, { applicationsOpen });
          const h = availabilityHeadline(mentor);
          const affiliation = mentorAffiliation(mentor);
          return (
            <li key={mentor.id} className="flex gap-4 bg-ink-900 p-5">
              <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="sm" />
              <div className="min-w-0 flex-1">
                <h3 className="font-wide text-base font-bold leading-tight tracking-[-0.015em] text-paper">
                  <Link
                    href={mentorProfileHref(mentor.id)}
                    className="rounded-xs decoration-accent decoration-2 underline-offset-4 hover:underline"
                  >
                    {mentor.name}
                  </Link>
                </h3>
                {affiliation ? <p className="mt-1 text-sm leading-snug text-paper-muted">{affiliation}</p> : null}
                <p className="mt-2.5 font-mono text-xs leading-snug text-paper-subtle tabular">
                  {h.date ? `${h.date} · ${h.time}` : h.label}
                </p>
                {cta.href ? (
                  <Link
                    href={cta.href}
                    className="group/cta mt-2 inline-flex h-10 items-center gap-2 rounded-xs text-sm font-semibold text-paper transition-colors duration-150 hover:text-accent"
                  >
                    {cta.label}
                    {cta.kind === "interest" ? <span className="sr-only"> in meeting {mentor.name}</span> : null}
                    <ArrowRightIcon className="size-4 text-accent transition-transform duration-150 group-hover/cta:translate-x-0.5" />
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-paper-subtle">{cta.label}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
