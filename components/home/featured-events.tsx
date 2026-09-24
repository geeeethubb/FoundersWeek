/**
 * FeaturedEvents — the featured events after office hours, in priority order (Dan Caruso's
 * fireside chat, the Sept 29 panel, the Sept 30 happy hour, Founder Failure Lab), as compact cards
 * — events Founders hosts sit on a light-orange card: Founders involvement, title, date and
 * time, place, and a link to the event page. Then the link to the full calendar with a note on the
 * official dates.
 *
 * There is deliberately NO application, interest, waitlist or booking affordance here — the only
 * application on the site is Founders Office Hours.
 *
 * Server component.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";
import { InvolvementBadge } from "@/components/ui/badge";
import { ArrowRightIcon, CalendarIcon, MapPinIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import type { FeaturedEventView } from "./home-model";

export function FeaturedEvents({ events, calendarNote }: { events: FeaturedEventView[]; calendarNote: string | null }) {
  return (
    <section aria-labelledby="events-heading">
      <Container>
        <div className="border-t border-line pt-10 md:pt-12">
          <h2 id="events-heading" className="text-2xl font-semibold tracking-tight text-text sm:text-[1.75rem]">
            Featured events
          </h2>
        </div>

        {events.length ? (
          <ul className="mt-6 grid gap-4 md:grid-cols-2 md:gap-5 lg:mt-8">
            {events.map((e) => (
              <li key={e.id} className="min-w-0">
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 rounded-md bg-surface-subtle px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6">
          {calendarNote ? <p className="text-[0.9375rem] leading-relaxed text-text-muted">{calendarNote}</p> : null}
          <Link
            href="/schedule"
            className="group/cal inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xs text-[0.9375rem] font-semibold text-charcoal underline decoration-accent decoration-2 underline-offset-[6px] sm:self-auto"
          >
            See the full calendar
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cal:translate-x-0.5" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

function EventCard({ event: e }: { event: FeaturedEventView }) {
  const hosted = e.involvement === "hosted";
  return (
    <article
      aria-labelledby={`featured-${e.id}`}
      className={cn(
        "group relative flex h-full flex-col rounded-md border p-5 transition-[border-color,box-shadow] duration-150 hover:shadow-sm sm:p-6",
        hosted ? "border-accent/35 bg-accent-soft hover:border-accent/60" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      {e.involvement ? <InvolvementBadge involvement={e.involvement} className="self-start" /> : null}
      <h3
        id={`featured-${e.id}`}
        className="mt-4 text-xl font-semibold leading-snug tracking-tight text-text sm:text-[1.375rem]"
      >
        <Link
          href={e.href}
          className="rounded-xs decoration-accent decoration-2 underline-offset-[5px] after:absolute after:inset-0 after:rounded-md group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
        >
          {e.title}
        </Link>
      </h3>
      <dl className="mt-4 space-y-2 text-[0.9375rem] leading-snug">
        <div className="flex gap-3">
          <dt className="pt-0.5">
            <CalendarIcon className="size-4 text-text-subtle" />
            <span className="sr-only">When</span>
          </dt>
          <dd className="text-charcoal">
            <time dateTime={e.dateTime}>
              {e.date} · <span className="tabular">{e.time}</span>
            </time>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="pt-0.5">
            <MapPinIcon className="size-4 text-text-subtle" />
            <span className="sr-only">Where</span>
          </dt>
          <dd className="text-charcoal">
            {e.place}
            {e.address ? <span className="mt-0.5 block text-sm text-text-subtle">{e.address}</span> : null}
          </dd>
        </div>
      </dl>
      <p
        aria-hidden
        className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-text-muted transition-colors group-hover:text-text"
      >
        Event details
        <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </p>
    </article>
  );
}
