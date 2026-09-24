import Link from "next/link";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import { organizersHref, type ApplicationFilters } from "@/lib/organizer/filters";
import { STATUS_SHORT_LABELS } from "@/lib/organizer/labels";
import type { StatusCounts } from "@/lib/organizer/queries";
import { StatusSwatch } from "./bits";

/** All seven statuses + total as a hairline grid; each cell filters the list by that status. */
export function StatusStrip({ counts, filters }: { counts: StatusCounts; filters: ApplicationFilters }) {
  const cells = [
    { key: "all", label: "All", title: "All applications", count: counts.total, status: null },
    ...APPLICATION_STATUSES.map((s) => ({
      key: s,
      label: STATUS_SHORT_LABELS[s],
      title: APPLICATION_STATUS_LABELS[s],
      count: counts[s],
      status: s,
    })),
  ];
  return (
    <nav aria-label="Applications by status">
      <ul className="grid grid-cols-4 gap-px overflow-hidden rounded-sm border border-line bg-line lg:grid-cols-8">
        {cells.map((cell) => {
          const active = (filters.status ?? null) === cell.status;
          return (
            <li key={cell.key} className="bg-ink-900">
              <Link
                href={organizersHref({ ...filters, status: cell.status })}
                aria-current={active ? "page" : undefined}
                aria-label={`${cell.title}: ${cell.count} ${cell.count === 1 ? "application" : "applications"}`}
                className={cn(
                  "group relative flex h-full min-h-[5.25rem] flex-col justify-between gap-3 px-2.5 py-3 transition-colors duration-150 sm:px-4 sm:py-4",
                  active ? "bg-ink-800" : "hover:bg-ink-850",
                )}
              >
                {active ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
                <span
                  className={cn(
                    "mono-label flex items-center gap-2 max-sm:text-[0.625rem] max-sm:tracking-[0.04em]",
                    active ? "text-paper" : "text-paper-subtle group-hover:text-paper-muted",
                  )}
                >
                  {cell.status ? <StatusSwatch status={cell.status} className="w-3 max-sm:hidden" /> : null}
                  <span className="truncate">{cell.label}</span>
                </span>
                <span
                  className={cn(
                    "font-wide text-2xl font-bold leading-none tracking-[-0.03em] tabular sm:text-3xl",
                    cell.count === 0 && !active ? "text-paper-subtle" : "text-paper",
                  )}
                >
                  {cell.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
