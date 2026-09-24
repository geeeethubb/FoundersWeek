import type { Metadata } from "next";
import Link from "next/link";
import { getMentors } from "@/content";
import { OrbitField } from "@/components/home/orbit-field";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { mentorProfileHref } from "@/lib/mentors-view";
import { applyHref } from "@/lib/schedule/entries";

// Next.js adds `noindex` to 404 responses itself.
export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * 404 — say so plainly, then route people to what matters most, in priority order:
 * Founders Office Hours (apply / meet the mentors, with every mentor's profile one click away),
 * then the Calendar, then home.
 */
export default function NotFound() {
  const mentors = getMentors();
  const destinations = [
    {
      href: "/office-hours",
      title: "Founders Office Hours",
      body: "Meet the mentors and apply for one-on-one time — one application covers every mentor.",
    },
    { href: "/schedule", title: "Calendar", body: "Every Founders Week event, in order, with Founders’ involvement labeled." },
    { href: "/", title: "Home", body: "The guide’s front page: office hours first, then the week’s featured events." },
  ];

  return (
    <section aria-labelledby="not-found-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
      <OrbitField className="absolute -right-[24rem] -top-[20rem] -z-10 hidden w-[56rem] max-w-none md:block" />
      <Container className="pb-8 pt-10 md:pb-12 md:pt-16">
        <p className="mono-label flex items-center gap-2.5 text-paper-muted">
          <span className="text-accent tabular">404</span>
          <span aria-hidden className="h-px w-4 bg-line-strong" />
          Page not found
        </p>
        <h1
          id="not-found-title"
          className="mt-5 max-w-3xl font-wide text-[2.5rem] font-bold leading-[0.95] tracking-[-0.04em] text-paper sm:text-6xl"
        >
          This page isn’t on the map.{" "}
          <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em]">Here’s what is.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">
          The link may be out of date, or the page may have moved. The office-hours application now lives on the Office
          Hours page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={applyHref()} className={buttonClasses({ size: "lg", className: "group/cta" })}>
            {PRIMARY_CTA_LABEL}
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
          </Link>
          <Link href="/schedule" className={buttonClasses({ variant: "secondary", size: "lg" })}>
            Open the Calendar
          </Link>
        </div>

        <nav aria-label="Where to next" className="mt-14 md:mt-16">
          <ol className="divide-y divide-line border-y border-line">
            {destinations.map((d, i) => (
              <li key={d.href}>
                <Link
                  href={d.href}
                  className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-5 transition-colors sm:grid-cols-[3rem_16rem_minmax(0,1fr)_auto]"
                >
                  <span className="font-mono text-sm text-accent tabular">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-wide text-lg font-bold tracking-[-0.02em] text-paper underline-offset-[5px] decoration-accent decoration-2 group-hover:underline">
                    {d.title}
                  </span>
                  <span className="col-start-2 text-sm leading-relaxed text-paper-muted sm:col-start-auto">{d.body}</span>
                  <ArrowRightIcon className="col-start-3 row-start-1 size-4 self-center text-paper-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-paper sm:col-start-4" />
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        {mentors.length ? (
          <div className="mt-12">
            <h2 className="mono-label text-paper-subtle">Looking for a mentor?</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {mentors.map((m) => (
                <li key={m.id}>
                  <Link
                    href={mentorProfileHref(m.id)}
                    className="group inline-flex min-h-11 items-center gap-3 rounded-sm border border-line py-1.5 pl-1.5 pr-4 transition-colors hover:border-line-strong"
                  >
                    <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="xs" />
                    <span className="text-sm font-medium text-paper">{m.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
