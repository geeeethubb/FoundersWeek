import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMentorsForOrganizers, isDemoContentEnabled } from "@/content";
import { ApplicationFiltersForm } from "@/components/organizer/application-filters";
import { ApplicationResults } from "@/components/organizer/application-results";
import { MentorLineup } from "@/components/organizer/mentor-lineup";
import { MentorNotes } from "@/components/organizer/mentor-notes";
import { OrganizerBar } from "@/components/organizer/organizer-bar";
import { SetupChecklist } from "@/components/organizer/setup-checklist";
import { SlotBoard } from "@/components/organizer/slot-board";
import { StatusStrip } from "@/components/organizer/status-strip";
import { buttonClasses } from "@/components/ui/button";
import { AlertIcon, ArrowUpRightIcon, DownloadIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import { APPLY_ANCHOR, APPLY_PATH } from "@/lib/schedule/entries";
import { getDb, type Database } from "@/lib/db/client";
import { getDataStoreStatus } from "@/lib/organizer/data-store";
import { buildOrganizerDirectory } from "@/lib/organizer/directory";
import {
  activeFilterCount,
  applicationFiltersQuery,
  exportHref,
  organizersHref,
  parseApplicationFilters,
  restrictToDirectory,
} from "@/lib/organizer/filters";
import { requireOrganizerPage } from "@/lib/organizer/page-auth";
import { getMentorInterest, getSlotUsage, getStatusCounts, listApplications } from "@/lib/organizer/queries";
import { getSetupStatus } from "@/lib/setup-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<Record<string, never>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The public application (a section of the Office Hours page). */
const PUBLIC_APPLICATION_HREF = `${APPLY_PATH}#${APPLY_ANCHOR}`;

function rawQuery(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, value);
  }
  return q.toString();
}

function SectionHeader({ id, title, lede }: { id: string; title: string; lede?: string }) {
  return (
    <div className="mb-6 max-w-2xl">
      <h2 id={id} className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
        {title}
      </h2>
      {lede ? <p className="mt-2 text-base leading-relaxed text-text-muted">{lede}</p> : null}
    </div>
  );
}

export default async function OrganizersDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await requireOrganizerPage(`/organizers${rawQuery(sp) ? `?${rawQuery(sp)}` : ""}`);

  const mentors = getMentorsForOrganizers();
  const directory = buildOrganizerDirectory(mentors);
  // Only ids that exist in content (an event such as Dan Caruso's is never a mentor filter).
  const filters = restrictToDirectory(parseApplicationFilters(sp), directory);
  // The GET form submits empty fields; keep URLs canonical and shareable.
  if (rawQuery(sp) !== applicationFiltersQuery(filters)) redirect(organizersHref(filters));

  const [dataStore, setup] = await Promise.all([getDataStoreStatus(), getSetupStatus()]);

  const header = (
    <>
      <OrganizerBar name={session.name} demo={isDemoContentEnabled()} />
      <header className="border-b border-line">
        <Container className="grid gap-8 pt-10 pb-12 md:pt-14 lg:grid-cols-12 lg:items-start lg:gap-12">
          <div className="lg:col-span-7">
            <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl">Applications</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-muted">
              Review office-hours applications, propose times and keep each student’s status up to date. Only the
              organizer team can see what applicants wrote.
            </p>
            <a
              href={PUBLIC_APPLICATION_HREF}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-text underline-offset-4 hover:underline sm:min-h-9"
            >
              Open the public application
              <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </div>
          <SetupChecklist status={setup} dataStore={dataStore} className="lg:col-span-5" />
        </Container>
      </header>
    </>
  );

  let db: Database | null = null;
  if (dataStore.state !== "down") {
    try {
      db = await getDb();
    } catch {
      db = null;
    }
  }
  if (!db) {
    return (
      <>
        {header}
        <Container className="pt-10 pb-6">
          <div role="alert" className="max-w-3xl rounded-md bg-danger-soft px-5 py-4 text-sm leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-text">
              <AlertIcon className="size-4 shrink-0 text-danger" />
              Applications can’t be loaded right now
            </p>
            <p className="mt-1.5 text-text-muted">
              The application database isn’t available, so you can’t review or change anything right now. Nothing has
              been lost. Reload this page once Setup shows the database as connected.
            </p>
          </div>
        </Container>
      </>
    );
  }

  const [applications, counts, usage, interest] = await Promise.all([
    listApplications(db, filters),
    getStatusCounts(db),
    getSlotUsage(db),
    getMentorInterest(db),
  ]);
  const filtered = activeFilterCount(filters) > 0;

  return (
    <>
      {header}

      <Container className="pt-10 md:pt-12">
        <section aria-labelledby="overview-heading" className="space-y-8">
          <h2 id="overview-heading" className="sr-only">
            Overview
          </h2>
          <div>
            <h3 className="mb-3 text-sm font-medium text-text-muted">By status</h3>
            <StatusStrip counts={counts} filters={filters} />
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-sm font-medium text-text-muted">By mentor · active applications</h3>
              <p className="text-xs text-text-subtle">Select a mentor to filter</p>
            </div>
            <MentorLineup directory={directory} interest={interest} usage={usage} filters={filters} />
          </div>
        </section>
      </Container>

      <Container className="pt-8">
        <section aria-label="Filters">
          <ApplicationFiltersForm filters={filters} directory={directory} />
        </section>
      </Container>

      <Container className="pt-12">
        <section aria-labelledby="results-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="results-heading" className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                {filtered ? "Matching applications" : "All applications"}
              </h2>
              <p role="status" aria-live="polite" className="mt-1 text-sm text-text-muted tabular">
                {applications.length} of {counts.total} application{counts.total === 1 ? "" : "s"}
                {filters.sort === "oldest" ? " · oldest first" : " · newest first"}
              </p>
            </div>
            {/* Plain link (not next/link): it's a file download from a route handler. */}
            <a
              href={exportHref(filters)}
              download
              className={buttonClasses({ variant: "secondary", size: "md", className: "max-sm:h-11 max-sm:w-full" })}
            >
              <DownloadIcon className="size-4" />
              Export CSV{filtered ? " (filtered)" : ""}
            </a>
          </div>

          {applications.length ? (
            <ApplicationResults applications={applications} directory={directory} />
          ) : (
            <div className="rounded-md bg-surface-subtle px-6 py-10 text-center">
              <p className="font-semibold text-text">
                {counts.total === 0 ? "No applications yet" : "No applications match these filters"}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-text-muted">
                {counts.total === 0 ? (
                  <>
                    Applications show up here as soon as students submit{" "}
                    <a href={PUBLIC_APPLICATION_HREF} className="font-medium text-text underline underline-offset-4">
                      the application on the Office Hours page
                    </a>
                    .
                  </>
                ) : (
                  "Try a different mentor, availability or status, or clear the filters."
                )}
              </p>
            </div>
          )}
        </section>
      </Container>

      <Container className="pt-20">
        <section aria-labelledby="capacity-heading">
          <SectionHeader
            id="capacity-heading"
            title="Slot capacity"
            lede="Proposed and confirmed appointments both hold a seat, and canceling frees it up. Full slots can’t be assigned."
          />
          <SlotBoard directory={directory} usage={usage} />
        </section>
      </Container>

      <Container className="pt-20 pb-8">
        <section aria-labelledby="mentor-notes-heading">
          <SectionHeader
            id="mentor-notes-heading"
            title="Mentor notes"
            lede="Scheduling, constraints and copy that still needs approval. None of this shows up on the public site. Students can pick a mentor who’s still scheduling without choosing a time, and those applications show as “Interest only”."
          />
          <MentorNotes mentors={mentors} />
        </section>
      </Container>
    </>
  );
}
