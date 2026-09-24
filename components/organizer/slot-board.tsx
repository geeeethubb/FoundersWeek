import Link from "next/link";
import { DemoBadge } from "@/components/ui/badge";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge } from "@/components/ui/status";
import { formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";
import { organizersHref } from "@/lib/organizer/filters";
import type { OrganizerDirectory, SlotInfo } from "@/lib/organizer/directory";
import type { SlotUsage } from "@/lib/organizer/queries";
import { Code, SeatPips } from "./bits";

/**
 * Every appointment slot in content with seats used (proposed + confirmed) vs capacity.
 * Grouped by mentor, in content order.
 */
export function SlotBoard({
  directory,
  usage,
}: {
  directory: OrganizerDirectory;
  usage: ReadonlyMap<string, SlotUsage>;
}) {
  const groups = directory.mentors
    .map((m) => ({ mentor: m, slots: directory.slots.filter((s) => s.mentorId === m.id) }))
    .filter((g) => g.slots.length);

  if (!groups.length) {
    return (
      <div className="max-w-3xl rounded-md bg-surface-subtle px-5 py-5 sm:px-6">
        <p className="font-semibold text-text">No appointment slots yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Right now mentors only have availability windows or are still scheduling. Once specific times are proposed
          or confirmed, add them as <Code>slots</Code> in <Code>content/mentors.ts</Code>. They’ll show up here with
          seat counts, and you can assign them on each application.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {groups.map((g) => (
        <section
          key={g.mentor.id}
          aria-labelledby={`slots-${g.mentor.id}`}
          className="rounded-md border border-line bg-surface"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <MentorPortrait id={g.mentor.id} name={g.mentor.name} headshot={g.mentor.headshot} size="xs" />
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h3 id={`slots-${g.mentor.id}`} className="font-semibold text-text">
                <Link href={organizersHref({ mentor: g.mentor.id })} className="underline-offset-4 hover:underline">
                  {g.mentor.name}
                </Link>
              </h3>
              {g.mentor.affiliation ? <span className="text-sm text-text-subtle">{g.mentor.affiliation}</span> : null}
              {g.mentor.demo ? <DemoBadge /> : null}
            </div>
          </header>
          <ul className="divide-y divide-line">
            {g.slots.map((slot) => (
              <SlotRow key={slot.id} slot={slot} usage={usage.get(slot.id) ?? { proposed: 0, confirmed: 0 }} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SlotRow({ slot, usage }: { slot: SlotInfo; usage: SlotUsage }) {
  const used = usage.proposed + usage.confirmed;
  const full = used >= slot.capacity;
  const remaining = Math.max(0, slot.capacity - used);
  const where = [slot.format === "virtual" ? "Virtual" : slot.format === "hybrid" ? "Hybrid" : null, slot.location]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_13rem] sm:items-center sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <Link
          href={organizersHref({ availability: `slot:${slot.id}` })}
          className="text-sm font-medium text-text underline-offset-4 tabular hover:underline"
        >
          {formatDate(slot.date, "short")} · {formatTimeRange(slot.start, slot.end)} {TZ_LABEL}
        </Link>
        {where ? <p className="mt-0.5 text-xs text-text-subtle">{where}</p> : null}
      </div>
      <AvailabilityBadge kind={slot.status} className="justify-self-start" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <SeatPips capacity={slot.capacity} confirmed={usage.confirmed} proposed={usage.proposed} />
        <span className="text-sm text-text tabular">
          {used}/{slot.capacity} seats
          <span className="sr-only">
            {" "}
            used ({usage.confirmed} confirmed, {usage.proposed} proposed)
          </span>
        </span>
        <span className={full ? "text-sm font-medium text-text" : "text-sm text-text-subtle"}>
          {full ? "Full" : `${remaining} open`}
        </span>
      </div>
    </li>
  );
}
