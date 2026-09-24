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
    "Founders Office Hours during Founders Week at the University of Illinois Urbana-Champaign: apply to meet startup founders and operators one-on-one — plus a student-curated calendar of the week.",
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
    dates: null,
    scheduleCompleteness: "complete",
    lastReviewed: "2026-09-23",
  },
  applications: {
    open: true,
    opensAt: null,
    deadline: null,
    decisionsBy: null,
    emailDomains: ["illinois.edu"],
  },
  brand: {
    foundersLogo: null,
    illinoisMark: null,
  },
};
