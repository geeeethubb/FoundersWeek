import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge, AppointmentStatusBadge } from "@/components/ui/status";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeftIcon, LockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container, Notice } from "@/components/ui/primitives";
import { findSlot, getMentors, getSite } from "@/content";
import type { SessionFormat } from "@/content/types";
import { APPLICATION_STATUS_DESCRIPTIONS, SESSION_COPY, type ApplicationStatus } from "@/lib/applications/constants";
import { getApplicationStatusView, type ApplicationStatusView } from "@/lib/applications/repository";
import { DatabaseUnavailableError, getDb } from "@/lib/db/client";
import { verifyStatusToken } from "@/lib/security/status-token";
import { formatDate, formatInstant, formatTimeRange, TZ_LABEL, utcToZoned } from "@/lib/time";

/**
 * A student's private application status (/apply/status/<signed token>). The URL is the
 * credential; the page shows only status, first name, chosen mentors and appointments — never the
 * email or answers. While there's no appointment yet, one line says how long a session is
 * (`site.officeHours`).
 */
export const metadata: Metadata = {
  title: "Application status",
  robots: { index: false, follow: false },
  // The URL is the credential: never leak it to other sites via the Referer header.
  referrer: "no-referrer",
};

const FORMAT_LABELS: Record<SessionFormat, string> = { "in-person": "In person", virtual: "Virtual", hybrid: "Hybrid" };

/** Statuses where "no appointment yet" is worth saying. */
const AWAITING: ApplicationStatus[] = ["submitted", "under_review", "selected", "waitlisted"];

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

function PrivateLabel() {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-text-subtle">
      <LockIcon className="size-3.5" />
      Private application status
    </p>
  );
}

export default async function ApplicationStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await load(token);
  if (!result) notFound();

  if (result.kind === "unavailable") {
    return (
      <Container className="py-16 md:py-24">
        <div className="max-w-2xl">
          <PrivateLabel />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">Status unavailable</h1>
          <Notice tone="warning" title="We can’t load application statuses right now" className="mt-8">
            If you applied, your application is saved. Please try this link again in a little while.
          </Notice>
          <ButtonLink href="/office-hours" variant="secondary" size="lg" className="mt-8">
            <ArrowLeftIcon className="size-4" />
            Back to Office Hours
          </ButtonLink>
        </div>
      </Container>
    );
  }

  const { view } = result;
  const mentors = new Map(getMentors().map((m) => [m.id, m]));

  const appointments = view.appointments.map((a) => {
    const slot = findSlot(a.slotId);
    const start = utcToZoned(new Date(a.startsAt));
    const end = utcToZoned(new Date(a.endsAt));
    const date = slot?.date ?? start.date;
    const time = slot ? formatTimeRange(slot.start, slot.end) : formatTimeRange(start.time, end.time);
    return {
      ...a,
      when: `${formatDate(date, "long")} · ${time} ${TZ_LABEL}`,
      mentorName: mentors.get(a.mentorId)?.name ?? "Your mentor",
      demo: Boolean(mentors.get(a.mentorId)?.demo),
      where: [slot?.format ? FORMAT_LABELS[slot.format] : null, slot?.location ?? "Location will be shared by email"]
        .filter(Boolean)
        .join(" · "),
    };
  });

  return (
    <Container className="py-14 md:py-20">
      <div className="max-w-3xl">
        <PrivateLabel />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">
          {view.firstName ? `Hi, ${view.firstName}.` : "Your application"}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-text-muted sm:text-lg">
          Here’s where your office-hours application stands. Submitted{" "}
          <time dateTime={view.createdAt}>{formatInstant(view.createdAt)}</time>.
        </p>

        <section aria-labelledby="status-current" className="mt-10 rounded-md border border-line bg-surface p-6 sm:p-7">
          <h2 id="status-current" className="text-sm font-medium text-text-subtle">
            Current status
          </h2>
          <ApplicationStatusBadge status={view.status} className="mt-3 h-7 px-2.5 text-sm" />
          <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-text">
            {APPLICATION_STATUS_DESCRIPTIONS[view.status]}
          </p>
          {!appointments.length && AWAITING.includes(view.status) ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-subtle">
              {SESSION_COPY.status(getSite().officeHours)}
            </p>
          ) : null}
        </section>

        {appointments.length ? (
          <section aria-labelledby="status-appointments" className="mt-12">
            <h2 id="status-appointments" className="text-xl font-semibold tracking-tight text-text">
              Appointments
            </h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {appointments.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                  <div className="min-w-0">
                    <p className="font-medium text-text tabular">
                      <time dateTime={a.startsAt}>{a.when}</time>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.9375rem] text-text">
                      with {a.mentorName}
                      {a.demo ? <DemoBadge /> : null}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">{a.where}</p>
                  </div>
                  <AppointmentStatusBadge status={a.status} className="self-start" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="status-mentors" className="mt-12">
          <h2 id="status-mentors" className="text-xl font-semibold tracking-tight text-text">
            Mentors you chose
          </h2>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {view.mentors.map(({ mentorId, rank }) => {
              const mentor = mentors.get(mentorId);
              const affiliation = mentor ? [mentor.role, mentor.company].filter(Boolean).join(" · ") || null : null;
              return (
                <li key={mentorId} className="flex items-center gap-4 py-4">
                  <MentorPortrait
                    id={mentorId}
                    name={mentor?.name ?? "?"}
                    headshot={mentor?.headshot ? { ...mentor.headshot, alt: "" } : null}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-semibold text-text">{mentor?.name ?? "A mentor no longer listed"}</span>
                      {mentor?.demo ? <DemoBadge /> : null}
                      {rank === 1 && view.mentors.length > 1 ? (
                        <span className="inline-flex h-6 items-center rounded-xs bg-accent-soft px-2 text-xs font-semibold text-accent-strong">
                          First choice
                        </span>
                      ) : null}
                    </p>
                    {affiliation ? <p className="mt-0.5 text-sm text-text-muted">{affiliation}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <p className="mt-10 flex max-w-2xl gap-2.5 text-sm leading-relaxed text-text-subtle">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>Keep this link private, since anyone with it can see this page. Bookmark it to check back any time.</span>
        </p>

        <ButtonLink href="/office-hours" variant="secondary" size="lg" className="mt-8 w-full sm:w-auto">
          <ArrowLeftIcon className="size-4" />
          Back to Office Hours
        </ButtonLink>
      </div>
    </Container>
  );
}
