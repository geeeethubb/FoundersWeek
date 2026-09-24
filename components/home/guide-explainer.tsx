/**
 * GuideExplainer — "Founders vs. Founders Week": the student org vs. the broader series, that this
 * site is a student-curated guide, and the badge legend (Hosted / Co-hosted / Supported by Founders /
 * Part of Founders Week / Related event) with how many listings carry each label — all computed
 * from the schedule entries.
 *
 * Props
 * - `site`: SiteSettings (org and week names/descriptions).
 * - `entries`: every public ScheduleEntry.
 * Server component.
 */
import Link from "next/link";
import type { SiteSettings } from "@/content/types";
import { InvolvementBadge, RelatedBadge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { INVOLVEMENT_DESCRIPTIONS, type ScheduleEntry } from "@/lib/schedule/entries";
import { listText, plural } from "@/lib/schedule/format";
import { scheduleHref } from "@/lib/schedule/url";
import {
  foundersListingCount,
  involvementSummaries,
  liveEntries,
  relatedSummary,
  titlesPreview,
  type LabelSummary,
} from "./home-model";

export function GuideExplainer({ site, entries }: { site: SiteSettings; entries: ScheduleEntry[] }) {
  const total = liveEntries(entries).length;
  const founders = foundersListingCount(entries);
  const summaries = involvementSummaries(entries);
  const week = summaries.find((s) => s.involvement === "week");
  const related = relatedSummary(entries);

  return (
    <section aria-labelledby="guide-heading" className="border-b border-line">
      <Container className="py-14 md:py-20">
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Eyebrow className="mb-4">Reading this guide</Eyebrow>
            <h2
              id="guide-heading"
              className="font-wide text-[2rem] font-bold leading-[1.02] tracking-[-0.03em] text-paper sm:text-[2.5rem]"
            >
              {site.org.shortName}{" "}
              <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.01em] text-paper-muted">vs.</span>{" "}
              {site.week.name}
            </h2>
            <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-paper-muted">
              This site is a <span className="text-paper">student-curated guide</span> to {site.week.name}, made by{" "}
              {site.org.name}. It isn’t an official {site.university} publication.
            </p>
          </div>

          <dl className="grid border-y border-line sm:grid-cols-2 lg:col-span-8">
            <div className="py-6 sm:pr-8">
              <dt className="font-wide text-xl font-bold tracking-[-0.02em] text-paper">
                {site.org.shortName}
                <span className="mono-label ml-3 align-middle text-accent">The student org</span>
              </dt>
              <dd className="mt-3 text-[0.9375rem] leading-relaxed text-paper-muted">
                {site.org.description}
                {founders > 0 && total
                  ? ` ${founders} of the ${total} listings here are hosted, co-hosted or supported by ${site.org.shortName} — starting with Founders Office Hours.`
                  : null}
              </dd>
            </div>
            <div className="border-t border-line py-6 sm:border-l sm:border-t-0 sm:pl-8">
              <dt className="font-wide text-xl font-bold tracking-[-0.02em] text-paper">
                {site.week.name}
                <span className="mono-label ml-3 align-middle text-paper-subtle">The series</span>
              </dt>
              <dd className="mt-3 text-[0.9375rem] leading-relaxed text-paper-muted">
                The broader series of events at the {site.university}, mostly organized by other groups.
                {week && total ? ` ${week.count} of the ${total} listings here are part of the wider program.` : null} We
                never imply {site.org.shortName} runs an event it doesn’t.
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-12 md:mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-strong pb-3">
            <h3 className="mono-label text-paper">How listings are labeled</h3>
            <p className="mono-label text-paper-subtle">Only when a source supports it</p>
          </div>
          <ul className="divide-y divide-line">
            {summaries.map((s) => (
              <LegendRow
                key={s.involvement}
                badge={<InvolvementBadge involvement={s.involvement} />}
                description={INVOLVEMENT_DESCRIPTIONS[s.involvement]}
                summary={s}
              />
            ))}
            <LegendRow
              badge={<RelatedBadge />}
              description="Related to Founders Week, outside the official program."
              summary={related}
            />
          </ul>
          <Link
            href={scheduleHref()}
            className="group/legend mt-4 inline-flex min-h-11 items-center gap-2 rounded-xs text-sm font-medium text-paper-muted transition-colors hover:text-paper"
          >
            See every label in the Calendar
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/legend:translate-x-0.5" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function LegendRow({
  badge,
  description,
  summary,
}: {
  badge: React.ReactNode;
  description: string;
  summary: LabelSummary;
}) {
  const { shown, more } = titlesPreview(summary.titles);
  return (
    <li className="grid gap-x-8 gap-y-2 py-4 md:grid-cols-12 md:items-baseline">
      <span className="md:col-span-3">{badge}</span>
      <span className="text-sm leading-relaxed text-paper-muted md:col-span-4">{description}</span>
      <span className="text-sm leading-relaxed md:col-span-5">
        <span className="font-mono text-[0.8125rem] tabular text-paper">{plural(summary.count, "listing", "listings")}</span>
        {shown.length ? (
          <span className="text-paper-muted">
            {" "}
            · {listText(more ? [...shown, `${more} more`] : shown)}
          </span>
        ) : null}
      </span>
    </li>
  );
}
