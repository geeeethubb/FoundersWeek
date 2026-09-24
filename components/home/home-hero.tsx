/**
 * HomeHero — the home page opens on Founders Office Hours (priority 1): the opportunity, the
 * primary "Apply for Office Hours" CTA (→ /office-hours#apply), "Meet the mentors" (→ /office-hours),
 * a quiet link to the Calendar, and — in the hero itself — every mentor in the MentorRoster.
 *
 * Layout: copy and roster side by side from `xl` (both above the fold at 1440 × 900); stacked
 * below (copy → CTAs → roster), so on a 390px phone the first mentor appears within the first
 * screen. Server component.
 */
import Link from "next/link";
import type { Mentor, SiteSettings } from "@/content/types";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import type { AppearanceView } from "@/lib/mentors-view";
import { applyHref } from "@/lib/schedule/entries";
import { plural } from "@/lib/schedule/format";
import { numberWord } from "./home-model";
import { MentorRoster } from "./mentor-roster";
import { OrbitField } from "./orbit-field";

export function HomeHero({
  site,
  mentors,
  appearances,
  range,
  entryCount,
  dayCount,
}: {
  site: SiteSettings;
  mentors: Mentor[];
  appearances: Record<string, AppearanceView[]>;
  /** "Mon Sep 28 – Sat Oct 3" (null when the calendar is empty). */
  range: string | null;
  entryCount: number;
  dayCount: number;
}) {
  const count = mentors.length;
  const open = site.applications.open;

  return (
    <section aria-labelledby="home-title" className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
      {/* Centered behind the roster on wide screens (its orange arc rides out into the margin). */}
      <OrbitField className="absolute -right-[28rem] -top-[25rem] -z-10 hidden w-[56rem] max-w-none md:block xl:left-[calc(50%-15.5rem)] xl:right-auto xl:top-[-9.75rem] xl:w-[62rem]" />

      {/*
        Grid: copy (row 1) and the calendar link (row 2) on the left, the roster spanning both rows on
        the right. Stacked below xl in reading order copy → roster → calendar link, so phones reach
        the mentors sooner.
      */}
      <Container className="grid gap-x-12 gap-y-10 pb-12 pt-6 sm:pt-8 md:pb-16 md:pt-12 xl:grid-cols-12 xl:gap-y-5 xl:pb-14 xl:pt-10">
        <div className="xl:col-span-5 xl:self-end">
          <p className="mono-label flex flex-wrap items-center gap-x-2.5 gap-y-1 text-paper-muted">
            <span>
              {site.week.name} {site.week.year}
            </span>
            <span aria-hidden className="h-px w-4 bg-line-strong" />
            <span>UIUC</span>
            {range ? (
              <>
                <span aria-hidden className="h-px w-4 bg-line-strong" />
                <span className="tabular">{range}</span>
              </>
            ) : null}
          </p>

          <h1
            id="home-title"
            className="mt-5 font-wide text-[2.625rem] font-bold leading-[0.92] tracking-[-0.045em] text-paper sm:mt-6 sm:text-6xl md:text-7xl xl:text-[3.75rem]"
          >
            Office hours with founders{" "}
            <span className="font-serif text-[1.1em] font-normal italic leading-[0.9] tracking-[-0.02em]">
              &amp; operators.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper-muted sm:mt-6 sm:text-lg">
            <span className="font-serif text-[1.2em] italic leading-none text-paper">{site.tagline}</span>{" "}
            {count
              ? `${numberWord(count, { capitalize: true })} experienced founders and operators are holding one-on-one office hours during ${site.week.name}.`
              : `Founders and operators are holding one-on-one office hours during ${site.week.name}.`}{" "}
            One application covers every mentor — Founders matches students on interests and availability.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={applyHref()} className={buttonClasses({ size: "lg", className: "group/cta" })}>
              {PRIMARY_CTA_LABEL}
              <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
            </Link>
            <Link href="/office-hours" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Meet the mentors
            </Link>
          </div>
          {!open ? (
            <p className="mt-4 text-sm text-paper-muted">
              The office-hours application isn’t accepting submissions right now.
            </p>
          ) : null}
        </div>

        <MentorRoster
          mentors={mentors}
          appearances={appearances}
          applicationsOpen={open}
          className="xl:col-span-7 xl:col-start-6 xl:row-span-2 xl:row-start-1 xl:self-center"
        />

        <p className="-mt-4 text-[0.9375rem] text-paper-muted xl:col-span-5 xl:mt-0 xl:self-start">
          <Link
            href="/schedule"
            className="group/cal inline-flex min-h-11 items-center gap-2 rounded-xs transition-colors duration-150 hover:text-paper"
          >
            <span>
              Or browse the{" "}
              <span className="text-paper underline decoration-line-strong underline-offset-[5px] transition-colors group-hover/cal:decoration-paper/60">
                Calendar
              </span>
              {entryCount ? (
                <span className="font-mono text-[0.8125rem] tabular text-paper-subtle">
                  {" "}
                  · {plural(entryCount, "entry", "entries")}, {plural(dayCount, "day", "days")}
                </span>
              ) : null}
            </span>
            <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover/cal:translate-x-0.5" />
          </Link>
        </p>
      </Container>
    </section>
  );
}
