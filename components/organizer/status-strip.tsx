import Link from "next/link";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import { organizersHref, type ApplicationFilters } from "@/lib/organizer/filters";
import { STATUS_SHORT_LABELS } from "@/lib/organizer/labels";
import type { StatusCounts } from "@/lib/organizer/queries";

/** All seven statuses + total; each cell filters the list by that status (select again for all). */
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
      {/* Always full rows (4 × 2 on phones, 8 across on desktop), so the hairline grid never shows gaps. */}
      <ul className="grid grid-cols-4 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-8">
        {cells.map((cell) => {
          const active = (filters.status ?? null) === cell.status;
          return (
            <li key={cell.key} className="bg-surface">
              <Link
                href={organizersHref({ ...filters, status: cell.status })}
                aria-current={active ? "page" : undefined}
                aria-label={`${cell.title}: ${cell.count} ${cell.count === 1 ? "application" : "applications"}`}
                className={cn(
                  "group relative flex h-full min-h-20 flex-col justify-between gap-2 px-3 py-3 transition-colors duration-150 sm:px-4",
                  active ? "bg-surface-subtle" : "hover:bg-surface-subtle",
                )}
              >
                {active ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
                <span
                  className={cn(
                    "truncate text-xs font-medium sm:text-sm",
                    active ? "text-text" : "text-text-muted group-hover:text-text",
                  )}
                >
                  {cell.label}
                </span>
                <span
                  className={cn(
                    "text-2xl font-semibold leading-none tracking-tight tabular",
                    cell.count === 0 && !active ? "text-text-subtle" : "text-text",
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
