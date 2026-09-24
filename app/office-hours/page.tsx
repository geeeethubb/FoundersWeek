import type { Metadata } from "next";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import { ApplySection } from "@/components/apply/apply-section";
import { AvailabilityLegend } from "@/components/mentors/availability-legend";
import { HowItWorks } from "@/components/mentors/how-it-works";
import { MentorLineup } from "@/components/mentors/mentor-lineup";
import { MentorSections } from "@/components/mentors/mentor-sections";
import { InvolvementBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon, ChevronDownIcon } from "@/components/ui/icons";
import { Container, Eyebrow, Notice, SectionHeading } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { appearancesByMentor } from "@/lib/mentors-view";
import { APPLY_ANCHOR } from "@/lib/schedule/entries";
import { TZ_NAME } from "@/lib/time";

/**
 * Founders Office Hours — the site's primary experience.
 *
 * Hero (the opportunity + "Apply for Office Hours") → the lineup (every mentor, equal weight, at the
 * fold) → a full section per mentor → how it works + availability key → the application (#apply).
 * Dynamic: the application reads ?mentor=…&window=…|slot=… to preselect a mentor, so every mentor
 * CTA on the site links to /office-hours?mentor=<id>…#apply.
 */

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

export function generateMetadata(): Metadata {
  const mentors = getMentors();
  const names = mentors.map((m) => m.name);
  const who =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "founders and operators");
  return {
    title: "Office Hours",
    description: `Apply for Founders Office Hours: meet ${who} one-on-one during Founders Week at UIUC. One application, no account needed.`,
    alternates: { canonical: "/office-hours" },
    openGraph: {
      title: "Founders Office Hours",
      description: `Meet ${who} one-on-one during Founders Week at UIUC.`,
    },
    twitter: {
      card: "summary_large_image",
      title: "Founders Office Hours",
      description: `Meet ${who} one-on-one during Founders Week at UIUC.`,
    },
  };
}

export default async function OfficeHoursPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const site = getSite();
  const mentors = getMentors();
  const appearances = appearancesByMentor(getScheduleEntries(), mentors);
  const applicationsOpen = site.applications.open;
  const count = mentors.length;

  const facts = [
    count ? `${count} ${count === 1 ? "mentor" : "mentors"}` : "Mentors being confirmed",
    "One application",
    TZ_NAME,
    "No account needed",
  ];

  return (
    <>
      {/* ── Hero + lineup: the opportunity and every mentor, at the fold ───────────────── */}
      <section aria-labelledby="office-hours-title" className="relative isolate overflow-hidden">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
        <Container className="pt-7 md:pt-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>
              Founders Office Hours · {site.week.name} {site.week.year}
            </Eyebrow>
            <InvolvementBadge involvement="hosted" />
          </div>

          {/*
            Mobile reads headline → pitch → CTA → facts. On desktop the facts tuck under the headline
            so both columns are the same height and the lineup rises above the fold.
          */}
          <div className="mt-5 grid gap-6 md:mt-6 lg:grid-cols-12 lg:items-end lg:gap-x-12 lg:gap-y-5">
            <h1
              id="office-hours-title"
              className="font-wide text-[2.75rem] font-bold leading-[0.9] tracking-[-0.045em] text-paper sm:text-6xl lg:col-span-7 lg:text-[4.75rem]"
            >
              Meet founders{" "}
              <span className="block font-serif text-[1.12em] font-normal italic leading-[0.95] tracking-[-0.02em]">
                one-on-one.
              </span>
            </h1>

            <div className="lg:col-span-5 lg:row-span-2 lg:pb-0.5">
              <p className="max-w-xl text-base leading-relaxed text-paper-muted sm:text-lg">
                {count
                  ? `${numberWord(count)} experienced founders and operators`
                  : "Experienced founders and operators"}{" "}
                are holding office hours during {site.week.name}. Apply once, tell us who you’d like to meet, and
                Founders will match you on interests and availability.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <a href={`#${APPLY_ANCHOR}`} className={buttonClasses({ size: "lg", className: "group/cta" })}>
                  {PRIMARY_CTA_LABEL}
                  <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex h-11 items-center gap-1.5 rounded-xs text-[0.9375rem] text-paper-muted underline-offset-4 transition-colors duration-150 hover:text-paper hover:underline"
                >
                  How it works
                  <ChevronDownIcon className="size-4" />
                </a>
              </div>
              {!applicationsOpen ? (
                <p className="mt-4 text-sm text-paper-muted">
                  The office-hours application isn’t accepting submissions right now.
                </p>
              ) : null}
            </div>

            <ul
              aria-label="At a glance"
              className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs leading-5 text-paper-muted lg:col-span-7 lg:row-start-2"
            >
              {facts.map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <span aria-hidden className="size-1 rotate-45 bg-accent" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </Container>

        <section id="mentors" aria-labelledby="lineup-heading" className="scroll-mt-24">
          <Container className="pt-9 pb-4 md:pt-10 md:pb-10">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-line pb-3">
              <h2 id="lineup-heading" className="mono-label flex items-center gap-2 text-paper">
                <span aria-hidden className="text-accent">
                  ◆
                </span>
                The lineup
              </h2>
              <p className="mono-label text-paper-subtle tabular">
                {String(count).padStart(2, "0")} {count === 1 ? "mentor" : "mentors"}
                <span className="hidden sm:inline"> · Every one in a single application</span>
              </p>
            </div>
            {count ? (
              <MentorLineup mentors={mentors} applicationsOpen={applicationsOpen} priority />
            ) : (
              <Notice title="Mentors are being confirmed">
                Mentors will be listed here as soon as they’re confirmed. You can still apply below.
              </Notice>
            )}
          </Container>
        </section>
      </section>

      {/* ── Every mentor in full ─────────────────────────────────────────────────────── */}
      {count ? (
        <section aria-labelledby="mentor-details-heading" className="border-t border-line">
          <Container className="pt-14 md:pt-20">
            <SectionHeading
              id="mentor-details-heading"
              eyebrow="The mentors"
              title="Who you can meet"
              lede="Verified details only: background, expertise and where each mentor appears during Founders Week. Topics and appointment times are added as mentors confirm them."
            />
            <MentorSections
              mentors={mentors}
              appearances={appearances}
              applicationsOpen={applicationsOpen}
              className="mt-10 md:mt-14"
            />
          </Container>
        </section>
      ) : null}

      {/* ── How it works + reading availability ─────────────────────────────────────── */}
      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-24 border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <Eyebrow className="mb-4">How it works</Eyebrow>
              <h2
                id="how-it-works-heading"
                className="font-wide text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-paper sm:text-4xl"
              >
                Apply once.{" "}
                <span className="block font-serif text-[1.08em] font-normal italic tracking-[-0.01em]">
                  We handle the match.
                </span>
              </h2>
            </div>
            <HowItWorks layout="row" className="lg:col-span-8" />
          </div>

          <div className="mt-14 md:mt-16">
            <h3 className="mono-label mb-4 text-paper-subtle">Reading availability · line style = certainty</h3>
            <AvailabilityLegend variant="compact" />
          </div>
        </Container>
      </section>

      {/* ── The application: the goal of the page ───────────────────────────────────── */}
      <div className="relative isolate border-t border-line bg-ink-950">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]" />
        <Container className="py-14 md:py-24">
          <div className="relative border-t-2 border-accent pt-10 md:rounded-sm md:border md:border-line-strong md:bg-ink-900 md:px-10 md:pt-14 md:pb-14 lg:px-14">
            {/* Registration corners — the frame of the page's goal. */}
            <span
              aria-hidden
              className="absolute -top-px -left-px hidden size-5 border-t-2 border-l-2 border-accent md:block"
            />
            <span
              aria-hidden
              className="absolute -top-px -right-px hidden size-5 border-t-2 border-r-2 border-accent md:block"
            />
            <span
              aria-hidden
              className="absolute -bottom-px -left-px hidden size-5 border-b-2 border-l-2 border-accent md:block"
            />
            <span
              aria-hidden
              className="absolute -right-px -bottom-px hidden size-5 border-r-2 border-b-2 border-accent md:block"
            />
            <ApplySection searchParams={params} />
          </div>
        </Container>
      </div>
    </>
  );
}
