/**
 * Paths and published titles the suite visits (kept literal on purpose: the tests assert the
 * published facts, not whatever the content files currently say).
 */

/** Public pages the suite walks (header, a11y smoke, "never shown" checks). */
export const PUBLIC_PAGES = [
  "/",
  "/office-hours",
  "/office-hours/patrick-haddox",
  "/office-hours/arnav-mishra",
  "/office-hours/vikram-lakhwara",
  "/office-hours/elliott-notrica",
  "/office-hours/ron-lewis",
  "/office-hours/rishab-veldur",
  "/schedule",
  "/schedule/office-hours-elliott-notrica-2026-09-30-am",
  "/schedule/office-hours-elliott-notrica-2026-09-30-pm",
  "/schedule/office-hours-patrick-haddox-2026-10-01-am",
  "/schedule/office-hours-elliott-notrica-2026-10-01-pm",
  "/schedule/office-hours-rishab-veldur-2026-10-01",
  "/schedule/office-hours-ron-lewis-2026-10-01-pm",
  "/schedule/office-hours-arnav-mishra-2026-10-02-am",
  "/schedule/dan-caruso-fireside-chat",
  "/schedule/how-to-make-10k-a-month-in-college",
  "/schedule/happy-hour-at-legends-with-arnav-mishra",
  "/schedule/founder-failure-lab",
  "/schedule/techrise-pitch-competition",
  "/schedule/founders-showcase-day-sessions",
  "/schedule/founders-evening-showcase-and-reception",
  "/schedule/illinois-football-vs-purdue",
] as const;

/** Monday, Sept 28 — "Supported by Founders", information only (no application of any kind). */
export const DAN_CARUSO_PATH = "/schedule/dan-caruso-fireside-chat";
export const DAN_TITLE = "Fireside Chat with Dan Caruso";
export const DAN_LINKEDIN = "https://www.linkedin.com/in/danielpcaruso";
export const DAN_VENUE = "Beckman Institute";
export const DAN_ROOM = "Auditorium (Room 1025)";
export const DAN_ADDRESS = "405 N. Mathews Ave., Urbana, IL 61801";
export const DAN_CALLOUT = "Private session with Dan Caruso";

/** Tuesday, Sept 29, 6–8 PM, 100 MSEB — "Co-hosted by Founders". */
export const PANEL_PATH = "/schedule/how-to-make-10k-a-month-in-college";
export const PANEL_TITLE = "How to Make $10K/Month in College";
export const PANEL_INFO_URL = "https://www.austnkennedy.com/how-to-make-10k-a-month-in-college";
/** Room 100 of the Materials Science and Engineering Building ("100 MSEB"), however it's worded. */
export const PANEL_PLACE = /100 MSEB|Materials Science and Engineering Building\W*Room 100/;

/** Wednesday, Sept 30, 5–7 PM at Legends (6th & Green) — hosted by Arnav Mishra, RSVP on Partiful. */
export const HAPPY_HOUR_ID = "happy-hour-at-legends-with-arnav-mishra";
export const HAPPY_HOUR_PATH = `/schedule/${HAPPY_HOUR_ID}`;
export const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
export const HAPPY_HOUR_RSVP_LABEL = "RSVP on Partiful";
export const HAPPY_HOUR_RSVP_URL = "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN";

/** Wed Sep 30, 3:30–5:00 PM at EnterpriseWorks: inside Elliott's 2:00–5:00 PM office-hours window. */
export const KICKOFF_TITLE = "Founders Week Kickoff Reception";
/** Wed Sep 30, 6:30–8:30 PM, CIF Room 1038 — hosted by Founders; featured on a light-orange card. */
export const FAILURE_LAB_ID = "founder-failure-lab";
export const FAILURE_LAB_PATH = `/schedule/${FAILURE_LAB_ID}`;
export const FAILURE_LAB_TITLE = "Founder Failure Lab";
export const FAILURE_LAB_VENUE = "Campus Instructional Facility (CIF)";
export const FAILURE_LAB_ROOM = "Room 1038";
export const FAILURE_LAB_ADDRESS = "1405 Springfield Ave., Urbana, IL 61801";
export const FAILURE_LAB_REGISTER_LABEL = "Register on Luma";
export const FAILURE_LAB_REGISTER_URL = "https://luma.com/hyoeuqh1";
/** 6:30–8:30 PM Central, as on Luma (the organizers confirmed the 8:30 PM end). */
export const FAILURE_LAB_TIME = "6:30–8:30 PM CT";
/** The three speakers, each name linked to the LinkedIn profile the organizers supplied. */
export const FAILURE_LAB_SPEAKERS = [
  { name: "Manu Edakara", linkedin: "https://www.linkedin.com/in/manuedakara/" },
  { name: "Sharan Mehta", linkedin: "https://www.linkedin.com/in/sharanmehta/" },
  { name: "Nick Militello", linkedin: "https://www.linkedin.com/in/nickdymondmilitello/" },
] as const;
/**
 * Thursday, Oct 1 program blocks around Rishab's noon–5 PM office-hours window: Pitching (11:45 AM–2:15 PM)
 * and Launching From Illinois (3:00–5:00 PM) overlap it; TechRise (5:00–7:00 PM) starts as it ends.
 * Ron's 2:30–4:30 PM window overlaps Rishab's and Launching From Illinois, but not Pitching.
 */
export const PITCHING_PATH = "/schedule/science-and-practice-of-pitching";
export const PITCHING_TITLE = "The Science and Practice of Pitching";
export const LAUNCHING_TITLE = "Entrepreneurial Impact: Launching From Illinois";
export const TECHRISE_PATH = "/schedule/techrise-pitch-competition";
export const TECHRISE_TITLE = "TechRise Pitch Competition and Panel Discussion";
export const SHOWCASE_PATH = "/schedule/founders-showcase-day-sessions";
export const SHOWCASE_TITLE = "Founders Showcase Day Sessions";
/** The university's Friday evening event — a separate event that stays on the calendar. */
export const EVENING_SHOWCASE_PATH = "/schedule/founders-evening-showcase-and-reception";
export const EVENING_SHOWCASE_TITLE = "Founders Evening Showcase and Reception";

/** The Founders' Saturday afterparty (HERE Apartments) was canceled: this URL must be a 404. */
export const CANCELED_AFTERPARTY_PATH = "/schedule/founders-week-afterparty";

/** Calendar days, chronological: related events Mon–Tue, then the official program Wed–Sat. */
export const DAYS = [
  { date: "2026-09-28", heading: "Monday, September 28", tab: /^Mon\s*(Sep\s*)?28\b/ },
  { date: "2026-09-29", heading: "Tuesday, September 29", tab: /^Tue\s*(Sep\s*)?29\b/ },
  { date: "2026-09-30", heading: "Wednesday, September 30", tab: /^Wed\s*(Sep\s*)?30\b/ },
  { date: "2026-10-01", heading: "Thursday, October 1", tab: /^Thu\s*(Oct\s*)?1\b/ },
  { date: "2026-10-02", heading: "Friday, October 2", tab: /^Fri\s*(Oct\s*)?2\b/ },
  { date: "2026-10-03", heading: "Saturday, October 3", tab: /^Sat\s*(Oct\s*)?3\b/ },
] as const;
