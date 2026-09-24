import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvailabilityBadge, ApplicationStatusBadge, AppointmentStatusBadge } from "@/components/ui/status";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockIcon, PickMark } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container, Eyebrow, Notice } from "@/components/ui/primitives";
import { findSlot, getMentors, getSite } from "@/content";
import type { SessionFormat } from "@/content/types";
import {
  APPLICATION_STATUS_DESCRIPTIONS,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/applications/constants";
import { getApplicationStatusView, type ApplicationStatusView } from "@/lib/applications/repository";
import { cn } from "@/lib/cn";
import { DatabaseUnavailableError, getDb } from "@/lib/db/client";
import { INTEREST_COPY, schedulingStatus } from "@/lib/mentors";
import { verifyStatusToken } from "@/lib/security/status-token";
import { formatDate, formatInstant, formatTimeRange, TZ_LABEL, utcToZoned } from "@/lib/time";

export const metadata: Metadata = {
  title: "Application status",
  robots: { index: false, follow: false },
  // The URL is the credential: never leak it to other sites via the Referer header.
  referrer: "no-referrer",
};

const FORMAT_LABELS: Record<SessionFormat, string> = { "in-person": "In person", virtual: "Virtual", hybrid: "Hybrid" };

/** The usual path an application takes. Waitlisted/canceled are shown as side outcomes. */
const MAIN_PATH: ApplicationStatus[] = ["submitted", "under_review", "selected", "confirmed", "attended"];
const SIDE_OUTCOMES: ApplicationStatus[] = ["waitlisted", "canceled"];

type Load = { kind: "ok"; view: ApplicationStatusView } | { kind: "unavailable" };

async function load(token: string): Promise<Load | null> {
  let id: string | null;
  try {
    id = verifyStatusToken(token);
  } catch {
    // No signing secret configured: links can't be verified right now.
    return { kind: "unavailable" };
  }
  if (!id) return null;
  try {
    const view = await getApplicationStatusView(await getDb(), id);
    return view ? { kind: "ok", view } : null;
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return { kind: "unavailable" };
    throw error;
  }
}

export default async function ApplicationStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await load(token);
  if (!result) notFound();

  if (result.kind === "unavailable") {
    return (
      <Container className="py-16 md:py-24">
        <Eyebrow>Application status</Eyebrow>
        <h1 className="mt-5 font-wide text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-5xl">
          Status unavailable
        </h1>
        <Notice tone="warning" title="We can’t load application statuses right now" className="mt-8 max-w-2xl">
          If you applied, your application is saved. Please try this link again in a little while.
        </Notice>
        <ButtonLink href="/office-hours" variant="secondary" size="lg" className="mt-8">
          <ArrowLeftIcon className="size-4" />
          Back to Office Hours
        </ButtonLink>
      </Container>
    );
  }

  const { view } = result;
  const site = getSite();
  const mentors = new Map(getMentors().map((m) => [m.id, m]));

  const appointments = view.appointments.map((a) => {
    const slot = findSlot(a.slotId);
    const start = utcToZoned(new Date(a.startsAt));
    const end = utcToZoned(new Date(a.endsAt));
    const date = slot?.date ?? start.date;
    const time = slot ? formatTimeRange(slot.start, slot.end) : formatTimeRange(start.time, end.time);
    return {
      ...a,
      date,
      when: `${formatDate(date, "long")} · ${time} ${TZ_LABEL}`,
      mentorName: mentors.get(a.mentorId)?.name ?? "Your mentor",
      demo: Boolean(mentors.get(a.mentorId)?.demo),
      format: slot?.format ? FORMAT_LABELS[slot.format] : null,
      location: slot?.location ?? null,
    };
  });

  const onMainPath = MAIN_PATH.includes(view.status);
  const reachedIndex = onMainPath ? MAIN_PATH.indexOf(view.status) : 1;

  return (
    <>
      <div className="border-b border-line">
        <Container className="pb-8 pt-10 md:pb-12 md:pt-16">
          <Eyebrow>
            <span className="inline-flex items-center gap-2">
              <LockIcon className="size-3.5 text-accent" />
              Private application status
            </span>
          </Eyebrow>
          <h1 className="mt-5 font-wide text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-5xl md:text-6xl">
            {view.firstName ? `Hi, ${view.firstName}.` : "Your application"}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">
            Here’s where your office-hours application stands.
          </p>
          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="mono-label text-paper-subtle">Submitted</dt>
              <dd className="mt-1 font-mono text-sm text-paper tabular">
                <time dateTime={view.createdAt}>{formatInstant(view.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="mono-label text-paper-subtle">Mentors</dt>
              <dd className="mt-1 font-mono text-sm text-paper tabular">{view.mentors.length}</dd>
            </div>
          </dl>
        </Container>
      </div>

      <Container className="py-10 md:py-14">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-20">
          <div className="min-w-0 space-y-12">
            {/* Current status */}
            <section aria-labelledby="status-current" className="rounded-sm border border-line-strong bg-ink-850 p-5 sm:p-7">
              <h2 id="status-current" className="mono-label text-paper-subtle">
                Current status
              </h2>
              <div className="mt-4">
                <ApplicationStatusBadge status={view.status} className="h-7 px-2.5 text-xs" />
              </div>
              <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-paper">
                {APPLICATION_STATUS_DESCRIPTIONS[view.status]}
              </p>
            </section>

            {/* Appointments */}
            <section aria-labelledby="status-appointments">
              <h2 id="status-appointments" className="font-wide text-2xl font-bold tracking-[-0.025em] text-paper">
                Appointments
              </h2>
              {appointments.length ? (
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-paper tabular">
                          <time dateTime={a.startsAt}>{a.when}</time>
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 font-medium text-paper">
                          with {a.mentorName}
                          {a.demo ? <DemoBadge /> : null}
                        </p>
                        <p className="mt-1 text-sm text-paper-muted">
                          {[a.format, a.location ?? "Location will be shared by email"].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={a.status} className="self-start" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-paper-muted">
                  No appointment yet. If you’re selected, Founders will email you to confirm a time — it will also
                  appear here.
                </p>
              )}
            </section>

            {/* Mentors */}
            <section aria-labelledby="status-mentors">
              <h2 id="status-mentors" className="font-wide text-2xl font-bold tracking-[-0.025em] text-paper">
                Mentors you chose
              </h2>
              <ol className="mt-5 divide-y divide-line border-y border-line">
                {view.mentors.map(({ mentorId, rank }) => {
                  const mentor = mentors.get(mentorId);
                  const inProgress = mentor ? schedulingStatus(mentor) === "in-progress" : false;
                  const affiliation = mentor ? [mentor.role, mentor.company].filter(Boolean).join(" · ") || null : null;
                  return (
                    <li key={mentorId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                      <div className="flex min-w-0 items-center gap-5">
                        <MentorPortrait
                          id={mentorId}
                          name={mentor?.name ?? "?"}
                          headshot={mentor?.headshot ?? null}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="font-semibold text-paper">{mentor?.name ?? "A mentor no longer listed"}</span>
                            {mentor?.demo ? <DemoBadge /> : null}
                            {rank === 1 ? (
                              <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-accent">
                                <PickMark className="size-1.5" />
                                First choice
                              </span>
                            ) : null}
                          </p>
                          {affiliation ? <p className="mt-0.5 text-sm text-paper-muted">{affiliation}</p> : null}
                        </div>
                      </div>
                      {inProgress ? (
                        <div className="pl-[4.375rem] sm:max-w-[16rem] sm:pl-0 sm:text-right">
                          <AvailabilityBadge kind="in-progress" />
                          <p className="mt-1.5 text-xs leading-relaxed text-paper-subtle">{INTEREST_COPY.followUp}</p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/office-hours" variant="secondary" size="lg">
                <ArrowLeftIcon className="size-4" />
                Back to Office Hours
              </ButtonLink>
              <ButtonLink href="/schedule" variant="ghost" size="lg">
                Explore the Calendar
                <ArrowRightIcon className="size-4" />
              </ButtonLink>
            </div>
          </div>

          {/* How it works */}
          <aside aria-labelledby="status-how" className="lg:border-l lg:border-line lg:pl-8">
            <h2 id="status-how" className="mono-label text-paper-subtle">
              How applications move
            </h2>
            {!onMainPath ? (
              <p className="mt-4 text-sm leading-relaxed text-paper-muted">
                Your application is <span className="text-paper">{APPLICATION_STATUS_LABELS[view.status].toLowerCase()}</span>.
              </p>
            ) : null}
            <ol className="relative mt-5">
              {MAIN_PATH.map((status, i) => {
                const current = status === view.status;
                const done = onMainPath ? i < reachedIndex : i <= reachedIndex;
                const last = i === MAIN_PATH.length - 1;
                return (
                  <li key={status} className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-6 last:pb-0">
                    {!last ? (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-[0.5625rem] top-6 bottom-1 w-px",
                          done ? "bg-line-strong" : "border-l border-dashed border-line-strong",
                        )}
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "relative mt-0.5 flex size-5 items-center justify-center rounded-full border",
                        current
                          ? "border-accent bg-accent-soft"
                          : done
                            ? "border-line-strong bg-ink-850"
                            : "border-dashed border-line-strong",
                      )}
                    >
                      {current ? <span className="size-2 rounded-full bg-accent" /> : null}
                      {done && !current ? <CheckIcon className="size-3 text-paper-muted" strokeWidth={2} /> : null}
                    </span>
                    <div className={cn("min-w-0", !current && !done && "opacity-80")}>
                      <p className={cn("text-sm font-medium", current ? "text-paper" : "text-paper-muted")}>
                        {APPLICATION_STATUS_LABELS[status]}
                        {current ? <span className="sr-only"> (current status)</span> : null}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-paper-subtle">{APPLICATION_STATUS_DESCRIPTIONS[status]}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-8 space-y-3 border-t border-line pt-5">
              {SIDE_OUTCOMES.map((status) => (
                <div key={status}>
                  <dt className={cn("text-sm font-medium", status === view.status ? "text-paper" : "text-paper-muted")}>
                    {APPLICATION_STATUS_LABELS[status]}
                    {status === view.status ? <span className="sr-only"> (current status)</span> : null}
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-paper-subtle">{APPLICATION_STATUS_DESCRIPTIONS[status]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 flex gap-2.5 border-t border-line pt-5 text-xs leading-relaxed text-paper-subtle">
              <LockIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Keep this link private — anyone with it can see this page. Bookmark it to check back; it updates as{" "}
                {site.org.shortName} reviews applications.
              </span>
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
