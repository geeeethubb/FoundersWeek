/**
 * Mentor headshots keyed by mentor id, so calendar rows (office hours, mentors on stage, hosts)
 * can show the approved photo. Schedule entries only carry a mentor's id and name; pages build
 * this map from `getMentors()` and pass it down (client components get it as a plain prop).
 */
import type { Mentor } from "@/content/types";

export type Headshot = NonNullable<Mentor["headshot"]>;
export type MentorHeadshots = Record<string, Headshot>;

/** Expects public mentors (from `getMentors()`). Mentors without an approved photo are left out. */
export function mentorHeadshots(mentors: Pick<Mentor, "id" | "headshot">[]): MentorHeadshots {
  const out: MentorHeadshots = {};
  for (const m of mentors) if (m.headshot) out[m.id] = m.headshot;
  return out;
}
