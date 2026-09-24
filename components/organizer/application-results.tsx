import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { ApplicationStatusBadge } from "@/components/ui/status";
import { formatInstant } from "@/lib/time";
import {
  intervalLabel,
  mentorName,
  resolveAvailability,
  type OrganizerDirectory,
} from "@/lib/organizer/directory";
import { participationLabel, stageLabel, yearLabel } from "@/lib/organizer/labels";
import type { ApplicationRecord } from "@/lib/organizer/queries";
import { AppointmentLine, AvailabilityList, DuplicateFlag, PreferenceList } from "./bits";

interface Row {
  app: ApplicationRecord;
  href: string;
  preferences: { mentorId: string; rank: number; name: string }[];
  availability: ReturnType<typeof resolveAvailability>[];
  appointments: { id: string; status: "proposed" | "confirmed"; mentorName: string; when: string }[];
  meta: string;
  work: string;
  demo: boolean;
}

function toRow(app: ApplicationRecord, directory: OrganizerDirectory): Row {
  const team =
    app.participation === "team"
      ? app.teamName
        ? `Team “${app.teamName}”`
        : "With a team"
      : participationLabel(app.participation);
  return {
    app,
    href: `/organizers/applications/${app.id}`,
    preferences: app.mentors.map((m) => ({ ...m, name: mentorName(directory, m.mentorId) })),
    availability: app.availability.map((a) => resolveAvailability(directory, a)),
    appointments: app.appointments
      .filter((a): a is typeof a & { status: "proposed" | "confirmed" } => a.status !== "canceled")
      .map((a) => ({
        id: a.id,
        status: a.status,
        mentorName: mentorName(directory, a.mentorId),
        when: intervalLabel(a.startsAt, a.endsAt),
      })),
    meta: `${yearLabel(app.year)} · ${app.major}`,
    work: `${stageLabel(app.stage)} · ${team}`,
    demo: app.mentors.some((m) => directory.mentorsById.get(m.mentorId)?.demo),
  };
}

/** Desktop table (lg+) and a stacked list designed for phones. Rows link to the detail page. */
export function ApplicationResults({
  applications,
  directory,
}: {
  applications: ApplicationRecord[];
  directory: OrganizerDirectory;
}) {
  const rows = applications.map((a) => toRow(a, directory));
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[58rem] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Applications matching the current filters</caption>
          <thead>
            <tr className="border-b border-line-strong">
              {[
                ["Applicant", "w-[26%]"],
                ["Preferred mentors", "w-[20%]"],
                ["Selected availability", "w-[27%]"],
                ["Status & appointments", "w-[27%]"],
              ].map(([h, w]) => (
                <th key={h} scope="col" className={`mono-label px-3 pb-3 font-medium text-paper-subtle first:pl-0 last:pr-0 ${w}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.app.id} className="group relative align-top transition-colors duration-150 hover:bg-paper/[0.025]">
                <td className="py-4 pl-0 pr-3">
                  <Link
                    href={r.href}
                    className="font-medium text-[0.9375rem] text-paper underline-offset-4 [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] group-hover:underline"
                  >
                    {r.app.fullName}
                  </Link>
                  <p className="mt-0.5 break-all font-mono text-xs text-paper-muted">{r.app.email}</p>
                  <p className="mt-2 text-xs leading-5 text-paper-muted">{r.meta}</p>
                  <p className="text-xs leading-5 text-paper-subtle">{r.work}</p>
                  <DuplicateFlag count={r.app.duplicateCount} className="mt-2" />
                  <p className="mt-2 font-mono text-[0.6875rem] text-paper-subtle">
                    <time dateTime={r.app.createdAt}>{formatInstant(r.app.createdAt)}</time>
                  </p>
                </td>
                <td className="px-3 py-4">
                  <PreferenceList mentors={r.preferences} dense />
                  {r.demo ? <DemoBadge className="mt-2" /> : null}
                </td>
                <td className="px-3 py-4">
                  <AvailabilityList items={r.availability} />
                </td>
                <td className="py-4 pl-3 pr-0">
                  <div className="flex items-start justify-between gap-3">
                    <ApplicationStatusBadge status={r.app.status} />
                    <ChevronRightIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-paper-subtle transition-colors duration-150 group-hover:text-accent"
                    />
                  </div>
                  {r.appointments.length ? (
                    <div className="mt-3 space-y-2.5 border-t border-dashed border-line pt-3">
                      {r.appointments.map((a) => (
                        <AppointmentLine key={a.id} status={a.status} mentorName={a.mentorName} when={a.when} />
                      ))}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line border-y border-line lg:hidden">
        {rows.map((r) => (
          <li key={r.app.id} className="relative">
            <article className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-[-0.01em] text-paper [overflow-wrap:anywhere]">
                    <Link href={r.href} className="after:absolute after:inset-0 after:content-['']">
                      {r.app.fullName}
                    </Link>
                  </h3>
                  <p className="mt-0.5 break-all font-mono text-xs text-paper-muted">{r.app.email}</p>
                </div>
                <ChevronRightIcon className="mt-1 size-4 shrink-0 text-paper-subtle" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ApplicationStatusBadge status={r.app.status} />
                {r.demo ? <DemoBadge /> : null}
              </div>
              <DuplicateFlag count={r.app.duplicateCount} className="mt-2" />
              <dl className="mt-4 grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
                <dt className="mono-label pt-0.5 text-paper-subtle">Student</dt>
                <dd className="text-paper-muted">
                  {r.meta}
                  <span className="block text-paper-subtle">{r.work}</span>
                </dd>
                <dt className="mono-label pt-0.5 text-paper-subtle">Mentors</dt>
                <dd>
                  <PreferenceList mentors={r.preferences} dense />
                </dd>
                <dt className="mono-label pt-0.5 text-paper-subtle">Times</dt>
                <dd>
                  <AvailabilityList items={r.availability} />
                </dd>
                {r.appointments.length ? (
                  <>
                    <dt className="mono-label pt-0.5 text-paper-subtle">Appointments</dt>
                    <dd className="space-y-2.5">
                      {r.appointments.map((a) => (
                        <AppointmentLine key={a.id} status={a.status} mentorName={a.mentorName} when={a.when} />
                      ))}
                    </dd>
                  </>
                ) : null}
                <dt className="mono-label pt-0.5 text-paper-subtle">Submitted</dt>
                <dd>
                  <time dateTime={r.app.createdAt} className="font-mono text-xs text-paper-muted">
                    {formatInstant(r.app.createdAt)}
                  </time>
                </dd>
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
