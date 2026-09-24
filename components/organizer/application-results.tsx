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

const HEADINGS: [string, string][] = [
  ["Applicant", "w-[27%]"],
  ["Preferred mentors", "w-[22%]"],
  ["Selected availability", "w-[26%]"],
  ["Status & appointments", "w-[25%]"],
];

/** Desktop table (lg+) and a stacked card list for phones. Rows link to the detail page. */
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
      <div className="hidden overflow-x-auto rounded-md border border-line lg:block">
        <table className="w-full min-w-[58rem] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Applications matching the current filters</caption>
          <thead className="bg-surface-subtle">
            <tr className="border-b border-line">
              {HEADINGS.map(([h, w]) => (
                <th key={h} scope="col" className={`px-4 py-3 text-sm font-medium text-text-muted first:pl-5 last:pr-5 ${w}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.app.id} className="group relative align-top transition-colors duration-150 hover:bg-surface-subtle">
                <td className="py-4 pl-5 pr-4">
                  <Link
                    href={r.href}
                    className="text-[0.9375rem] font-semibold text-text underline-offset-4 [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] group-hover:underline"
                  >
                    {r.app.fullName}
                  </Link>
                  <p className="mt-0.5 break-all text-sm text-text-muted">{r.app.email}</p>
                  <p className="mt-2 text-sm leading-snug text-text-muted">{r.meta}</p>
                  <p className="text-sm leading-snug text-text-subtle">{r.work}</p>
                  <DuplicateFlag count={r.app.duplicateCount} className="mt-2" />
                  <p className="mt-2 text-xs text-text-subtle">
                    Submitted <time dateTime={r.app.createdAt}>{formatInstant(r.app.createdAt)}</time>
                  </p>
                </td>
                <td className="px-4 py-4">
                  <PreferenceList mentors={r.preferences} />
                  {r.demo ? <DemoBadge className="mt-2" /> : null}
                </td>
                <td className="px-4 py-4">
                  <AvailabilityList items={r.availability} />
                </td>
                <td className="py-4 pl-4 pr-5">
                  <div className="flex items-start justify-between gap-3">
                    <ApplicationStatusBadge status={r.app.status} />
                    <ChevronRightIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-text-subtle transition-colors duration-150 group-hover:text-text"
                    />
                  </div>
                  {r.appointments.length ? (
                    <div className="mt-3 space-y-3">
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

      <ul className="space-y-3 lg:hidden">
        {rows.map((r) => (
          <li key={r.app.id} className="relative">
            <article className="rounded-md border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text [overflow-wrap:anywhere]">
                    <Link href={r.href} className="after:absolute after:inset-0 after:rounded-md after:content-['']">
                      {r.app.fullName}
                    </Link>
                  </h3>
                  <p className="mt-0.5 break-all text-sm text-text-muted">{r.app.email}</p>
                </div>
                <ChevronRightIcon className="mt-1 size-4 shrink-0 text-text-subtle" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ApplicationStatusBadge status={r.app.status} />
                {r.demo ? <DemoBadge /> : null}
              </div>
              <DuplicateFlag count={r.app.duplicateCount} className="mt-2" />
              <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-t border-line pt-4 text-sm">
                <dt className="text-text-subtle">Student</dt>
                <dd className="text-text-muted">
                  {r.meta}
                  <span className="block text-text-subtle">{r.work}</span>
                </dd>
                <dt className="text-text-subtle">Mentors</dt>
                <dd>
                  <PreferenceList mentors={r.preferences} />
                </dd>
                <dt className="text-text-subtle">Times</dt>
                <dd>
                  <AvailabilityList items={r.availability} />
                </dd>
                {r.appointments.length ? (
                  <>
                    <dt className="text-text-subtle">Appointments</dt>
                    <dd className="space-y-3">
                      {r.appointments.map((a) => (
                        <AppointmentLine key={a.id} status={a.status} mentorName={a.mentorName} when={a.when} />
                      ))}
                    </dd>
                  </>
                ) : null}
                <dt className="text-text-subtle">Submitted</dt>
                <dd className="text-text-muted">
                  <time dateTime={r.app.createdAt}>{formatInstant(r.app.createdAt)}</time>
                </dd>
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
