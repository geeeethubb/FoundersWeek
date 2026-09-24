"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
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
    <section aria-labelledby="error-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
      <Container className="pb-16 pt-10 md:pb-24 md:pt-16">
        <p className="mono-label flex items-center gap-2.5 text-paper-muted">
          <span className="text-danger">Error</span>
          <span aria-hidden className="h-px w-4 bg-line-strong" />
          Something went wrong
        </p>
        <h1
          id="error-title"
          ref={heading}
          tabIndex={-1}
          className="mt-5 max-w-3xl font-wide text-[2.5rem] font-bold leading-[0.95] tracking-[-0.04em] text-paper focus:outline-none sm:text-6xl"
        >
          This page didn’t load.{" "}
          <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em]">Let’s try that again.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted" role="status">
          It’s probably temporary. Try again — or head to Office Hours or the Calendar, which may still be working.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => retry()} className={buttonClasses({ size: "lg" })}>
            Try again
          </button>
          <Link href="/office-hours" className={buttonClasses({ variant: "secondary", size: "lg", className: "group/oh" })}>
            Office Hours
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/oh:translate-x-0.5" />
          </Link>
          <Link
            href="/schedule"
            className="inline-flex min-h-12 items-center gap-2 px-1 text-[0.9375rem] text-paper-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper hover:decoration-paper/60"
          >
            Calendar
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-10 font-mono text-xs text-paper-subtle">
            Reference <span className="tabular text-paper-muted">{error.digest}</span>
          </p>
        ) : null}
      </Container>
    </section>
  );
}
