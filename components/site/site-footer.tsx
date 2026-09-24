import Link from "next/link";
import { getSite } from "@/content";
import { Container } from "@/components/ui/primitives";
import { BrandLockup } from "./brand";

/** Minimal footer: logo, links, one student-run attribution. */
export function SiteFooter() {
  const site = getSite();
  return (
    <footer className="mt-24 border-t border-line bg-surface-subtle">
      <Container className="flex flex-col gap-8 py-10 md:flex-row md:items-center md:justify-between">
        <BrandLockup showWeek={false} />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link className="text-text-muted hover:text-text" href="/office-hours">
                Office Hours
              </Link>
            </li>
            <li>
              <Link className="text-text-muted hover:text-text" href="/schedule">
                Calendar
              </Link>
            </li>
            <li>
              <Link className="text-text-muted hover:text-text" href="/office-hours#apply">
                Apply
              </Link>
            </li>
            {site.org.contactEmail ? (
              <li>
                <a className="text-text-muted hover:text-text" href={`mailto:${site.org.contactEmail}`}>
                  {site.org.contactEmail}
                </a>
              </li>
            ) : null}
            <li>
              <Link className="text-text-subtle hover:text-text" href="/organizers">
                Organizers
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
      <div className="border-t border-line">
        <Container className="py-5 text-xs leading-relaxed text-text-subtle">
          Run by students in {site.org.name}. This isn’t an official University of Illinois website. All times are
          Central Time.
        </Container>
      </div>
    </footer>
  );
}
