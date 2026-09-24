import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMentorsForOrganizers, isDemoContentEnabled } from "@/content";
import { AppointmentActions } from "@/components/organizer/appointment-actions";
import { AssignForm, type AssignGroup } from "@/components/organizer/assign-form";
import { AvailabilityList, InterestOnly } from "@/components/organizer/bits";
import { CopyLink } from "@/components/organizer/copy-link";
import { NotesForm } from "@/components/organizer/notes-form";
import { OrganizerBar } from "@/components/organizer/organizer-bar";
import { StatusForm } from "@/components/organizer/status-form";
import { DemoBadge } from "@/components/ui/badge";
import { MentorPortrait } from "@/components/ui/portrait";
import { ArrowLeftIcon, ArrowUpRightIcon, CheckIcon, PickMark, XIcon } from "@/components/ui/icons";
import { Container, Eyebrow, Notice } from "@/components/ui/primitives";
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
  type MentorBookability,
  type OrganizerDirectory,
} from "@/lib/organizer/directory";
import { redactSecrets } from "@/lib/organizer/data-store-view";
import { describeActivity, participationLabel, stageDescription, stageLabel, yearLabel } from "@/lib/organizer/labels";
import { requireOrganizerPage } from "@/lib/organizer/page-auth";
import {
  getApplicationDetail,
  getSlotUsage,
  isUuid,
  type ApplicationDetail,
  type AppointmentRecord,
} from "@/lib/organizer/queries";
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
        <Container className="pt-10">
          <Notice tone="danger" title="The application database isn’t available" role="alert">
            <p>This application can’t be loaded right now. Try again shortly.</p>
            {isNonProductionDeploy() ? <p className="mt-2 font-mono text-xs">{redactSecrets(persistence.detail)}</p> : null}
          </Notice>
        </Container>
      </>
    );
  }

  const db = await getDb();
  const [detail, usage] = await Promise.all([getApplicationDetail(db, id), getSlotUsage(db)]);
  if (!detail) notFound();

  const directory = buildOrganizerDirectory(getMentorsForOrganizers());
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
        <Container className="pt-8 pb-8 md:pt-12 md:pb-10">
        <Link
          href="/organizers"
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-xs px-1 text-sm text-paper-muted transition-colors hover:text-paper sm:min-h-8"
        >
          <ArrowLeftIcon className="size-4" />
          All applications
        </Link>
        <Eyebrow className="mt-6">
          Application · Submitted <time dateTime={app.createdAt}>{formatInstant(app.createdAt)}</time>
        </Eyebrow>
        <h1 className="mt-4 font-wide [overflow-wrap:anywhere] text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-paper sm:text-5xl">
          {app.fullName}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <ApplicationStatusBadge status={app.status} />
          <span className="break-all font-mono text-sm text-paper-muted">{app.email}</span>
          {demo ? <DemoBadge /> : null}
        </div>
        {detail.related.length ? (
          <div className="mt-5 max-w-2xl">
            <Notice tone="warning" title={`${app.duplicateCount} applications from this email`}>
              <ul className="mt-1 space-y-1">
                {detail.related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/organizers/applications/${r.id}`}
                      className="text-paper underline underline-offset-4 hover:text-accent"
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
      <nav aria-label="Jump to organizer actions" className="border-b border-line lg:hidden">
        <Container>
          <ul className="-mx-2 flex gap-1 overflow-x-auto py-1.5">
            {[
              ["status", "Status"],
              ["appointments", "Appointments"],
              ["notes", "Notes"],
              ["activity", "Activity"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={`#${href}`}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xs px-2 text-sm text-paper-muted transition-colors hover:text-paper"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Container className="grid gap-12 pt-10 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 space-y-12 lg:col-span-7">
          <Answers detail={detail} directory={directory} />
        </div>

        <aside aria-label="Organizer actions" className="min-w-0 space-y-10 lg:col-span-5">
          <Panel title="Status" id="status">
            <StatusForm applicationId={app.id} status={app.status} confirmBlockedReason={confirmBlockedReason} />
          </Panel>

          <Panel title="Appointments" id="appointments">
            {activeAppointments.length ? (
              <ul className="divide-y divide-line border-y border-line">
                {activeAppointments.map((a) => {
                  const slot = directory.slotsById.get(a.slotId);
                  const blocked = !slot
                    ? "This slot is no longer in content."
                    : slot.status !== "confirmed"
                      ? `Can’t confirm yet — this time isn’t confirmed with ${slot.mentorFirstName}.`
                      : null;
                  return (
                    <li key={a.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <AppointmentStatusBadge status={a.status} />
                        {slot ? <AvailabilityBadge kind={slot.status} /> : null}
                      </div>
                      <p className="mt-3 font-medium text-paper">{mentorName(directory, a.mentorId)}</p>
                      <p className="font-mono text-xs text-paper-muted">{intervalLabel(a.startsAt, a.endsAt)}</p>
                      {slot?.location ? <p className="mt-0.5 text-xs text-paper-subtle">{slot.location}</p> : null}
                      <p className="mt-1 text-xs text-paper-subtle">
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
              <p className="rounded-sm border border-dotted border-line-strong px-4 py-3 text-sm text-paper-muted">
                No active appointments.
              </p>
            )}
            {canceledAppointments.length ? (
              <details className="group mt-3 text-sm">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-paper-subtle hover:text-paper sm:min-h-8">
                  {canceledAppointments.length} canceled appointment{canceledAppointments.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-paper-subtle">
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

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="mono-label mb-3 text-paper">Assign appointment</h3>
              {closed ? (
                <p className="text-sm text-paper-muted">
                  This application is {APPLICATION_STATUS_LABELS[app.status].toLowerCase()}. Change its status to assign
                  an appointment.
                </p>
              ) : directory.slots.length === 0 ? (
                <p className="text-sm leading-relaxed text-paper-muted">
                  No mentor has appointment slots yet, so nothing can be proposed. Add proposed or confirmed slots to{" "}
                  <code className="font-mono text-paper">content/mentors.ts</code> once specific times are set — they’ll
                  appear here.
                </p>
              ) : (
                <AssignForm
                  applicationId={app.id}
                  groups={assignGroups(detail, directory, usage)}
                  hasActiveAppointment={activeAppointments.length > 0}
                />
              )}
            </div>
          </Panel>

          <Panel title="Private status link" id="status-link">
            <p className="mb-3 text-sm text-paper-muted">
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

function Panel({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="mb-4 flex items-center gap-3 font-wide text-lg font-bold tracking-[-0.015em] text-paper">
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
        <SectionTitle id="about-heading" index="01">
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
                  <dt className="inline text-paper-subtle">Team name: </dt>
                  <dd className="inline">{app.teamName ?? <span className="text-paper-subtle">Not given</span>}</dd>
                </div>
                <div>
                  <dt className="inline text-paper-subtle">Teammates: </dt>
                  <dd className="inline whitespace-pre-line">
                    {app.teammates ?? <span className="text-paper-subtle">Not given</span>}
                  </dd>
                </div>
              </dl>
            ) : null}
          </Row>
          <Row label="Stage">
            {stageLabel(app.stage)}
            {stageDescription(app.stage) ? (
              <span className="block text-sm text-paper-subtle">{stageDescription(app.stage)}</span>
            ) : null}
          </Row>
        </dl>
      </section>

      <section aria-labelledby="answers-heading">
        <SectionTitle id="answers-heading" index="02">
          Answers
        </SectionTitle>
        <div className="space-y-6">
          <LongAnswer label="What they’re working on or exploring" text={app.workingOn} />
          <LongAnswer label="Question or challenge" text={app.question} />
          <div>
            <h3 className="mono-label mb-2 text-paper-subtle">Link</h3>
            {app.link ? <SafeLink href={app.link} /> : <p className="text-sm text-paper-subtle">No link shared.</p>}
          </div>
        </div>
      </section>

      <section aria-labelledby="prefs-heading">
        <SectionTitle id="prefs-heading" index="03">
          Mentors &amp; availability
        </SectionTitle>
        <ol className="divide-y divide-line border-y border-line">
          {app.mentors.map((m) => {
            const info = directory.mentorsById.get(m.mentorId);
            const picks = byMentor(m.mentorId);
            return (
              <li key={m.mentorId} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6">
                <div className="flex gap-3">
                  <span className="w-5 shrink-0 pt-2.5 font-mono text-xs text-paper-subtle tabular">{m.rank}.</span>
                  <MentorPortrait id={m.mentorId} name={info?.name ?? m.mentorId} headshot={info?.headshot} size="xs" />
                  <div className="min-w-0">
                    <p className="font-medium text-paper">
                      {mentorName(directory, m.mentorId)}
                      {info?.demo ? <DemoBadge className="ml-2 align-middle" /> : null}
                    </p>
                    {info?.affiliation ? <p className="text-xs text-paper-subtle">{info.affiliation}</p> : null}
                    {m.rank === 1 ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-accent">
                        <PickMark className="size-1.5" />
                        First choice
                      </p>
                    ) : null}
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
          <h3 className="mono-label mb-2 text-paper-subtle">Availability notes</h3>
          {app.availabilityNotes ? (
            <p className="whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-paper">{app.availabilityNotes}</p>
          ) : (
            <p className="text-sm text-paper-subtle">None.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="meta-heading">
        <SectionTitle id="meta-heading" index="04">
          Consent &amp; submission
        </SectionTitle>
        <dl>
          <Row label="No guarantee">
            <Flag ok={app.acknowledgedNoGuarantee}>Understands applying doesn’t guarantee an appointment</Flag>
          </Row>
          <Row label="Sharing">
            <Flag ok={app.consentToShare}>Agreed to share answers with matched mentor(s)</Flag>
          </Row>
          <Row label="Submitted">
            <time dateTime={app.createdAt} className="font-mono text-sm">
              {formatInstant(app.createdAt)}
            </time>
          </Row>
          <Row label="Last updated">
            <time dateTime={app.updatedAt} className="font-mono text-sm">
              {formatInstant(app.updatedAt)}
            </time>
          </Row>
          {referrer ? <Row label="Came from">{referrer}’s profile</Row> : null}
          <Row label="Reference">
            <span className="break-all font-mono text-xs text-paper-muted">{app.id}</span>
          </Row>
        </dl>
      </section>
    </>
  );
}

function SectionTitle({ id, index, children }: { id: string; index: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-3 font-wide text-xl font-bold tracking-[-0.015em] text-paper">
      <span className="mono-label text-accent tabular">{index}</span>
      {children}
    </h2>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 border-t border-line py-3 text-[0.9375rem] last:border-b sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="mono-label pt-1 text-paper-subtle">{label}</dt>
      <dd className="min-w-0 text-paper">{children}</dd>
    </div>
  );
}

function LongAnswer({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="mono-label mb-2 text-paper-subtle">{label}</h3>
      <p className="whitespace-pre-line break-words border-l-2 border-line-strong pl-4 text-base leading-relaxed text-paper">
        {text}
      </p>
    </div>
  );
}

function Flag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-start gap-2", ok ? "text-paper" : "text-danger")}>
      {ok ? <CheckIcon className="mt-1 size-3.5 shrink-0 text-success" /> : <XIcon className="mt-1 size-3.5 shrink-0" />}
      <span>
        {ok ? "Yes — " : "No — "}
        {children}
      </span>
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
      <p className="break-all font-mono text-sm text-paper">{href}</p>
      {safe ? (
        <a
          href={safe}
          target="_blank"
          rel="noopener noreferrer nofollow"
          referrerPolicy="no-referrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-paper-muted underline underline-offset-4 hover:text-accent sm:min-h-8"
        >
          Open link
          <ArrowUpRightIcon className="size-3.5" />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      ) : (
        <p className="text-xs text-warning">Not a web link — not clickable.</p>
      )}
    </div>
  );
}

function ActivityLog({ detail, directory }: { detail: ApplicationDetail; directory: OrganizerDirectory }) {
  if (!detail.activity.length) {
    return <p className="text-sm text-paper-subtle">No activity recorded yet.</p>;
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
            <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full border border-line-strong bg-ink-900" />
            <p className="text-sm text-paper">
              {d.title} <span className="text-paper-subtle">by {a.actor}</span>
            </p>
            {d.detail ? <p className="mt-0.5 text-xs text-paper-muted">{d.detail}</p> : null}
            <time dateTime={a.at} className="mt-0.5 block font-mono text-[0.6875rem] text-paper-subtle">
              {formatInstant(a.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

/** Slot options for assignment: preferred mentors first (by rank), then everyone else. */
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
      const options = directory.slots
        .filter((s) => s.mentorId === m.id)
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
            disabledReason,
          };
        });
      return {
        mentorId: m.id,
        label: `${m.name}${m.demo ? " (demo)" : ""} — ${r === 1 ? "1st choice" : r ? `preference ${r}` : "not requested"}`,
        preferred: r !== undefined,
        options,
      };
    })
    .filter((g) => g.options.length);
}

/**
 * Why Confirmed/Attended isn't possible yet (no confirmed appointment). Mentors still scheduling
 * (no slots in content) are named, so organizers know the application can only be reviewed,
 * selected or waitlisted for now.
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
      ? "Needs a confirmed appointment — confirm the proposed appointment below first."
      : "Needs a confirmed appointment. The proposed time isn’t confirmed with the mentor yet, so it can’t be confirmed.";
  }
  const without = preferences.filter((p) => p.slots.length === 0);
  if (preferences.length && without.length === preferences.length) {
    const names = joinNames(without.map((p) => p.firstName));
    return `Needs a confirmed appointment, and ${names} ${without.length === 1 ? "doesn’t" : "don’t"} have appointment slots yet. Use Under review, Selected or Waitlisted for now.`;
  }
  return "Needs a confirmed appointment — propose a slot below, then confirm it.";
}

/** Preferred mentors without appointment slots (scheduling in progress, or a window only). */
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
  const contentFile = <code className="font-mono text-xs text-paper">content/mentors.ts</code>;
  return (
    <div className="mt-4 rounded-sm border border-dotted border-line-strong px-4 py-3.5 text-sm">
      <p className="font-medium text-paper">No appointment slots yet for {names}</p>
      <ul className="mt-2.5 space-y-2">
        {mentors.map((m) => (
          <li key={m.mentorId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-paper-muted">{m.mentorName}</span>
            {m.windows.length ? (
              m.windows.map((w) => (
                <span key={w.id} className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono text-xs text-paper-subtle">{w.label}</span>
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
        <p className="mt-3 leading-relaxed text-paper-muted">
          To offer a time with {names} as well, add slots to {contentFile} once they’re set.
        </p>
      ) : (
        <p className="mt-3 leading-relaxed text-paper-muted">
          {allWithout
            ? "You can review this application now — mark it Under review, Selected or Waitlisted. "
            : "Their preferences can’t be booked yet; you can still propose another mentor’s slot below. "}
          Confirmed and Attended need a confirmed appointment, which becomes possible once slots for {names} are
          added to {contentFile} and confirmed with {mentors.length === 1 ? "them" : "each mentor"}.
        </p>
      )}
    </div>
  );
}
