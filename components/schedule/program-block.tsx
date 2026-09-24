"use client";

/**
 * Expand/collapse for a program block's sub-sessions inside an agenda row: a toggle button
 * ("11 sessions", aria-expanded + aria-controls), a proportional mini timeline (office-hours mentor
 * sessions in orange), and the session list (hidden with the `hidden` attribute when collapsed, so it's out of the tab order and the
 * accessibility tree). Opening fades in; under prefers-reduced-motion it simply appears.
 *
 * The calendar decides the default (see `defaultProgramOpen`): collapsed on "All days", open when a
 * single day is selected or a search matched a sub-session. A student's toggle wins until the
 * default changes (switching day or search resets it to the view's default).
 *
 * Props
 * - `entry`: the program-block ScheduleEntry (must have `sessions`).
 * - `defaultOpen`: whether the list starts expanded.
 * - `matches`: indexes of sessions matching the current search (marked "Match").
 * - `className`: extra classes for the wrapper (which is `relative z-10`, above the row's
 *   stretched title link).
 */
import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { plural } from "@/lib/schedule/format";
import { programTrack, sessionCountLabel } from "@/lib/schedule/program";
import { cn } from "@/lib/cn";
import { ProgramTrack, SessionList } from "./program-sessions";

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
  const track = programTrack(entry);
  const count = sessionCountLabel(entry.sessions.length);

  return (
    <div className={cn("relative z-10 mt-4", className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setState({ basis: defaultOpen, open: !open })}
          className={cn(
            "inline-flex min-h-11 items-center gap-2.5 rounded-sm border px-3.5 font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] transition-colors duration-150 md:min-h-9",
            open
              ? "border-paper/35 bg-paper/[0.05] text-paper"
              : "border-line-strong text-paper hover:border-paper/40 hover:bg-paper/[0.04]",
          )}
        >
          <ChevronDownIcon
            className={cn("size-3.5 text-paper-muted transition-transform duration-200", open && "rotate-180")}
          />
          <span className="tabular">{count}</span>
          <span className="sr-only"> in {entry.title}</span>
          {matches.length ? (
            <span className="text-accent">
              · {plural(matches.length, "match", "matches")}
            </span>
          ) : null}
        </button>
        {track.length ? <ProgramTrack segments={track} className="hidden min-w-24 max-w-[22rem] flex-1 sm:block" /> : null}
      </div>
      <div id={panelId} hidden={!open} className="animate-fade-up">
        <SessionList sessions={entry.sessions} date={entry.date} highlight={matches} className="mt-3" />
      </div>
    </div>
  );
}
