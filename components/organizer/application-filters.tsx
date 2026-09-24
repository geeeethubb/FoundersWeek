import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/icons";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";
import type { OrganizerDirectory } from "@/lib/organizer/directory";
import { activeFilterCount, NO_TIME_SELECTED, SEARCH_MAX_LENGTH, type ApplicationFilters } from "@/lib/organizer/filters";

/**
 * Dashboard filters as a plain GET form: works without JavaScript and every filtered view
 * is a shareable URL (the page redirects to the canonical query string).
 */
export function ApplicationFiltersForm({
  filters,
  directory,
}: {
  filters: ApplicationFilters;
  directory: OrganizerDirectory;
}) {
  const active = activeFilterCount(filters);
  // Availability options grouped by mentor: slots where they exist, windows otherwise.
  const groups = directory.mentors
    .map((m) => {
      const slots = directory.slots.filter((s) => s.mentorId === m.id);
      const slotWindowIds = new Set(slots.map((s) => s.windowId));
      const windows = directory.windows.filter((w) => w.mentorId === m.id && !slotWindowIds.has(w.id));
      return {
        mentor: m,
        options: [
          ...windows.map((w) => ({ value: `window:${w.id}`, label: `${w.label} — window` })),
          ...slots.map((s) => ({ value: `slot:${s.id}`, label: `${s.label} — ${s.status} slot` })),
        ],
      };
    })
    .filter((g) => g.options.length);

  return (
    <form
      method="get"
      action="/organizers"
      role="search"
      aria-label="Filter applications"
      className="rounded-sm border border-line bg-ink-850/60 p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-12 lg:gap-x-5 lg:gap-y-4">
        <div className="col-span-2 lg:order-1 lg:col-span-4">
          <label htmlFor="f-q" className="mono-label mb-2 block text-paper-subtle">
            Search
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-paper-subtle" />
            <input
              id="f-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Name, email, major or team"
              autoComplete="off"
              className="field-control pl-9"
            />
          </div>
        </div>

        <SelectField
          id="f-mentor"
          name="mentor"
          label="Mentor"
          defaultValue={filters.mentor ?? ""}
          className="col-span-2 sm:col-span-1 lg:order-2 lg:col-span-3"
        >
          <option value="">All mentors</option>
          {directory.mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.demo ? " (demo)" : ""}
            </option>
          ))}
        </SelectField>

        <fieldset className="col-span-2 min-w-0 sm:col-span-1 lg:order-5 lg:col-span-5" aria-describedby="f-choice-hint">
          <legend className="mono-label mb-2 text-paper-subtle">Mentor match</legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="inline-flex rounded-sm border border-line-strong bg-ink-950 p-0.5">
              <Segment name="choice" value="" label="Any preference" defaultChecked={!filters.firstChoiceOnly} />
              <Segment name="choice" value="first" label="First choice only" defaultChecked={filters.firstChoiceOnly} />
            </div>
            <p id="f-choice-hint" className="text-xs text-paper-subtle">
              Applies when a mentor is selected.
            </p>
          </div>
        </fieldset>

        <SelectField
          id="f-availability"
          name="availability"
          label="Availability"
          defaultValue={filters.availability ?? ""}
          className="col-span-2 lg:order-3 lg:col-span-3"
        >
          <option value="">Any availability</option>
          <option value={NO_TIME_SELECTED}>Interest only — no time selected</option>
          {groups.map((g) => (
            <optgroup key={g.mentor.id} label={`${g.mentor.name}${g.mentor.demo ? " (demo)" : ""}`}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <SelectField id="f-status" name="status" label="Status" defaultValue={filters.status ?? ""} className="lg:order-4 lg:col-span-2">
          <option value="">Any status</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>

        <SelectField id="f-sort" name="sort" label="Sort" defaultValue={filters.sort} className="lg:order-6 lg:col-span-2">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </SelectField>

        <div className="col-span-2 flex items-end justify-end gap-2 max-sm:[&>*]:flex-1 lg:order-7 lg:col-span-5">
          {active ? (
            <Link
              href="/organizers"
              className="inline-flex h-11 items-center justify-center rounded-sm px-4 text-[0.9375rem] text-paper-muted underline-offset-4 transition-colors duration-150 hover:text-paper hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
          <Button type="submit" variant="primary" className="h-11">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  className,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mono-label mb-2 block text-paper-subtle">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          className="field-control cursor-pointer appearance-none truncate pr-9"
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-paper-subtle" />
      </div>
    </div>
  );
}

function Segment({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="relative cursor-pointer">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex h-[2.625rem] items-center whitespace-nowrap rounded-xs px-3 text-sm text-paper-muted transition-colors duration-150 hover:text-paper peer-checked:bg-paper/[0.09] peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent">
        {label}
      </span>
    </label>
  );
}
