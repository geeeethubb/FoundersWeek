import type { Metadata } from "next";

/**
 * Organizer area. Private: never indexed, never cached (see also next.config.ts headers).
 * Authorization happens in each page (requireOrganizerPage) and each API handler — a layout
 * doesn't re-run on client navigation, so it can't be the only gate.
 */
export const metadata: Metadata = {
  title: { default: "Organizers", template: "%s · Organizers" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "same-origin",
};

export default function OrganizersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
