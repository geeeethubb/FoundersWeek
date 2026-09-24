/**
 * Program blocks: events with timed sub-sessions (`entry.sessions`), e.g. Friday's
 * "Founders Showcase Day Sessions". Pure helpers shared by the calendar's expandable block rows,
 * the event detail timeline, calendar export and the tests.
 */
import type { ISODate, ProgramSession, Speaker } from "@/content/types";
import { formatTimeRange, minutesOfDay } from "@/lib/time";
import type { ScheduleEntry } from "./entries";
import { normalizeSearchText, queryTokens } from "./filter";
import { listText, plural } from "./format";

/** Where a mentor's profile lives (app/office-hours/[id]). */
export function mentorProfileHref(mentorId: string): string {
  return `/office-hours/${encodeURIComponent(mentorId)}`;
}

export function hasProgram(entry: Pick<ScheduleEntry, "sessions">): boolean {
  return entry.sessions.length > 0;
}

/** "11 sessions" */
export function sessionCountLabel(count: number): string {
  return plural(count, "session", "sessions");
}

/** "1:55–2:25 PM", "11:55 AM–12:45 PM" */
export function sessionTimeLabel(session: Pick<ProgramSession, "start" | "end">): string {
  return formatTimeRange(session.start, session.end);
}

/** Stable in-page anchor for a session on the event page, e.g. "session-1355". */
export function sessionAnchorId(session: Pick<ProgramSession, "start">): string {
  return `session-${session.start.replace(":", "")}`;
}

/** Speakers and moderators, in source order. */
export function splitSessionPeople(session: Pick<ProgramSession, "people">): {
  speakers: Speaker[];
  moderators: Speaker[];
} {
  return {
    speakers: session.people.filter((p) => p.role !== "moderator"),
    moderators: session.people.filter((p) => p.role === "moderator"),
  };
}

/** A session with no people listed (check-in, lunch, tours) reads as logistics. */
export function isLogistics(session: Pick<ProgramSession, "people" | "peopleNote">): boolean {
  return session.people.length === 0 && !session.peopleNote;
}

function personText(p: Speaker): string {
  return p.title ? `${p.name} (${p.title})` : p.name;
}

/**
 * Plain-text people line for exports: "Charles Isbell (Chancellor); moderated by Scott Rose and
 * Susan Martinis". Empty string when nobody is listed.
 */
export function sessionPeopleText(session: Pick<ProgramSession, "people" | "peopleNote">): string {
  const { speakers, moderators } = splitSessionPeople(session);
  const parts: string[] = [];
  if (speakers.length) parts.push(listText(speakers.map(personText)));
  if (moderators.length) parts.push(`moderated by ${listText(moderators.map(personText))}`);
  if (session.peopleNote) parts.push(session.peopleNote.replace(/\.$/, ""));
  return parts.join("; ");
}

/** Plain-text line for one session: "10:15–10:45 AM — Innovating in Quantum (Brian DeMarco, …)". */
export function sessionLineText(session: ProgramSession): string {
  const people = sessionPeopleText(session);
  return `${sessionTimeLabel(session)} — ${session.title}${people ? ` (${people})` : ""}`;
}

export interface ProgramMentor {
  mentorId: string;
  name: string;
  /** Title of the (first) session they appear in. */
  sessionTitle: string;
  /** That session's local start/end, `HH:mm`. */
  start: string;
  end: string;
  /** In-page anchor of that session on the event page ("session-1355"). */
  anchor: string;
  role: "speaker" | "moderator";
}

/** Office-hours mentors appearing in a block's sessions, in program order (one row per mentor). */
export function programMentors(entry: Pick<ScheduleEntry, "sessions">): ProgramMentor[] {
  const seen = new Set<string>();
  const out: ProgramMentor[] = [];
  for (const session of entry.sessions) {
    for (const p of session.people) {
      if (!p.mentorId || seen.has(p.mentorId)) continue;
      seen.add(p.mentorId);
      out.push({
        mentorId: p.mentorId,
        name: p.name,
        sessionTitle: session.title,
        start: session.start,
        end: session.end,
        anchor: sessionAnchorId(session),
        role: p.role === "moderator" ? "moderator" : "speaker",
      });
    }
  }
  return out;
}

function sessionHaystack(session: ProgramSession): string {
  return normalizeSearchText(
    [session.title, ...session.people.flatMap((p) => [p.name, p.title]), session.peopleNote].filter(Boolean).join(" "),
  );
}

/**
 * Indexes of sessions that on their own contain every (3+ character) word of the query — used to
 * open a block and mark why it matched ("Isbell" or "charles isbell" → the fireside chat).
 * A query that matched the block through its own fields (e.g. its venue, "Illinois Conference
 * Center") marks nothing, even if one word also appears in a session title. Empty when the query
 * has no 3+ character words.
 */
export function matchingSessionIndexes(entry: Pick<ScheduleEntry, "sessions">, query: string): number[] {
  const tokens = queryTokens(query).filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  const out: number[] = [];
  entry.sessions.forEach((s, i) => {
    const haystack = sessionHaystack(s);
    if (tokens.every((t) => haystack.includes(t))) out.push(i);
  });
  return out;
}

/**
 * Whether a block row starts expanded in the calendar.
 * - A single day is selected: the student is planning that day, so show its timeline.
 * - A search matched a sub-session: show the matching session (otherwise the hit is invisible).
 * - Otherwise ("All days"): collapsed, so a long block (Friday has 11 sessions) doesn't bury
 *   the rest of the week.
 */
export function defaultProgramOpen(
  entry: Pick<ScheduleEntry, "sessions">,
  filters: { day: ISODate | null; q: string },
): boolean {
  if (!hasProgram(entry)) return false;
  if (filters.day) return true;
  return matchingSessionIndexes(entry, filters.q).length > 0;
}

export interface TrackSegment {
  /** Offset from the block start, as a % of the block's length. */
  left: number;
  /** Length as a % of the block's length. */
  width: number;
  /** Features an office-hours mentor. */
  mentor: boolean;
  logistics: boolean;
}

/** Proportional segments for the block's mini timeline (empty when the block has no exact span). */
export function programTrack(entry: Pick<ScheduleEntry, "sessions" | "time">): TrackSegment[] {
  if (entry.time.kind !== "exact" || !entry.time.end || !entry.sessions.length) return [];
  const start = minutesOfDay(entry.time.start);
  const span = minutesOfDay(entry.time.end) - start;
  if (span <= 0) return [];
  const pct = (n: number) => Math.round((n / span) * 10000) / 100;
  return entry.sessions.map((s) => {
    const a = Math.max(0, minutesOfDay(s.start) - start);
    const b = Math.min(span, minutesOfDay(s.end) - start);
    return {
      left: pct(a),
      width: pct(Math.max(0, b - a)),
      mentor: s.people.some((p) => Boolean(p.mentorId)),
      logistics: isLogistics(s),
    };
  });
}
