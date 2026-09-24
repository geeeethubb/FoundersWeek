/**
 * ClosingCta — the page ends where it began: the primary "Apply for Office Hours" CTA, with the
 * mentors' portraits as a compact row and the application promise in the shared wording.
 *
 * Props
 * - `mentors`: public mentors (portraits + names; names are listed for screen readers and as text).
 * - `applicationsOpen`: `site.applications.open`.
 * Server component.
 */
import Link from "next/link";
import type { Mentor } from "@/content/types";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { applyHref } from "@/lib/schedule/entries";
import { listText } from "@/lib/schedule/format";

export function ClosingCta({ mentors, applicationsOpen }: { mentors: Mentor[]; applicationsOpen: boolean }) {
  return (
    // -mb-24 cancels the footer's top margin so this band runs straight into the (same-colored) footer.
    <section aria-labelledby="closing-heading" className="relative isolate -mb-24 overflow-hidden bg-ink-950">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
      <Container className="grid gap-x-12 gap-y-8 py-14 md:py-20 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          {mentors.length ? (
            <ul aria-label="Mentors" className="flex flex-wrap gap-2">
              {mentors.map((m) => (
                <li key={m.id}>
                  <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="md" />
                  <span className="sr-only">{m.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <h2
            id="closing-heading"
            className="mt-7 font-wide text-[2.25rem] font-bold leading-[0.98] tracking-[-0.04em] text-paper sm:text-5xl"
          >
            One application.{" "}
            <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.01em]">Every mentor.</span>
          </h2>
          {mentors.length ? (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-paper-muted">
              Tell us who you’d like to meet — {listText(mentors.map((m) => m.firstName))} — and what you’re working on.
              It takes about five minutes.
            </p>
          ) : null}
        </div>
        <div className="lg:col-span-5 lg:justify-self-end">
          <Link href={applyHref()} className={buttonClasses({ size: "lg", className: "group/cta w-full sm:w-auto" })}>
            {PRIMARY_CTA_LABEL}
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
          </Link>
          <p className="mt-3 max-w-xs text-[0.8125rem] leading-relaxed text-paper-subtle">
            {applicationsOpen ? APPLICATION_COPY.noReservation : "The application isn’t accepting submissions right now."}
          </p>
        </div>
      </Container>
    </section>
  );
}
