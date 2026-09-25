/**
 * Read queries for the organizer view (dashboard, detail page, CSV export).
 * Server-only: applicant records never leave the server except to an authenticated organizer.
 */
import "server-only";
import type { ApplicationStatus, AppointmentStatus } from "@/lib/applications/constants";
import { APPLICATION_STATUSES } from "@/lib/applications/constants";
import type { Queryable } from "@/lib/db/client";
import { NO_TIME_SELECTED, type ApplicationFilters } from "./filters";

export interface AppointmentRecord {
  id: string;
  applicationId: string;
  mentorId: string;
  slotId: string;
  /** ISO timestamps (UTC). */
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string;
}

export interface ApplicationRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  emailNormalized: string;
  year: string;
  major: string;
  participation: string;
  teamName: string | null;
  teammates: string | null;
  stage: string;
  workingOn: string;
  question: string;
  link: string | null;
  availabilityNotes: string | null;
  firstChoiceMentorId: string;
  acknowledgedNoGuarantee: boolean;
  consentToShare: boolean;
  referrerMentorId: string | null;
  organizerNotes: string;
  /** Ranked preferences; rank 1 = first choice. */
  mentors: { mentorId: string; rank: number }[];
  availability: { mentorId: string; kind: "window" | "slot"; optionId: string }[];
  /** All appointments for this application, including canceled, by start time. */
  appointments: AppointmentRecord[];
  /** Applications (including this one) submitted with the same normalized email. */
  duplicateCount: number;
}

export interface ActivityRecord {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
}

export interface ApplicationDetail {
  application: ApplicationRecord;
  activity: ActivityRecord[];
  /** Other applications from the same email (newest first). */
  related: { id: string; createdAt: string; status: ApplicationStatus }[];
  /** Active appointments for this student across ALL their applications (conflict hints). */
  studentAppointments: AppointmentRecord[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Row mapping (PGlite returns Date objects; postgres.js too — but json_build_object gives strings)
// ---------------------------------------------------------------------------

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

type RawAppointment = {
  id: string;
  applicationId?: string;
  application_id?: string;
  mentorId?: string;
  mentor_id?: string;
  slotId?: string;
  slot_id?: string;
  startsAt?: unknown;
  starts_at?: unknown;
  endsAt?: unknown;
  ends_at?: unknown;
  status: AppointmentStatus;
  createdAt?: unknown;
  created_at?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
  createdBy?: string;
  created_by?: string;
};

export function mapAppointment(r: RawAppointment): AppointmentRecord {
  const updated = r.updatedAt ?? r.updated_at;
  return {
    id: r.id,
    applicationId: (r.applicationId ?? r.application_id)!,
    mentorId: (r.mentorId ?? r.mentor_id)!,
    slotId: (r.slotId ?? r.slot_id)!,
    startsAt: iso(r.startsAt ?? r.starts_at),
    endsAt: iso(r.endsAt ?? r.ends_at),
    status: r.status,
    createdAt: iso(r.createdAt ?? r.created_at),
    updatedAt: updated == null ? null : iso(updated),
    createdBy: (r.createdBy ?? r.created_by) ?? "",
  };
}

const APPOINTMENT_JSON = `json_build_object(
  'id', ap.id, 'applicationId', ap.application_id, 'mentorId', ap.mentor_id, 'slotId', ap.slot_id,
  'startsAt', ap.starts_at, 'endsAt', ap.ends_at, 'status', ap.status,
  'createdAt', ap.created_at, 'updatedAt', ap.updated_at, 'createdBy', ap.created_by)`;

const APPLICATION_SELECT = `
  select a.id, a.created_at, a.updated_at, a.status, a.full_name, a.email, a.email_normalized, a.year, a.major,
         a.participation, a.team_name, a.teammates, a.stage, a.working_on, a.question, a.link_url,
         a.availability_notes, a.first_choice_mentor_id, a.acknowledged_no_guarantee, a.consent_to_share,
         a.referrer_mentor_id, a.organizer_notes,
         coalesce((select json_agg(json_build_object('mentorId', am.mentor_id, 'rank', am.rank) order by am.rank)
                     from application_mentors am where am.application_id = a.id), '[]'::json) as mentors,
         coalesce((select json_agg(json_build_object('mentorId', av.mentor_id, 'kind', av.option_kind, 'optionId', av.option_id)
                                   order by av.mentor_id, av.option_kind, av.option_id)
                     from application_availability av where av.application_id = a.id), '[]'::json) as availability,
         coalesce((select json_agg(${APPOINTMENT_JSON} order by ap.starts_at, ap.created_at)
                     from appointments ap where ap.application_id = a.id), '[]'::json) as appointments,
         (select count(*)::int from applications d where d.email_normalized = a.email_normalized) as duplicate_count
    from applications a`;

type RawApplication = Record<string, unknown>;

function mapApplication(r: RawApplication): ApplicationRecord {
  return {
    id: String(r.id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    status: r.status as ApplicationStatus,
    fullName: String(r.full_name),
    email: String(r.email),
    emailNormalized: String(r.email_normalized),
    year: String(r.year),
    major: String(r.major),
    participation: String(r.participation),
    teamName: (r.team_name as string | null) || null,
    teammates: (r.teammates as string | null) || null,
    stage: String(r.stage),
    workingOn: String(r.working_on),
    question: String(r.question),
    link: (r.link_url as string | null) || null,
    availabilityNotes: (r.availability_notes as string | null) || null,
    firstChoiceMentorId: String(r.first_choice_mentor_id),
    acknowledgedNoGuarantee: Boolean(r.acknowledged_no_guarantee),
    consentToShare: Boolean(r.consent_to_share),
    referrerMentorId: (r.referrer_mentor_id as string | null) || null,
    organizerNotes: String(r.organizer_notes ?? ""),
    mentors: json<ApplicationRecord["mentors"]>(r.mentors, []).map((m) => ({ mentorId: m.mentorId, rank: Number(m.rank) })),
    availability: json<ApplicationRecord["availability"]>(r.availability, []),
    appointments: json<RawAppointment[]>(r.appointments, []).map(mapAppointment),
    duplicateCount: Number(r.duplicate_count ?? 1),
  };
}

/** Escape LIKE wildcards so a search for "100%" matches literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function buildApplicationWhere(filters: ApplicationFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const p = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.mentor) {
    clauses.push(
      filters.firstChoiceOnly
        ? `exists (select 1 from application_mentors am where am.application_id = a.id and am.mentor_id = ${p(filters.mentor)} and am.rank = 1)`
        : `exists (select 1 from application_mentors am where am.application_id = a.id and am.mentor_id = ${p(filters.mentor)})`,
    );
  }
  if (filters.availability === NO_TIME_SELECTED) {
    clauses.push(`not exists (select 1 from application_availability av where av.application_id = a.id)`);
  } else if (filters.availability) {
    const [kind, id] = filters.availability.split(":");
    clauses.push(
      `exists (select 1 from application_availability av where av.application_id = a.id and av.option_kind = ${p(kind)} and av.option_id = ${p(id)})`,
    );
  }
  if (filters.status) clauses.push(`a.status = ${p(filters.status)}`);
  if (filters.q) {
    const like = p(likePattern(filters.q));
    clauses.push(
      `(a.full_name ilike ${like} or a.email ilike ${like} or a.major ilike ${like} or coalesce(a.team_name, '') ilike ${like} or coalesce(a.teammates, '') ilike ${like})`,
    );
  }
  return { sql: clauses.length ? `where ${clauses.join(" and ")}` : "", params };
}

export async function listApplications(db: Queryable, filters: ApplicationFilters): Promise<ApplicationRecord[]> {
  const where = buildApplicationWhere(filters);
  const order = filters.sort === "oldest" ? "a.created_at asc, a.id asc" : "a.created_at desc, a.id desc";
  const rows = await db.query<RawApplication>(`${APPLICATION_SELECT} ${where.sql} order by ${order}`, where.params);
  return rows.map(mapApplication);
}

export type StatusCounts = Record<ApplicationStatus, number> & { total: number };

export async function getStatusCounts(db: Queryable): Promise<StatusCounts> {
  const rows = await db.query<{ status: ApplicationStatus; n: number }>(
    `select status, count(*)::int as n from applications group by status`,
  );
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as StatusCounts;
  counts.total = 0;
  for (const r of rows) {
    if (r.status in counts) counts[r.status] = Number(r.n);
    counts.total += Number(r.n);
  }
  return counts;
}

export interface SlotUsage {
  proposed: number;
  confirmed: number;
}

/** Active (proposed + confirmed) appointment counts per slot id. */
export async function getSlotUsage(db: Queryable): Promise<Map<string, SlotUsage>> {
  const rows = await db.query<{ slot_id: string; status: AppointmentStatus; n: number }>(
    `select slot_id, status, count(*)::int as n from appointments where status <> 'canceled' group by slot_id, status`,
  );
  const usage = new Map<string, SlotUsage>();
  for (const r of rows) {
    const u = usage.get(r.slot_id) ?? { proposed: 0, confirmed: 0 };
    if (r.status === "proposed") u.proposed += Number(r.n);
    if (r.status === "confirmed") u.confirmed += Number(r.n);
    usage.set(r.slot_id, u);
  }
  return usage;
}

/** An application holding a seat in a session (an active appointment). */
export interface SlotHolder {
  appointmentId: string;
  applicationId: string;
  fullName: string;
  teamName: string | null;
  status: Exclude<AppointmentStatus, "canceled">;
}

/** Who holds each session's seats (proposed or confirmed), per slot id, earliest assignment first. */
export async function getSlotHolders(db: Queryable): Promise<Map<string, SlotHolder[]>> {
  const rows = await db.query<{
    id: string;
    slot_id: string;
    application_id: string;
    full_name: string;
    team_name: string | null;
    status: SlotHolder["status"];
  }>(
    `select ap.id, ap.slot_id, ap.application_id, a.full_name, a.team_name, ap.status
       from appointments ap join applications a on a.id = ap.application_id
      where ap.status <> 'canceled'
      order by ap.created_at, ap.id`,
  );
  const holders = new Map<string, SlotHolder[]>();
  for (const r of rows) {
    const list = holders.get(r.slot_id) ?? [];
    list.push({
      appointmentId: String(r.id),
      applicationId: String(r.application_id),
      fullName: r.full_name,
      teamName: r.team_name || null,
      status: r.status,
    });
    holders.set(r.slot_id, list);
  }
  return holders;
}

export interface MentorInterest {
  /** Active (not canceled) applications listing this mentor. */
  any: number;
  /** …of which this mentor is the first choice. */
  first: number;
}

export async function getMentorInterest(db: Queryable): Promise<Map<string, MentorInterest>> {
  const rows = await db.query<{ mentor_id: string; any: number; first: number }>(
    `select am.mentor_id, count(*)::int as any, (count(*) filter (where am.rank = 1))::int as first
       from application_mentors am join applications a on a.id = am.application_id
      where a.status <> 'canceled'
      group by am.mentor_id`,
  );
  return new Map(rows.map((r) => [r.mentor_id, { any: Number(r.any), first: Number(r.first) }]));
}

export async function getApplicationDetail(db: Queryable, id: string): Promise<ApplicationDetail | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.query<RawApplication>(`${APPLICATION_SELECT} where a.id = $1`, [id]);
  if (!row) return null;
  const application = mapApplication(row);
  const [activity, related, studentAppointments] = await Promise.all([
    db.query<{ id: string | number; at: unknown; actor: string; action: string; detail: unknown }>(
      `select id, at, actor, action, detail from application_activity where application_id = $1 order by at desc, id desc limit 200`,
      [id],
    ),
    db.query<{ id: string; created_at: unknown; status: ApplicationStatus }>(
      `select id, created_at, status from applications where email_normalized = $1 and id <> $2 order by created_at desc`,
      [application.emailNormalized, id],
    ),
    db.query<RawAppointment>(
      `select ap.* from appointments ap join applications a on a.id = ap.application_id
        where a.email_normalized = $1 and ap.status <> 'canceled' order by ap.starts_at`,
      [application.emailNormalized],
    ),
  ]);
  return {
    application,
    activity: activity.map((a) => ({
      id: String(a.id),
      at: iso(a.at),
      actor: a.actor,
      action: a.action,
      detail: json<Record<string, unknown>>(a.detail, {}),
    })),
    related: related.map((r) => ({ id: r.id, createdAt: iso(r.created_at), status: r.status })),
    studentAppointments: studentAppointments.map(mapAppointment),
  };
}
