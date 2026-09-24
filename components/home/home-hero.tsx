/**
 * HomeHero — the compact opening of the home page: the headline, one sentence explaining Founders
 * Week office hours, and the primary action ("Apply for Office Hours" → /office-hours#apply) with a
 * quiet link to the mentors. When the application is switched off, the primary action becomes the
 * mentors page and the hero says applications are closed.
 *
 * Layout: stacked up to `xl`; from `xl` the headline sits left and the sentence and actions right,
 * bottom-aligned, so the mentors below stay on the first screen.
 *
 * Server component.
 */
import Link from "next/link";
import type { SiteSettings } from "@/content/types";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { applyHref } from "@/lib/schedule/entries";
import { formatDeadline } from "@/lib/time";
import { officeHoursSentence } from "./home-model";

export function HomeHero({ site }: { site: SiteSettings }) {
  const open = site.applications.open;
  const deadline = open && site.applications.deadline ? formatDeadline(site.applications.deadline) : null;

  return (
    <section aria-labelledby="home-title">
      <Container className="grid pb-12 pt-12 md:pb-12 md:pt-16 xl:grid-cols-12 xl:items-end xl:gap-x-12">
        <div className="xl:col-span-7">
          <p className="flex items-center gap-3 text-sm font-semibold text-accent-strong">
            <span aria-hidden className="h-0.5 w-8 rounded-full bg-accent" />
            Founders Office Hours
          </p>
          <h1
            id="home-title"
            className="mt-5 max-w-3xl text-[2.5rem] font-bold leading-[1.06] tracking-tight text-text sm:text-5xl lg:text-[3.5rem]"
          >
            Meet the people building what’s next.
          </h1>
        </div>

        <div className="xl:col-span-5 xl:pb-1">
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-muted xl:mt-0">{officeHoursSentence(site)}</p>
          <div className="mt-8 flex flex-col items-start gap-x-7 gap-y-4 sm:flex-row sm:items-center xl:mt-7">
            {open ? (
              <Link href={applyHref()} className={buttonClasses({ size: "lg", className: "group/cta font-semibold" })}>
                {PRIMARY_CTA_LABEL}
                <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
              </Link>
            ) : (
              <Link href="/office-hours" className={buttonClasses({ size: "lg", className: "font-semibold" })}>
                Meet the mentors
              </Link>
            )}
            {open ? (
              <Link
                href="/office-hours"
                className="inline-flex min-h-11 items-center rounded-xs text-[0.9375rem] font-medium text-charcoal underline decoration-line-strong decoration-1 underline-offset-[6px] transition-colors hover:decoration-accent"
              >
                Meet the mentors
              </Link>
            ) : null}
          </div>
          {!open ? (
            <p className="mt-4 text-sm text-text-subtle">Applications are closed right now.</p>
          ) : deadline ? (
            <p className="mt-4 text-sm text-text-subtle">Apply by {deadline}.</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
