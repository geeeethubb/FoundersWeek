/**
 * Office-hours sessions: every session is `sessionMinutes` long, with a `breakMinutes` break
 * before the next one (site.officeHours, 25 + 5 today). A mentor's exact availability window is
 * split into sessions on that grid, starting at the window's start:
 *
 *   Thu 10:00–11:30 → 10:00–10:25, 10:30–10:55, 11:00–11:25
 *   Thu 12:00–17:00 → 12:00–12:25, 12:30–12:55, … 16:30–16:55 (10 sessions)
 *
 * Windows without exact start and end times (part of day, time to be confirmed) have no sessions
 * yet. Students still apply to windows; organizers assign them to a specific session.
 *
 * Pure (no I/O), shared by the organizer scheduler and public copy.
 */
import type { AppointmentSlot, AvailabilityWindow, LocalTime, Mentor } from "@/content/types";
import { minutesOfDay } from "@/lib/time";

export interface SessionRule {
  sessionMinutes: number;
  breakMinutes: number;
}

export interface SessionTime {
  start: LocalTime;
  end: LocalTime;
}

function toLocalTime(minutes: number): LocalTime {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as LocalTime;
}

/** The sessions that fit inside an exact window (none for rough or date-only windows). */
export function sessionTimes(window: Pick<AvailabilityWindow, "time">, rule: SessionRule): SessionTime[] {
  const { time } = window;
  if (time.kind !== "exact" || !time.end || rule.sessionMinutes <= 0) return [];
  const step = rule.sessionMinutes + Math.max(0, rule.breakMinutes);
  const end = minutesOfDay(time.end);
  const out: SessionTime[] = [];
  for (let start = minutesOfDay(time.start); start + rule.sessionMinutes <= end; start += step) {
    out.push({ start: toLocalTime(start), end: toLocalTime(start + rule.sessionMinutes) });
  }
  return out;
}

/** Stable id for a generated session: "<windowId>-1200". Stored with appointments, so never change it. */
export function sessionSlotId(windowId: string, start: LocalTime): string {
  return `${windowId}-${start.replace(":", "")}`;
}

/**
 * Bookable sessions for a mentor: explicit `slots` in content win for their window; every other
 * exact window is split into sessions. Each generated session seats one application (a student or
 * a team) and is confirmed, because the mentor confirmed the window and the grid is Founders' rule.
 */
export function generatedSessionSlots(mentor: Pick<Mentor, "availability" | "slots">, rule: SessionRule): AppointmentSlot[] {
  const windowsWithSlots = new Set(mentor.slots.map((s) => s.windowId));
  return mentor.availability
    .filter((w) => !windowsWithSlots.has(w.id))
    .flatMap((w) =>
      sessionTimes(w, rule).map((t) => ({
        id: sessionSlotId(w.id, t.start),
        windowId: w.id,
        date: w.date,
        start: t.start,
        end: t.end,
        capacity: 1,
        status: "confirmed" as const,
      })),
    );
}

/** "Each session is 25 minutes, with a 5-minute break between sessions." */
export function sessionRuleText(rule: SessionRule): string {
  return rule.breakMinutes > 0
    ? `Each session is ${rule.sessionMinutes} minutes, with a ${rule.breakMinutes}-minute break between sessions.`
    : `Each session is ${rule.sessionMinutes} minutes.`;
}

/**
 * Problems with explicit slots under the rule: wrong length, outside an exact window, or too close
 * to (or overlapping) the previous slot in the same window. Empty when everything fits.
 */
export function slotRuleProblems(mentor: Pick<Mentor, "availability" | "slots">, rule: SessionRule): string[] {
  const problems: string[] = [];
  const windows = new Map(mentor.availability.map((w) => [w.id, w]));
  const byWindow = new Map<string, AppointmentSlot[]>();
  for (const s of mentor.slots) {
    const length = minutesOfDay(s.end) - minutesOfDay(s.start);
    if (length !== rule.sessionMinutes) {
      problems.push(`slot ${s.id} is ${length} minutes; sessions are ${rule.sessionMinutes} minutes`);
    }
    const w = windows.get(s.windowId);
    if (w && w.time.kind === "exact" && w.time.end) {
      if (minutesOfDay(s.start) < minutesOfDay(w.time.start) || minutesOfDay(s.end) > minutesOfDay(w.time.end)) {
        problems.push(`slot ${s.id} falls outside window ${w.id}`);
      }
    }
    byWindow.set(s.windowId, [...(byWindow.get(s.windowId) ?? []), s]);
  }
  for (const slots of byWindow.values()) {
    const sorted = [...slots].sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const gap = minutesOfDay(sorted[i].start) - minutesOfDay(sorted[i - 1].end);
      if (gap < 0) {
        problems.push(`slot ${sorted[i].id} overlaps ${sorted[i - 1].id}`);
      } else if (gap < rule.breakMinutes) {
        problems.push(
          `slot ${sorted[i].id} starts ${gap} minutes after ${sorted[i - 1].id} ends; sessions need a ${rule.breakMinutes}-minute break`,
        );
      }
    }
  }
  return problems;
}
