import type { SiteSettings } from "./types";

/**
 * Site-wide settings. `null` means "not supplied yet" — the UI handles every null
 * gracefully and the README lists what is still missing.
 */
export const site: SiteSettings = {
  name: "Founders × Founders Week",
  shortName: "Founders Week",
  tagline: "Find your people. Build what’s next.",
  description:
    "Founders Office Hours during Founders Week 2026 at the University of Illinois Urbana-Champaign. Apply to meet startup founders and investors, and check out the full Founders Week calendar.",
  university: "University of Illinois Urbana-Champaign",
  timezone: "America/Chicago",
  org: {
    name: "Founders – Illinois Entrepreneurs",
    shortName: "Founders",
    description:
      "Founders – Illinois Entrepreneurs is a student entrepreneurship organization at the University of Illinois Urbana-Champaign.",
    url: null,
    contactEmail: null,
    instagram: null,
    linkedin: null,
  },
  week: {
    name: "Founders Week",
    year: 2026,
    officialUrl: null,
    // Official Founders Week program. Related events begin Monday, Sept 28.
    dates: { start: "2026-09-30", end: "2026-10-03" },
    scheduleCompleteness: "complete",
    lastReviewed: "2026-09-25",
  },
  applications: {
    open: true,
    opensAt: null,
    deadline: null,
    decisionsBy: null,
    emailDomains: ["illinois.edu"],
  },
  // Every office-hours session is 25 minutes, with a 5-minute break between sessions
  // (organizer update, Sept 24). Windows are split into sessions on this grid.
  officeHours: { sessionMinutes: 25, breakMinutes: 5 },
  brand: {
    // Tight crop of the supplied logo (public/brand/founders-logo-original.png, kept intact):
    // foreground mark + wordmark only, original colors and proportions, transparent background.
    foundersLogo: {
      src: "/brand/founders-logo.png",
      width: 539,
      height: 145,
      alt: "Founders – Illinois Entrepreneurs",
    },
    illinoisMark: null,
  },
};
