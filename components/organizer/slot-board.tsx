import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { AlertIcon, LockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge, AppointmentStatusBadge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";
import { organizersHref } from "@/lib/organizer/filters";
import { sessionLimitNote, type MentorInfo, type OrganizerDirectory, type SlotInfo } from "@/lib/organizer/directory";
import type { SlotHolder, SlotUsage } from "@/lib/organizer/queries";
import { Code, SeatPips } from "./bits";

const NO_USAGE: SlotUsage = { proposed: 0, confirmed: 0 };

function usedSeats(u: SlotUsage | undefined): number {
  return u ? u.proposed + u.confirmed : 0;
}

/**
 * Every bookable session (explicit content slots and sessions generated from exact windows),
 * grouped by mentor (content order) and window, with who holds each seat. A mentor who agreed to
 * fewer sessions than their window fits (content `session.sessionCount`) gets a note above their
 * sessions so nobody overbooks them.
 */
export function SlotBoard({
  directory,
  usage,
  holders = new Map(),
}: {
  directory: OrganizerDirectory;
  usage: ReadonlyMap<string, SlotUsage>;
  /** Applications holding each session's seats (dashboard); omitted = counts only. */
  holders?: ReadonlyMap<string, SlotHolder[]>;
}) {
  const groups = directory.mentors
    .map((m) => ({ mentor: m, slots: directory.slots.filter((s) => s.mentorId === m.id) }))
    .filter((g) => g.slots.length);

  if (!groups.length) {
    return (
      <div className="max-w-3xl rounded-md bg-surface-subtle px-5 py-5 sm:px-6">
        <p className="font-semibold text-text">No sessions yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Right now mentors are still scheduling or only have rough windows. Once a mentor has a window with exact
          start and end times in <Code>content/mentors.ts</Code>, it’s split into sessions automatically. They’ll show up
          here with seat counts, and you can assign them on each application.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {groups.map((g) => (
        <MentorSessions key={g.mentor.id} mentor={g.mentor} slots={g.slots} directory={directory} usage={usage} holders={holders} />
      ))}
    </div>
  );
}

function MentorSessions({
  mentor,
  slots,
  directory,
  usage,
  holders,
}: {
  mentor: MentorInfo;
  slots: SlotInfo[];
  directory: OrganizerDirectory;
  usage: ReadonlyMap<string, SlotUsage>;
  holders: ReadonlyMap<string, SlotHolder[]>;
}) {
  const booked = slots.filter((s) => usedSeats(usage.get(s.id)) > 0).length;
  const limit = sessionLimitNote(mentor, slots.length);
  // Sessions under the window they came from (content order), so "Applications that chose this
  // window" sits right above the sessions organizers assign them to.
  const windowIds = [...new Set(slots.map((s) => s.windowId))];

  return (
    <section aria-labelledby={`slots-${mentor.id}`} className="rounded-md border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <MentorPortrait id={mentor.id} name={mentor.name} headshot={mentor.headshot} size="xs" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h3 id={`slots-${mentor.id}`} className="font-semibold text-text">
            <Link href={organizersHref({ mentor: mentor.id })} className="underline-offset-4 hover:underline">
              {mentor.name}
            </Link>
          </h3>
          {mentor.affiliation ? <span className="text-sm text-text-subtle">{mentor.affiliation}</span> : null}
          {mentor.demo ? <DemoBadge /> : null}
        </div>
        <p className="text-sm text-text-muted tabular">
          {booked} of {slots.length} session{slots.length === 1 ? "" : "s"} booked
        </p>
      </header>

      {limit ? (
        <div className="border-b border-line bg-warning-soft px-4 py-3 text-sm leading-relaxed sm:px-5">
          <p className="flex gap-2 font-medium text-text">
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              {limit} Booked so far: {booked}.
            </span>
          </p>
          {mentor.organizerNotes ? (
            <p className="mt-1.5 flex gap-2 text-text-muted">
              <LockIcon className="mt-1 size-3.5 shrink-0 text-text-subtle" />
              <span>
                <span className="sr-only">Organizer note: </span>
                {mentor.organizerNotes}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {windowIds.map((windowId) => {
        const window = directory.windowsById.get(windowId);
        const inWindow = slots.filter((s) => s.windowId === windowId);
        return (
          <div key={windowId} className="border-b border-line last:border-b-0">
            {window ? (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface-subtle px-4 py-2 text-xs sm:px-5">
                <p className="text-text-muted">
                  <span className="font-medium text-text tabular">{window.label}</span> window ·{" "}
                  <span className="tabular">
                    {inWindow.length} session{inWindow.length === 1 ? "" : "s"}
                  </span>
                </p>
                <Link
                  href={organizersHref({ availability: `window:${window.id}` })}
                  className="font-medium text-text underline-offset-4 hover:underline"
                >
                  Applications that chose this window
                </Link>
              </div>
            ) : null}
            <ul className="divide-y divide-line">
              {inWindow.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  usage={usage.get(slot.id) ?? NO_USAGE}
                  holders={holders.get(slot.id) ?? []}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function SlotRow({ slot, usage, holders }: { slot: SlotInfo; usage: SlotUsage; holders: SlotHolder[] }) {
  const used = usage.proposed + usage.confirmed;
  const full = used >= slot.capacity;
  const remaining = Math.max(0, slot.capacity - used);
  const where = [slot.format === "virtual" ? "Virtual" : slot.format === "hybrid" ? "Hybrid" : null, slot.location]
    .filter(Boolean)
    .join(" · ");
  const time = `${formatDate(slot.date, "short")} · ${formatTimeRange(slot.start, slot.end)} ${TZ_LABEL}`;
  return (
    <li className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_13rem] sm:items-start sm:gap-6 sm:px-5">
      <div className="min-w-0">
        {slot.generated ? (
          // Students pick the window, not a session: there's nothing to filter by here.
          <p className="text-sm font-medium text-text tabular">{time}</p>
        ) : (
          <Link
            href={organizersHref({ availability: `slot:${slot.id}` })}
            className="text-sm font-medium text-text underline-offset-4 tabular hover:underline"
          >
            {time}
          </Link>
        )}
        {where ? <p className="mt-0.5 text-xs text-text-subtle">{where}</p> : null}
        {holders.length ? (
          <ul className="mt-2 space-y-1.5">
            {holders.map((h) => (
              <li key={h.appointmentId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Link
                  href={`/organizers/applications/${h.applicationId}`}
                  className="font-medium text-text underline underline-offset-4 [overflow-wrap:anywhere]"
                >
                  {h.fullName}
                </Link>
                {h.teamName ? (
                  <span className="text-xs text-text-subtle">
                    {/^team\b/i.test(h.teamName) ? h.teamName : `Team ${h.teamName}`}
                  </span>
                ) : null}
                <AppointmentStatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <AvailabilityBadge kind={slot.status} className="justify-self-start" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SeatPips capacity={slot.capacity} confirmed={usage.confirmed} proposed={usage.proposed} />
        <span className="text-sm text-text tabular">
          {used}/{slot.capacity} {slot.capacity === 1 ? "seat" : "seats"}
          <span className="sr-only">
            {" "}
            used ({usage.confirmed} confirmed, {usage.proposed} proposed)
          </span>
        </span>
        <span className={cn("text-sm", full ? "font-medium text-text" : "text-text-subtle")}>
          {full ? "Full" : `${remaining} open`}
        </span>
      </div>
    </li>
  );
}
