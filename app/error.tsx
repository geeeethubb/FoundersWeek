"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

/**
 * Route error boundary (client). Says what happened without leaking details, offers "Try again"
 * (`retry` re-fetches and re-renders the segment — Next 16.3), and keeps the way to Office Hours
 * and the Calendar open. Focus moves to the heading so keyboard and screen-reader users land on
 * the message.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    heading.current?.focus();
  }, [error]);

  return (
    <section aria-labelledby="error-title">
      <Container className="pb-8 pt-16 md:pt-24">
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-sm font-semibold text-accent-strong">
            <span aria-hidden className="h-0.5 w-8 rounded-full bg-accent" />
            Something went wrong
          </p>
          <h1
            id="error-title"
            ref={heading}
            tabIndex={-1}
            className="mt-5 text-[2.25rem] font-bold leading-[1.1] tracking-tight text-text focus:outline-none sm:text-5xl"
          >
            This page didn’t load.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-text-muted" role="status">
            It’s probably temporary. Try again, or go to Office Hours or the Calendar.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" onClick={() => retry()} className={buttonClasses({ size: "lg", className: "font-semibold" })}>
              Try again
            </button>
            <Link href="/office-hours" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Office Hours
            </Link>
            <Link href="/schedule" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Calendar
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-10 text-xs text-text-subtle">
              Reference <span className="tabular text-text-muted">{error.digest}</span>
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
