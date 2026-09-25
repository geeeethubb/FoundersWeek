/**
 * Building blocks for /schedule/[id]: key facts (when, where, organizer), the primary action
 * (register / RSVP; office hours only ever get "Apply" — no other event gets an application or
 * booking CTA), informational callouts, speakers/hosts, the program, and calendar export.
 * Server components; content comes in as props.
 */
import Link from "next/link";
import type { Mentor, Speaker } from "@/content/types";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  MapPinIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { mentorApplyHref, mentorCtaLabel } from "@/lib/mentors";
import { mentorCta } from "@/lib/mentors-view";
import { mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import { entryTimeText, LOCATION_FORTHCOMING, locationLines, TIME_FORTHCOMING } from "@/lib/schedule/format";
import type { MentorHeadshots } from "@/lib/schedule/headshots";
import { mentorProfileHref, programMentors, sessionCountLabel, sessionTimeLabel } from "@/lib/schedule/program";
import { formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";
import { cn } from "@/lib/cn";
import { numberWord } from "@/lib/words";
import { MentorMarker, SessionList } from "./program-sessions";

/**
 * Small stacked links (a speaker's name, a mentor's session time): the link box is a 44px-tall tap
 * target, and negative margins hand the extra height back so the lines keep their spacing. Pair
 * with the text size's line height: `TAP_BASE` for 16px/1.375 text, `TAP_SM` for 14px.
 */
const TAP_BASE = "-my-[11px] inline-flex min-h-11 items-center";
const TAP_SM = "-my-3 inline-flex min-h-11 items-center";

function sameText(a: string, b: string) {
  const norm = (s: string) => s.replace(/\.$/, "").trim().toLowerCase();
  return norm(a) === norm(b);
}

// ---------------------------------------------------------------------------
// Key facts
// ---------------------------------------------------------------------------

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: (p: { className?: string }) => React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-text-subtle" />
      <div className="min-w-0">
        <dt className="text-sm font-medium text-text-subtle">{label}</dt>
        <dd className="mt-1 leading-snug text-text">{children}</dd>
      </div>
    </div>
  );
}

/** The organizer line, unless it only repeats a host listed on the page (e.g. Arnav's happy hour). */
export function organizerText(entry: Pick<ScheduleEntry, "organizer" | "speakers" | "kind">): string | null {
  if (!entry.organizer) return null;
  const hosts = entry.speakers.filter((s) => s.role === "host");
  if (hosts.some((h) => entry.organizer!.startsWith(h.name))) return null;
  return entry.organizer;
}

/** When · Where · Organizer ("Hosted by" for office hours), with honest notes for anything pending. */
export function EventFacts({ entry, className }: { entry: ScheduleEntry; className?: string }) {
  const isOfficeHours = entry.kind === "office-hours";
  const time = entryTimeText(entry);
  const lines = locationLines(entry.location);
  const loc = entry.location;
  const locationNote =
    loc.kind === "tba" && loc.note && !sameText(loc.note, LOCATION_FORTHCOMING) ? loc.note : null;
  // Office hours: what the window is, then how sessions run inside it (the session rule, from
  // site.officeHours via the entry; said once on the page).
  const timeNote = isOfficeHours
    ? [
        entry.time.kind === "exact" ? "Availability window, not a booked appointment." : "Exact window to be confirmed.",
        entry.sessionRule,
      ]
        .filter(Boolean)
        .join(" ")
    : entry.status !== "canceled" && entry.statusNote && !sameText(entry.statusNote, TIME_FORTHCOMING)
      ? entry.statusNote
      : null;
  const organizer = organizerText(entry);

  return (
    <dl className={cn("grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      <Fact icon={ClockIcon} label="When">
        <time dateTime={entry.date} className="block">
          {formatDate(entry.date, "long")}
        </time>
        <span className="block tabular">{time}</span>
        {timeNote ? <span className="mt-1 block text-sm text-text-muted">{timeNote}</span> : null}
      </Fact>

      <Fact icon={MapPinIcon} label="Where">
        {lines.map((line, i) => (
          <span key={line} className={cn("block", i > 0 && "text-text-muted")}>
            {line}
          </span>
        ))}
        {loc.kind === "in-person" && loc.mapUrl ? (
          <a
            href={loc.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-accent"
          >
            Map
            <ArrowUpRightIcon className="size-3.5" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ) : null}
        {locationNote ? <span className="mt-1 block text-sm text-text-muted">{locationNote}</span> : null}
      </Fact>

      {organizer ? (
        <Fact icon={UsersIcon} label={isOfficeHours ? "Hosted by" : "Organizer"}>
          {organizer}
        </Fact>
      ) : null}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Primary action
// ---------------------------------------------------------------------------

/**
 * Register / RSVP (external), "Apply to meet <mentor>" for office hours, or the canceled notice.
 * Information-only events (e.g. Dan Caruso) render nothing — their official links are "More info".
 */
export function EventPrimaryAction({ entry }: { entry: ScheduleEntry }) {
  if (entry.status === "canceled") {
    return (
      <div role="note" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-text">
        <p className="font-semibold text-danger">This event was canceled.</p>
        {entry.statusNote ? <p className="mt-1 text-text-muted">{entry.statusNote}</p> : null}
      </div>
    );
  }

  if (entry.kind === "office-hours" && entry.registration) {
    return (
      <ButtonLink href={entry.registration.url} size="lg" className="w-full sm:w-auto">
        {entry.registration.label}
        <ArrowRightIcon className="size-4" />
      </ButtonLink>
    );
  }

  if (entry.registration) {
    return (
      <a
        href={entry.registration.url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}
      >
        {entry.registration.label}
        <ArrowUpRightIcon className="size-4" />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }

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
    return <p className="text-sm leading-relaxed text-text-muted">{reason}</p>;
  }
  return (
    <div className="grid gap-2">
      <a href={icsHref} download className={buttonClasses({ variant: "secondary", className: "min-h-11 w-full" })}>
        <DownloadIcon className="size-4" />
        Apple Calendar or Outlook (.ics)
      </a>
      <a
        href={googleHref}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "secondary", className: "min-h-11 w-full" })}
      >
        <CalendarIcon className="size-4" />
        Google Calendar
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </div>
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
      className={cn("rounded-md border-l-2 border-accent bg-surface-subtle px-5 py-4 md:px-6 md:py-5", className)}
    >
      <p className="font-semibold text-text">{callout.title}</p>
      <p className="mt-1.5 max-w-[62ch] leading-relaxed text-text-muted">{callout.body}</p>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Speakers and hosts
// ---------------------------------------------------------------------------

/** "Host" when everyone listed hosts the event (Arnav's happy hour), otherwise "Speaker(s)". */
export function speakersHeading(speakers: Pick<Speaker, "role">[]): string {
  const many = speakers.length > 1;
  if (speakers.length && speakers.every((s) => s.role === "host")) return many ? "Hosts" : "Host";
  return many ? "Speakers" : "Speaker";
}

const ROLE_LABELS: Record<NonNullable<Speaker["role"]>, string> = { host: "Host", moderator: "Moderator" };

/** Screen-reader label for a speaker's profile link: "on LinkedIn" or "profile". */
function profileLabel(url: string): string {
  return /(^|\.)linkedin\.com$/i.test(new URL(url).hostname) ? "on LinkedIn" : "profile";
}

export function SpeakerList({
  speakers,
  headingId,
  headshots = {},
}: {
  speakers: Speaker[];
  headingId: string;
  headshots?: MentorHeadshots;
}) {
  if (!speakers.length) return null;
  const heading = speakersHeading(speakers);
  const uniform = heading.startsWith("Host");
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold tracking-tight text-text">
        {heading}
      </h2>
      <ul className="mt-4 space-y-4">
        {speakers.map((s) => (
          <li key={s.name} className="flex items-center gap-4">
            {s.mentorId ? <MentorPortrait id={s.mentorId} name={s.name} headshot={headshots[s.mentorId]} size="sm" /> : null}
            <div className="min-w-0 leading-snug">
              <p className="font-medium text-text">
                {s.mentorId ? (
                  <Link
                    href={mentorProfileHref(s.mentorId)}
                    className={cn(
                      TAP_BASE,
                      "underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent",
                    )}
                  >
                    {s.name}
                  </Link>
                ) : s.profileUrl ? (
                  <a
                    href={s.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      TAP_BASE,
                      "gap-1 underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent",
                    )}
                  >
                    {s.name}
                    <ArrowUpRightIcon className="size-3.5 text-text-subtle" />
                    <span className="sr-only">{profileLabel(s.profileUrl)} (opens in new tab)</span>
                  </a>
                ) : (
                  s.name
                )}
                {s.role && !uniform ? <span className="ml-2 text-sm font-normal text-text-subtle">{ROLE_LABELS[s.role]}</span> : null}
                {s.mentorId ? <MentorMarker /> : null}
              </p>
              {s.title ? <p className="mt-0.5 text-sm text-text-muted">{s.title}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Office hours: who you'd meet
// ---------------------------------------------------------------------------

/** Mentor photo, name (→ profile) and verified affiliation, for an office-hours event page. */
export function OfficeHoursMentor({
  mentor,
  headshot,
}: {
  mentor: NonNullable<ScheduleEntry["mentor"]>;
  headshot?: MentorHeadshots[string];
}) {
  const affiliation = mentorAffiliation(mentor);
  return (
    <div className="flex items-center gap-4">
      <MentorPortrait id={mentor.id} name={mentor.name} headshot={headshot} size="md" />
      <div className="min-w-0 leading-snug">
        <p className="text-lg font-semibold text-text">{mentor.name}</p>
        {affiliation ? <p className="text-text-muted">{affiliation}</p> : null}
        <Link
          href={mentorProfileHref(mentor.id)}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent md:min-h-8"
        >
          More about {mentor.firstName}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** "Appointments are limited…" plus the no-reservation note, for office-hours pages. */
export const OFFICE_HOURS_NOTES = [APPLICATION_COPY.limited, APPLICATION_COPY.noReservation] as const;

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

/**
 * The full sub-session program of a block, plus — when office-hours mentors speak in it — each
 * mentor's photo, name (→ profile), verified affiliation, their session (→ its anchor on this page)
 * and a CTA that opens the application with that mentor preselected ("Apply to meet Arnav", or
 * "Express interest" while scheduling).
 *
 * Props
 * - `entry`: the program-block ScheduleEntry (renders nothing without sessions).
 * - `headingId`: id for the section heading.
 * - `mentors`: public mentors (`getMentors()`), used for photos, affiliations and CTA labels.
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
    entry.time.kind === "exact" && entry.time.end ? `${formatTimeRange(entry.time.start, entry.time.end)} ${TZ_LABEL}` : null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold tracking-tight text-text">
        Program
      </h2>
      <p className="mt-1 text-sm text-text-muted tabular">
        {sessionCountLabel(entry.sessions.length)}
        {span ? ` · ${span}` : null}
      </p>
      <SessionList sessions={entry.sessions} date={entry.date} variant="detail" className="mt-4 border-t border-line-strong" />

      {onStage.length ? (
        <section aria-labelledby={`${headingId}-mentors`} className="mt-10 rounded-md bg-surface-subtle p-5 md:p-6">
          <h3 id={`${headingId}-mentors`} className="text-lg font-semibold tracking-tight text-text">
            Office-hours mentors in this program
          </h3>
          <p className="mt-1.5 max-w-[60ch] leading-relaxed text-text-muted">
            {onStage.length === 1
              ? "One speaker here is also holding Founders Office Hours this week."
              : `${numberWord(onStage.length, { capitalize: true })} speakers here are also holding Founders Office Hours this week.`}{" "}
            Appointments are limited.
          </p>

          <ul className="mt-5 space-y-5">
            {onStage.map((m) => {
              const name = m.mentor?.name ?? m.name;
              const affiliation = m.mentor ? mentorAffiliation(m.mentor) : null;
              const cta = m.mentor ? mentorCtaLabel(m.mentor) : null;
              return (
                <li key={m.mentorId} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex min-w-0 items-center gap-4">
                    <MentorPortrait id={m.mentorId} name={name} headshot={m.mentor?.headshot} size="sm" />
                    <div className="min-w-0 leading-snug">
                      <p>
                        <Link
                          href={mentorProfileHref(m.mentorId)}
                          className={cn(
                            TAP_BASE,
                            "whitespace-nowrap font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent",
                          )}
                        >
                          {name}
                        </Link>
                      </p>
                      {affiliation ? <p className="text-sm text-text-muted">{affiliation}</p> : null}
                      <p className="mt-0.5 text-sm text-text-subtle tabular">
                        <a
                          href={`#${m.anchor}`}
                          className={cn(TAP_SM, "underline decoration-line-strong underline-offset-4 hover:text-text")}
                        >
                          {sessionTimeLabel(m)}
                        </a>
                        {m.role === "moderator" ? " · Moderator" : null}
                      </p>
                    </div>
                  </div>
                  {m.mentor?.acceptingApplications && cta ? (
                    <ButtonLink
                      href={(m.mentor ? mentorCta(m.mentor).href : null) ?? mentorApplyHref(m.mentorId)}
                      variant="secondary"
                      className="min-h-11 w-full shrink-0 bg-surface sm:w-auto"
                    >
                      {cta}
                      <ArrowRightIcon className="size-4" />
                      {cta === "Express interest" ? <span className="sr-only"> in office hours with {name}</span> : null}
                    </ButtonLink>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
