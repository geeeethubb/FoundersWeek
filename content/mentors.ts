import { site } from "./site";
import type { Mentor, SourceRef } from "./types";

/**
 * Production mentors — verified facts only. Order here is the order students see.
 *
 * - `role`/`company`: only what the mentor, organizers or an authoritative source confirmed.
 * - `bio`: concise factual introduction built only from verified, cited facts (see `sources`).
 * - `expertise`: "Can help most with" — grounded in verified information, each with its `basis`.
 * - `askMeAbout`, `goodFitFor`: must come from the mentor or the organizers. Use `status: "draft"`
 *   until approved; drafts never render publicly. `goodFitFor` items may be full sentences.
 * - `backgroundTags`: short public tags about the mentor's background (not a list of promised topics).
 * - Windows with `time: { kind: "tba" }` mean the date is set but the time isn't: students who pick
 *   that mentor must give broad availability, and the window reads "Exact time to be confirmed".
 * - `availability` windows are general availability, NOT bookings. Leave empty while scheduling is
 *   being coordinated: the mentor shows "Scheduling in progress" with an "Express interest" CTA.
 * - `organizerNotes` never render publicly (stripped by content/index.ts).
 * - `slots` are specific appointment times. Add them only once times are proposed/confirmed.
 *   Slot and window ids are stored with applications — never rename or reuse them.
 * - Calendar events a mentor speaks at or hosts (the official program and related events) are linked
 *   from content/events.ts (`mentorId`).
 * - Headshots live in /public/mentors/<id>.jpg (supplied by Founders organizers).
 *
 * Bios and "can help most with" highlights were written 2026-09-24 at the organizers' request from
 * the mentors' public profiles. LinkedIn itself requires sign-in, so every statement is checked
 * against the public sources listed on each mentor.
 */

const BRIEF: SourceRef = {
  label: "Founders – Illinois Entrepreneurs organizer brief",
  note: "Supplied by Founders organizers.",
  checked: "2026-09-24",
};
const AGENDA: SourceRef = {
  label: "Founders Week agenda",
  note: "Founders Showcase and TechRise session listings, supplied by Founders organizers.",
  checked: "2026-09-23",
};

/**
 * Every office-hours session is the same length (organizer policy, Sept 24): site.officeHours.
 * Windows are split into sessions on that grid (lib/schedule/sessions.ts).
 */
const SESSION_MINUTES = site.officeHours.sessionMinutes;

export const mentors: Mentor[] = [
  {
    id: "patrick-haddox",
    name: "Patrick Haddox",
    firstName: "Patrick",
    role: "CEO & Co-Founder",
    company: "Samara Aerospace",
    headshot: { src: "/mentors/patrick-haddox.jpg", alt: "Patrick Haddox", width: 800, height: 800 },
    bio: {
      status: "approved",
      value:
        "Patrick Haddox is the CEO and co-founder of Samara Aerospace, which is building the Hummingbird satellite bus around MSAC, an attitude-control technology developed at the University of Illinois that steadies a spacecraft by moving its solar panels instead of relying on reaction wheels. He graduated from Illinois’ Grainger College of Engineering in 2014 and previously worked as a senior spacecraft test engineer at Blue Canyon Technologies. Samara closed a $10 million seed round in early 2026, led by Balerion Space Ventures with Illinois Ventures participating, and is now working toward its first Hummingbird launch.",
      note: "From public sources (see `sources`); written at the organizers' request.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Turning university research into a startup", basis: "Samara commercializes MSAC, invented at Illinois" },
        { label: "Raising a seed round for deep-tech hardware", basis: "Samara’s $10M seed round, 2026" },
        { label: "Spacecraft engineering and testing", basis: "Former senior spacecraft test engineer, Blue Canyon Technologies" },
        { label: "Winning early aerospace and government customers", basis: "Samara’s SpaceWERX contract" },
      ],
      note: "Grounded in public sources. Replace with Patrick’s own topics if he supplies them.",
    },
    // Mentorship topics in his own words are still welcome — never inferred.
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: "in-person",
      durationMinutes: SESSION_MINUTES,
      location: "Espresso Royale at Grainger Library",
      address: "1301 W Springfield Ave, Urbana, IL 61801",
      sessionCount: null,
      confirmed: true,
      note: "Patrick is holding office hours in this window at Espresso Royale in Grainger Library.",
    },
    availability: [
      {
        id: "patrick-haddox-2026-10-01-am",
        date: "2026-10-01",
        time: { kind: "exact", start: "10:00", end: "11:30" },
        note: "Patrick is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/patrick-haddox/" }],
    acceptingApplications: true,
    organizerNotes:
      "Open to hosting all three 25-minute sessions in the Thu Oct 1, 10:00–11:30 AM window (10:00, 10:30, 11:00), as long as they fit in the window (organizer update, Sept 24). Location: Espresso Royale at Grainger Library, 1301 W Springfield Ave, Urbana (organizer update, Sept 24).",
    sources: [
      BRIEF,
      AGENDA,
      {
        label: "Illinois ISE: “Launching satellite technology” (Samara, MSAC, Haddox ’14)",
        url: "https://ise.illinois.edu/news/75981",
        checked: "2026-09-24",
      },
      {
        label: "Payload: “Samara Closes $10M Seed Round” (Jan 2026)",
        url: "https://payloadspace.com/samara-closes-10m-seed-round/",
        checked: "2026-09-24",
      },
      {
        label: "SpaceNews: “Samara Aerospace claims SpaceWERX contract”",
        url: "https://spacenews.com/samara-aerospace-claims-spacewerx-contract/",
        checked: "2026-09-24",
      },
      {
        label: "Crunchbase: Patrick Haddox (prior role at Blue Canyon Technologies)",
        url: "https://www.crunchbase.com/person/patrick-haddox",
        checked: "2026-09-24",
      },
    ],
  },
  {
    id: "arnav-mishra",
    name: "Arnav Mishra",
    firstName: "Arnav",
    role: "Co-Founder & CTO",
    company: "Doss",
    headshot: { src: "/mentors/arnav-mishra.jpg", alt: "Arnav Mishra", width: 800, height: 800 },
    bio: {
      status: "approved",
      value:
        "Arnav Mishra is the co-founder and CTO of Doss, a flexible, AI-native alternative to legacy ERP software that helps companies run inventory, procurement, finance and fulfillment. He has a master’s in computer science from UIUC and was a founding software engineer at the construction-finance startup Siteline, after working as an engineer at Rubrik and interning at Uber and VMware. He also mentors up-and-coming engineers through Techquitable Futures and Contrary.",
      note: "From public sources (see `sources`); written at the organizers' request.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Going from engineer to technical co-founder", basis: "Founding engineer at Siteline, then co-founder & CTO of Doss" },
        { label: "Building B2B and enterprise software", basis: "Doss, an AI-native alternative to legacy ERP" },
        { label: "Early-stage architecture, integrations and automation", basis: "Built core systems as Siteline’s founding engineer" },
        { label: "Landing engineering roles at startups and big tech", basis: "Rubrik; internships at Uber and VMware" },
        { label: "Taking a startup from idea to scale", basis: "Founders Showcase talk on building Doss" },
      ],
      note: "Grounded in public sources. Replace with Arnav’s own topics if he supplies them.",
    },
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: "in-person",
      durationMinutes: SESSION_MINUTES,
      location: "Atrium, Siebel Center for Computer Science",
      address: "201 N. Goodwin Ave., Urbana, IL 61801",
      sessionCount: null,
      confirmed: true,
      note: "Arnav is holding office hours on Friday, October 2, from 10:00 to 11:30 AM in the atrium of the Siebel Center for Computer Science.",
    },
    availability: [
      {
        // Id kept from when only "before noon" was known: applications store it.
        id: "arnav-mishra-2026-10-02-am",
        date: "2026-10-02",
        time: { kind: "exact", start: "10:00", end: "11:30" },
        note: "Arnav is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/arnav-mishra/" }],
    acceptingApplications: true,
    organizerNotes:
      "Window confirmed for Fri Oct 2, 10:00–11:30 AM (organizer update, Sept 24). Location from Arnav (Sept 25): the Atrium of the Siebel Center for Computer Science, 201 North Goodwin Avenue, Urbana. Added to the calendar at his suggestion (Sept 25): his Siebel School Speaker Series talk Wed Sep 30, 3:30 PM (Siebel 2405). He also told us he’s on the Entrepreneurial Impact panel Thu Oct 1, 3–5 PM (Beckman Institute), which was already on the calendar; he’s now listed on it. Speaking 1:55 PM Fri at the Founders Showcase. Hosting a happy hour at Legends Wed Sep 30, 5–7 PM (invited the Founders community).",
    sources: [
      BRIEF,
      AGENDA,
      {
        label: "Organizer update: office hours in the Atrium, Siebel Center for Computer Science, 201 North Goodwin Avenue, Urbana",
        note: "From Arnav Mishra, relayed by Founders organizers.",
        checked: "2026-09-25",
      },
      {
        label: "DOSS: Arnav Mishra author page",
        url: "https://www.doss.com/resources/authors/arnav-mishra",
        checked: "2026-09-24",
      },
      {
        label: "Unite.AI: interview with Arnav Mishra, Co-Founder and CTO of Doss",
        url: "https://www.unite.ai/arnav-mishra-co-founder-and-cto-of-doss-interview-series/",
        checked: "2026-09-24",
      },
      {
        label: "Partiful: Happy Hour @ Legends (host bio: UIUC ’18)",
        url: "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN",
        checked: "2026-09-24",
      },
    ],
  },
  {
    id: "vikram-lakhwara",
    name: "Vikram “Vik” Lakhwara",
    firstName: "Vik",
    role: "Founder & Managing Member",
    company: "Stakehouse",
    headshot: { src: "/mentors/vikram-lakhwara.jpg", alt: "Vikram “Vik” Lakhwara", width: 251, height: 251 },
    bio: {
      status: "approved",
      value:
        "Vik Lakhwara is the founder and managing member of Stakehouse, a St. Louis venture fund that backs early-stage founders with ties to universities in Missouri and its neighboring states, including Illinois. He was a venture capitalist in Silicon Valley with the Bay Area fund Green Cow Venture Capital, then moved to St. Louis and became T-REX’s first investor-in-residence. St. Louis founders named him the first-ever Investor of the Year at STL Startup Week.",
      note: "From public sources (see `sources`); written at the organizers' request.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Raising a pre-seed round", basis: "Stakehouse backs founders at the earliest stage" },
        { label: "What early-stage investors look for", basis: "Founder & Managing Member, Stakehouse" },
        { label: "Fundraising as a Midwest university founder", basis: "Stakehouse invests in founders tied to Missouri-region universities" },
        { label: "Funding start-ups in the Midwest", basis: "Founders Showcase panelist" },
        { label: "Silicon Valley vs. Midwest venture", basis: "Former Silicon Valley VC, now in St. Louis" },
      ],
      note: "Grounded in public sources. Replace with Vik’s own topics if he supplies them.",
    },
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: SESSION_MINUTES,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "We’re still working out when and how Vik will hold office hours. Founders will follow up once availability is finalized.",
    },
    // Scheduling in progress. Vik has existing commitments Wednesday through Saturday morning —
    // those are NOT available slots; do not add a window in that period.
    availability: [],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/viklakhwara/" }],
    acceptingApplications: true,
    organizerNotes:
      "Existing commitments Wednesday through Saturday morning. These are not available slots, so don’t schedule or show that period as available.",
    sources: [
      BRIEF,
      AGENDA,
      {
        label: "Stakehouse team page (title: Founder & Managing Member)",
        url: "https://www.stakehouse.fund/team",
        checked: "2026-09-24",
      },
      {
        label: "Stakehouse home page (investment focus, T-REX, Investor of the Year)",
        url: "https://www.stakehouse.fund/",
        checked: "2026-09-24",
      },
      {
        label: "St. Louis Public Radio: St. Louis startup ecosystem (Green Cow, move from San Francisco)",
        url: "https://www.stlpr.org/economy-business/2025-01-14/st-louis-startup-ecosystem-hard-to-find-investment-capital",
        checked: "2026-09-24",
      },
    ],
  },
  {
    id: "elliott-notrica",
    name: "Elliott Notrica",
    firstName: "Elliott",
    role: "Founder & CEO",
    company: "Symbio Bioculinary",
    headshot: { src: "/mentors/elliott-notrica.jpg", alt: "Elliott Notrica", width: 800, height: 800 },
    bio: {
      status: "approved",
      value:
        "Elliott Notrica is the founder and CEO of Symbio Bioculinary, a biotech startup in Bloomington, Illinois, that engineers microorganisms to turn companies’ food waste into new ingredients and products. He started Symbio in his first year at Illinois Wesleyan University, where he studied biology, and has grown it into a working lab with a full-time team. He was a 2023 Future Founders Fellow and has spoken at KojiCon, the international conference on mold-based fermentation.",
      note: "From public sources (see `sources`); written at the organizers' request.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Starting a company as an undergrad", basis: "Founded Symbio in his first year at Illinois Wesleyan" },
        { label: "Biotech and food-tech startups", basis: "Founder & CEO, Symbio Bioculinary" },
        { label: "Licensing a technology instead of making the product", basis: "Symbio licenses engineered microbes to food companies" },
        { label: "Early grants, competitions and fellowships", basis: "Titan New Venture Challenge grant; 2023 Future Founders Fellow" },
        { label: "Setting up a lab and making first hires", basis: "Symbio’s Bloomington lab and full-time team" },
      ],
      note: "Grounded in public sources. Replace with Elliott’s own topics if he supplies them.",
    },
    askMeAbout: null,
    goodFitFor: null,
    session: {
      format: null,
      durationMinutes: SESSION_MINUTES,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "Elliott is holding office hours on Wednesday, September 30 (9 AM to noon and 2 to 5 PM) and Thursday, October 1 (noon to 5 PM). We’re still setting the location.",
    },
    availability: [
      {
        id: "elliott-notrica-2026-09-30-am",
        date: "2026-09-30",
        time: { kind: "exact", start: "09:00", end: "12:00" },
        note: "Elliott is free at these times, but they aren’t booked appointments. We’ll schedule sessions inside them.",
      },
      {
        id: "elliott-notrica-2026-09-30-pm",
        date: "2026-09-30",
        time: { kind: "exact", start: "14:00", end: "17:00" },
        note: "Elliott is free at these times, but they aren’t booked appointments. We’ll schedule sessions inside them.",
      },
      {
        id: "elliott-notrica-2026-10-01-pm",
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        note: "Elliott is free at these times, but they aren’t booked appointments. We’ll schedule sessions inside them.",
      },
    ],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/elliottnotrica/" }],
    acceptingApplications: true,
    organizerNotes:
      "From his email (Sept 25): available anytime after 9 AM on Sept 30, or noon to 5 PM on Oct 1. Organizers set his windows to Wed Sept 30, 9 AM–noon and 2–5 PM, and Thu Oct 1, noon–5 PM (22 sessions in all). Location not set yet. On the TechRise Cohort 2 panel Thu Oct 1, 6:30 PM.",
    sources: [
      BRIEF,
      AGENDA,
      {
        label: "Illinois Wesleyan: “The Future of Food” (IWU Magazine, 2026)",
        url: "https://www.iwu.edu/magazine/2026/the-future-of-food.html",
        checked: "2026-09-24",
      },
      {
        label: "Illinois Wesleyan: Notrica speaks at KojiCon, grows fermentation business (2025)",
        url: "https://www.iwu.edu/news/2025/notrica-26-speaks-at-international-mold-conference-grows-fermentation-business.html",
        checked: "2026-09-24",
      },
      {
        label: "Illinois Wesleyan: Notrica recognized by Future Founders (2023)",
        url: "https://www.iwu.edu/news/2023/elliott-notrica-26-recognized-by-national-entrepreneurship-program.html",
        checked: "2026-09-24",
      },
    ],
  },
  {
    id: "ron-lewis",
    name: "Ron Lewis",
    firstName: "Ron",
    role: "Co-Founder",
    company: "Auctus Advisory",
    headshot: { src: "/mentors/ron-lewis.jpg", alt: "Ron Lewis", width: 800, height: 800 },
    bio: {
      status: "approved",
      value:
        "Ron is a repeat entrepreneur and co-founder of Auctus Advisory, where he advises on revenue optimization, financial forecasting, and stakeholder communication. He writes on LinkedIn about Chicago’s venture capital scene, including how funds can do more to back diverse founders and talent. He’s a good person to ask about revenue, forecasts and how to report progress to investors.",
      note: "First sentence supplied by Founders organizers; second from Ron’s public LinkedIn posts.",
    },
    expertise: {
      status: "approved",
      value: [
        { label: "Revenue strategy and optimization", basis: "Advises on revenue optimization at Auctus Advisory" },
        { label: "Financial forecasting and planning", basis: "Advises on financial forecasting at Auctus Advisory" },
        { label: "Communicating progress to investors and stakeholders", basis: "Advises on stakeholder communication at Auctus Advisory" },
        { label: "Navigating Chicago’s venture capital scene", basis: "Writes publicly about Chicago venture capital" },
      ],
      note: "Grounded in Ron’s supplied bio and public posts.",
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
      format: "in-person",
      durationMinutes: SESSION_MINUTES,
      location: "Business Instructional Facility (BIF)",
      address: "515 E. Gregory Drive, Champaign, IL 61820",
      sessionCount: null,
      confirmed: true,
      note: "Ron is holding office hours on Thursday, October 1, from 2:30 to 4:30 PM at the Business Instructional Facility (BIF).",
    },
    availability: [
      {
        id: "ron-lewis-2026-10-01-pm",
        date: "2026-10-01",
        time: { kind: "exact", start: "14:30", end: "16:30" },
        note: "Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ],
    slots: [],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }],
    acceptingApplications: true,
    organizerNotes:
      "Window confirmed for Thu Oct 1, 2:30–4:30 PM at BIF, 515 E. Gregory Drive, Champaign (organizer update, Sept 24). He’s also open to Oct 4; organizers will send details later, so nothing about Oct 4 is published yet. Confirm suggested discussion topics with Ron before publishing them.",
    sources: [
      BRIEF,
      {
        label: "Ron Lewis’s public LinkedIn post on Chicago venture capital",
        url: "https://www.linkedin.com/posts/ronlewis20_venturecapital-founders-entrepreneurs-activity-6924692779570753536-Sq1o",
        checked: "2026-09-24",
      },
    ],
  },
  {
    id: "rishab-veldur",
    name: "Rishab Veldur",
    firstName: "Rishab",
    role: "Co-Founder & CEO",
    company: "Auvi Labs",
    headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 },
    bio: {
      status: "approved",
      value:
        "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier. With a background in engineering at Illinois, he helped build a company that placed second in the 2024 Cozad New Venture Challenge.",
      note: "Supplied by the organizers and checked against the sources below. Auvi’s device (Beacon) is investigational: never call it FDA-approved, cleared, commercially available or clinically proven.",
    },
    // Areas from his background, not topics Rishab has agreed to cover.
    backgroundTags: ["Medtech", "Hardware and software", "University spinouts"],
    expertise: null,
    askMeAbout: null,
    goodFitFor: {
      status: "approved",
      value: [
        "Interested in turning a technical project into a healthcare startup? Rishab’s experience spans engineering, medical-device development, and building a company through Illinois’ entrepreneurship ecosystem.",
      ],
      note: "The organizers’ suggested fit, based on his background. Not a syllabus Rishab approved, and not medical or regulatory advice.",
    },
    session: {
      format: null,
      durationMinutes: SESSION_MINUTES,
      location: null,
      sessionCount: null,
      confirmed: false,
      note: "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting the location.",
    },
    availability: [
      {
        // Id kept from when only the date was known: applications store it.
        id: "rishab-veldur-2026-10-01",
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        note: "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ],
    slots: [],
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/rishab-veldur" },
      { label: "Auvi Labs", url: "https://www.auvilabs.com/" },
    ],
    acceptingApplications: true,
    organizerNotes:
      "From his email to the organizers: he’s at Founders Week on Oct 1 and 2, but only has time for office hours on Thu Oct 1, and he’d like to meet student teams (a preference, not an eligibility rule; individuals can apply). Window locked for Thu Oct 1, anytime 12–5 PM (organizer update, Sept 24). Location and capacity aren’t confirmed. Also on the Showcase panel “Health Innovation: From Therapeutics to Devices”, Fri Oct 2, 1:20–1:55 PM (not office hours). Keep the phone number from his email signature off the site.",
    sources: [
      {
        label: "Founders organizer update: Rishab Veldur profile and his email about availability",
        note: "Role, company, links, bio, background tags and suggested fit supplied by Founders organizers; Oct 1 office-hours availability from his email to them; the 12–5 PM window confirmed by the organizers on Sept 24.",
        checked: "2026-09-24",
      },
      AGENDA,
      {
        label: "Carle Illinois College of Medicine: U of I innovation detects dialysis access failure (Aug 17, 2026)",
        url: "https://medicine.illinois.edu/news/u-of-i-innovation-detects-dialysis-access-failure",
        note: "CEO Rishab Veldur, trained at Grainger Engineering; UIUC spinout; wearable ultrasound (Beacon); pilot testing planned; aims for market in 2028.",
        checked: "2026-09-24",
      },
      {
        label: "Auvi Labs: About (founders)",
        url: "https://www.auvilabs.com/about",
        note: "Lists Rishab Veldur as CEO among the founders. Site footer: Beacon is investigational and not cleared for sale by the FDA.",
        checked: "2026-09-24",
      },
      {
        label: "Technology Entrepreneur Center: 2024 Cozad New Venture Challenge winners",
        url: "https://tec.illinois.edu/news/66233",
        note: "AUVI placed second.",
        checked: "2026-09-24",
      },
    ],
  },
];
