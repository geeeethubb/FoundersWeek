// Seed a LOCAL PGlite database with fictional applications for developing and reviewing the
// organizer view. Never point this at a real database.
//
//   node scripts/dev/seed-applications.mjs --dir ./.data/organizer [--reset]
//
// Stop any dev server using the same directory first — a PGlite directory can only be opened
// by one process at a time. Applicants are invented; some reference demo mentors/slots, so run
// the dev server with SHOW_DEMO_CONTENT=true to see them resolved (otherwise they show as
// "no longer listed"). One applicant deliberately contains spreadsheet-formula text to check
// CSV export sanitization.
//
// Scenarios covered (for manual QA of the organizer view):
// - Interest only in mentors still scheduling (Ron, Vik): Daniel Reyes (twice), Ethan Brooks, the
//   formula-test applicant. Review them as Under review / Selected / Waitlisted; confirming is
//   blocked until those mentors have confirmed slots.
// - Windows (Patrick, Arnav) without slots: Maya, Priya, Marcus, Hannah.
// - Slot capacity with SHOW_DEMO_CONTENT=true: demo-avery-slot-1430 seats 2 (Sofia, Noah x2, Grace
//   can compete for it); demo-avery-slot-1400 seats 1; demo-jordan-slot-1500 is only *proposed*.
// - Student conflict: Noah Williams applied twice (same email) for demo-avery-slot-1430.
// - referrer = the mentor profile the student came from (only some applicants).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations, pgliteAdapter } from "../../db/migrate-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
let dir = "./.data/organizer";
let reset = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dir") dir = args[++i];
  else if (args[i] === "--reset") reset = true;
}
if (dir.startsWith("postgres")) {
  console.error("Refusing to seed a Postgres URL. This script only seeds a local PGlite directory.");
  process.exit(1);
}

const dataDir = path.resolve(root, dir);
mkdirSync(dataDir, { recursive: true });
const db = await PGlite.create(dataDir);
await applyMigrations(pgliteAdapter(db), path.join(root, "db", "migrations"), (m) => console.log(`[seed] ${m}`));

if (reset) {
  await db.exec("truncate applications, application_mentors, application_availability, appointments, application_activity, rate_limit_events");
  console.log("[seed] cleared existing applications");
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

/** Fictional applicants. `availability` = ["window:<id>" | "slot:<id>"], mentors in rank order. */
const applicants = [
  {
    full_name: "Maya Okafor",
    email: "mokafor2@illinois.edu",
    year: "junior",
    major: "Aerospace Engineering",
    participation: "team",
    team_name: "Orbit Relay",
    teammates: "Jonah Petrov (CS)\nLeah Kim (ECE)",
    stage: "building",
    working_on:
      "A low-cost telemetry relay for student CubeSat teams.\n\nWe have a working prototype on the bench and two campus teams testing it.",
    question: "How do we price hardware for university labs, and when should we think about raising money?",
    link_url: "https://example.com/orbit-relay",
    availability_notes: "Free all Thursday morning; class 12–1:30.",
    mentors: ["patrick-haddox", "ron-lewis"],
    availability: ["window:patrick-haddox-2026-10-01-am"],
    referrer: "patrick-haddox",
    status: "under_review",
    hours: 70,
  },
  {
    full_name: "Daniel Reyes",
    email: "dreyes7@illinois.edu",
    year: "sophomore",
    major: "Finance",
    participation: "individual",
    stage: "idea",
    working_on: "A budgeting tool that helps student orgs forecast event costs and sponsorship income.",
    question: "What should a first financial model look like before we have any revenue?",
    mentors: ["ron-lewis", "vikram-lakhwara"],
    availability: [],
    referrer: "ron-lewis",
    status: "submitted",
    hours: 52,
  },
  {
    full_name: "Priya Natarajan",
    email: "priyan3@illinois.edu",
    year: "senior",
    major: "Computer Science",
    participation: "individual",
    stage: "launched",
    working_on: "Campus marketplace for textbooks — 400 weekly active users since August.",
    question: "How do I talk to investors about growth that is very seasonal?",
    link_url: "https://example.com/shelfswap",
    mentors: ["arnav-mishra", "ron-lewis", "patrick-haddox"],
    availability: ["window:arnav-mishra-2026-10-02-am", "window:patrick-haddox-2026-10-01-am"],
    status: "selected",
    hours: 48,
  },
  {
    full_name: "Ethan Brooks",
    email: "ebrooks4@illinois.edu",
    year: "freshman",
    major: "Undeclared",
    participation: "individual",
    stage: "exploring",
    working_on: "Curious about startups. I want to learn how founders decide what problem to work on.",
    question: "How did you know your first idea was worth pursuing?",
    mentors: ["vikram-lakhwara"],
    availability: [],
    referrer: "vikram-lakhwara",
    status: "submitted",
    hours: 30,
  },
  {
    full_name: "Sofia Martinez",
    email: "smarti88@illinois.edu",
    year: "masters",
    major: "Bioengineering",
    participation: "team",
    team_name: "Clearline Dx",
    teammates: "Ana Ruiz",
    stage: "building",
    working_on: "Paper-based diagnostic strip for early detection of sepsis in low-resource clinics.",
    question: "Regulatory path vs. customer discovery — which comes first for a medical device?",
    availability_notes: "Virtual preferred on Friday.",
    mentors: ["demo-avery-sample", "patrick-haddox"],
    availability: ["slot:demo-avery-slot-1400", "slot:demo-avery-slot-1430", "window:patrick-haddox-2026-10-01-am"],
    status: "under_review",
    hours: 26,
  },
  {
    full_name: "Noah Williams",
    email: "nwill5@illinois.edu",
    year: "junior",
    major: "Industrial Design",
    participation: "individual",
    stage: "idea",
    working_on: "Modular furniture for dorm rooms that ships flat and assembles without tools.",
    question: "How do I validate demand before building inventory?",
    mentors: ["demo-avery-sample"],
    availability: ["slot:demo-avery-slot-1430"],
    status: "submitted",
    hours: 20,
  },
  // Same student again (conflict check: one student can’t hold two seats at the same time).
  {
    full_name: "Noah Williams",
    email: "NWill5@illinois.edu",
    year: "junior",
    major: "Industrial Design",
    participation: "team",
    team_name: "Flatpack Dorm",
    teammates: "Ruth Alvarez",
    stage: "idea",
    working_on: "Applying again with my teammate — same furniture project, now with a second designer.",
    question: "Should we pre-sell before the first production run?",
    mentors: ["demo-avery-sample", "ron-lewis"],
    availability: ["slot:demo-avery-slot-1430"],
    status: "submitted",
    hours: 6,
  },
  {
    full_name: "Grace Liu",
    email: "graceliu2@illinois.edu",
    year: "phd",
    major: "Materials Science",
    participation: "individual",
    stage: "building",
    working_on: "Spinning out a battery-coating process from my lab.",
    question: "What does licensing from the university look like in practice?",
    mentors: ["demo-jordan-placeholder", "demo-avery-sample"],
    availability: ["slot:demo-jordan-slot-1500", "slot:demo-avery-slot-1400"],
    status: "under_review",
    hours: 16,
  },
  {
    full_name: "Marcus Hill",
    email: "mhill23@illinois.edu",
    year: "senior",
    major: "Economics",
    participation: "individual",
    stage: "idea",
    working_on: "Tutoring marketplace for intro econ courses.",
    question: "Is a two-sided marketplace realistic for a solo founder?",
    mentors: ["arnav-mishra"],
    availability: ["window:arnav-mishra-2026-10-02-am"],
    status: "waitlisted",
    hours: 12,
  },
  // Same student, second application (duplicate-email indicator).
  {
    full_name: "Daniel Reyes",
    email: "DReyes7@illinois.edu",
    year: "sophomore",
    major: "Finance",
    participation: "individual",
    stage: "idea",
    working_on: "Following up — I also want to ask about pitching to sponsors.",
    question: "How do I explain our numbers to a potential sponsor without overpromising?",
    mentors: ["vikram-lakhwara", "ron-lewis"],
    availability: [],
    status: "submitted",
    hours: 8,
  },
  // Adversarial content: formulas must be neutralized in the CSV export.
  {
    full_name: "=HYPERLINK(\"https://example.com\",\"Formula Test\")",
    email: "formula.test@illinois.edu",
    year: "other",
    major: "+1+1 Engineering",
    participation: "team",
    team_name: "@SUM(A1:A2)",
    teammates: "-2+3, \"quoted\" name",
    stage: "exploring",
    working_on: "  =cmd|' /C calc'!A0",
    question: "\tTab-leading question with a comma, and \"quotes\".",
    mentors: ["ron-lewis"],
    availability: [],
    status: "submitted",
    hours: 3,
  },
  {
    full_name: "Hannah Cole",
    email: "hcole9@illinois.edu",
    year: "junior",
    major: "Marketing",
    participation: "individual",
    stage: "launched",
    working_on: "Selling handmade ceramics online; ~$2k/month in revenue.",
    question: "When is it worth hiring help versus staying lean?",
    mentors: ["patrick-haddox"],
    availability: ["window:patrick-haddox-2026-10-01-am"],
    status: "canceled",
    hours: 60,
  },
];

/** Which mentor each window/slot id belongs to (ids come from content/mentors.ts and content/demo.ts). */
const OPTION_OWNERS = [
  ["patrick-haddox-", "patrick-haddox"],
  ["arnav-mishra-", "arnav-mishra"],
  ["demo-avery-", "demo-avery-sample"],
  ["demo-jordan-", "demo-jordan-placeholder"],
];

let created = 0;
for (const a of applicants) {
  await db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `insert into applications (created_at, updated_at, idempotency_key, status, full_name, email, email_normalized, year, major,
         participation, team_name, teammates, stage, working_on, question, link_url, availability_notes,
         first_choice_mentor_id, acknowledged_no_guarantee, consent_to_share, referrer_mentor_id)
       values ($1, $1, gen_random_uuid(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, true, $17)
       returning id`,
      [
        hoursAgo(a.hours),
        a.status,
        a.full_name,
        a.email,
        a.email.trim().toLowerCase(),
        a.year,
        a.major,
        a.participation,
        a.team_name ?? null,
        a.teammates ?? null,
        a.stage,
        a.working_on,
        a.question,
        a.link_url ?? null,
        a.availability_notes ?? null,
        a.mentors[0],
        a.referrer ?? null,
      ],
    );
    const id = rows[0].id;
    for (const [i, mentorId] of a.mentors.entries()) {
      await tx.query(`insert into application_mentors (application_id, mentor_id, rank) values ($1, $2, $3)`, [id, mentorId, i + 1]);
    }
    for (const key of a.availability) {
      const [kind, optionId] = key.split(":");
      const mentorId = OPTION_OWNERS.find(([prefix]) => optionId.startsWith(prefix))?.[1] ?? a.mentors[0];
      await tx.query(
        `insert into application_availability (application_id, mentor_id, option_kind, option_id) values ($1, $2, $3, $4)`,
        [id, mentorId, kind, optionId],
      );
    }
    await tx.query(
      `insert into application_activity (application_id, at, actor, action, detail) values ($1, $2, 'Applicant', 'submitted', '{}'::jsonb)`,
      [id, hoursAgo(a.hours)],
    );
    if (a.status !== "submitted") {
      await tx.query(
        `insert into application_activity (application_id, at, actor, action, detail) values ($1, $2, 'Seed script', 'status_changed', $3::jsonb)`,
        [id, hoursAgo(a.hours - 1), JSON.stringify({ from: "submitted", to: a.status })],
      );
    }
  });
  created++;
}

const [{ n }] = (await db.query("select count(*)::int as n from applications")).rows;
console.log(`[seed] inserted ${created} applications (${n} total) into ${dir}`);
await db.close();
