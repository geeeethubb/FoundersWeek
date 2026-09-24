/**
 * Server-side content loader. Import content through here (not the raw files) so that:
 * - content is validated once,
 * - demo content is only included when explicitly enabled outside production,
 * - draft mentor copy is stripped unless draft preview is enabled outside production.
 *
 * Client components receive content as props from server components.
 */
import "server-only";
import { buildScheduleEntries, scheduleDays, type ScheduleEntry } from "@/lib/schedule/entries";
import { demoEvents, demoMentors } from "./demo";
import { events as productionEvents } from "./events";
import { mentors as productionMentors } from "./mentors";
import { site } from "./site";
import type { AppointmentSlot, AvailabilityWindow, Draftable, Mentor, ScheduleEvent, SiteSettings } from "./types";
import { validateContent } from "./validate";

function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** Fictional demo events/mentors. Never on a production deploy, even if the flag is set. */
export function isDemoContentEnabled(): boolean {
  return !isProductionDeploy() && process.env.SHOW_DEMO_CONTENT === "true";
}

/** Show unapproved (draft) mentor copy, labeled "Draft". Never on a production deploy. */
export function isDraftPreviewEnabled(): boolean {
  return !isProductionDeploy() && process.env.SHOW_DRAFT_CONTENT === "true";
}

let validated = false;
function ensureValidated() {
  if (validated) return;
  validateContent({ events: productionEvents, mentors: productionMentors, forbidDemo: true });
  validateContent({
    events: [...productionEvents, ...demoEvents],
    mentors: [...productionMentors, ...demoMentors],
    forbidDemo: false,
  });
  validated = true;
}

function publicDraftable<T>(field: Draftable<T> | null, showDrafts: boolean): Draftable<T> | null {
  if (!field) return null;
  if (field.status === "approved") return field;
  return showDrafts ? field : null;
}

/** Strip draft copy (unless draft preview is on) and organizer-only notes. Public pages must use this. */
function toPublicMentor(mentor: Mentor, showDrafts: boolean): Mentor {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { organizerNotes, ...rest } = mentor;
  return {
    ...rest,
    bio: publicDraftable(mentor.bio, showDrafts),
    expertise: publicDraftable(mentor.expertise, showDrafts),
    askMeAbout: publicDraftable(mentor.askMeAbout, showDrafts),
    goodFitFor: publicDraftable(mentor.goodFitFor, showDrafts),
  };
}

export function getSite(): SiteSettings {
  return site;
}

export function getEvents(): ScheduleEvent[] {
  ensureValidated();
  return isDemoContentEnabled() ? [...productionEvents, ...demoEvents] : [...productionEvents];
}

/** Mentors as shown publicly (drafts stripped unless draft preview is enabled). */
export function getMentors(): Mentor[] {
  ensureValidated();
  const all = isDemoContentEnabled() ? [...productionMentors, ...demoMentors] : [...productionMentors];
  const showDrafts = isDraftPreviewEnabled();
  return all.map((m) => toPublicMentor(m, showDrafts));
}

export function getMentor(id: string): Mentor | undefined {
  return getMentors().find((m) => m.id === id);
}

/**
 * Full mentor records including drafts and organizer notes.
 * ONLY for the protected organizer view — never pass to public pages.
 */
export function getMentorsForOrganizers(): Mentor[] {
  ensureValidated();
  return isDemoContentEnabled() ? [...productionMentors, ...demoMentors] : [...productionMentors];
}

export function getScheduleEntries(): ScheduleEntry[] {
  return buildScheduleEntries({ events: getEvents(), mentors: getMentors(), site });
}

export function getScheduleEntry(id: string): ScheduleEntry | undefined {
  return getScheduleEntries().find((e) => e.id === id);
}

export function getScheduleDays() {
  return scheduleDays(getScheduleEntries());
}

export interface SlotRef extends AppointmentSlot {
  mentorId: string;
}
export interface WindowRef extends AvailabilityWindow {
  mentorId: string;
}

export function getAllSlots(): SlotRef[] {
  return getMentors().flatMap((m) => m.slots.map((s) => ({ ...s, mentorId: m.id })));
}

export function getAllWindows(): WindowRef[] {
  return getMentors().flatMap((m) => m.availability.map((w) => ({ ...w, mentorId: m.id })));
}

export function findSlot(id: string): SlotRef | undefined {
  return getAllSlots().find((s) => s.id === id);
}

export function findWindow(id: string): WindowRef | undefined {
  return getAllWindows().find((w) => w.id === id);
}

export type { ScheduleEntry };
