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
  OFFICE_HOURS_NOTES,
  OfficeHoursMentor,
  ProgramTimeline,
  SpeakerList,
} from "@/components/schedule/event-detail";
import { ShareActions } from "@/components/schedule/share-actions";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { googleCalendarUrl } from "@/lib/calendar/google";
import { getSiteUrl } from "@/lib/config";
import { overlapsFor } from "@/lib/schedule/filter";
import { dayLabels, entryTimeText, paragraphs } from "@/lib/schedule/format";
import { mentorHeadshots } from "@/lib/schedule/headshots";
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

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold tracking-tight text-text">
      {children}
    </h2>
  );
}

/**
 * One event (or office-hours window): title, when/where, labels, the primary action (register,
 * RSVP, or — for office hours only — apply), description, speakers or host, the program for blocks,
 * add to calendar (confirmed events with an exact start and end), share, and the rest of the day.
 * Information-only events such as Dan Caruso's fireside chat show their callout and official links —
 * never an application, interest or booking affordance.
 */
export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const entry = getScheduleEntry(id);
  if (!entry) notFound();

  const all = getScheduleEntries();
  const mentors = getMentors();
  const headshots = mentorHeadshots(mentors);
  const overlaps = overlapsFor(entry, all);
  const overlapIds = new Set(overlaps.map((o) => o.id));
  const sameDay = all.filter((e) => e.date === entry.date && e.id !== entry.id && !overlapIds.has(e.id));
  const day = dayLabels(entry.date);
  const isOfficeHours = entry.kind === "office-hours";
  const canceled = entry.status === "canceled";
  const googleHref = googleCalendarUrl(entry, getSiteUrl());
  const links = canceled ? [] : entry.links;
  const hasActions = hasPrimaryAction(entry) || links.length > 0;

  return (
    <article className="pb-20 md:pb-28">
      <Container as="header" className="pt-6 md:pt-10">
        <Link
          href={scheduleHref({ day: entry.date })}
          className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon className="size-4" />
          Calendar<span className="sr-only">: {day.long}</span>
        </Link>

        <div className="mt-6 max-w-5xl md:mt-8">
          <EntryBadges entry={entry} />
          <h1
            className={cn(
              "mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl md:leading-[1.08]",
              canceled ? "text-text-muted" : "text-text",
            )}
          >
            {entry.title}
          </h1>
        </div>

        <EventFacts entry={entry} className="mt-8 max-w-5xl md:mt-10" />

        {hasActions ? (
          <div className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <EventPrimaryAction entry={entry} />
            {links.length ? (
              // `contents`: the links join this row as siblings of the primary action.
              <EntryLinks links={links} variant="button" className="contents sm:[&>a]:w-auto" />
            ) : null}
          </div>
        ) : null}
        {isOfficeHours && !canceled ? (
          <p className="mt-3 text-sm text-text-muted">{OFFICE_HOURS_NOTES[1]}</p>
        ) : null}
      </Container>

      <Container className="mt-12 md:mt-16">
        <div className="grid gap-x-16 gap-y-12 border-t border-line pt-10 md:grid-cols-12 md:pt-14">
          <div className="min-w-0 space-y-12 md:col-span-7 lg:col-span-8">
            <section aria-labelledby="about-heading">
              <SectionHeading id="about-heading">About</SectionHeading>
              {isOfficeHours && entry.mentor ? (
                <div className="mt-5 max-w-2xl space-y-5">
                  <OfficeHoursMentor mentor={entry.mentor} headshot={headshots[entry.mentor.id]} />
                  {entry.statusNote ? <p className="leading-relaxed text-text sm:text-lg">{entry.statusNote}</p> : null}
                  <p className="leading-relaxed text-text-muted sm:text-lg">{OFFICE_HOURS_NOTES[0]}</p>
                  <p>
                    <Link
                      href="/office-hours"
                      className="inline-flex min-h-11 items-center gap-1.5 font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      All office-hours mentors
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-w-2xl space-y-4 leading-relaxed text-text-muted sm:text-lg">
                  {paragraphs(entry.description).map((p, i) => (
                    <p key={i} className={cn("whitespace-pre-line", i === 0 && "text-text")}>
                      {p}
                    </p>
                  ))}
                </div>
              )}
              {entry.callout ? <EventCallout callout={entry.callout} className="mt-8 max-w-2xl" /> : null}
            </section>

            <SpeakerList speakers={entry.speakers} headingId="speakers-heading" headshots={headshots} />

            <ProgramTimeline entry={entry} headingId="program-heading" mentors={mentors} />

            {overlaps.length ? (
              <section aria-labelledby="overlaps-heading">
                <SectionHeading id="overlaps-heading">Overlaps with</SectionHeading>
                <p className="mt-1.5 text-text-muted">
                  {overlaps.length === 1
                    ? "This time overlaps with another listing."
                    : "This time overlaps with other listings."}
                </p>
                <AgendaPreview entries={overlaps} showDate={false} className="mt-4" />
              </section>
            ) : null}
          </div>

          <aside aria-label="Calendar and sharing" className="md:col-span-5 lg:col-span-4">
            <div className="space-y-8 rounded-md border border-line p-6 md:sticky md:top-[calc(4.5rem+1px+1.5rem)]">
              <section aria-labelledby="calendar-heading">
                <h2 id="calendar-heading" className="text-base font-semibold text-text">
                  Add to calendar
                </h2>
                <div className="mt-3">
                  <CalendarActions entry={entry} icsHref={`${eventHref(entry.id)}/calendar.ics`} googleHref={googleHref} />
                </div>
              </section>
              <section aria-labelledby="share-heading">
                <h2 id="share-heading" className="text-base font-semibold text-text">
                  Share
                </h2>
                <ShareActions path={eventHref(entry.id)} title={entry.title} text={entry.summary} className="mt-3" />
              </section>
            </div>
          </aside>
        </div>
      </Container>

      {sameDay.length ? (
        <Container className="mt-20 md:mt-24">
          <section aria-labelledby="same-day-heading">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <h2 id="same-day-heading" className="text-2xl font-semibold tracking-tight text-text">
                Also on {day.long}
              </h2>
              <Link
                href={scheduleHref({ day: entry.date })}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
              >
                See the full day
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <AgendaPreview entries={sameDay} showDate={false} className="mt-5" />
          </section>
        </Container>
      ) : null}
    </article>
  );
}
