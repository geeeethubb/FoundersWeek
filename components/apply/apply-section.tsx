/**
 * The office-hours application as a page section (`#apply`), embedded on /office-hours — the
 * site's primary experience. Server component: resolves the prefill from the URL
 * (`?mentor=<id>&window=<id>|slot=<id>`), checks whether submissions can be stored right now,
 * and renders the client form.
 *
 * Usage (in a dynamic page): <ApplySection searchParams={await searchParams} />
 *
 * The section starts with its heading, so any link to #apply lands on "Apply for Office Hours"
 * just below the sticky header (html's scroll-padding-top).
 *
 * When submissions can't be stored (closed, not configured, database down) the form stays
 * readable but disabled, with an honest explanation — it never pretends to accept answers.
 */
import { ApplicationForm } from "@/components/apply/application-form";
import type { ApplyMentorProfiles } from "@/components/apply/mentor-section";
import { Notice } from "@/components/ui/primitives";
import { getMentors, getSite } from "@/content";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { draftStorageKey } from "@/lib/applications/draft";
import { presentOptions } from "@/lib/applications/option-presentation";
import { resolvePrefill, type ApplySearchParams } from "@/lib/applications/prefill";
import { getSubmissionState, type SubmissionState } from "@/lib/applications/submission-state";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { APPLY_ANCHOR } from "@/lib/schedule/entries";
import { formatDate, formatDeadline } from "@/lib/time";

/**
 * Organizer setup hints (submission-state.ts) are shown only on a local dev server or a Vercel
 * preview deploy — never on a production site, whatever it's hosted on. Raw connection errors can
 * name hosts, so outside local development they're replaced with a generic pointer to the logs.
 */
function safeOrganizerHint(state: Extract<SubmissionState, { open: false }>): string | null {
  if (!state.organizerHint) return null;
  const localDev = process.env.NODE_ENV === "development";
  if (!localDev && process.env.VERCEL_ENV !== "preview") return null;
  if (localDev || state.reason !== "database-unavailable") return state.organizerHint;
  return "The application database is unreachable or not migrated. Check the server logs, then README → Database.";
}

export async function ApplySection({ searchParams }: { searchParams: ApplySearchParams }) {
  const site = getSite();
  const mentors = getMentors();
  const catalog = buildApplicationCatalog(mentors);
  const state = await getSubmissionState();
  const prefill = resolvePrefill(catalog, searchParams);
  const presentations = presentOptions(catalog, mentors);
  const profiles: ApplyMentorProfiles = Object.fromEntries(
    mentors.map((m) => [m.id, { role: m.role, company: m.company, headshot: m.headshot }]),
  );

  const { deadline, decisionsBy } = site.applications;
  const dates = [
    deadline ? `Apply by ${formatDeadline(deadline)}.` : null,
    decisionsBy ? `Decisions by ${formatDate(decisionsBy.slice(0, 10), "long")}.` : null,
  ].filter(Boolean);
  const closed = state.open ? null : { title: state.title, message: state.message };
  const hint = state.open ? null : safeOrganizerHint(state);

  return (
    <section id={APPLY_ANCHOR} aria-labelledby="apply-heading" className="group/apply">
      <div className="max-w-2xl">
        <h2 id="apply-heading" className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {PRIMARY_CTA_LABEL}
        </h2>
        <span aria-hidden className="mt-4 block h-0.5 w-10 rounded-full bg-accent" />
        <div className="group-has-[[data-apply-success]]/apply:hidden">
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            One short form covers every mentor. It takes about five minutes, and you don’t need a résumé, deck or account.
          </p>
          {dates.length ? <p className="mt-2 text-[0.9375rem] font-medium text-text">{dates.join(" ")}</p> : null}
        </div>
      </div>

      {!state.open ? (
        <div id="apply-closed-notice" className="mt-8 max-w-2xl group-has-[[data-apply-success]]/apply:hidden">
          <Notice tone="warning" title={state.title} role="status">
            <p>{state.message} You can still read through the questions below.</p>
            {hint ? (
              <p className="mt-2 text-xs leading-relaxed text-text-subtle">
                Organizer setup (not shown in production): {hint}
              </p>
            ) : null}
          </Notice>
        </div>
      ) : null}

      <div className="mt-10 md:mt-12">
        <ApplicationForm
          catalog={catalog}
          emailDomains={site.applications.emailDomains}
          presentations={presentations}
          profiles={profiles}
          prefill={prefill}
          draftKey={draftStorageKey({ shortName: site.shortName, year: site.week.year })}
          closed={closed}
        />
      </div>
    </section>
  );
}
