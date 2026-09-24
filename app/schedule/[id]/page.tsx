import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentors, getScheduleEntries, getScheduleEntry, getSite } from "@/content";
import { AgendaPreview } from "@/components/schedule/agenda-preview";
import { EntryBadges } from "@/components/schedule/entry-badges";
import { EntryLinks } from "@/components/schedule/entry-links";
import {
  CalendarActions,
  EventCallout,
  EventFacts,
  EventPrimaryAction,
  hasPrimaryAction,
  ProgramTimeline,
  SourcesList,
  TopicList,
} from "@/components/schedule/event-detail";
import { MentorMarker } from "@/components/schedule/program-sessions";
import { ShareActions } from "@/components/schedule/share-actions";
import { FeaturedMark, isFeatured } from "@/components/schedule/time-gutter";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { googleCalendarUrl } from "@/lib/calendar/google";
import { getSiteUrl } from "@/lib/config";
import { EVENT_TYPE_LABELS, type ScheduleEntry } from "@/lib/schedule/entries";
import { overlapsFor } from "@/lib/schedule/filter";
import { dayLabels, entryTimeText, paragraphs } from "@/lib/schedule/format";
import { mentorProfileHref, sessionCountLabel } from "@/lib/schedule/program";
import { eventHref, scheduleHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";

type EventPageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getScheduleEntries().map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = getScheduleEntry(id);
  if (!entry) return { title: "Event not found", robots: { index: false } };
  const site = getSite();
  const when = `${dayLabels(entry.date).long} · ${entryTimeText(entry)}`;
  const description = `${when}. ${entry.summary}`;
  return {
    title: entry.title,
    description,
    alternates: { canonical: eventHref(entry.id) },
    robots: entry.demo ? { index: false } : undefined,
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      title: entry.title,
      description,
      url: eventHref(entry.id),
    },
    twitter: { card: "summary_large_image", title: entry.title, description },
  };
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mono-label text-paper-subtle">
      {children}
    </h2>
  );
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const entry = getScheduleEntry(id);
  if (!entry) notFound();

  const all = getScheduleEntries();
  const overlaps = overlapsFor(entry, all);
  const overlapIds = new Set(overlaps.map((o) => o.id));
  const sameDay = all.filter((e) => e.date === entry.date && e.id !== entry.id && !overlapIds.has(e.id));
  const day = dayLabels(entry.date);
  const isOfficeHours = entry.kind === "office-hours";
  const canceled = entry.status === "canceled";
  const googleHref = googleCalendarUrl(entry, getSiteUrl());
  const body = paragraphs(entry.description);

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
        <Container className="pb-10 pt-6 md:pb-14 md:pt-10">
          <Link
            href={scheduleHref({ day: entry.date })}
            className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-xs px-1 font-mono text-[0.75rem] uppercase tracking-[0.1em] text-paper-muted transition-colors hover:text-paper"
          >
            <ArrowLeftIcon className="size-3.5" />
            Calendar · {day.long}
          </Link>

          <div className="mt-6 max-w-4xl md:mt-10">
            <p className="mono-label flex flex-wrap items-center gap-x-3 gap-y-1 text-paper-muted">
              {isFeatured(entry) ? (
                <>
                  <FeaturedMark rank={entry.featuredRank!} />
                  <span aria-hidden className="h-px w-5 bg-line-strong max-sm:hidden" />
                </>
              ) : null}
              <span>{entry.types.map((t) => EVENT_TYPE_LABELS[t]).join(" · ")}</span>
              <span aria-hidden className="h-px w-5 bg-line-strong max-sm:hidden" />
              <span className="tabular">
                {day.mono} · {entryTimeText(entry, { zone: false })}
              </span>
              {entry.sessions.length ? (
                <>
                  <span aria-hidden className="h-px w-5 bg-line-strong max-sm:hidden" />
                  <a href="#program-heading" className="tabular underline decoration-line-strong underline-offset-4 hover:text-paper">
                    {sessionCountLabel(entry.sessions.length)}
                  </a>
                </>
              ) : null}
            </p>
            <h1
              className={cn(
                "mt-5 font-wide text-4xl font-bold leading-[0.98] tracking-[-0.035em] sm:text-5xl md:text-6xl",
                canceled ? "text-paper-muted" : "text-paper",
              )}
            >
              {entry.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">{entry.summary}</p>
            <EntryBadges entry={entry} className="mt-6" />
          </div>
        </Container>
      </header>

      <Container className="grid gap-x-12 gap-y-14 pt-10 md:grid-cols-12 md:pt-14">
        {/* Facts + actions first on mobile; right rail on desktop. */}
        <aside aria-label="Event details" className="md:order-2 md:col-span-5 lg:col-span-4 lg:col-start-9">
          <div className="md:sticky md:top-[calc(4rem+1px+1.5rem)]">
            <EventFacts entry={entry} />
            {hasPrimaryAction(entry) ? (
              <div className="mt-6">
                <EventPrimaryAction entry={entry} />
              </div>
            ) : null}
            {entry.links.length && !canceled ? (
              <section aria-labelledby="links-heading" className="mt-6">
                <h2 id="links-heading" className="sr-only">
                  Official links
                </h2>
                <EntryLinks links={entry.links} variant="button" />
              </section>
            ) : null}
            <section aria-labelledby="calendar-heading" className="mt-8">
              <SectionTitle id="calendar-heading">Add to calendar</SectionTitle>
              <div className="mt-3">
                <CalendarActions entry={entry} icsHref={`${eventHref(entry.id)}/calendar.ics`} googleHref={googleHref} />
              </div>
            </section>
            <section aria-labelledby="share-heading" className="mt-8">
              <SectionTitle id="share-heading">Share</SectionTitle>
              <ShareActions path={eventHref(entry.id)} title={entry.title} text={entry.summary} className="mt-3" />
            </section>
          </div>
        </aside>

        <div className="min-w-0 space-y-14 md:order-1 md:col-span-7">
          <section aria-labelledby="about-heading">
            <SectionTitle id="about-heading">About</SectionTitle>
            <div className="mt-4 max-w-[65ch] space-y-4 text-[1.0625rem] leading-relaxed text-paper">
              {body.map((p, i) => (
                <p key={i} className={cn("whitespace-pre-line", i === 0 ? undefined : "text-paper-muted")}>
                  {p}
                </p>
              ))}
            </div>
            {entry.callout ? <EventCallout callout={entry.callout} className="mt-8" /> : null}
            {isOfficeHours && entry.mentor ? (
              <div className="mt-6 flex flex-wrap gap-x-6">
                <Link
                  href={mentorProfileHref(entry.mentor.id)}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-paper underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-paper"
                >
                  More about {entry.mentor.firstName}
                  <ArrowRightIcon className="size-4" />
                </Link>
                <Link
                  href="/office-hours"
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-paper-muted underline decoration-line underline-offset-4 transition-colors hover:text-paper hover:decoration-paper"
                >
                  All office-hours mentors
                </Link>
              </div>
            ) : null}
          </section>

          <ProgramTimeline entry={entry} headingId="program-heading" mentors={getMentors()} />

          {entry.speakers.length ? (
            <section aria-labelledby="speakers-heading">
              <SectionTitle id="speakers-heading">{entry.speakers.length === 1 ? "Speaker" : "Speakers"}</SectionTitle>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {entry.speakers.map((s) => (
                  <li key={s.name} className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <span className="font-medium text-paper">
                      {s.mentorId ? (
                        <>
                          <Link
                            href={mentorProfileHref(s.mentorId)}
                            className="underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
                          >
                            {s.name}
                          </Link>
                          <MentorMarker />
                        </>
                      ) : (
                        s.name
                      )}
                      {s.role === "moderator" ? <span className="ml-2 mono-label text-paper-subtle">Moderator</span> : null}
                    </span>
                    {s.title ? <span className="text-sm text-paper-muted">{s.title}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {entry.topics.length ? (
            <section aria-labelledby="topics-heading">
              <SectionTitle id="topics-heading">Topics</SectionTitle>
              <div className="mt-4">
                <TopicList topics={entry.topics} />
              </div>
            </section>
          ) : null}

          {overlaps.length ? (
            <section aria-labelledby="overlaps-heading">
              <SectionTitle id="overlaps-heading">
                <span className="text-warning">Overlaps with</span>
              </SectionTitle>
              <p className="mt-2 text-sm text-paper-muted">
                {overlaps.length === 1 ? "This entry’s time overlaps with another listing." : "This entry’s time overlaps with other listings."}
              </p>
              <OverlapList entries={overlaps} />
            </section>
          ) : null}

          <section aria-labelledby="sources-heading">
            <SectionTitle id="sources-heading">Sources</SectionTitle>
            <div className="mt-4">
              <SourcesList sources={entry.sources} />
            </div>
          </section>
        </div>
      </Container>

      {sameDay.length ? (
        <Container className="mt-20 md:mt-24">
          <section aria-labelledby="same-day-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono-label tabular text-paper-muted">{day.mono}</p>
                <h2 id="same-day-heading" className="mt-2 font-wide text-2xl font-bold tracking-[-0.025em] text-paper md:text-[1.75rem]">
                  Also on {day.long}
                </h2>
              </div>
              <Link
                href={scheduleHref({ day: entry.date })}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-paper-muted transition-colors hover:text-paper"
              >
                Full day in the calendar
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <AgendaPreview entries={sameDay} showDate={false} className="mt-6" />
          </section>
        </Container>
      ) : null}
    </article>
  );
}

function OverlapList({ entries }: { entries: ScheduleEntry[] }) {
  return <AgendaPreview entries={entries} showDate={false} className="mt-4" />;
}
