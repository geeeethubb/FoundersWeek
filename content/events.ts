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
 * on 2026-09-23 and is intentionally no longer listed anywhere on the site. (Arnav Mishra's
 * Wednesday happy hour at Legends is a separate event, added 2026-09-24.)
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
    title: "Fireside Chat with Dan Caruso",
    date: "2026-09-28",
    // Start time supplied by organizers; no end time was given (so no calendar export yet).
    time: { kind: "exact", start: "16:00" },
    status: "confirmed",
    types: ["talk"],
    involvement: "supported",
    foundersPick: true,
    organizer: null,
    location: {
      kind: "in-person",
      venue: "Beckman Institute",
      room: "Auditorium (Room 1025)",
      address: "405 N. Mathews Ave., Urbana, IL 61801",
    },
    summary:
      "A fireside chat with Illinois alum Dan Caruso, founder of Caruso Ventures and founding CEO of Zayo Group.",
    description:
      "Dan Caruso is one of the most successful entrepreneurs among Illinois alumni. He co-founded Zayo Group in 2007 and, as founding CEO and chairman, took it public in 2014 and grew it through organic expansion and 45 acquisitions into one of the largest commercial fiber networks in the world, before its $14.3 billion take-private in 2020. A 1986 Illinois mechanical engineering graduate, he was earlier a founding executive of Level 3 Communications; including Zayo, he has been part of three fiber startups valued at more than $10 billion. In 2020 he founded Caruso Ventures, which invests in quantum technology, space tech and other Colorado scaleups.\n\nThis fireside chat is supported by Founders – Illinois Entrepreneurs.",
    speakers: [{ name: "Dan Caruso", title: "Founder, Caruso Ventures · Founding CEO, Zayo Group", verified: true }],
    topics: ["fiber infrastructure", "scaling a company", "venture investing"],
    registration: null,
    links: [{ label: "Dan Caruso on LinkedIn", url: "https://www.linkedin.com/in/danielpcaruso" }],
    featured: { rank: 2 },
    related: true,
    callout: {
      title: "Private session with Dan Caruso",
      body: "Founders is also supporting student participation in a separate private session with Dan Caruso. Attending the fireside chat doesn’t include access to the private session.",
    },
    sources: [
      AGENDA,
      {
        label: "Organizer update: Mon Sept 28, 4 p.m., Beckman Institute Auditorium (Room 1025)",
        note: "Supplied by Founders organizers.",
        checked: "2026-09-24",
      },
      {
        label: "Grainger College of Engineering, Distinguished Alumni: Dan Caruso",
        url: "https://grainger.illinois.edu/alumni/distinguished/caruso",
        checked: "2026-09-24",
      },
      {
        label: "Caruso Ventures: about Dan Caruso",
        url: "https://carusoventures.com/book",
        checked: "2026-09-24",
      },
    ],
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
    location: {
      kind: "in-person",
      venue: "Materials Science and Engineering Building",
      room: "Room 100",
      address: "1304 W. Green St., Urbana, IL 61801",
    },
    summary:
      "A panel of recent Illinois alumni, led by Austin Kennedy. Co-hosted by Founders.",
    description:
      "A panel of recent Illinois alumni led by Austin Kennedy, co-hosted by Founders – Illinois Entrepreneurs.\n\n“How to Make $10K/Month in College” is the event’s title, not a promise of earnings. Check the official event page for details.",
    speakers: [{ name: "Austin Kennedy", title: "Recent Illinois alumnus", verified: true }],
    topics: [],
    registration: null,
    links: [{ label: "Event information", url: "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college" }],
    featured: { rank: 3 },
    related: true,
    sources: [
      AGENDA,
      { label: "Official event page", url: "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college" },
      {
        label: "Organizer update: Materials Science and Engineering Building, Room 100, 1304 W. Green St., Urbana",
        note: "Supplied by Founders organizers.",
        checked: "2026-09-24",
      },
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
    summary: "Founders Week kicks off with a reception at EnterpriseWorks.",
    description: "Founders Week opens with a kickoff reception at EnterpriseWorks.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },

  {
    // Arnav's Siebel School Speaker Series talk ("Tech Talk @ Siebel"), added at his suggestion.
    // Official title, title-cased (the listing reads "and other Founder Stories").
    id: "building-an-ai-native-company",
    title: "Building an AI-Native Company: Databases, Distributed Systems, and Other Founder Stories",
    date: "2026-09-30",
    // The Siebel School calendar lists a 3:30 PM start and no end time (so no calendar export yet).
    time: { kind: "exact", start: "15:30" },
    status: "confirmed",
    types: ["talk"],
    // A Siebel School talk; no source ties it to Founders or the Founders Week program.
    involvement: null,
    foundersPick: false,
    organizer: "Siebel School of Computing and Data Science",
    location: {
      kind: "in-person",
      venue: "Siebel Center for Computer Science",
      room: "Room 2405",
      address: "201 N. Goodwin Ave., Urbana, IL 61801",
    },
    summary:
      "A Siebel School Speaker Series talk by Arnav Mishra, co-founder and CTO of Doss, on the engineering behind an AI-native company.",
    description:
      "A Siebel School Speaker Series talk by Arnav Mishra, co-founder and CTO of Doss and one of this week’s office-hours mentors. Doss is building an AI-native ERP, and in his words, the talk explores “the architectural bets we’ve made to account for the future of software, while continuing to serve customers today.”\n\nHe’ll focus on three parts of that build: designing structured data storage for people and AI agents, orchestrating complex business logic across a distributed data layer, and building interfaces that give nontechnical users the flexibility of front-end code. He’ll also share how customer conversations, selling and fundraising shape those technical decisions.",
    speakers: [{ name: "Arnav Mishra", title: "Co-Founder & CTO, Doss", verified: true, mentorId: "arnav-mishra" }],
    topics: ["AI-native software", "databases", "distributed systems"],
    registration: null,
    links: [{ label: "Event information", url: "https://calendars.illinois.edu/detail/7046?eventId=33563773" }],
    related: true,
    sources: [
      {
        label: "Siebel School Speaker Series calendar: Arnav Mishra, “Building an AI-Native Company”",
        url: "https://calendars.illinois.edu/detail/7046?eventId=33563773",
        note: "Date, 3:30 PM start (no end time in the listing or its calendar file), Room 2405, sponsor, abstract and bio.",
        checked: "2026-09-25",
      },
      {
        label: "Organizer update: Arnav suggested adding his tech talk at Siebel",
        note: "From Arnav Mishra, relayed by Founders organizers. Street address from Arnav (for his office hours in the same building), in the calendar’s address style.",
        checked: "2026-09-25",
      },
    ],
  },

  {
    id: "happy-hour-at-legends-with-arnav-mishra",
    title: "Happy Hour with Arnav Mishra at Legends",
    date: "2026-09-30",
    time: { kind: "exact", start: "17:00", end: "19:00" },
    status: "confirmed",
    types: ["social", "networking"],
    // Organizers: Arnav's event, supported by Founders.
    involvement: "supported",
    foundersPick: true,
    organizer: "Arnav Mishra (Co-Founder & CTO, Doss)",
    location: { kind: "in-person", venue: "Legends", address: "6th & Green" },
    summary:
      "Arnav Mishra of Doss invited the Founders community to his happy hour at Legends, an open hang to talk post-grad life and startups. Food and drinks are covered. RSVP on Partiful.",
    description:
      "Arnav Mishra, co-founder and CTO of Doss, invited the Founders community to his happy hour at Legends (6th & Green). He’s a UIUC alum (class of ’18) and one of this week’s office-hours mentors.\n\nIn his words, it’s “open to anyone who wants to hang to talk post-grad life, startups, or nothing in particular.” Food and drinks are covered by the host. RSVP on Partiful is required.\n\nThis happy hour is supported by Founders – Illinois Entrepreneurs.",
    speakers: [
      { name: "Arnav Mishra", title: "Co-Founder & CTO, Doss", verified: true, role: "host", mentorId: "arnav-mishra" },
    ],
    topics: ["startups", "post-grad life"],
    registration: { url: "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN", label: "RSVP on Partiful" },
    featured: { rank: 4 },
    related: true,
    sources: [
      {
        label: "Partiful: Happy Hour @ Legends (hosted by Arnav Mishra)",
        url: "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN",
        checked: "2026-09-24",
      },
    ],
  },

  {
    id: "founder-failure-lab",
    title: "Founder Failure Lab",
    date: "2026-09-30",
    time: { kind: "exact", start: "18:30", end: "20:30" },
    status: "confirmed",
    types: ["panel"],
    involvement: "hosted",
    foundersPick: true,
    organizer: "Founders – Illinois Entrepreneurs",
    location: {
      kind: "in-person",
      venue: "Campus Instructional Facility (CIF)",
      room: "Room 1038",
      address: "1405 Springfield Ave., Urbana, IL 61801",
    },
    summary:
      "Why do startups actually fail? Guess what sank real companies, learn the most common mistakes and how to avoid them, and hear three founders share their own failures. Hosted by Founders.",
    // Organizers' two blurbs, combined. The statistics are CB Insights' (see sources). Ends at
    // 8:30 PM, as on Luma (organizers confirmed 2026-09-24; their first note said 8:00 PM).
    description:
      "The setbacks. The hard lessons. The next attempt.\n\nWhy do startups actually fail? In a CB Insights analysis of hundreds of startup shutdowns, 70% ran out of capital, 43% struggled with product-market fit, and 29% suffered from bad timing. At Founder Failure Lab, you’ll guess what caused real companies to fail and learn the most common mistakes startups make and how to avoid them.\n\nYou’ll also hear from Manu Edakara, director of the iVenture Accelerator and a Forbes 30 Under 30 honoree; Sharan Mehta, founder of NoshBox and an iVenture 11 participant; and Nick Militello, founder of VORO and PromoPigeon and a participant in iVenture 10 and 12. They’ll share their own failures (the setbacks, the difficult decisions and the resilience to keep going) and what they learned from them. Bring your questions.",
    speakers: [
      {
        name: "Manu Edakara",
        title: "Director, iVenture Accelerator · Forbes 30 Under 30",
        verified: true,
        profileUrl: "https://www.linkedin.com/in/manuedakara/",
      },
      {
        name: "Sharan Mehta",
        title: "Founder, NoshBox · iVenture 11",
        verified: true,
        profileUrl: "https://www.linkedin.com/in/sharanmehta/",
      },
      {
        name: "Nick Militello",
        title: "Founder, VORO and PromoPigeon · iVenture 10 and 12",
        verified: true,
        profileUrl: "https://www.linkedin.com/in/nickdymondmilitello/",
      },
    ],
    topics: ["why startups fail", "setbacks", "resilience"],
    registration: { url: "https://luma.com/hyoeuqh1", label: "Register on Luma" },
    featured: { rank: 5 },
    sources: [
      {
        label: "Founders organizer announcement: Founder Failure Lab",
        note: "Date, time, room and address, speakers, LinkedIn links and both blurbs supplied by Founders organizers.",
        checked: "2026-09-24",
      },
      {
        label: "Luma: Founder Failure Lab (registration)",
        url: "https://luma.com/hyoeuqh1",
        note: "Title, Sept 30 6:30–8:30 PM CT (end time confirmed by organizers), CIF 1038, free registration.",
        checked: "2026-09-24",
      },
      {
        label: "CB Insights: The top 9 reasons startups fail (March 2026)",
        url: "https://www.cbinsights.com/research/report/startup-failure-reasons-top/",
        note: "431 VC-backed startups that shut down since 2023; reasons identified for 385: 70% ran out of capital, 43% poor product-market fit, 29% bad timing.",
        checked: "2026-09-24",
      },
      {
        label: "Entrepreneurship at Illinois: Manu Edakara, Director, iVenture Accelerator",
        url: "https://www.entrepreneurship.illinois.edu/staff/manu-edakara",
        checked: "2026-09-24",
      },
      {
        label: "Forbes 30 Under 30 2020, Education: Manu Edakara",
        url: "https://www.forbes.com/pictures/5dcf200de0af7b0006b1754a/manu-edakara-27/",
        checked: "2026-09-24",
      },
    ],
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
      "A midday program on pitching at the Gies Business Instructional Facility: lunch, welcome remarks, then a panel discussion on the science and practice of pitching.",
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
    summary: "A panel discussion and networking at the Beckman Institute. Arnav Mishra of Doss is on the panel.",
    description:
      "A panel discussion on launching from Illinois at the Beckman Institute in Urbana, followed by networking.\n\nArnav Mishra, co-founder and CTO of Doss and one of this week’s office-hours mentors, is on the panel.",
    // Arnav told the organizers he's on this panel (Sept 25). No other panelists were supplied.
    speakers: [{ name: "Arnav Mishra", title: "Co-Founder & CTO, Doss", verified: true, mentorId: "arnav-mishra" }],
    topics: [],
    registration: null,
    sources: [
      AGENDA,
      {
        label: "Organizer update: Arnav Mishra is on this panel",
        note: "From Arnav Mishra, relayed by Founders organizers.",
        checked: "2026-09-25",
      },
    ],
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
          { name: "Elliott Notrica", verified: true, mentorId: "elliott-notrica" },
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
      "A full day of talks and panels on quantum, physical AI, health innovation and funding in the Midwest. Office-hours mentors Rishab Veldur, Arnav Mishra, Patrick Haddox and Vik Lakhwara are on stage.",
    description:
      "The daytime Founders Showcase program at the Illinois Conference Center: breakfast networking, the showcase kickoff, a fireside chat with Chancellor Charles Isbell, and sessions on quantum, robotics and physical AI, health innovation, space tech and funding start-ups in the Midwest. The day wraps up with innovation tours and structured networking.\n\nFour of this week’s office-hours mentors are speaking: Rishab Veldur (Auvi Labs), Arnav Mishra (Doss), Patrick Haddox (Samara Aerospace) and Vik Lakhwara (Stakehouse).",
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
          { name: "Rishab Veldur", verified: true, mentorId: "rishab-veldur" },
          { name: "Rohit Bhargava", verified: true },
        ],
      },
      {
        start: "13:55",
        end: "14:25",
        title: "From Idea to Scale: Building Doss, Lessons from an Illini Founder",
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
      "The university’s Founders Week evening showcase and reception at the Illinois Conference Center:\n\n• Live music by New Souls.\n• Entrepreneurship FamILLy Meeting: a panel on the future of Entrepreneurship at Illinois.\n• Fast-pitch showcase of 10 Entrepreneurship at Illinois startups.\n• Awards and networking.",
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
    statusNote: "Time to be announced.",
    types: ["social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Atkins Patio & Lawn and EnterpriseWorks" },
    summary: "A tailgate at Atkins Patio & Lawn and a tour of EnterpriseWorks.",
    // "When" already says "Time to be announced"; the description doesn't repeat it.
    description: "A Founders Week tailgate at Atkins Patio & Lawn, with a tour of EnterpriseWorks.",
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
    // As for the tailgate: the page says "Time to be announced" once, under "When".
    statusNote: "Time to be announced.",
    types: ["social"],
    involvement: "week",
    foundersPick: false,
    organizer: UNIVERSITY,
    location: { kind: "in-person", venue: "Memorial Stadium" },
    summary: "Illinois vs. Purdue at Memorial Stadium. It’s on the Founders Week agenda, but tickets aren’t included.",
    description:
      "Illinois vs. Purdue at Memorial Stadium, listed on the Founders Week agenda.\n\nThis listing doesn’t include admission or tickets.",
    speakers: [],
    topics: [],
    registration: null,
    sources: [AGENDA],
  },
];
