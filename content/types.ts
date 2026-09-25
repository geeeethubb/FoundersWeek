/**
 * Content model for Founders × Founders Week.
 *
 * Everything public on the site (events, mentors, availability, appointment slots, site
 * settings) is plain data in /content. Components never hard-code schedule facts.
 * All dates and times are local to America/Chicago (Central Time).
 */

/** Calendar date in Central Time, `YYYY-MM-DD`. */
export type ISODate = string;

/** 24-hour wall-clock time in Central Time, `HH:mm`. */
export type LocalTime = string;

/**
 * When something happens on its date.
 * - `exact`: start (and usually end) are known.
 * - `part-of-day`: only a rough window is known ("Friday morning, before noon").
 * - `tba`: date known, time not announced.
 */
export type TimeSpec =
  | { kind: "exact"; start: LocalTime; end?: LocalTime }
  | {
      kind: "part-of-day";
      part: "morning" | "afternoon" | "evening";
      /** Latest possible end, if known (e.g. "12:00" for "before noon"). */
      before?: LocalTime;
      /** Earliest possible start, if known. */
      after?: LocalTime;
    }
  | { kind: "tba" };

/**
 * How firm an event is.
 * - `confirmed`: date, time and place confirmed by the organizer.
 * - `planned`: announced/planned, pending final organizer confirmation.
 * - `tentative`: under discussion; may change substantially.
 * - `canceled`: kept visible so shared links still explain what happened.
 */
export type ConfirmationStatus = "confirmed" | "planned" | "tentative" | "canceled";

/**
 * Founders' (the student org's) relationship to an event. Only set when a source supports it.
 * - `hosted`: Hosted by Founders.
 * - `cohosted`: Co-hosted by Founders with another organizer.
 * - `supported`: Supported by Founders (sponsor, promotion partner, student participation…).
 * - `week`: Part of Founders Week, organized by someone else.
 * `null`: listed for reference only.
 */
export type Involvement = "hosted" | "cohosted" | "supported" | "week";

export type EventType =
  | "talk"
  | "panel"
  | "workshop"
  | "networking"
  | "office-hours"
  | "pitch"
  | "social"
  | "other";

export type EventLocation =
  | { kind: "in-person"; venue: string; room?: string; address?: string; mapUrl?: string }
  | { kind: "virtual"; platform?: string; url?: string }
  | { kind: "hybrid"; venue: string; room?: string; address?: string; url?: string }
  | { kind: "tba"; note?: string };

export interface SourceRef {
  /** Human-readable name of the source, e.g. "Official Founders Week schedule". */
  label: string;
  url?: string;
  /** Context such as who supplied it and when. */
  note?: string;
  /** Date the source was last checked, `YYYY-MM-DD`. */
  checked?: ISODate;
}

export interface Speaker {
  name: string;
  /** Role/affiliation as stated by the source. Only rendered when `verified`. */
  title?: string;
  /** Speakers are only shown publicly when verified against a source. */
  verified: boolean;
  /** "moderator" when the source says "moderated by"; "host" for the person hosting the event. */
  role?: "moderator" | "host";
  /** Links the speaker to an office-hours mentor profile (content/mentors.ts id). */
  mentorId?: string;
  /** Public profile supplied by organizers (e.g. LinkedIn); the name links to it. */
  profileUrl?: string;
}

/**
 * A timed session inside a program block (e.g. "Panel Discussion" 1:15–2:15 PM within
 * "The Science and Practice of Pitching"). Times are Central Time, within the block's time.
 */
export interface ProgramSession {
  start: LocalTime;
  end: LocalTime;
  title: string;
  /** Verified people for this session; empty for logistics (lunch, check-in). */
  people: Speaker[];
  /** e.g. "Additional participants to be announced." */
  peopleNote?: string;
}

export interface ScheduleEvent {
  /** Stable URL slug. Changing it breaks shared links. */
  id: string;
  title: string;
  date: ISODate;
  time: TimeSpec;
  status: ConfirmationStatus;
  /** Short explanation of the status, e.g. "Pending final organizer confirmation." */
  statusNote?: string;
  types: EventType[];
  involvement: Involvement | null;
  /** Editorial recommendation from Founders. */
  foundersPick: boolean;
  /** Who runs the event. `null` when the source doesn't say. */
  organizer: string | null;
  location: EventLocation;
  /** One or two sentences for the agenda row. */
  summary: string;
  /** Full description. Blank lines separate paragraphs. */
  description: string;
  speakers: Speaker[];
  topics: string[];
  registration: { url: string; label?: string } | null;
  /** Official information links (e.g. "Event information"). */
  links?: { label: string; url: string }[];
  /** Timed sub-sessions when the event is a program block. */
  sessions?: ProgramSession[];
  /**
   * Featured placement in promotional sections (home, top of the calendar). Lower rank = higher
   * priority. Office hours are always rank 1 (generated). The agenda itself stays chronological.
   */
  featured?: { rank: number };
  /** Listed as a related event outside the official Founders Week program. */
  related?: boolean;
  /**
   * Informational note shown on the event page (no call to action), e.g. a related private
   * session Founders is supporting.
   */
  callout?: { title: string; body: string };
  sources: SourceRef[];
  /** Fictional content for visual development. Never shipped in production. */
  demo?: boolean;
}

/**
 * Content that must be approved before it is shown publicly
 * (mentor bios, "ask me about" topics, etc.). Drafts are only visible to organizers
 * in preview (SHOW_DRAFT_CONTENT=true outside production).
 */
export interface Draftable<T> {
  status: "draft" | "approved";
  value: T;
  /** Where the content came from / what still needs checking. */
  note?: string;
}

export type SessionFormat = "in-person" | "virtual" | "hybrid";

/** When a mentor is generally available. Not an appointment. */
export interface AvailabilityWindow {
  /** Stable id; referenced by applications. */
  id: string;
  date: ISODate;
  time: TimeSpec;
  /** Optional display override, e.g. "Friday morning · Exact times TBA". */
  label?: string;
  /** Public note shown under the window. */
  note?: string;
}

/**
 * A specific appointment time within a window.
 * - `proposed`: a time Founders has proposed; not yet confirmed by the mentor.
 * - `confirmed`: time and duration confirmed by the mentor; can be assigned and confirmed.
 */
export interface AppointmentSlot {
  /** Stable id; referenced by applications and appointments. Never reuse. */
  id: string;
  windowId: string;
  date: ISODate;
  start: LocalTime;
  end: LocalTime;
  /** How many applications (individuals or teams) can be seated in this slot. */
  capacity: number;
  status: "proposed" | "confirmed";
  format?: SessionFormat;
  location?: string;
}

export interface Mentor {
  /** Stable URL slug. */
  id: string;
  name: string;
  firstName: string;
  /** Verified role/title. `null` when not confirmed — never guess from other facts. */
  role: string | null;
  /** Verified company. */
  company: string | null;
  headshot: { src: string; alt: string; width: number; height: number } | null;
  /** Concise factual background. */
  bio: Draftable<string> | null;
  /**
   * Relevant expertise grounded in verified information. Each item states its `basis`
   * (e.g. "Founders Showcase panelist") so readers can see where it comes from.
   * Distinct from `askMeAbout`, which must be confirmed by the mentor.
   */
  expertise: Draftable<{ label: string; basis: string }[]> | null;
  /**
   * Short public tags describing the mentor's background (e.g. "Medtech"), shown under
   * "Background". Areas the mentor knows from experience, not topics they agreed to cover.
   */
  backgroundTags?: string[];
  /** "Ask me about" topics — must come from the mentor, not be inferred. */
  askMeAbout: Draftable<string[]> | null;
  /** Who the conversation would be useful for. */
  goodFitFor: Draftable<string[]> | null;
  session: {
    format: SessionFormat | null;
    durationMinutes: number | null;
    location: string | null;
    /** Street address for `location`, when known (e.g. "515 E. Gregory Drive, Champaign, IL 61820"). */
    address?: string | null;
    /** e.g. "One or two sessions". */
    sessionCount: string | null;
    /** True once format, duration and location are confirmed. */
    confirmed: boolean;
    /** Public note about what is still being finalized. */
    note?: string;
  };
  /**
   * General availability. Leave empty while scheduling is still being coordinated — the mentor
   * is then shown as "Scheduling in progress" and students can express interest without
   * choosing a time. Never list a period the mentor has said they are unavailable.
   */
  availability: AvailabilityWindow[];
  slots: AppointmentSlot[];
  /** Verified public links (e.g. LinkedIn). */
  links: { label: string; url: string }[];
  /** Whether students can currently select this mentor in the application. */
  acceptingApplications: boolean;
  /**
   * Organizer-only notes (constraints, what still needs verifying). Stripped from public data;
   * shown only in the protected organizer view.
   */
  organizerNotes?: string;
  sources: SourceRef[];
  demo?: boolean;
}

export interface SiteSettings {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  university: string;
  timezone: "America/Chicago";
  org: {
    name: string;
    shortName: string;
    description: string;
    url: string | null;
    contactEmail: string | null;
    instagram: string | null;
    linkedin: string | null;
  };
  week: {
    name: string;
    year: number;
    /** Official Founders Week page, if one exists. */
    officialUrl: string | null;
    /** Official start/end dates, if published. */
    dates: { start: ISODate; end: ISODate } | null;
    /** Whether the schedule here covers the full official program. */
    scheduleCompleteness: "partial" | "complete";
    /** Date the schedule content was last reviewed, `YYYY-MM-DD`. */
    lastReviewed: ISODate;
  };
  applications: {
    /** Master switch for the office-hours application. */
    open: boolean;
    /** ISO 8601 timestamp with offset, e.g. "2026-09-28T23:59:00-05:00". `null` = not set. */
    opensAt: string | null;
    /** ISO 8601 timestamp with offset. `null` = no deadline announced. */
    deadline: string | null;
    /** ISO 8601 date. `null` = not announced. */
    decisionsBy: string | null;
    /** Email domains accepted as "Illinois email". */
    emailDomains: string[];
  };
  /**
   * How office-hours sessions are scheduled (organizer policy, 2026-09-24): every session is
   * `sessionMinutes` long with a `breakMinutes` break before the next one. Availability windows
   * are split into sessions on this grid (lib/schedule/sessions.ts).
   */
  officeHours: {
    sessionMinutes: number;
    breakMinutes: number;
  };
  brand: {
    /** Path under /public to the Founders logo, with intrinsic size. `null` = typographic lockup. */
    foundersLogo: { src: string; width: number; height: number; alt: string } | null;
    /** Path under /public to an approved Illinois mark, with intrinsic size. */
    illinoisMark: { src: string; width: number; height: number; alt: string } | null;
  };
}
