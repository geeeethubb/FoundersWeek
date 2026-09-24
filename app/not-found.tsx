import type { Metadata } from "next";
import Link from "next/link";
import { getSite } from "@/content";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { applyHref } from "@/lib/schedule/entries";

// Next.js adds `noindex` to 404 responses itself.
export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * 404 — say so plainly and calmly, then point to what matters: Office Hours (the application
 * lives there) and the Calendar, with home as a quiet last option.
 */
export default function NotFound() {
  const open = getSite().applications.open;
  return (
    <section aria-labelledby="not-found-title">
      <Container className="pb-8 pt-16 md:pt-24">
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-sm font-semibold text-accent-strong">
            <span aria-hidden className="h-0.5 w-8 rounded-full bg-accent" />
            Page not found
          </p>
          <h1
            id="not-found-title"
            className="mt-5 text-[2.25rem] font-bold leading-[1.1] tracking-tight text-text sm:text-5xl"
          >
            We couldn’t find that page.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-text-muted">
            The link might be out of date, or the page may have moved. You’ll find office hours and the application on
            the Office Hours page, and every event on the Calendar.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {open ? (
              <Link href={applyHref()} className={buttonClasses({ size: "lg", className: "group/cta font-semibold" })}>
                {PRIMARY_CTA_LABEL}
                <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
              </Link>
            ) : (
              <Link href="/office-hours" className={buttonClasses({ size: "lg", className: "font-semibold" })}>
                Office Hours
              </Link>
            )}
            <Link href="/schedule" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Calendar
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-xs text-[0.9375rem] font-medium text-charcoal underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-accent sm:ml-3"
            >
              Home
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
