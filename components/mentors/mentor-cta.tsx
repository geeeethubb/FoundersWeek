/**
 * Mentor calls to action. Every CTA lands on the application section of the Office Hours page
 * (/office-hours?mentor=<id>[&window|slot=<id>]#apply) with the mentor preselected.
 *
 * - `MentorCtaButton` — the orange CTA from `mentorCta()` (lib/mentors-view.ts): "Apply to meet
 *   <first name>" (single window/slot preselected when there's exactly one) or "Express interest".
 *   Props: `cta`, `size` ("md" | "lg"), `className`. A closed CTA renders as a quiet, non-link label.
 * - `PreselectNote` — one mono line saying what the CTA prefills ("Opens the application with
 *   Thu, Oct 1 · 10:00–11:30 AM CT preselected"). Props: `cta`, `firstName`, `className`.
 * - `MentorCtaCopy` — the matching promise: APPLICATION_COPY for apply, INTEREST_COPY for interest.
 *   Props: `cta`, `className`.
 * - `MentorCtaPanel` — desktop right-column panel (sticky) for the profile page.
 *   Props: `mentor`, `cta`, `className`.
 * - `MentorActionBar` — mobile bottom action bar. It is `position: sticky` at the end of the
 *   profile, so it floats at the bottom of the viewport while reading and settles into place at the
 *   end of the profile — it never covers the last content or the footer. Props: `cta`, `className`.
 */
import type { Mentor } from "@/content/types";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import { INTEREST_COPY } from "@/lib/mentors";
import { type MentorCta } from "@/lib/mentors-view";
import { AvailabilityTicket } from "./mentor-lineup";

export function MentorCtaButton({
  cta,
  size = "md",
  className,
}: {
  cta: MentorCta;
  size?: "md" | "lg";
  className?: string;
}) {
  if (cta.href === null) {
    return (
      <span
        className={cn(
          buttonClasses({ variant: "secondary", size, className }),
          "cursor-default border-dashed text-paper-muted hover:border-line-strong hover:bg-transparent",
        )}
      >
        {cta.label}
      </span>
    );
  }
  return (
    <ButtonLink href={cta.href} size={size} className={cn("group/cta", className)}>
      {cta.label}
      <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
    </ButtonLink>
  );
}

/** What the CTA prefills in the application. */
export function PreselectNote({
  cta,
  firstName,
  className,
}: {
  cta: MentorCta;
  firstName: string;
  className?: string;
}) {
  if (cta.kind === "closed") return null;
  const text =
    cta.kind === "interest"
      ? `Adds ${firstName} to your application — no time to choose.`
      : cta.preselects
        ? `Preselects ${cta.preselects}.`
        : `Adds ${firstName} to your application.`;
  // Keep times like "11:30 AM CT" on one line.
  const unbroken = text.replace(/ (AM|PM) CT/g, "\u00a0$1\u00a0CT");
  return <p className={cn("font-mono text-xs leading-relaxed text-paper-subtle", className)}>{unbroken}</p>;
}

export function MentorCtaCopy({ cta, className }: { cta: MentorCta; className?: string }) {
  if (cta.kind === "closed") {
    return <p className={cn("text-sm leading-relaxed text-paper-muted", className)}>{cta.reason}</p>;
  }
  const lines =
    cta.kind === "interest"
      ? [INTEREST_COPY.followUp, INTEREST_COPY.noReservation]
      : [APPLICATION_COPY.limited, APPLICATION_COPY.noReservation];
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed text-paper-muted", className)}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function MentorCtaPanel({
  mentor,
  cta,
  className,
}: {
  mentor: Pick<Mentor, "id" | "name" | "firstName" | "headshot" | "availability" | "slots">;
  cta: MentorCta;
  className?: string;
}) {
  return (
    <div className={cn("rounded-sm border border-line-strong bg-ink-850", className)}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="xs" />
        <p className="min-w-0 text-sm leading-snug text-paper">
          <span className="mono-label block text-paper-subtle">Founders Office Hours</span>
          with {mentor.firstName}
        </p>
      </div>
      <div className="space-y-5 px-5 py-5">
        <AvailabilityTicket mentor={mentor} />
        <div className="space-y-2.5">
          <MentorCtaButton cta={cta} size="lg" className="w-full" />
          <PreselectNote cta={cta} firstName={mentor.firstName} />
        </div>
        <MentorCtaCopy cta={cta} />
        {cta.kind !== "closed" ? (
          <p className="border-t border-line pt-4 text-sm leading-relaxed text-paper-subtle">
            One application covers every mentor — you can add others to the same application.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MentorActionBar({ cta, className }: { cta: MentorCta; className?: string }) {
  const note =
    cta.kind === "interest"
      ? INTEREST_COPY.noReservation
      : cta.kind === "apply"
        ? APPLICATION_COPY.noReservation
        : null;
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 -mx-5 border-t border-line-strong bg-ink-900 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8",
        className,
      )}
    >
      <MentorCtaButton cta={cta} size="lg" className="w-full" />
      {note ? <p className="mt-2 text-center text-xs leading-snug text-paper-subtle">{note}</p> : null}
    </div>
  );
}
