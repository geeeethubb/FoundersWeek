import type { ScheduleEvent, SourceRef } from "./types";

/**
 * Production calendar — verified events only.
 *
 * Office-hours entries are NOT listed here: they are generated from mentor availability in
 * ./mentors.ts so times live in exactly one place (and they are always featured first).
 *
 * Before adding an event, confirm date, time, venue, organizer and Founders' involvement
 * (hosted / cohosted / supported / week) against a source, and add it to `sources`.
 * Program blocks list their timed sub-sessions in `sessions`.
 *
 * Removed: the Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled by Founders
 * on 2026-09-23 and is intentionally no longer listed anywhere on the site.
 */

const AGENDA: SourceRef = {
  label: "Founders Week agenda",
  note: "Full Founders Week calendar supplied by Founders organizers.",
  checked: "2026-09-23",
};

const UNIVERSITY = "University of Illinois Founders Week";

export const events: ScheduleEvent[] = [
  // ── Monday, September 28 — related event ───────────────────────────────────────────
  {
    id: "dan-caruso-fireside-chat",
    title: "Dan Caruso — Fireside Chat",
    date: "2026-09-28",
    time: { kind: "tba" },
    status: "planned",
    statusNote: "Time and location forthcoming.",
    types: ["talk"],
    involvement: "supported",
    foundersPick: true,
    organizer: null,
    location: { kind: "tba", note: "Location forthcoming." },
    summary: "A fireside chat with Dan Caruso, founder of Caruso Ventures. Time and location forthcoming.",
    description:
      "A fireside chat with Dan Caruso, founder of Caruso Ventures, supported by Founders – Illinois Entrepreneurs.\n\nThe time and location haven’t been announced yet. This page will be updated when they are.",
    speakers: [{ name: "Dan Caruso", title: "Founder, Caruso Ventures", verified: true }],
    topics: [],
    registration: null,
    featured: { rank: 2 },
    related: true,
    callout: {
      title: "Private session with Dan Caruso",
      body: "Founders is supporting student participation in a separate private session with Dan Caruso. Attendance at the fireside chat does not include private-session access. Private-session details are forthcoming.",
    },
    sources: [AGENDA],
  },

  // ── Tuesday, September 29 — related event ──────────────────────────────────────────
  {
    id: "how-to-make-10k-a-month-in-college",
    title: "How to Make $10K/Month in College",
    date: "2026-09-29",
    time: { kind: "exact", start: "18:00", end: "20:00" },
    status: "confirmed",
    types: ["panel"],
    involvement: "cohosted",
    foundersPick: true,
    organizer: "Austin Kennedy, co-hosted by Founders – Illinois Entrepreneurs",
    location: { kind: "in-person", venue: "100 MSEB" },
    summary:
      "A panel led by recent Illinois alumnus Austin Kennedy, featuring other recent Illinois alumni. Co-hosted by Founders.",
    description:
      "A panel led by recent Illinois alumnus Austin Kennedy, featuring other recent Illinois alumni, co-hosted by Founders – Illinois Entrepreneurs.\n\n“How to Make $10K/Month in College” is the event’s title, not a promise of earnings. See the official event page for details.",
    speakers: [{ name: "Austin Kennedy", title: "Recent Illinois alumnus", verified: true }],
    topics: [],
    registration: null,
    links: [{ label: "Event information", url: "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college" }],
    featured: { rank: 3 },
    related: true,
    sources: [
      AGENDA,
      { label: "Official event page", url: "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college" },
    ],
  },

  // ── Wednesday, September 30 ────────────────────────────────────────────────────────
  {
    id: "founders-week-kickoff-reception",
    title: "Founders Week Kickoff Reception",
    date: "2026-09-30",
    time: { kind: "exact", start: "15:30", end: "17:00" },
    status: "confirmed",
    types: ["networking", "social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "EnterpriseWorks" },
    summary: "The Founders Week kickoff reception at EnterpriseWorks.",
    description: "Founders Week opens with a kickoff reception at EnterpriseWorks.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },

  // ── Thursday, October 1 — three program blocks ─────────────────────────────────────
  {
    id: "science-and-practice-of-pitching",
    title: "The Science and Practice of Pitching",
    date: "2026-10-01",
    time: { kind: "exact", start: "11:45", end: "14:15" },
    status: "confirmed",
    types: ["panel"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Gies Business Instructional Facility", address: "Champaign" },
    summary: "Lunch, welcome remarks, and a panel discussion on the science and practice of pitching.",
    description:
      "A program block on pitching at the Gies Business Instructional Facility: lunch, welcome remarks, then a panel discussion on the science and practice of pitching.",
    speakers: [],
    topics: ["pitching"],
    registration: null,
    sessions: [
      { start: "11:45", end: "13:00", title: "Lunch", people: [] },
      {
        start: "13:00",
        end: "13:15",
        title: "Welcome Remarks",
        people: [
          { name: "Melissa Graebner", verified: true },
          { name: "Susan Martinis", verified: true },
        ],
      },
      {
        start: "13:15",
        end: "14:15",
        title: "Panel Discussion: Science and Practice of Pitching",
        people: [
          { name: "Doug Hannah", verified: true },
          { name: "Ryan Coon", verified: true },
          { name: "Nancy Sullivan", verified: true },
          { name: "Shay Brokemond", verified: true },
        ],
      },
    ],
    sources: [AGENDA],
  },
  {
    id: "entrepreneurial-impact-launching-from-illinois",
    title: "Entrepreneurial Impact: Launching From Illinois",
    date: "2026-10-01",
    time: { kind: "exact", start: "15:00", end: "17:00" },
    status: "confirmed",
    types: ["panel", "networking"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Beckman Institute", address: "Urbana" },
    summary: "Panel discussion and networking at the Beckman Institute.",
    description: "A panel discussion on launching from Illinois, followed by networking, at the Beckman Institute in Urbana.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },
  {
    id: "techrise-pitch-competition",
    title: "TechRise Pitch Competition and Panel Discussion",
    date: "2026-10-01",
    time: { kind: "exact", start: "17:00", end: "19:00" },
    status: "confirmed",
    types: ["pitch", "panel", "networking"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "EnterpriseWorks", address: "Champaign" },
    summary: "Networking, the TechRise pitch competition, a cohort panel, and prize awards at EnterpriseWorks.",
    description:
      "An evening program at EnterpriseWorks: welcome remarks and networking, the TechRise pitch competition, a “where are they now?” panel with the TechRise × University of Illinois Founders Week Cohort 2, and the prize award.",
    speakers: [],
    topics: ["pitching"],
    registration: null,
    sessions: [
      {
        start: "17:00",
        end: "17:45",
        title: "Welcome Remarks and Networking",
        people: [
          { name: "Gerald Wilson", verified: true },
          { name: "Susan Martinis", verified: true },
        ],
      },
      { start: "17:45", end: "18:30", title: "Pitch Competition", people: [] },
      {
        start: "18:30",
        end: "18:50",
        title: "TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?",
        people: [
          { name: "Mehmet Gunal", verified: true },
          { name: "Elliott Notrica", verified: true },
        ],
        peopleNote: "Additional participants to be announced.",
      },
      {
        start: "18:50",
        end: "19:00",
        title: "Prize Award and Closing Remarks",
        people: [
          { name: "Phil Rowell", verified: true },
          { name: "Susan Martinis", verified: true },
          { name: "Laura Appenzeller", verified: true },
          { name: "Gerald Wilson", verified: true },
        ],
      },
    ],
    sources: [AGENDA],
  },

  // ── Friday, October 2 — Illinois Conference Center ─────────────────────────────────
  {
    id: "founders-showcase-day-sessions",
    title: "Founders Showcase Day Sessions",
    date: "2026-10-02",
    time: { kind: "exact", start: "08:00", end: "17:30" },
    status: "confirmed",
    types: ["talk", "panel", "networking"],
    involvement: "week",
    foundersPick: true,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Illinois Conference Center" },
    summary:
      "A full day of talks and panels — quantum, physical AI, health innovation, funding in the Midwest — with office-hours mentors Arnav Mishra, Patrick Haddox and Vik Lakhwara on stage.",
    description:
      "The Founders Showcase day program at the Illinois Conference Center: breakfast networking, the showcase kickoff, a fireside chat with Chancellor Charles Isbell, and sessions on quantum, robotics and physical AI, health innovation, space tech and funding start-ups in the Midwest, followed by innovation tours and structured networking.\n\nThree of this week’s office-hours mentors speak today: Arnav Mishra (Doss), Patrick Haddox (Samara Aerospace) and Vik Lakhwara (Stakehouse).",
    speakers: [],
    topics: ["quantum", "robotics", "physical AI", "health innovation", "space tech", "funding"],
    registration: null,
    sessions: [
      { start: "08:00", end: "08:45", title: "Check-In and Breakfast Networking", people: [] },
      { start: "09:00", end: "10:00", title: "Founders Showcase Kickoff", people: [] },
      {
        start: "10:15",
        end: "10:45",
        title: "Innovating in Quantum",
        people: [
          { name: "Brian DeMarco", verified: true },
          { name: "Kelsey Ortiz", verified: true },
          { name: "Alireza Talebpour", verified: true },
          { name: "Sanjukta Kundu", verified: true },
        ],
      },
      {
        start: "11:00",
        end: "11:30",
        title:
          "Fireside Chat with Chancellor Charles Isbell: Innovation, Entrepreneurship, and Illinois’ Ambition for Impact",
        people: [
          { name: "Charles Isbell", title: "Chancellor", verified: true },
          { name: "Scott Rose", verified: true, role: "moderator" },
          { name: "Susan Martinis", verified: true, role: "moderator" },
        ],
      },
      {
        start: "11:30",
        end: "11:55",
        title: "Intelligent Systems, Robotics, and Physical AI",
        people: [
          { name: "Justin Yim", verified: true },
          { name: "Naira Hovakimyan", verified: true },
          { name: "Austin Ellis-Mohr", verified: true },
        ],
      },
      {
        start: "12:45",
        end: "13:20",
        title: "The Entrepreneurial University: A Leadership Perspective",
        people: [
          { name: "Rashid Bashir", verified: true },
          { name: "Mark Cohen", verified: true },
          { name: "Melissa Graebner", verified: true },
          { name: "Tami Craig Schilling", verified: true },
        ],
      },
      {
        start: "13:20",
        end: "13:55",
        title: "Health Innovation: From Therapeutics to Devices",
        people: [
          { name: "Marty Burke", verified: true },
          { name: "Carol Curtis", verified: true },
          { name: "Steve Boppart", verified: true },
          { name: "Rishab Veldur", verified: true },
          { name: "Rohit Bhargava", verified: true },
        ],
      },
      {
        start: "13:55",
        end: "14:25",
        title: "From Idea to Scale — Building Doss: Lessons from an Illini Founder",
        people: [
          { name: "Arnav Mishra", verified: true, mentorId: "arnav-mishra" },
          { name: "Ranjitha Kumar", verified: true, role: "moderator" },
        ],
      },
      {
        start: "14:40",
        end: "14:55",
        title: "Next Generation Industrial, Manufacturing and Space Tech",
        people: [
          { name: "Patrick Haddox", verified: true, mentorId: "patrick-haddox" },
          { name: "Ben Hooberman", verified: true },
          { name: "Adam Hamilton", verified: true },
        ],
      },
      {
        start: "14:55",
        end: "15:35",
        title: "Funding Start-ups in the Midwest",
        people: [
          { name: "Desiree Vargas", verified: true },
          { name: "Abin Kuriakose", verified: true },
          { name: "Vik Lakhwara", verified: true, mentorId: "vikram-lakhwara" },
          { name: "Sean Chou", verified: true },
          { name: "Laura Appenzeller", verified: true, role: "moderator" },
        ],
      },
      { start: "15:50", end: "17:30", title: "Innovation Tours and Structured Networking", people: [] },
    ],
    sources: [AGENDA],
  },
  {
    id: "founders-evening-showcase-and-reception",
    title: "Founders Evening Showcase and Reception",
    date: "2026-10-02",
    time: { kind: "exact", start: "18:00", end: "20:30" },
    status: "confirmed",
    types: ["pitch", "panel", "networking", "social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Illinois Conference Center" },
    summary:
      "Live music, the Entrepreneurship FamILLy Meeting panel, a fast-pitch showcase of 10 startups, awards and networking.",
    description:
      "The university’s Founders Week evening showcase and reception at the Illinois Conference Center:\n\n• Live music by New Souls.\n• Entrepreneurship FamILLy Meeting — a panel on the future of Entrepreneurship at Illinois.\n• Fast-pitch showcase of 10 Entrepreneurship at Illinois startups.\n• Awards and networking.",
    speakers: [],
    topics: ["pitching", "networking"],
    registration: null,
    sources: [AGENDA],
  },

  // ── Saturday, October 3 ────────────────────────────────────────────────────────────
  {
    id: "tailgate-and-enterpriseworks-tour",
    title: "Tailgate and EnterpriseWorks Tour",
    date: "2026-10-03",
    time: { kind: "tba" },
    status: "planned",
    statusNote: "Time forthcoming.",
    types: ["social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Atkins Patio & Lawn and EnterpriseWorks" },
    summary: "A tailgate at Atkins Patio & Lawn and a tour of EnterpriseWorks. Time forthcoming.",
    description: "A Founders Week tailgate at Atkins Patio & Lawn, with a tour of EnterpriseWorks. The time hasn’t been announced yet.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },
  {
    id: "illinois-football-vs-purdue",
    title: "Illinois Football Game vs. Purdue",
    date: "2026-10-03",
    time: { kind: "tba" },
    status: "planned",
    statusNote: "Game time not listed in the Founders Week agenda yet.",
    types: ["social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Memorial Stadium" },
    summary: "Illinois vs. Purdue at Memorial Stadium. Listed in the Founders Week agenda; tickets are not included.",
    description:
      "Illinois vs. Purdue at Memorial Stadium, listed in the Founders Week agenda. The game time isn’t in the supplied agenda yet.\n\nThis listing doesn’t include admission or tickets.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },
];
