/**
 * Building blocks for /schedule/[id]: key facts, the primary call to action (register / apply —
 * office hours only ever get "Apply"; no other event gets an application or booking CTA),
 * informational callouts, the program timeline, calendar export, and sources.
 * Server components; content comes in as props.
 */
import Link from "next/link";
import type { Mentor, SourceRef } from "@/content/types";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  DownloadIcon,
  InfoIcon,
} from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge } from "@/components/ui/status";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { mentorApplyHref, mentorCtaLabel, PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { applyHref, mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import {
  entryAvailabilityKind,
  entryTimeText,
  LOCATION_FORTHCOMING,
  referenceTime,
  timeZoneNote,
} from "@/lib/schedule/format";
import { mentorProfileHref, programMentors, sessionCountLabel, sessionTimeLabel } from "@/lib/schedule/program";
import { formatDate, formatTimeRange } from "@/lib/time";
import { cn } from "@/lib/cn";
import { SessionList } from "./program-sessions";

function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-paper underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-paper",
        className,
      )}
    >
      {children}
      <ArrowUpRightIcon className="size-3.5 shrink-0" />
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Key facts
// ---------------------------------------------------------------------------

/** Label/value row sized for the narrow detail rail (MetaRow's label column is wider). */
function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-t border-line py-3.5 text-sm">
      <dt className="mono-label pt-0.5 text-paper-subtle">{label}</dt>
      <dd className="min-w-0 text-paper">{children}</dd>
    </div>
  );
}

function sameText(a: string, b: string) {
  return a.replace(/\.$/, "").trim().toLowerCase() === b.replace(/\.$/, "").trim().toLowerCase();
}

export function EventFacts({ entry }: { entry: ScheduleEntry }) {
  const loc = entry.location;
  const isOfficeHours = entry.kind === "office-hours";

  return (
    <dl className="border-b border-line">
      <FactRow label="When">
        <p>
          <time dateTime={entry.date}>{formatDate(entry.date, "full")}</time>
        </p>
        <p className="mt-0.5 font-mono text-[0.875rem] tabular text-paper">{entryTimeText(entry)}</p>
        {entry.sessions.length ? (
          <p className="mt-0.5 text-[0.8125rem] text-paper-muted">{sessionCountLabel(entry.sessions.length)} inside</p>
        ) : null}
        <p className="mt-1 text-[0.8125rem] text-paper-muted">{timeZoneNote(entry.date, referenceTime(entry))}</p>
      </FactRow>

      <FactRow label="Where">
        {loc.kind === "in-person" || loc.kind === "hybrid" ? (
          <>
            <p>{loc.venue}</p>
            {loc.room ? <p className="text-paper-muted">{loc.room}</p> : null}
            {loc.address ? <p className="text-paper-muted">{loc.address}</p> : null}
            {loc.kind === "in-person" && loc.mapUrl ? (
              <ExternalLink href={loc.mapUrl} className="mt-1.5 text-[0.8125rem]">
                Map
              </ExternalLink>
            ) : null}
            {loc.kind === "hybrid" ? (
              <p className="mt-1.5 text-[0.8125rem] text-paper-muted">
                Also online
                {loc.url ? (
                  <>
                    {" · "}
                    <ExternalLink href={loc.url}>Online link</ExternalLink>
                  </>
                ) : null}
              </p>
            ) : null}
          </>
        ) : loc.kind === "virtual" ? (
          <>
            <p>Virtual{loc.platform ? ` · ${loc.platform}` : ""}</p>
            {loc.url ? (
              <ExternalLink href={loc.url} className="mt-1 text-[0.8125rem]">
                Join link
              </ExternalLink>
            ) : (
              <p className="text-[0.8125rem] text-paper-muted">Join link not published yet.</p>
            )}
          </>
        ) : (
          <>
            <p>{LOCATION_FORTHCOMING}</p>
            {loc.note && !sameText(loc.note, LOCATION_FORTHCOMING) ? (
              <p className="mt-0.5 text-[0.8125rem] text-paper-muted">{loc.note}</p>
            ) : null}
          </>
        )}
      </FactRow>

      {isOfficeHours && entry.mentor ? (
        <FactRow label="Mentor">
          <p>{entry.mentor.name}</p>
          {mentorAffiliation(entry.mentor) ? (
            <p className="text-paper-muted">{mentorAffiliation(entry.mentor)}</p>
          ) : null}
        </FactRow>
      ) : null}

      {entry.organizer ? <FactRow label={isOfficeHours ? "Run by" : "Organizer"}>{entry.organizer}</FactRow> : null}

      <FactRow label="Status">
        <div className="flex flex-wrap gap-2">
          {isOfficeHours ? <AvailabilityBadge kind={entryAvailabilityKind(entry)} /> : null}
          {!isOfficeHours || entry.status === "confirmed" ? <StatusBadge status={entry.status} /> : null}
        </div>
        {entry.statusNote ? <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-muted">{entry.statusNote}</p> : null}
      </FactRow>

      {/* Only show a registration row when there's something to act on — information-only
          events (e.g. Dan Caruso) must not suggest a sign-up is coming. */}
      {isOfficeHours ? (
        <FactRow label="How to join">
          <p>By application</p>
        </FactRow>
      ) : entry.status === "canceled" ? null : entry.registration ? (
        <FactRow label="Registration">
          <ExternalLink href={entry.registration.url}>{entry.registration.label}</ExternalLink>
        </FactRow>
      ) : entry.links.length ? (
        <FactRow label="More info">
          <ExternalLink href={entry.links[0].url}>{entry.links[0].label}</ExternalLink>
        </FactRow>
      ) : null}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Primary action
// ---------------------------------------------------------------------------

export function EventPrimaryAction({ entry }: { entry: ScheduleEntry }) {
  if (entry.status === "canceled") {
    return (
      <div className="rounded-sm border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-paper">
        <p className="font-semibold">This event was canceled.</p>
        {entry.statusNote ? <p className="mt-1 text-paper-muted">{entry.statusNote}</p> : null}
      </div>
    );
  }

  if (entry.kind === "office-hours" && entry.registration) {
    return (
      <div className="space-y-4">
        <ButtonLink href={entry.registration.url} size="lg" className="w-full">
          {entry.registration.label}
          <ArrowRightIcon className="size-4" />
        </ButtonLink>
        <div className="space-y-2 border-l-2 border-dashed border-paper/35 pl-4 text-[0.8125rem] leading-relaxed text-paper-muted">
          <p>
            <span className="text-paper">This is an availability window, not an appointment.</span>{" "}
            {APPLICATION_COPY.noReservation}
          </p>
          <p>{APPLICATION_COPY.limited}</p>
        </div>
      </div>
    );
  }

  if (entry.registration) {
    return (
      <a
        href={entry.registration.url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "primary", size: "lg", className: "w-full" })}
      >
        {entry.registration.label}
        <ArrowUpRightIcon className="size-4" />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }

  // No registration link: nothing to act on (information-only events show no sign-up UI).
  return null;
}

/** Whether EventPrimaryAction renders anything for this entry. */
export function hasPrimaryAction(entry: ScheduleEntry): boolean {
  return entry.status === "canceled" || Boolean(entry.registration);
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function CalendarActions({
  entry,
  icsHref,
  googleHref,
}: {
  entry: ScheduleEntry;
  icsHref: string;
  googleHref: string | null;
}) {
  if (!entry.calendar.available || !googleHref) {
    const reason = entry.calendar.available ? "Calendar export isn’t available for this event." : entry.calendar.reason;
    return (
      <div className="flex gap-3 rounded-sm border border-dotted border-line-strong px-4 py-3.5">
        <CalendarIcon className="mt-0.5 size-4 shrink-0 text-paper-subtle" />
        <div className="text-sm">
          <p className="font-medium text-paper-muted">Add to calendar — not available yet</p>
          <p className="mt-1 leading-relaxed text-paper-muted">{reason}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
      <a href={icsHref} download className={buttonClasses({ variant: "secondary", className: "w-full" })}>
        <DownloadIcon className="size-4" />
        Download .ics
        <span className="sr-only">(Apple Calendar, Outlook)</span>
      </a>
      <a
        href={googleHref}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "secondary", className: "w-full" })}
      >
        <CalendarIcon className="size-4" />
        Google Calendar
        <span className="sr-only">(opens in new tab)</span>
      </a>
      <p className="text-[0.8125rem] text-paper-subtle sm:col-span-2 md:col-span-1 xl:col-span-2">
        .ics works with Apple Calendar and Outlook. Times stay in Central Time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export function SourcesList({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) {
    return <p className="text-sm text-paper-muted">No public source has been listed for this entry yet.</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {sources.map((s, i) => (
        <li key={`${s.label}-${i}`} className="py-3.5 text-sm">
          <p className="font-medium text-paper">
            {s.url ? <ExternalLink href={s.url}>{s.label}</ExternalLink> : s.label}
          </p>
          {s.note ? <p className="mt-1 leading-relaxed text-paper-muted">{s.note}</p> : null}
          {s.checked ? (
            <p className="mt-1.5 font-mono text-[0.75rem] tabular text-paper-subtle">
              Checked <time dateTime={s.checked}>{formatDate(s.checked, "month-day")}, {s.checked.slice(0, 4)}</time>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Topic chips (hairline). */
export function TopicList({ topics }: { topics: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {topics.map((t) => (
        <li key={t}>
          <span className="inline-flex min-h-8 items-center rounded-xs border border-line-strong px-2.5 text-[0.8125rem] text-paper">
            {t}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Callout (information only)
// ---------------------------------------------------------------------------

/**
 * `entry.callout` — an informational note (e.g. the separate private session Founders is
 * supporting alongside Dan Caruso's fireside chat). Deliberately has no call to action.
 */
export function EventCallout({ callout, className }: { callout: { title: string; body: string }; className?: string }) {
  return (
    <aside
      aria-label={callout.title}
      className={cn("relative rounded-sm border border-dashed border-line-strong bg-ink-850 px-5 py-5 md:px-6", className)}
    >
      <p className="mono-label flex items-center gap-2 text-paper-subtle">
        <InfoIcon className="size-3.5 text-info" />
        For your information
      </p>
      <p className="mt-3 font-wide text-lg font-semibold tracking-[-0.015em] text-paper">{callout.title}</p>
      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-paper-muted">{callout.body}</p>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Program timeline
// ---------------------------------------------------------------------------

/**
 * The full sub-session timeline of a program block, plus — when office-hours mentors speak in
 * it — a "Founders Office Hours" panel: each mentor's portrait, name (→ profile), verified
 * affiliation, their session (→ its anchor on this page) and a CTA that opens the application with
 * that mentor preselected ("Apply to meet Arnav", or "Express interest" while scheduling).
 *
 * Props
 * - `entry`: the program-block ScheduleEntry (renders nothing without sessions).
 * - `headingId`: id for the section heading.
 * - `mentors`: public mentors (`getMentors()`), used for names, affiliations and CTA labels.
 */
export function ProgramTimeline({
  entry,
  headingId,
  mentors = [],
}: {
  entry: ScheduleEntry;
  headingId: string;
  mentors?: Mentor[];
}) {
  if (!entry.sessions.length) return null;
  const onStage = programMentors(entry).map((pm) => ({ ...pm, mentor: mentors.find((m) => m.id === pm.mentorId) ?? null }));
  const span =
    entry.time.kind === "exact" && entry.time.end ? `${formatTimeRange(entry.time.start, entry.time.end)} CT` : null;
  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id={headingId} className="mono-label text-paper-subtle">
          Program
        </h2>
        <p className="font-mono text-[0.75rem] tabular text-paper-muted">
          {sessionCountLabel(entry.sessions.length)}
          {span ? ` · ${span}` : null}
        </p>
      </div>
      <SessionList sessions={entry.sessions} date={entry.date} variant="detail" className="mt-3 border-y border-line" />

      {onStage.length ? (
        <section
          aria-labelledby={`${headingId}-mentors`}
          className="relative mt-8 rounded-sm border border-line-accent bg-ink-850 px-5 py-5 md:px-6 md:py-6"
        >
          <span aria-hidden className="absolute left-1.5 top-1.5 size-2 border-l border-t border-accent/70" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 size-2 border-b border-r border-accent/70" />
          <h3 id={`${headingId}-mentors`} className="mono-label flex items-center gap-2 text-accent">
            <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
            Founders Office Hours
          </h3>
          <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-paper">
            {onStage.length === 1
              ? "One speaker in this program is also an office-hours mentor this week."
              : `${onStage.length === 2 ? "Two" : onStage.length === 3 ? "Three" : onStage.length} speakers in this program are also office-hours mentors this week.`}{" "}
            <span className="text-paper-muted">Apply to meet one-on-one — appointments are limited.</span>
          </p>

          <ul className="mt-5 divide-y divide-line border-y border-line">
            {onStage.map((m) => {
              const name = m.mentor?.name ?? m.name;
              const affiliation = m.mentor ? mentorAffiliation(m.mentor) : null;
              return (
                <li key={m.mentorId} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <MentorPortrait id={m.mentorId} name={name} headshot={m.mentor?.headshot} size="sm" />
                    <div className="min-w-0">
                      <p>
                        <Link
                          href={mentorProfileHref(m.mentorId)}
                          className="font-medium text-paper underline decoration-accent/60 underline-offset-4 transition-colors hover:decoration-accent"
                        >
                          {name}
                        </Link>
                      </p>
                      {affiliation ? <p className="text-sm text-paper-muted">{affiliation}</p> : null}
                      <p className="mt-1 font-mono text-[0.75rem] leading-snug tabular text-paper-muted">
                        <a href={`#${m.anchor}`} className="underline decoration-line-strong underline-offset-4 hover:text-paper">
                          {sessionTimeLabel(m)}
                        </a>
                        {m.role === "moderator" ? " · Moderator" : null}
                      </p>
                    </div>
                  </div>
                  {m.mentor?.acceptingApplications ? (
                    <ButtonLink
                      href={mentorApplyHref(m.mentorId)}
                      variant="secondary"
                      className="w-full shrink-0 sm:w-auto"
                    >
                      {mentorCtaLabel(m.mentor)}
                      <ArrowRightIcon className="size-4" />
                      {mentorCtaLabel(m.mentor) === "Express interest" ? (
                        <span className="sr-only"> in office hours with {name}</span>
                      ) : null}
                    </ButtonLink>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href={applyHref()} className="w-full sm:w-auto">
              {PRIMARY_CTA_LABEL}
              <ArrowRightIcon className="size-4" />
            </ButtonLink>
            <Link
              href="/office-hours"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-paper-muted transition-colors hover:text-paper"
            >
              Meet all the mentors
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}
