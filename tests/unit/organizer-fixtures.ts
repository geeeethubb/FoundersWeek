/**
 * Shared fixtures for organizer tests: insert applications directly with SQL (the public
 * application API is tested separately) and build the slot lookup from fixture content.
 */
import { demoMentors } from "@/content/demo";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Queryable } from "@/lib/db/client";
import { buildOrganizerDirectory, type SlotInfo } from "@/lib/organizer/directory";

/** The office-hours rule from site settings (never hard-coded in tests of app behavior). */
export const RULE = site.officeHours;

/** Production + demo mentors, with sessions generated from exact windows under site.officeHours. */
export const directory = buildOrganizerDirectory([...mentors, ...demoMentors], RULE);

/** Content slots and generated sessions, plus extra test-only slots (e.g. one overlapping demo-avery-slot-1400). */
export function slotMap(extra: Partial<SlotInfo>[] = []): Map<string, SlotInfo> {
  const map = new Map(directory.slotsById);
  for (const e of extra) {
    const base = directory.slotsById.get("demo-avery-slot-1400")!;
    const slot: SlotInfo = { ...base, ...e, label: `${e.date ?? base.date} ${e.start}–${e.end}` } as SlotInfo;
    map.set(slot.id, slot);
  }
  return map;
}

let counter = 0;

export async function insertApplication(
  db: Queryable,
  overrides: {
    email?: string;
    fullName?: string;
    status?: string;
    major?: string;
    teamName?: string | null;
    mentors?: string[];
    availability?: string[];
    createdAt?: string;
  } = {},
): Promise<string> {
  counter++;
  const email = overrides.email ?? `student${counter}@illinois.edu`;
  const mentorIds = overrides.mentors ?? ["demo-avery-sample"];
  const [{ id }] = await db.query<{ id: string }>(
    `insert into applications (idempotency_key, status, full_name, email, email_normalized, year, major, participation,
       team_name, stage, working_on, question, first_choice_mentor_id, acknowledged_no_guarantee, consent_to_share, created_at)
     values (gen_random_uuid(), $1, $2, $3, $4, 'junior', $5, $6, $7, 'idea', 'Working on it', 'A question', $8, true, true,
             coalesce($9::timestamptz, now()))
     returning id`,
    [
      overrides.status ?? "submitted",
      overrides.fullName ?? `Student ${counter}`,
      email,
      email.trim().toLowerCase(),
      overrides.major ?? "Computer Science",
      overrides.teamName ? "team" : "individual",
      overrides.teamName ?? null,
      mentorIds[0],
      overrides.createdAt ?? null,
    ],
  );
  for (const [i, m] of mentorIds.entries()) {
    await db.query(`insert into application_mentors (application_id, mentor_id, rank) values ($1, $2, $3)`, [id, m, i + 1]);
  }
  for (const key of overrides.availability ?? []) {
    const [kind, optionId] = key.split(":");
    const owner =
      kind === "slot" ? directory.slotsById.get(optionId)?.mentorId : directory.windowsById.get(optionId)?.mentorId;
    await db.query(
      `insert into application_availability (application_id, mentor_id, option_kind, option_id) values ($1, $2, $3, $4)`,
      [id, owner ?? mentorIds[0], kind, optionId],
    );
  }
  return id;
}

export async function applicationStatus(db: Queryable, id: string): Promise<string> {
  const [row] = await db.query<{ status: string }>(`select status from applications where id = $1`, [id]);
  return row.status;
}
