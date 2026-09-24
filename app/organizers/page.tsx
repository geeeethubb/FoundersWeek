import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMentorsForOrganizers, isDemoContentEnabled } from "@/content";
import { ApplicationFiltersForm } from "@/components/organizer/application-filters";
import { ApplicationResults } from "@/components/organizer/application-results";
import { DataStoreIndicator } from "@/components/organizer/data-store-indicator";
import { MentorLineup } from "@/components/organizer/mentor-lineup";
import { MentorNotes } from "@/components/organizer/mentor-notes";
import { OrganizerBar } from "@/components/organizer/organizer-bar";
import { SlotBoard } from "@/components/organizer/slot-board";
import { StatusStrip } from "@/components/organizer/status-strip";
import { buttonClasses } from "@/components/ui/button";
import { ArrowUpRightIcon, DownloadIcon } from "@/components/ui/icons";
import { Container, Eyebrow, Notice, SectionHeading } from "@/components/ui/primitives";
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

export default async function OrganizersDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await requireOrganizerPage(`/organizers${rawQuery(sp) ? `?${rawQuery(sp)}` : ""}`);

  const mentors = getMentorsForOrganizers();
  const directory = buildOrganizerDirectory(mentors);
  // Only ids that exist in content (an event such as Dan Caruso's is never a mentor filter).
  const filters = restrictToDirectory(parseApplicationFilters(sp), directory);
  // The GET form submits empty fields; keep URLs canonical and shareable.
  if (rawQuery(sp) !== applicationFiltersQuery(filters)) redirect(organizersHref(filters));

  const dataStore = await getDataStoreStatus();

  const header = (
    <>
      <OrganizerBar name={session.name} demo={isDemoContentEnabled()} />
      <header className="relative isolate overflow-hidden border-b border-line">
        <div aria-hidden className="absolute inset-0 -z-10 bg-blueprint opacity-70" />
        <Container className="grid gap-8 pt-10 pb-9 md:pt-14 md:pb-11 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <Eyebrow index="01">Organizers · Office hours</Eyebrow>
            <h1 className="mt-5 font-wide text-[2.75rem] font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-6xl">
              Applications
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-paper-muted sm:text-lg">
              Review office-hours applications, assign appointment slots and keep each student’s status current.
              Applicant answers are private to the organizer team.
            </p>
            <a
              href={PUBLIC_APPLICATION_HREF}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-paper-muted underline-offset-4 transition-colors hover:text-accent hover:underline sm:min-h-8"
            >
              Public application form
              <span className="font-mono text-xs text-paper-subtle">{PUBLIC_APPLICATION_HREF}</span>
              <ArrowUpRightIcon className="size-3.5" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </div>
          <DataStoreIndicator status={dataStore} className="lg:col-span-4" />
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
          <Notice tone="danger" title="Applications can’t be loaded right now" role="alert">
            <p>
              The application database isn’t available, so nothing can be reviewed or changed. Nothing has been lost —
              reload this page once the data store shows as connected.
            </p>
          </Notice>
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

      <Container as="section" className="space-y-6 pt-8 md:pt-10">
        <h2 className="sr-only">Overview</h2>
        <div>
          <p aria-hidden className="mono-label mb-2.5 text-paper-subtle">
            By status
          </p>
          <StatusStrip counts={counts} filters={filters} />
        </div>
        <div>
          <p aria-hidden className="mono-label mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-paper-subtle">
            <span>By mentor · active applications</span>
            <span className="normal-case tracking-normal font-sans text-xs">Select a mentor to filter</span>
          </p>
          <MentorLineup directory={directory} interest={interest} usage={usage} filters={filters} />
        </div>
      </Container>

      <Container as="section" className="pt-6">
        <h2 className="sr-only">Filters</h2>
        <ApplicationFiltersForm filters={filters} directory={directory} />
      </Container>

      <Container as="section" className="pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 id="results-heading" className="font-wide text-2xl font-bold tracking-[-0.02em] text-paper">
              {filtered ? "Matching applications" : "All applications"}
            </h2>
            <p role="status" aria-live="polite" className="mt-1 font-mono text-xs text-paper-muted tabular">
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
          <div className="pt-2">
            <ApplicationResults applications={applications} directory={directory} />
          </div>
        ) : (
          <div className="mt-6 rounded-sm border border-dotted border-line-strong px-5 py-8 text-center">
            <p className="font-medium text-paper">
              {counts.total === 0 ? "No applications yet" : "No applications match these filters"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-paper-muted">
              {counts.total === 0 ? (
                <>
                  Applications appear here as soon as students submit the form at{" "}
                  <a href={PUBLIC_APPLICATION_HREF} className="font-mono text-xs text-paper underline underline-offset-4 hover:text-accent">
                    {PUBLIC_APPLICATION_HREF}
                  </a>
                  .
                </>
              ) : (
                "Try a different mentor, availability or status — or clear the filters."
              )}
            </p>
          </div>
        )}
      </Container>

      <Container as="section" className="pt-20">
        <SectionHeading
          index="02"
          eyebrow="Capacity"
          title="Slot capacity"
          id="capacity-heading"
          lede="Proposed and confirmed appointments both hold a seat; canceling frees it. Full slots can’t be assigned."
          className="mb-6"
        />
        <SlotBoard directory={directory} usage={usage} />
      </Container>

      <Container as="section" className="pt-20">
        <SectionHeading
          index="03"
          eyebrow="Organizer-only"
          title="Mentor notes"
          id="mentor-notes-heading"
          lede="Scheduling state, constraints and copy awaiting approval. None of this appears on the public site."
          className="mb-6"
        />
        <MentorNotes mentors={mentors} />
      </Container>
    </>
  );
}
