import type { Mentor, SourceRef } from "./types";

/**
 * Production mentors — verified facts only. Order here is the order students see.
 *
 * - `role`/`company`: only what the mentor or organizers confirmed. Leave `null` rather than guess.
 * - `bio`: concise factual background built only from verified facts (or supplied by the mentor).
 * - `expertise`: grounded in verified information, each with its `basis` (shown publicly).
 * - `askMeAbout`, `goodFitFor`: must come from the mentor. Use `status: "draft"` until approved;
 *   drafts never render publicly.
 * - `availability` windows are general availability, NOT bookings. Leave empty while scheduling is
 *   being coordinated: the mentor shows "Scheduling in progress" with an "Express interest" CTA.
 * - `organizerNotes` never render publicly (stripped by content/index.ts).
 * - `slots` are specific appointment times. Add them only once times are proposed/confirmed.
 *   Slot and window ids are stored with applications — never rename or reuse them.
 * - Founders Week sessions a mentor speaks at are linked from content/events.ts (`mentorId`).
 */

const BRIEF: SourceRef = {
  label: "Founders – Illinois Entrepreneurs organizer brief",
  note: "Supplied by Founders organizers.",
  checked: "2026-09-23",
};
const AGENDA: SourceRef = {
  label: "Founders Week agenda",
  note: "Founders Showcase session listing, supplied by Founders organizers.",
  checked: "2026-09-23",
};

export const mentors: Mentor[] = [
  {
    id: "patrick-haddox",
    name: "Patrick Haddox",
    firstName: "Patrick",
    role: "CEO & Co-Founder",
    company: "Samara Aerospace",
    headshot: null,
    bio: {
      status: "approved",
      value:
        "Patrick Haddox is the CEO and co-founder of Samara Aerospace. At the Founders Showcase he joins the panel “Next Generation Industrial, Manufacturing and Space Tech.”",
      note: "Composed only from verified role, company and agenda listing.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Building an aerospace company", basis: "CEO & Co-Founder, Samara Aerospace" },
        { label: "Industrial, manufacturing & space tech", basis: "Founders Showcase panelist" },
      ],
      note: "Grounded in verified role and agenda listing. Replace with Patrick’s own topics when he supplies them.",
    },
    // Mentorship topics must come from Patrick — never inferred from his title.
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: null,
      location: null,
      sessionCount: "One or two sessions",
      confirmed: false,
      note: "Patrick will host one or two sessions in this window. Exact appointments, lengths and location are pending.",
    },
    availability: [
      {
        id: "patrick-haddox-2026-10-01-am",
        date: "2026-10-01",
        time: { kind: "exact", start: "10:00", end: "11:30" },
        note: "Availability window — not a booked appointment. One or two sessions will be scheduled within it.",
      },
    ],
    slots: [],
    links: [],
    acceptingApplications: true,
    organizerNotes: "Willing to host one or two sessions in the Thu Oct 1, 10:00–11:30 AM window. Appointment lengths and location not finalized.",
    sources: [BRIEF, AGENDA],
  },
  {
    id: "arnav-mishra",
    name: "Arnav Mishra",
    firstName: "Arnav",
    role: "Co-Founder & CTO",
    company: "Doss",
    headshot: null,
    bio: {
      status: "approved",
      value:
        "Arnav Mishra is the co-founder and CTO of Doss. At the Founders Showcase he gives the talk “From Idea to Scale — Building Doss: Lessons from an Illini Founder.”",
      note: "Composed only from verified role, company and agenda listing.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Taking a startup from idea to scale", basis: "Founders Showcase talk on building Doss" },
        { label: "Technology leadership at an early-stage company", basis: "Co-Founder & CTO, Doss" },
      ],
      note: "Grounded in verified role and agenda listing. Replace with Arnav’s own topics when he supplies them.",
    },
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: null,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "Arnav is available Friday before noon. The exact window, duration, number of sessions and location are pending.",
    },
    availability: [
      {
        id: "arnav-mishra-2026-10-02-am",
        date: "2026-10-02",
        time: { kind: "part-of-day", part: "morning", before: "12:00" },
        label: "Friday morning, before noon · Exact window pending",
        note: "Arnav is available Friday before noon. The exact window will be shared once confirmed — you can apply now.",
      },
    ],
    slots: [],
    links: [],
    acceptingApplications: true,
    organizerNotes: "Available Fri Oct 2 before noon; exact start, duration, session count and location pending. Speaking 1:55 PM at the Founders Showcase.",
    sources: [BRIEF, AGENDA],
  },
  {
    id: "vikram-lakhwara",
    name: "Vikram “Vik” Lakhwara",
    firstName: "Vik",
    // Title unverified — leave null until confirmed.
    role: null,
    company: "Stakehouse",
    headshot: null,
    bio: {
      status: "approved",
      value:
        "Vik Lakhwara is with Stakehouse. At the Founders Showcase he joins the panel “Funding Start-ups in the Midwest.”",
      note: "Composed only from verified company and agenda listing. Title and fuller bio still to be verified.",
    },
    expertise: {
      status: "approved",
      value: [{ label: "Funding start-ups in the Midwest", basis: "Founders Showcase panelist" }],
      note: "Grounded in the agenda listing only. Verify areas of expertise with Vik before adding more.",
    },
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: null,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "Office-hours format and availability are pending coordination. Founders will follow up once availability is finalized.",
    },
    // Scheduling in progress. Vik has existing commitments Wednesday through Saturday morning —
    // those are NOT available slots; do not add a window in that period.
    availability: [],
    slots: [],
    links: [],
    acceptingApplications: true,
    organizerNotes:
      "Existing commitments Wednesday through Saturday morning — these are not available slots; do not schedule or display that period as available. Verify title, fuller bio and areas of expertise before publishing more.",
    sources: [BRIEF, AGENDA],
  },
  {
    id: "ron-lewis",
    name: "Ron Lewis",
    firstName: "Ron",
    role: "Co-Founder",
    company: "Auctus Advisory",
    headshot: null,
    bio: {
      status: "approved",
      value:
        "Ron is a repeat entrepreneur and co-founder of Auctus Advisory, where he advises on revenue optimization, financial forecasting, and stakeholder communication.",
      note: "Supplied by Founders organizers.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Revenue optimization", basis: "Advises on this at Auctus Advisory" },
        { label: "Financial forecasting", basis: "Advises on this at Auctus Advisory" },
        { label: "Stakeholder communication", basis: "Advises on this at Auctus Advisory" },
      ],
      note: "Taken from Ron’s supplied bio.",
    },
    askMeAbout: {
      status: "draft",
      value: [
        "Revenue strategy",
        "Startup financial planning",
        "Communicating business progress to stakeholders",
      ],
      note: "Suggested topics pending Ron’s confirmation. Set status to \"approved\" once he confirms.",
    },
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: null,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "Exact date, time and session format are pending. Founders will follow up once availability is finalized.",
    },
    // Scheduling in progress — add windows/slots here once Ron's availability is confirmed.
    availability: [],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }],
    acceptingApplications: true,
    organizerNotes:
      "Willing to help. Exact date, time and session format pending. Confirm suggested discussion topics with Ron before publishing them.",
    sources: [BRIEF],
  },
];
