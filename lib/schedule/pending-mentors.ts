/**
 * Mentors who are taking applications but have no published availability yet
 * ("Scheduling in progress"). They have no schedule entries, so the schedule lists them in a
 * separate block where students can express interest without choosing a time.
 *
 * Only public, verified fields are carried over — never organizer notes, drafts or constraints.
 */
import type { Mentor } from "@/content/types";
import { mentorApplyHref, mentorCtaLabel, schedulingStatus } from "@/lib/mentors";
import { mentorAffiliation } from "./entries";
import { normalizeSearchText } from "./filter";

export interface PendingMentor {
  id: string;
  name: string;
  firstName: string;
  /** Verified role/company only, e.g. "Co-Founder, Auctus Advisory" or "Stakehouse". */
  affiliation: string | null;
  headshot: Mentor["headshot"];
  /** "Express interest" */
  ctaLabel: string;
  /** Application link with this mentor preselected. */
  href: string;
  demo: boolean;
}

/** Expects public mentors (from `getMentors()`). */
export function pendingMentors(mentors: Mentor[]): PendingMentor[] {
  return mentors
    .filter((m) => m.acceptingApplications && schedulingStatus(m) === "in-progress")
    .map((m) => ({
      id: m.id,
      name: m.name,
      firstName: m.firstName,
      affiliation: mentorAffiliation(m),
      headshot: m.headshot,
      ctaLabel: mentorCtaLabel(m),
      href: mentorApplyHref(m.id),
      demo: Boolean(m.demo),
    }));
}

/** Search a pending mentor by name, role and company (same matching rules as schedule entries). */
export function pendingMentorMatches(mentor: PendingMentor, query: string): boolean {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeSearchText(`${mentor.name} ${mentor.affiliation ?? ""} office hours mentor`);
  return tokens.every((t) => haystack.includes(t));
}
