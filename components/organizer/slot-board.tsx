import Link from "next/link";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { MentorPortrait } from "@/components/ui/portrait";
import { AvailabilityBadge } from "@/components/ui/status";
import { formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";
import { organizersHref } from "@/lib/organizer/filters";
import type { OrganizerDirectory, SlotInfo } from "@/lib/organizer/directory";
import type { SlotUsage } from "@/lib/organizer/queries";
import { SeatPips } from "./bits";

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
      <div className="rounded-sm border border-dotted border-line-strong px-5 py-6">
        <p className="font-medium text-paper">No appointment slots yet</p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-paper-muted">
          Mentors currently have availability windows or are still scheduling. Once specific times are proposed or
          confirmed, add them as <code className="font-mono text-paper">slots</code> in{" "}
          <code className="font-mono text-paper">content/mentors.ts</code> — they appear here with seat counts and
          become assignable on each application.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
        <caption className="sr-only">Appointment slot capacity</caption>
        <thead>
          <tr className="border-b border-line-strong">
            <th scope="col" className="mono-label pb-3 pr-3 font-medium text-paper-subtle">
              Time
            </th>
            <th scope="col" className="mono-label px-3 pb-3 font-medium text-paper-subtle max-sm:sr-only">
              Slot status
            </th>
            <th scope="col" className="mono-label pb-3 pl-3 font-medium text-paper-subtle">
              Seats
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.mentor.id} className="border-b border-line">
            <tr>
              <th scope="colgroup" colSpan={3} className="pb-2 pt-5 text-left font-normal">
                <span className="flex items-center gap-3">
                  <MentorPortrait id={g.mentor.id} name={g.mentor.name} headshot={g.mentor.headshot} size="xs" />
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={organizersHref({ mentor: g.mentor.id })}
                      className="font-medium text-paper underline-offset-4 hover:underline"
                    >
                      {g.mentor.name}
                    </Link>
                    {g.mentor.affiliation ? (
                      <span className="text-xs text-paper-subtle">{g.mentor.affiliation}</span>
                    ) : null}
                    {g.mentor.demo ? <DemoBadge /> : null}
                  </span>
                </span>
              </th>
            </tr>
            {g.slots.map((slot) => (
              <SlotRow key={slot.id} slot={slot} usage={usage.get(slot.id) ?? { proposed: 0, confirmed: 0 }} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function SlotRow({ slot, usage }: { slot: SlotInfo; usage: SlotUsage }) {
  const used = usage.proposed + usage.confirmed;
  const full = used >= slot.capacity;
  const remaining = Math.max(0, slot.capacity - used);
  return (
    <tr className="border-t border-line align-top first:border-t-0">
      <td className="py-3 pr-3">
        <Link
          href={organizersHref({ availability: `slot:${slot.id}` })}
          className="font-mono text-xs leading-5 text-paper underline-offset-4 hover:underline"
        >
          <span className="block sm:inline">{formatDate(slot.date, "short")}</span>
          <span className="max-sm:hidden"> · </span>
          <span className="block sm:inline">
            {formatTimeRange(slot.start, slot.end)} {TZ_LABEL}
          </span>
        </Link>
        {slot.location || slot.format ? (
          <p className="mt-0.5 text-xs text-paper-subtle">
            {[slot.format === "virtual" ? "Virtual" : slot.format === "hybrid" ? "Hybrid" : null, slot.location]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <AvailabilityBadge kind={slot.status} className="mt-2 sm:hidden" />
      </td>
      <td className="px-3 py-3 max-sm:hidden">
        <AvailabilityBadge kind={slot.status} />
      </td>
      <td className="py-3 pl-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SeatPips capacity={slot.capacity} confirmed={usage.confirmed} proposed={usage.proposed} />
          <span className="font-mono text-xs text-paper tabular">
            {used}/{slot.capacity}
            <span className="sr-only">
              {" "}
              seats used ({usage.confirmed} confirmed, {usage.proposed} proposed)
            </span>
          </span>
          {full ? (
            <Badge tone="neutral" line="solid">
              Full
            </Badge>
          ) : (
            <span className="text-xs text-paper-subtle">{remaining} open</span>
          )}
        </div>
      </td>
    </tr>
  );
}
