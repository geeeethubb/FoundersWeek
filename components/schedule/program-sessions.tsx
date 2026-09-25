/**
 * Timed sub-sessions of a program block (e.g. Friday's "Founders Showcase Day Sessions"): a plain
 * list of time · title · people. Moderators are labeled; `peopleNote` is shown; people who are
 * office-hours mentors (`person.mentorId`) link to their profile with a small "Office-hours mentor"
 * note. Sessions with nobody listed (check-in, lunch, tours) read quieter.
 *
 * Server-friendly (no hooks) — used inside the calendar's expandable block rows and, in the
 * `detail` variant, as the full program on the event page.
 *
 * SessionList props
 * - `sessions`: ProgramSession[] (chronological, verified people only).
 * - `date`: the block's date (for <time dateTime>).
 * - `variant`: "compact" (agenda row, default) or "detail" (event page; titles are h3 headings and
 *   each session gets an anchor id like "session-1355").
 * - `highlight`: indexes of sessions matching the current search.
 * - `className`: extra classes for the <ol>.
 *
 * ProgramMentorsStrip props: `entry` (a program block), `headshots` (mentor photos by id),
 * `className` — the office-hours mentors who speak in the block, each with photo, name (→ profile)
 * and start time. Renders nothing when no mentor speaks. `relative z-10`, above the row's
 * stretched title link.
 */
import Link from "next/link";
import { Fragment } from "react";
import type { ISODate, ProgramSession, Speaker } from "@/content/types";
import { MentorPortrait } from "@/components/ui/portrait";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import type { MentorHeadshots } from "@/lib/schedule/headshots";
import {
  isLogistics,
  mentorProfileHref,
  programMentors,
  sessionAnchorId,
  sessionTimeLabel,
  splitSessionPeople,
} from "@/lib/schedule/program";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";

/** Small note after a mentor's name. */
export function MentorMarker({ className }: { className?: string }) {
  return (
    <span className={cn("ml-1.5 whitespace-nowrap text-xs font-semibold text-accent-strong", className)}>
      Office-hours mentor
    </span>
  );
}

/** One person in a session's list. A name never breaks across lines ("Rishab" / "Veldur" on a phone). */
function Person({ person }: { person: Speaker }) {
  if (person.mentorId) {
    return (
      <span>
        <Link
          href={mentorProfileHref(person.mentorId)}
          className="whitespace-nowrap font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
        >
          {person.name}
        </Link>
        <MentorMarker />
      </span>
    );
  }
  return (
    <span>
      <span className="whitespace-nowrap text-text">{person.name}</span>
      {person.title ? <span>, {person.title}</span> : null}
    </span>
  );
}

function PeopleList({ people }: { people: Speaker[] }) {
  return (
    <>
      {people.map((p, i) => (
        <Fragment key={`${p.name}-${i}`}>
          {i > 0 ? (i === people.length - 1 ? " and " : ", ") : null}
          <Person person={p} />
        </Fragment>
      ))}
    </>
  );
}

export function SessionPeople({ session, className }: { session: ProgramSession; className?: string }) {
  const { speakers, moderators } = splitSessionPeople(session);
  if (!speakers.length && !moderators.length && !session.peopleNote) return null;
  return (
    <div className={cn("space-y-0.5 text-sm leading-relaxed text-text-muted", className)}>
      {speakers.length ? (
        <p>
          <PeopleList people={speakers} />
        </p>
      ) : null}
      {moderators.length ? (
        <p>
          {moderators.length === 1 ? "Moderator: " : "Moderators: "}
          <PeopleList people={moderators} />
        </p>
      ) : null}
      {session.peopleNote ? <p>{session.peopleNote}</p> : null}
    </div>
  );
}

export function SessionList({
  sessions,
  date,
  variant = "compact",
  highlight = [],
  className,
}: {
  sessions: ProgramSession[];
  date: ISODate;
  variant?: "compact" | "detail";
  highlight?: number[];
  className?: string;
}) {
  const detail = variant === "detail";
  return (
    <ol className={cn("divide-y divide-line", className)}>
      {sessions.map((s, i) => {
        const quiet = isLogistics(s);
        const match = highlight.includes(i);
        const TitleTag = detail ? "h3" : "p";
        return (
          <li
            key={`${s.start}-${i}`}
            id={detail ? sessionAnchorId(s) : undefined}
            className={cn(
              "grid gap-x-6 gap-y-1",
              detail ? "scroll-mt-32 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]" : "py-3 sm:grid-cols-[9rem_minmax(0,1fr)]",
              match && "-mx-3 rounded-sm bg-accent-soft px-3",
            )}
          >
            <p className="text-sm tabular text-text-subtle">
              <time dateTime={`${date}T${s.start}`}>{sessionTimeLabel(s)}</time>
            </p>
            <div className="min-w-0">
              <TitleTag
                className={cn(
                  "leading-snug",
                  detail ? "text-base font-semibold sm:text-[1.0625rem]" : "text-[0.9375rem] font-medium",
                  quiet ? "font-normal text-text-muted" : "text-text",
                )}
              >
                {s.title}
                {match ? <span className="ml-2 whitespace-nowrap text-xs font-semibold text-accent-strong">Matches your search</span> : null}
              </TitleTag>
              <SessionPeople session={s} className="mt-1" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Office-hours mentors speaking in a program block, with photo and start time. */
export function ProgramMentorsStrip({
  entry,
  headshots = {},
  className,
}: {
  entry: ScheduleEntry;
  headshots?: MentorHeadshots;
  className?: string;
}) {
  const mentors = programMentors(entry);
  if (!mentors.length) return null;
  const labelId = `on-stage-${entry.id}`;
  return (
    <div className={cn("relative z-10", className)}>
      <p id={labelId} className="text-sm font-medium text-text-muted">
        Office-hours mentors on stage
      </p>
      <ul aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        {mentors.map((m) => (
          <li key={m.mentorId}>
            <Link
              href={mentorProfileHref(m.mentorId)}
              className="group/mentor inline-flex min-h-11 items-center gap-2.5 rounded-sm pr-1"
            >
              <MentorPortrait id={m.mentorId} name={m.name} headshot={headshots[m.mentorId]} size="xs" />
              <span className="text-sm leading-tight">
                <span className="block font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors group-hover/mentor:decoration-accent">
                  {m.name}
                </span>
                <span className="mt-0.5 block text-text-subtle tabular">
                  <span className="sr-only">speaks at </span>
                  <time dateTime={`${entry.date}T${m.start}`}>{formatTime(m.start)}</time>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
