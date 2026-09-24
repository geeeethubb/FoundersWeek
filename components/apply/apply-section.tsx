/**
 * The office-hours application as a page section (`#apply`), embedded on /office-hours — the
 * site's primary experience. Server component: resolves the prefill from the URL
 * (`?mentor=<id>&window=<id>|slot=<id>`), checks whether submissions can be stored right now,
 * and renders the client form.
 *
 * Usage (in a dynamic page): <ApplySection searchParams={await searchParams} />
 *
 * When submissions can't be stored (closed, not configured, database down) the form stays
 * readable but disabled, with an honest explanation — it never pretends to accept answers.
 */
import { ApplicationForm } from "@/components/apply/application-form";
import type { ApplyMentorProfiles } from "@/components/apply/mentor-section";
import { AlertIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/primitives";
import { getMentors, getSite } from "@/content";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { APPLICATION_COPY } from "@/lib/applications/constants";
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

  const deadline = site.applications.deadline;
  const decisionsBy = site.applications.decisionsBy;
  const deadlineLabel = deadline ? formatDeadline(deadline) : null;
  const closed = state.open ? null : { title: state.title, message: state.message };
  const hint = state.open ? null : safeOrganizerHint(state);
  const mentorCount = catalog.mentors.length;

  const facts: { label: string; value: string }[] = [
    { label: "Mentors", value: mentorCount ? `${mentorCount}, one form` : "Being confirmed" },
    { label: "Takes", value: "About 5 minutes" },
    { label: "You need", value: "Illinois email" },
    { label: "Apply by", value: deadlineLabel ?? "Not announced yet" },
    ...(decisionsBy ? [{ label: "Decisions by", value: formatDate(decisionsBy.slice(0, 10), "long") }] : []),
  ];

  return (
    <section id={APPLY_ANCHOR} aria-labelledby="apply-heading" className="group">
      <header className="relative group-has-[[data-apply-success]]:hidden">
        <ApplyOrbit className="pointer-events-none absolute -top-6 right-0 hidden h-56 w-auto lg:block" />
        <div className="relative max-w-3xl">
          <p className="mono-label flex items-center gap-2 text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Office Hours · Application
          </p>
          <h2
            id="apply-heading"
            className="mt-5 font-wide text-[2.5rem] font-bold leading-[0.92] tracking-[-0.04em] text-paper sm:text-6xl"
          >
            {PRIMARY_CTA_LABEL}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper-muted">
            One short application covers every mentor.{" "}
            <span className="text-paper">No résumé, no pitch deck, no account.</span> Pick who you’d like to meet,
            tell us what you’re working on, and you’re done.
          </p>
          <p className="mt-4 flex max-w-2xl gap-2.5 text-sm leading-relaxed text-paper-muted">
            <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-accent" />
            <span>
              <strong className="font-semibold text-paper">Applying doesn’t book a time.</strong> {APPLICATION_COPY.limited}
            </span>
          </p>
        </div>

        <dl className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
          {facts.slice(0, 4).map((f) => (
            <div key={f.label} className="bg-ink-900 px-4 py-3.5">
              <dt className="mono-label text-paper-subtle">{f.label}</dt>
              <dd className="mt-1.5 font-mono text-[0.8125rem] leading-snug text-paper tabular">{f.value}</dd>
            </div>
          ))}
        </dl>
        {facts[4] ? (
          <p className="mt-3 font-mono text-xs text-paper-muted tabular">
            {facts[4].label}: {facts[4].value}
          </p>
        ) : null}
      </header>

      {!state.open ? (
        <div id="apply-closed-notice" className="mt-8 max-w-3xl group-has-[[data-apply-success]]:hidden">
          <Notice tone="warning" title={state.title} role="status">
            <p>{state.message} You can still read through the questions below.</p>
            {hint ? (
              <p className="mt-2 flex gap-2 font-mono text-xs leading-relaxed text-paper-subtle">
                <AlertIcon className="mt-px size-3.5 shrink-0" />
                <span>Organizer setup (not shown in production): {hint}</span>
              </p>
            ) : null}
          </Notice>
        </div>
      ) : null}

      <div className="mt-12 md:mt-16 group-has-[[data-apply-success]]:mt-0">
        <ApplicationForm
          catalog={catalog}
          emailDomains={site.applications.emailDomains}
          presentations={presentations}
          profiles={profiles}
          prefill={prefill}
          closed={closed}
          deadlineLabel={deadlineLabel}
        />
      </div>
    </section>
  );
}

/**
 * Decorative orbit diagram beside the heading: one ring per mentor, each with a point, and the
 * orange point on the outermost — the same line language as the mentor portraits.
 */
function ApplyOrbit({ className }: { className?: string }) {
  const cx = 150;
  const cy = 110;
  const rings = [34, 58, 82, 106];
  const angles = [-38, 112, 204, 318];
  return (
    <svg viewBox="0 0 300 220" aria-hidden className={className} fill="none">
      <path d={`M${cx - 6} ${cy}H${cx + 6}M${cx} ${cy - 6}V${cy + 6}`} stroke="rgb(244 239 231 / 0.35)" strokeWidth="0.75" />
      {rings.map((r, i) => (
        <ellipse
          key={r}
          cx={cx}
          cy={cy}
          rx={r * 1.25}
          ry={r * 0.78}
          stroke={`rgb(244 239 231 / ${i === 1 ? 0.2 : 0.11})`}
          strokeWidth="0.75"
          strokeDasharray={i === 2 ? "2 3" : undefined}
        />
      ))}
      {rings.map((r, i) => {
        const a = (angles[i] * Math.PI) / 180;
        const x = cx + Math.cos(a) * r * 1.25;
        const y = cy + Math.sin(a) * r * 0.78;
        const last = i === rings.length - 1;
        return (
          <g key={`p-${r}`}>
            {last ? <circle cx={x} cy={y} r="8" stroke="rgb(255 95 5 / 0.45)" strokeWidth="0.75" /> : null}
            <circle cx={x} cy={y} r={last ? 3.5 : 2.25} fill={last ? "#ff5f05" : "rgb(244 239 231 / 0.55)"} />
          </g>
        );
      })}
      <path
        d={`M${cx + 106 * 1.25} ${cy} A${106 * 1.25} ${106 * 0.78} 0 0 1 ${cx + Math.cos(Math.PI / 3) * 106 * 1.25} ${cy + Math.sin(Math.PI / 3) * 106 * 0.78}`}
        stroke="rgb(255 95 5 / 0.7)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
