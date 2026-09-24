import type { Metadata } from "next";
import { getMentors, getSite } from "@/content";
import { ApplySection } from "@/components/apply/apply-section";
import { MentorGrid } from "@/components/mentors/mentor-card";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container, Notice } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { APPLY_ANCHOR } from "@/lib/schedule/entries";
import { numberWord } from "@/lib/words";

/**
 * Founders Office Hours — the site's primary experience. Four parts, in this order:
 *
 * 1. A short introduction and the Apply button (→ #apply).
 * 2. One grid of mentor cards (`#mentors`); each card's "Select mentor" opens the application
 *    with that mentor preselected, and "Profile" leads to /office-hours/<id>.
 * 3. A brief explanation of how matching works.
 * 4. The application itself (`<ApplySection>`, `#apply`).
 *
 * Dynamic: the application reads ?mentor=…&window=…|slot=… to preselect a mentor, so every mentor
 * action on the site links to /office-hours?mentor=<id>…#apply.
 */

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The one place this sentence appears on the page (the application doesn't repeat it). */
const MATCHING_SENTENCE =
  "Founders will match students by interests and availability and email selected applicants to confirm.";

function namesText(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}

export function generateMetadata(): Metadata {
  const site = getSite();
  const names = getMentors().map((m) => m.name);
  const who = names.length ? `Meet ${namesText(names)} during ${site.week.name}.` : `Office hours during ${site.week.name}.`;
  const description = `${who} Choose who you’d like to meet and apply once.`;
  return {
    title: "Office Hours",
    description: `Founders Office Hours at UIUC. ${description}`,
    alternates: { canonical: "/office-hours" },
    openGraph: { title: "Founders Office Hours", description },
    twitter: { card: "summary_large_image", title: "Founders Office Hours", description },
  };
}

export default async function OfficeHoursPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const site = getSite();
  const mentors = getMentors();
  const applicationsOpen = site.applications.open;
  const count = mentors.length;

  return (
    <>
      {/* 1 · Introduction */}
      <section aria-labelledby="office-hours-title">
        <Container className="pt-12 pb-10 md:pt-20 md:pb-14">
          <h1 id="office-hours-title" className="text-4xl font-bold leading-[1.05] tracking-tight text-text sm:text-5xl">
            Founders Office Hours
          </h1>
          <span aria-hidden className="mt-5 block h-0.5 w-10 rounded-full bg-accent" />
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
            {count
              ? `${numberWord(count, { capitalize: true })} founders and investors are making time for students during ${site.week.name}.`
              : `Founders and investors are making time for students during ${site.week.name}.`}{" "}
            Choose who you’d like to meet and apply once.
          </p>
          <div className="mt-8">
            {/* Fragment-only on purpose: it scrolls to the application and never re-selects the mentor
                a `?mentor=…` URL preselected (the student may have removed them since). */}
            <a href={`#${APPLY_ANCHOR}`} className={buttonClasses({ size: "lg", className: "group/cta" })}>
              {PRIMARY_CTA_LABEL}
              <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
            </a>
          </div>
          {!applicationsOpen ? (
            <p className="mt-4 text-sm text-text-muted">
              We aren’t taking office-hours applications right now.
            </p>
          ) : null}
        </Container>
      </section>

      {/* 2 · Who you can meet */}
      <section id="mentors" aria-labelledby="mentors-heading">
        <Container className="pb-16 md:pb-24">
          <h2 id="mentors-heading" className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Who you can meet
          </h2>
          {count && applicationsOpen ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
              Select anyone you’d like to meet and they’ll be added to your application below.
            </p>
          ) : null}
          {count ? (
            <MentorGrid mentors={mentors} applicationsOpen={applicationsOpen} className="mt-8" />
          ) : (
            <Notice title="Mentors are being confirmed" className="mt-8">
              We’ll list mentors here as soon as they’re confirmed. You can still apply below.
            </Notice>
          )}
        </Container>
      </section>

      {/* 3 · How matching works */}
      <section aria-labelledby="matching-heading" className="border-y border-line bg-surface-subtle">
        <Container className="py-16 md:py-20">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
            <h2
              id="matching-heading"
              className="text-2xl font-semibold tracking-tight text-text sm:text-3xl lg:col-span-4"
            >
              How matching works
            </h2>
            <div className="max-w-2xl space-y-4 text-base leading-relaxed text-text-muted sm:text-lg lg:col-span-8">
              <p>
                Tell us what you’re working on and when you’re free. If a mentor’s times aren’t set yet, share
                your general availability instead.
              </p>
              <p className="text-text">{MATCHING_SENTENCE}</p>
              <p>Appointments are limited, and applying doesn’t reserve a time.</p>
            </div>
          </div>
        </Container>
      </section>

      {/* 4 · The application */}
      <Container className="py-16 md:py-24">
        <ApplySection searchParams={params} />
      </Container>
    </>
  );
}
