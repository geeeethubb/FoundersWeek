import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentorsForOrganizers, getSite, isDemoContentEnabled } from "@/content";
import { AppointmentActions } from "@/components/organizer/appointment-actions";
import { AssignForm, type AssignGroup } from "@/components/organizer/assign-form";
import { AvailabilityList, Code, FirstChoiceMark, InterestOnly } from "@/components/organizer/bits";
import { CopyLink } from "@/components/organizer/copy-link";
import { NotesForm } from "@/components/organizer/notes-form";
import { OrganizerBar } from "@/components/organizer/organizer-bar";
import { StatusForm } from "@/components/organizer/status-form";
import { DemoBadge } from "@/components/ui/badge";
import { MentorPortrait } from "@/components/ui/portrait";
import { AlertIcon, ArrowLeftIcon, ArrowUpRightIcon, CheckIcon, XIcon } from "@/components/ui/icons";
import { Container, Notice } from "@/components/ui/primitives";
import { AppointmentStatusBadge, ApplicationStatusBadge, AvailabilityBadge } from "@/components/ui/status";
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import { getSiteUrl, isNonProductionDeploy } from "@/lib/config";
import { getDb, getPersistenceStatus } from "@/lib/db/client";
import {
  buildOrganizerDirectory,
  intervalLabel,
  joinNames,
  mentorBookability,
  mentorName,
  resolveAvailability,
  sessionLimitNote,
  type MentorBookability,
  type OrganizerDirectory,
} from "@/lib/organizer/directory";
import { redactDatabaseDetail } from "@/lib/organizer/data-store";
import { describeActivity, participationLabel, stageDescription, stageLabel, yearLabel } from "@/lib/organizer/labels";
import { requireOrganizerPage } from "@/lib/organizer/page-auth";
import {
  getApplicationDetail,
  getSlotUsage,
  isUuid,
  type ApplicationDetail,
  type AppointmentRecord,
} from "@/lib/organizer/queries";
import { sessionRuleText } from "@/lib/schedule/sessions";
import { statusPath } from "@/lib/security/status-token";
import { formatInstant, zonedTimeToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

// Generic title: applicant names shouldn't end up in browser history or tab lists.
export const metadata: Metadata = {
  title: "Application",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireOrganizerPage(`/organizers/applications/${encodeURIComponent(id)}`);
  if (!isUuid(id)) notFound();

  const persistence = await getPersistenceStatus();
  if (!persistence.ready) {
    return (
      <>
        <OrganizerBar name={session.name} demo={isDemoContentEnabled()} />
        <Container className="pt-10 pb-6">
          <div role="alert" className="max-w-3xl rounded-md bg-danger-soft px-5 py-4 text-sm leading-relaxed">
            <p className="flex items-center gap-2 font-semibold text-text">
              <AlertIcon className="size-4 shrink-0 text-danger" />
              The application database isn’t available
            </p>
            <p className="mt-1.5 text-text-muted">This application can’t be loaded right now. Try again in a minute.</p>
            {isNonProductionDeploy() ? (
              <p className="mt-2 break-words text-xs text-text-subtle">{redactDatabaseDetail(persistence.detail)}</p>
            ) : null}
          </div>
        </Container>
      </>
    );
  }

  const db = await getDb();
  const [detail, usage] = await Promise.all([getApplicationDetail(db, id), getSlotUsage(db)]);
  if (!detail) notFound();

  const directory = buildOrganizerDirectory(getMentorsForOrganizers(), getSite().officeHours);
  const { application: app } = detail;
  const statusUrl = `${getSiteUrl()}${statusPath(app.id)}`;
  const activeAppointments = app.appointments.filter((a) => a.status !== "canceled");
  const canceledAppointments = app.appointments.filter((a) => a.status === "canceled");
  const hasConfirmed = app.appointments.some((a) => a.status === "confirmed");
  const closed = app.status === "canceled" || app.status === "attended";
  const preferences = mentorBookability(directory, app.mentors.map((m) => m.mentorId));
  const withoutSlots = preferences.filter((p) => p.slots.length === 0);
  const confirmBlockedReason = hasConfirmed ? null : confirmationBlocker(activeAppointments, directory, preferences);
  const demo = app.mentors.some((m) => directory.mentorsById.get(m.mentorId)?.demo);

  return (
    <>
      <OrganizerBar name={session.name} demo={isDemoContentEnabled()} />

      <header className="border-b border-line">
        <Container className="pt-6 pb-10 md:pt-8 md:pb-12">
          <Link
            href="/organizers"
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-xs px-1 text-sm font-medium text-text-muted transition-colors hover:text-text sm:min-h-9"
          >
            <ArrowLeftIcon className="size-4" />
            All applications
          </Link>
          <p className="mt-6 text-sm text-text-subtle">
            Submitted <time dateTime={app.createdAt}>{formatInstant(app.createdAt)}</time>
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text [overflow-wrap:anywhere] sm:text-4xl">
            {app.fullName}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ApplicationStatusBadge status={app.status} />
            <span className="break-all text-base text-text-muted">{app.email}</span>
            {demo ? <DemoBadge /> : null}
          </div>
          {detail.related.length ? (
            <div className="mt-6 max-w-2xl">
              <Notice tone="warning" title={`${app.duplicateCount} applications from this email`}>
                <ul className="mt-1 space-y-1">
                  {detail.related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/organizers/applications/${r.id}`}
                        className="font-medium text-text underline underline-offset-4"
                      >
                        {formatInstant(r.createdAt)}
                      </Link>{" "}
                      · {APPLICATION_STATUS_LABELS[r.status]}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}
        </Container>
      </header>

      {/* Phones: the actions column sits below the answers — offer a shortcut. */}
      <nav aria-label="Jump to organizer actions" className="border-b border-line bg-surface-subtle lg:hidden">
        <Container>
          <ul className="-mx-2 flex gap-1 overflow-x-auto py-1">
            {[
              ["status", "Status"],
              ["appointments", "Appointments"],
              ["notes", "Notes"],
              ["activity", "Activity"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={`#${href}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xs px-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Container className="grid gap-12 pt-10 pb-8 md:pt-12 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 space-y-12 lg:col-span-7">
          <Answers detail={detail} directory={directory} />
        </div>

        <aside aria-label="Organizer actions" className="min-w-0 space-y-4 lg:col-span-5">
          <Panel title="Status" id="status">
            <StatusForm applicationId={app.id} status={app.status} confirmBlockedReason={confirmBlockedReason} />
          </Panel>

          <Panel title="Appointments" id="appointments">
            {activeAppointments.length ? (
              <ul className="divide-y divide-line">
                {activeAppointments.map((a) => {
                  const slot = directory.slotsById.get(a.slotId);
                  const blocked = !slot
                    ? "This session isn’t in the schedule anymore."
                    : slot.status !== "confirmed"
                      ? `This time isn’t confirmed with ${slot.mentorFirstName} yet, so it can’t be confirmed here.`
                      : null;
                  return (
                    <li key={a.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <AppointmentStatusBadge status={a.status} />
                        {slot ? <AvailabilityBadge kind={slot.status} /> : null}
                      </div>
                      <p className="mt-3 font-semibold text-text">{mentorName(directory, a.mentorId)}</p>
                      <p className="text-sm text-text-muted tabular">{intervalLabel(a.startsAt, a.endsAt)}</p>
                      {slot?.location ? <p className="mt-0.5 text-sm text-text-subtle">{slot.location}</p> : null}
                      <p className="mt-1 text-xs text-text-subtle">
                        Proposed by {a.createdBy} · {formatInstant(a.createdAt)}
                      </p>
                      <div className="mt-3">
                        <AppointmentActions
                          appointmentId={a.id}
                          status={a.status as "proposed" | "confirmed"}
                          confirmBlockedReason={blocked}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md bg-surface-subtle px-4 py-3 text-sm text-text-muted">No active appointments.</p>
            )}
            {canceledAppointments.length ? (
              <details className="group mt-3 text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-medium text-text-muted underline-offset-4 hover:text-text hover:underline sm:min-h-9 [&::-webkit-details-marker]:hidden">
                  {canceledAppointments.length} canceled appointment{canceledAppointments.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-1 space-y-1 text-sm text-text-subtle">
                  {canceledAppointments.map((a) => (
                    <li key={a.id}>
                      <span className="line-through">
                        {mentorName(directory, a.mentorId)} · {intervalLabel(a.startsAt, a.endsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {withoutSlots.length && !closed ? (
              <NoSlotsYet
                mentors={withoutSlots}
                allWithout={withoutSlots.length === preferences.length}
                hasConfirmed={hasConfirmed}
              />
            ) : null}

            <div className="mt-5 border-t border-line pt-5">
              <h3 className="mb-3 font-semibold text-text">Assign a session</h3>
              {closed ? (
                <p className="text-sm text-text-muted">
                  This application is {APPLICATION_STATUS_LABELS[app.status].toLowerCase()}. Change its status to assign
                  an appointment.
                </p>
              ) : directory.slots.length === 0 ? (
                <p className="text-sm leading-relaxed text-text-muted">
                  No mentor has sessions yet, so there’s nothing to propose. Once a mentor has a window with exact start
                  and end times in <Code>content/mentors.ts</Code>, it’s split into sessions and they’ll show up here.
                </p>
              ) : (
                <AssignForm
                  applicationId={app.id}
                  groups={assignGroups(detail, directory, usage)}
                  ruleText={sessionRuleText(directory.sessionRule)}
                  hasActiveAppointment={activeAppointments.length > 0}
                />
              )}
            </div>
          </Panel>

          <Panel title="Private status link" id="status-link">
            <p className="mb-3 text-sm leading-relaxed text-text-muted">
              Send this to the student so they can check their status. Anyone with the link can see it.
            </p>
            <CopyLink url={statusUrl} label="Private status link" />
          </Panel>

          <Panel title="Organizer notes" id="notes">
            <NotesForm applicationId={app.id} notes={app.organizerNotes} />
          </Panel>

          <Panel title="Activity" id="activity">
            <ActivityLog detail={detail} directory={directory} />
          </Panel>
        </aside>
      </Container>
    </>
  );
}

/** One organizer action group: a white card in the actions column. */
function Panel({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="rounded-md border border-line bg-surface p-5 sm:p-6">
      <h2 id={`${id}-heading`} className="mb-4 text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Answers({ detail, directory }: { detail: ApplicationDetail; directory: OrganizerDirectory }) {
  const app = detail.application;
  const availability = app.availability.map((a) => resolveAvailability(directory, a));
  const byMentor = (mentorId: string) => availability.filter((a) => a.mentorId === mentorId);
  const referrer = app.referrerMentorId ? mentorName(directory, app.referrerMentorId) : null;

  return (
    <>
      <section aria-labelledby="about-heading">
        <SectionTitle id="about-heading">
          Student
        </SectionTitle>
        <dl>
          <Row label="Year">{yearLabel(app.year)}</Row>
          <Row label="Major">{app.major}</Row>
          <Row label="Participation">
            {participationLabel(app.participation)}
            {app.participation === "team" ? (
              <dl className="mt-2 space-y-1 text-sm">
                <div>
                  <dt className="inline text-text-subtle">Team name: </dt>
                  <dd className="inline">{app.teamName ?? <span className="text-text-subtle">Not given</span>}</dd>
                </div>
                <div>
                  <dt className="inline text-text-subtle">Teammates: </dt>
                  <dd className="inline whitespace-pre-line">
                    {app.teammates ?? <span className="text-text-subtle">Not given</span>}
                  </dd>
                </div>
              </dl>
            ) : null}
          </Row>
          <Row label="Stage">
            {stageLabel(app.stage)}
            {stageDescription(app.stage) ? (
              <span className="block text-sm text-text-subtle">{stageDescription(app.stage)}</span>
            ) : null}
          </Row>
        </dl>
      </section>

      <section aria-labelledby="answers-heading">
        <SectionTitle id="answers-heading">
          Answers
        </SectionTitle>
        <div className="space-y-6">
          <LongAnswer label="What they’re working on or exploring" text={app.workingOn} />
          <LongAnswer label="Question or challenge" text={app.question} />
          <div>
            <h3 className="mb-2 text-sm font-medium text-text-subtle">Link</h3>
            {app.link ? <SafeLink href={app.link} /> : <p className="text-sm text-text-subtle">No link shared.</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="prefs-heading">
        <SectionTitle id="prefs-heading">
          Mentors &amp; availability
        </SectionTitle>
        <ol className="divide-y divide-line border-y border-line">
          {app.mentors.map((m) => {
            const info = directory.mentorsById.get(m.mentorId);
            const picks = byMentor(m.mentorId);
            return (
              <li key={m.mentorId} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6">
                <div className="flex gap-3">
                  <span className="w-5 shrink-0 pt-2 text-sm text-text-subtle tabular">{m.rank}.</span>
                  <MentorPortrait id={m.mentorId} name={info?.name ?? m.mentorId} headshot={info?.headshot} size="xs" />
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {mentorName(directory, m.mentorId)}
                      {info?.demo ? <DemoBadge className="ml-2 align-middle" /> : null}
                    </p>
                    {info?.affiliation ? <p className="text-sm text-text-subtle">{info.affiliation}</p> : null}
                    {m.rank === 1 ? <FirstChoiceMark label="First choice" className="mt-1" /> : null}
                  </div>
                </div>
                <div className="min-w-0 pl-[4.25rem] sm:pl-0">
                  {picks.length ? (
                    <AvailabilityList items={picks} showMentor={false} />
                  ) : info?.scheduling === "in-progress" ? (
                    <div>
                      <InterestOnly />
                      <AvailabilityBadge kind="in-progress" className="mt-2" />
                    </div>
                  ) : (
                    <InterestOnly />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-text-subtle">Availability notes</h3>
          {app.availabilityNotes ? (
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-text">{app.availabilityNotes}</p>
          ) : (
            <p className="text-sm text-text-subtle">None.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="meta-heading">
        <SectionTitle id="meta-heading">
          Consent &amp; submission
        </SectionTitle>
        <dl>
          <Row label="No guarantee">
            <Flag ok={app.acknowledgedNoGuarantee}>understands applying doesn’t guarantee an appointment</Flag>
          </Row>
          <Row label="Sharing">
            <Flag ok={app.consentToShare}>agreed to share their answers with the mentor(s) they’re matched with</Flag>
          </Row>
          <Row label="Submitted">
            <time dateTime={app.createdAt}>
              {formatInstant(app.createdAt)}
            </time>
          </Row>
          <Row label="Last updated">
            <time dateTime={app.updatedAt}>
              {formatInstant(app.updatedAt)}
            </time>
          </Row>
          {referrer ? <Row label="Came from">{referrer}’s profile</Row> : null}
          <Row label="Reference">
            <span className="break-all text-sm text-text-muted">{app.id}</span>
          </Row>
        </dl>
      </section>
    </>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 text-xl font-semibold tracking-tight text-text">
      {children}
    </h2>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 border-t border-line py-3 text-base last:border-b sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-sm leading-6 text-text-subtle">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </div>
  );
}

function LongAnswer({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-text-subtle">{label}</h3>
      <p className="whitespace-pre-line break-words border-l-2 border-accent pl-4 text-base leading-relaxed text-text">
        {text}
      </p>
    </div>
  );
}

/** Yes plus what they agreed to (children, lowercase), or "No, not confirmed". */
function Flag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-start gap-2", ok ? "text-text" : "text-danger")}>
      {ok ? <CheckIcon className="mt-1 size-3.5 shrink-0 text-success" /> : <XIcon className="mt-1 size-3.5 shrink-0" />}
      <span>{ok ? <>Yes, {children}</> : "No, not confirmed"}</span>
    </span>
  );
}

/** Applicant-supplied URL: shown as text; linked only when it's http(s). */
function SafeLink({ href }: { href: string }) {
  let safe: string | null = null;
  try {
    const u = new URL(href);
    if (u.protocol === "https:" || u.protocol === "http:") safe = u.toString();
  } catch {
    safe = null;
  }
  return (
    <div className="space-y-1">
      <p className="break-all text-sm text-text">{href}</p>
      {safe ? (
        <a
          href={safe}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-text underline underline-offset-4 sm:min-h-9"
        >
          Open link
          <ArrowUpRightIcon className="size-3.5" />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      ) : (
        <p className="text-xs font-medium text-warning">Not a web link, so it isn’t clickable.</p>
      )}
    </div>
  );
}

function ActivityLog({ detail, directory }: { detail: ApplicationDetail; directory: OrganizerDirectory }) {
  if (!detail.activity.length) {
    return <p className="text-sm text-text-subtle">No activity recorded yet.</p>;
  }
  const describeSlot = (slotId: string, startsAt?: string, endsAt?: string) => {
    const slot = directory.slotsById.get(slotId);
    if (startsAt && endsAt) return `${slot?.mentorName ?? "Slot"} · ${intervalLabel(startsAt, endsAt)}`;
    return slot ? `${slot.mentorName} · ${slot.label}` : slotId;
  };
  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {detail.activity.map((a) => {
        const d = describeActivity(a.action, a.detail, describeSlot);
        return (
          <li key={a.id} className="relative">
            <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full border border-line-strong bg-surface" />
            <p className="text-sm text-text">
              <span className="font-medium">{d.title}</span> <span className="text-text-subtle">by {a.actor}</span>
            </p>
            {d.detail ? <p className="mt-0.5 text-sm text-text-muted">{d.detail}</p> : null}
            <time dateTime={a.at} className="mt-0.5 block text-xs text-text-subtle">
              {formatInstant(a.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Session options for assignment: preferred mentors first (by rank), then everyone else. A mentor
 * who agreed to fewer sessions than are listed (Patrick) carries a note with how many are booked.
 */
function assignGroups(
  detail: ApplicationDetail,
  directory: OrganizerDirectory,
  usage: ReadonlyMap<string, { proposed: number; confirmed: number }>,
): AssignGroup[] {
  const app = detail.application;
  const rank = new Map(app.mentors.map((m) => [m.mentorId, m.rank]));
  const assigned = new Set(app.appointments.filter((a) => a.status !== "canceled").map((a) => a.slotId));
  const busy = detail.studentAppointments.map((a) => ({
    start: new Date(a.startsAt).getTime(),
    end: new Date(a.endsAt).getTime(),
  }));
  const mentors = [...directory.mentors].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));

  return mentors
    .map((m) => {
      const r = rank.get(m.id);
      const sessions = directory.slots.filter((s) => s.mentorId === m.id);
      const booked = sessions.filter((s) => {
        const u = usage.get(s.id);
        return u ? u.proposed + u.confirmed > 0 : false;
      }).length;
      const limit = sessionLimitNote(m, sessions.length);
      const options = sessions
        .map((slot) => {
          const u = usage.get(slot.id) ?? { proposed: 0, confirmed: 0 };
          const used = u.proposed + u.confirmed;
          const interval = {
            start: zonedTimeToUtc(slot.date, slot.start).getTime(),
            end: zonedTimeToUtc(slot.date, slot.end).getTime(),
          };
          const overlaps = busy.some((b) => b.start < interval.end && interval.start < b.end);
          const disabledReason = assigned.has(slot.id)
            ? "Already assigned"
            : used >= slot.capacity
              ? `Full (${used}/${slot.capacity})`
              : overlaps
                ? "Overlaps another appointment"
                : null;
          return {
            slotId: slot.id,
            label: slot.label,
            status: slot.status,
            capacity: slot.capacity,
            used,
            generated: slot.generated,
            disabledReason,
          };
        });
      return {
        mentorId: m.id,
        label: `${m.name}${m.demo ? " (demo)" : ""} · ${r === 1 ? "1st choice" : r ? `preference ${r}` : "not requested"}`,
        preferred: r !== undefined,
        note: limit ? `${limit} Booked so far: ${booked}.` : null,
        options,
      };
    })
    .filter((g) => g.options.length);
}

/**
 * Why Confirmed/Attended isn't possible yet (no confirmed appointment). Mentors without sessions
 * (still scheduling, or a window without exact times) are named, so organizers know the
 * application can only be reviewed, selected or waitlisted for now.
 */
function confirmationBlocker(
  active: AppointmentRecord[],
  directory: OrganizerDirectory,
  preferences: MentorBookability[],
): string {
  const proposed = active.filter((a) => a.status === "proposed");
  if (proposed.length) {
    const confirmable = proposed.some((a) => directory.slotsById.get(a.slotId)?.status === "confirmed");
    return confirmable
      ? "Needs a confirmed appointment. Confirm the proposed one below first."
      : "Needs a confirmed appointment. The proposed time isn’t confirmed with the mentor yet, so you can’t confirm it here.";
  }
  const without = preferences.filter((p) => p.slots.length === 0);
  if (preferences.length && without.length === preferences.length) {
    const names = joinNames(without.map((p) => p.firstName));
    return `Needs a confirmed appointment, and ${names} ${without.length === 1 ? "doesn’t" : "don’t"} have sessions yet. Use Under review, Selected or Waitlisted for now.`;
  }
  return "Needs a confirmed appointment. Propose a session below, then confirm it.";
}

/** Preferred mentors without sessions (scheduling in progress, or a window without exact times). */
function NoSlotsYet({
  mentors,
  allWithout,
  hasConfirmed,
}: {
  mentors: MentorBookability[];
  allWithout: boolean;
  /** The application already has a confirmed appointment — skip the status explanation. */
  hasConfirmed: boolean;
}) {
  const names = joinNames(mentors.map((m) => m.firstName));
  const contentFile = <Code>content/mentors.ts</Code>;
  return (
    <div className="mt-4 rounded-md bg-surface-subtle px-4 py-3.5 text-sm">
      <p className="font-semibold text-text">No sessions yet for {names}</p>
      <ul className="mt-2.5 space-y-2">
        {mentors.map((m) => (
          <li key={m.mentorId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-text-muted">{m.mentorName}</span>
            {m.windows.length ? (
              m.windows.map((w) => (
                <span key={w.id} className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-sm text-text-subtle">{w.label}</span>
                  <AvailabilityBadge kind={w.kind} />
                </span>
              ))
            ) : (
              <AvailabilityBadge kind="in-progress" />
            )}
          </li>
        ))}
      </ul>
      {hasConfirmed ? (
        <p className="mt-3 leading-relaxed text-text-muted">
          To offer a time with {names} as well, add {mentors.length === 1 ? "their" : "each mentor’s"} exact window to{" "}
          {contentFile} once it’s set. It’s split into sessions automatically.
        </p>
      ) : (
        <p className="mt-3 leading-relaxed text-text-muted">
          {allWithout
            ? "You can still review this application: mark it Under review, Selected or Waitlisted. "
            : "Their preferences can’t be booked yet, but you can still propose another mentor’s session below. "}
          Confirmed and Attended need a confirmed appointment. That’s possible once{" "}
          {mentors.length === 1 ? `${names} has` : `${names} each have`} a window with exact start and end times in{" "}
          {contentFile}. It’s split into sessions automatically.
        </p>
      )}
    </div>
  );
}
