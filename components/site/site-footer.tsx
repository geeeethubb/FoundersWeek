import Link from "next/link";
import { getSite } from "@/content";
import { Container } from "@/components/ui/primitives";
import { BrandLockup } from "./brand";

/** Footer links are 44px-tall tap targets (phones included). */
const LINK = "inline-flex min-h-11 min-w-11 items-center";

/** Minimal footer: logo, links, one student-run attribution. */
export function SiteFooter() {
  const site = getSite();
  return (
    <footer className="mt-24 border-t border-line bg-surface-subtle">
      {/* Phones: the taller link row brings its own space, so the gap and bottom padding shrink to match. */}
      <Container className="flex flex-col gap-5 pb-7 pt-10 md:flex-row md:items-center md:justify-between md:gap-8 md:py-10">
        <BrandLockup showWeek={false} />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 text-sm">
            <li>
              <Link className={`${LINK} text-text-muted hover:text-text`} href="/office-hours">
                Office Hours
              </Link>
            </li>
            <li>
              <Link className={`${LINK} text-text-muted hover:text-text`} href="/schedule">
                Calendar
              </Link>
            </li>
            <li>
              <Link className={`${LINK} text-text-muted hover:text-text`} href="/office-hours#apply">
                Apply
              </Link>
            </li>
            {site.org.contactEmail ? (
              <li>
                <a className={`${LINK} text-text-muted hover:text-text`} href={`mailto:${site.org.contactEmail}`}>
                  {site.org.contactEmail}
                </a>
              </li>
            ) : null}
            <li>
              <Link className={`${LINK} text-text-subtle hover:text-text`} href="/organizers">
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
