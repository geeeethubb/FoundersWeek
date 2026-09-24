import Link from "next/link";
import { getSite } from "@/content";
import { Container } from "@/components/ui/primitives";
import { formatDate, TZ_NAME } from "@/lib/time";
import { BrandLockup } from "./brand";

export function SiteFooter() {
  const site = getSite();
  return (
    <footer className="mt-24 border-t border-line bg-ink-950">
      <Container className="grid gap-12 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <BrandLockup />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper-muted">
            A student-curated guide to {site.week.name} at the {site.university}.
          </p>
        </div>

        <div className="md:col-span-5">
          <h2 className="mono-label text-paper-subtle">About this guide</h2>
          <p className="mt-4 text-sm leading-relaxed text-paper-muted">
            <strong className="font-semibold text-paper">{site.org.shortName}</strong> is{" "}
            {site.org.name}, a student entrepreneurship organization at UIUC.{" "}
            <strong className="font-semibold text-paper">{site.week.name}</strong> is the broader series of events —
            many are organized by other groups. We label every listing as{" "}
            <span className="text-paper">Hosted by Founders</span>,{" "}
            <span className="text-paper">Co-hosted by Founders</span>,{" "}
            <span className="text-paper">Supported by Founders</span>, or{" "}
            <span className="text-paper">Part of Founders Week</span>, and only when a source supports it.
          </p>
        </div>

        <nav aria-label="Footer" className="md:col-span-3">
          <h2 className="mono-label text-paper-subtle">Explore</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link className="font-semibold text-paper hover:text-accent" href="/office-hours">
                Office Hours
              </Link>
            </li>
            <li>
              <Link className="text-paper-muted hover:text-paper" href="/office-hours#apply">
                Apply for Office Hours
              </Link>
            </li>
            <li>
              <Link className="text-paper-muted hover:text-paper" href="/schedule">
                Calendar
              </Link>
            </li>
            <li>
              <Link className="text-paper-muted hover:text-paper" href="/schedule?view=picks">
                Founders picks
              </Link>
            </li>
            {site.org.contactEmail ? (
              <li>
                <a className="text-paper-muted hover:text-paper" href={`mailto:${site.org.contactEmail}`}>
                  {site.org.contactEmail}
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-3 py-6 text-xs text-paper-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono">
            All times {TZ_NAME} (America/Chicago) · Schedule reviewed {formatDate(site.week.lastReviewed, "month-day")},{" "}
            {site.week.year}
          </p>
          <p className="flex items-center gap-4">
            <span>Student-run. Not an official University of Illinois publication.</span>
            <Link href="/organizers" className="whitespace-nowrap text-paper-subtle underline-offset-4 hover:text-paper hover:underline">
              Organizers
            </Link>
          </p>
        </Container>
      </div>
    </footer>
  );
}
