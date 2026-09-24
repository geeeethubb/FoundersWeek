"use client";

/**
 * Expand/collapse for a program block's sub-sessions inside an agenda row: a toggle button
 * ("Show 11 sessions", aria-expanded + aria-controls) and the session list (hidden with the
 * `hidden` attribute when collapsed, so it's out of the tab order and the accessibility tree).
 *
 * The calendar decides the default (see `defaultProgramOpen`): collapsed on "All days", open when a
 * single day is selected or a search matched a sub-session. A student's toggle wins until the
 * default changes (switching day or search resets it to the view's default).
 *
 * Props
 * - `entry`: the program-block ScheduleEntry (must have `sessions`).
 * - `defaultOpen`: whether the list starts expanded.
 * - `matches`: indexes of sessions matching the current search.
 * - `className`: extra classes for the wrapper (which is `relative z-10`, above the row's
 *   stretched title link).
 */
import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { plural } from "@/lib/schedule/format";
import { sessionCountLabel } from "@/lib/schedule/program";
import { cn } from "@/lib/cn";
import { SessionList } from "./program-sessions";

export function ProgramBlock({
  entry,
  defaultOpen,
  matches = [],
  className,
}: {
  entry: ScheduleEntry;
  defaultOpen: boolean;
  matches?: number[];
  className?: string;
}) {
  // Adjust-state-during-render: a new default (different day/search) clears the student's toggle.
  const [state, setState] = useState<{ basis: boolean; open: boolean | null }>({ basis: defaultOpen, open: null });
  if (state.basis !== defaultOpen) setState({ basis: defaultOpen, open: null });
  const open = state.basis === defaultOpen && state.open !== null ? state.open : defaultOpen;

  const panelId = `program-${entry.id}`;

  return (
    <div className={cn("relative z-10 mt-4", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setState({ basis: defaultOpen, open: !open })}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3.5 text-sm font-medium text-text transition-colors duration-150 hover:border-text-subtle md:min-h-9"
      >
        <ChevronDownIcon className={cn("size-4 text-text-subtle transition-transform duration-200", open && "rotate-180")} />
        {open ? "Hide" : "Show"} {sessionCountLabel(entry.sessions.length)}
        <span className="sr-only"> in {entry.title}</span>
        {matches.length ? (
          <span className="text-accent-strong">· {plural(matches.length, "match", "matches")}</span>
        ) : null}
      </button>
      <div id={panelId} hidden={!open}>
        <SessionList
          sessions={entry.sessions}
          date={entry.date}
          highlight={matches}
          className="mt-3 max-w-3xl rounded-md bg-surface-subtle px-4"
        />
      </div>
    </div>
  );
}
