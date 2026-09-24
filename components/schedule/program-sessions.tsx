/**
 * Timed sub-sessions of a program block (e.g. Friday's "Founders Showcase Day Sessions"), drawn as
 * a hairline timeline: time · title · people. Moderators are labeled; `peopleNote` is shown;
 * people who are office-hours mentors (`person.mentorId`) link to their profile with an
 * "Office hours mentor" marker. Sessions with nobody listed (check-in, lunch, tours) read quieter.
 *
 * Server-friendly (no hooks) — used inside the calendar's expandable block rows and, in the
 * `detail` variant, as the full timeline on the event page.
 *
 * SessionList props
 * - `sessions`: ProgramSession[] (chronological, verified people only).
 * - `date`: the block's date (for <time dateTime>).
 * - `variant`: "compact" (agenda row, default) or "detail" (event page; titles are headings and
 *   each session gets an anchor id like "session-1355").
 * - `highlight`: indexes of sessions matching the current search (marked "Match").
 * - `className`: extra classes for the <ol>.
 *
 * ProgramTrack props: `segments` from programTrack(entry) — a decorative proportional timeline.
 *
 * ProgramMentorsStrip props: `entry` (a program block), `className` — the office-hours mentors who
 * speak in the block ("On stage"), each with portrait, name (→ mentor profile) and session start.
 * Renders nothing when no mentor speaks. Sits above the row's stretched title link (`relative z-10`).
 */
import Link from "next/link";
import { Fragment } from "react";
import type { ISODate, ProgramSession, Speaker } from "@/content/types";
import { MentorPortrait } from "@/components/ui/portrait";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import {
  isLogistics,
  mentorProfileHref,
  programMentors,
  sessionAnchorId,
  sessionTimeLabel,
  splitSessionPeople,
  type TrackSegment,
} from "@/lib/schedule/program";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/cn";

/** Small accent marker after a mentor's name. */
export function MentorMarker({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex h-5 -translate-y-px items-center gap-1.5 whitespace-nowrap rounded-xs border border-line-accent px-1.5 align-middle font-mono text-[0.6875rem] font-medium uppercase leading-none tracking-[0.06em] text-accent",
        className,
      )}
    >
      <span aria-hidden className="size-1 rotate-45 bg-accent" />
      Office hours mentor
    </span>
  );
}

function Person({ person }: { person: Speaker }) {
  if (person.mentorId) {
    return (
      // Name and marker wrap as one unit.
      <span className="whitespace-nowrap">
        <Link
          href={mentorProfileHref(person.mentorId)}
          className="font-medium text-paper underline decoration-accent/60 underline-offset-4 transition-colors hover:decoration-accent"
        >
          {person.name}
        </Link>
        <MentorMarker />
      </span>
    );
  }
  return (
    <span>
      <span className="text-paper/90">{person.name}</span>
      {person.title ? <span className="text-paper-muted">, {person.title}</span> : null}
    </span>
  );
}

function PeopleList({ people }: { people: Speaker[] }) {
  return (
    <>
      {people.map((p, i) => (
        <Fragment key={`${p.name}-${i}`}>
          {i > 0 ? <span className="text-paper-subtle">{i === people.length - 1 ? " and " : ", "}</span> : null}
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
    <div className={cn("space-y-1 text-sm leading-relaxed text-paper-muted", className)}>
      {speakers.length ? (
        <p>
          <PeopleList people={speakers} />
        </p>
      ) : null}
      {moderators.length ? (
        <p>
          <span className="mr-2 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-paper-subtle">
            {moderators.length === 1 ? "Moderator" : "Moderators"}
          </span>
          <PeopleList people={moderators} />
        </p>
      ) : null}
      {session.peopleNote ? <p className="text-[0.8125rem] italic text-paper-muted">{session.peopleNote}</p> : null}
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
    <ol className={cn("relative", className)}>
      {/* The rail the session nodes sit on. */}
      <span aria-hidden className={cn("absolute left-[3px] w-px bg-line-strong", detail ? "bottom-7 top-7" : "bottom-5 top-5")} />
      {sessions.map((s, i) => {
        const mentor = s.people.some((p) => Boolean(p.mentorId));
        const quiet = isLogistics(s);
        const match = highlight.includes(i);
        const TitleTag = detail ? "h3" : "p";
        return (
          <li
            key={`${s.start}-${i}`}
            id={detail ? sessionAnchorId(s) : undefined}
            className={cn(
              "relative grid gap-x-6 gap-y-1 pl-6",
              detail
                ? "scroll-mt-28 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] md:pl-8"
                : "py-2.5 sm:grid-cols-[9.25rem_minmax(0,1fr)]",
              match && "rounded-xs bg-accent-soft/60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 size-[7px] rotate-45 border",
                detail ? "top-[1.4rem]" : "top-[1.0625rem]",
                mentor || match ? "border-accent bg-accent" : quiet ? "border-paper/30 bg-ink-900" : "border-paper/70 bg-ink-900",
              )}
            />
            <p className={cn("font-mono tabular", detail ? "text-sm" : "text-[0.8125rem]")}>
              <time dateTime={`${date}T${s.start}`} className={quiet ? "text-paper-subtle" : "text-paper-muted"}>
                {sessionTimeLabel(s)}
              </time>
            </p>
            <div className="min-w-0">
              {match ? <p className="mono-label mb-1 text-accent">Search match</p> : null}
              <TitleTag
                className={cn(
                  "leading-snug",
                  detail
                    ? "font-wide text-[1.0625rem] font-semibold tracking-[-0.015em] sm:text-lg"
                    : "text-[0.9375rem]",
                  quiet ? "font-normal text-paper-muted" : detail ? "text-paper" : "font-medium text-paper",
                )}
              >
                {s.title}
              </TitleTag>
              <SessionPeople session={s} className={detail ? "mt-1.5" : "mt-1"} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Decorative proportional timeline of a block's sessions (mentor sessions in orange). */
export function ProgramTrack({ segments, className }: { segments: TrackSegment[]; className?: string }) {
  if (!segments.length) return null;
  return (
    <div aria-hidden className={cn("relative h-2", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            "absolute top-0 h-2 rounded-[1px]",
            s.mentor ? "bg-accent" : s.logistics ? "bg-paper/20" : "bg-paper/55",
          )}
          style={{ left: `${s.left}%`, width: `max(2px, calc(${s.width}% - 2px))` }}
        />
      ))}
    </div>
  );
}

/** "On stage": office-hours mentors speaking in a program block, with portrait and start time. */
export function ProgramMentorsStrip({ entry, className }: { entry: ScheduleEntry; className?: string }) {
  const mentors = programMentors(entry);
  if (!mentors.length) return null;
  const labelId = `on-stage-${entry.id}`;
  return (
    <div className={cn("relative z-10 flex w-fit max-w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5", className)}>
      <p id={labelId} className="mono-label flex shrink-0 items-center gap-2 text-accent">
        <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
        Office-hours mentors on stage
      </p>
      <ul aria-labelledby={labelId} className="flex flex-wrap gap-x-5 gap-y-2">
        {mentors.map((m) => (
          <li key={m.mentorId}>
            <Link
              href={mentorProfileHref(m.mentorId)}
              className="group/mentor inline-flex min-h-11 items-center gap-2.5 rounded-xs pr-1"
            >
              <MentorPortrait id={m.mentorId} name={m.name} size="sm" />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-paper underline decoration-accent/50 underline-offset-4 transition-colors group-hover/mentor:decoration-accent">
                  {m.name}
                </span>
                <span className="mt-0.5 font-mono text-[0.75rem] tabular text-paper-muted">
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
