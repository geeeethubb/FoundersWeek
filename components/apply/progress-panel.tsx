"use client";

/**
 * Progress for the application.
 *
 * - `ProgressPanel` (desktop, sticky side column): the six steps as a vertical path — solid where
 *   done, dashed where still open (the site's line-style convention), the step in view marked —
 *   plus the mentors picked so far, what happens after applying, and the deadline when set.
 * - `ReviewChecklist` (above the submit button, all widths): what's done and what's left, so
 *   phones — which don't get the side panel — see it before submitting.
 */
import { useEffect, useState } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { cn } from "@/lib/cn";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import {
  SECTIONS,
  SECTION_COUNT,
  SUBMIT_BLOCK_ID,
  requiredProgress,
  sectionDomId,
  type SectionId,
  type SectionProgress,
} from "./form-model";

type StepState = "complete" | "incomplete" | "optional";

function stepState(section: (typeof SECTIONS)[number], p: SectionProgress): StepState {
  if (section.optional && !p.started) return "optional";
  return p.complete ? "complete" : "incomplete";
}

const STEP_STATE_TEXT: Record<StepState, string> = {
  complete: "Done",
  incomplete: "To do",
  optional: "Optional",
};

/** The step currently in the reading zone of the viewport. */
function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Map<SectionId, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = SECTIONS.find((s) => sectionDomId(s.id) === entry.target.id)?.id;
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
          else visible.delete(id);
        }
        const next = SECTIONS.find((s) => visible.has(s.id))?.id ?? null;
        setActive((prev) => (next === null ? prev : next));
      },
      // A band across the upper-middle of the screen: the step being read/filled.
      { rootMargin: "-30% 0px -55% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(sectionDomId(s.id));
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export interface PanelMentor {
  id: string;
  name: string;
  headshot: { src: string; alt: string; width: number; height: number } | null;
  firstChoice: boolean;
  interestOnly: boolean;
  times: number;
}

export function ProgressPanel({
  progress,
  mentors,
  deadlineLabel,
  onJump,
}: {
  progress: SectionProgress[];
  mentors: PanelMentor[];
  deadlineLabel: string | null;
  onJump: (domId: string) => void;
}) {
  const { done, total } = requiredProgress(progress);
  const active = useActiveSection();
  const ready = done === total;

  return (
    <div className="space-y-8">
      <nav aria-label="Application steps">
        <div className="flex items-baseline justify-between gap-4">
          <p className="mono-label text-paper-subtle">Your application</p>
          <p className="font-mono text-xs text-paper-muted tabular" aria-live="polite" aria-atomic="true">
            <span className={ready ? "text-success" : "text-paper"}>{done}</span> / {total}
            <span className="sr-only"> required steps complete</span>
          </p>
        </div>

        <ol className="mt-5">
          {SECTIONS.map((section, i) => {
            const p = progress.find((x) => x.id === section.id)!;
            const state = stepState(section, p);
            const isActive = active === section.id;
            const next = SECTIONS[i + 1];
            return (
              <li key={section.id} className="relative">
                {next ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[0.8125rem] top-8 bottom-0 w-0 border-l",
                      state === "complete" ? "border-solid border-accent/60" : "border-dashed border-line-strong",
                    )}
                  />
                ) : null}
                <a
                  href={`#${sectionDomId(section.id)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onJump(sectionDomId(section.id));
                  }}
                  aria-current={isActive ? "step" : undefined}
                  className="group relative grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 rounded-xs pb-3.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex size-7 items-center justify-center rounded-full border bg-ink-900 font-mono text-[0.625rem] tabular transition-colors duration-200",
                      state === "complete"
                        ? "border-accent/70 bg-accent-soft text-accent"
                        : state === "optional"
                          ? "border-dotted border-line-strong text-paper-subtle"
                          : "border-dashed border-line-strong text-paper-muted",
                      isActive && "border-solid border-paper text-paper",
                    )}
                  >
                    {state === "complete" && !isActive ? <CheckIcon className="size-3" strokeWidth={2.5} /> : section.index}
                  </span>
                  <span className="min-w-0 pt-1">
                    <span
                      className={cn(
                        "block text-sm leading-5 transition-colors duration-150 group-hover:text-paper",
                        isActive || state === "complete" ? "text-paper" : "text-paper-muted",
                      )}
                    >
                      {section.short}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block font-mono text-[0.625rem] uppercase tracking-[0.1em]",
                        state === "complete" ? "text-success" : "text-paper-subtle",
                      )}
                    >
                      {STEP_STATE_TEXT[state]}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>

        <a
          href={`#${SUBMIT_BLOCK_ID}`}
          onClick={(e) => {
            e.preventDefault();
            onJump(SUBMIT_BLOCK_ID);
          }}
          className={cn(
            "mt-3 flex min-h-11 items-center justify-between gap-3 rounded-sm border px-3.5 text-sm font-medium transition-colors duration-150",
            ready
              ? "border-accent bg-accent text-accent-ink hover:bg-accent-hover"
              : "border-line-strong text-paper-muted hover:border-paper/30 hover:text-paper",
          )}
        >
          {ready ? "Ready — review & submit" : "Review & submit"}
          <span aria-hidden className="font-mono text-xs">↓</span>
        </a>
      </nav>

      <section aria-labelledby="apply-panel-mentors" className="border-t border-line pt-6">
        <h2 id="apply-panel-mentors" className="mono-label text-paper-subtle">
          Your mentors
        </h2>
        {mentors.length ? (
          <ul className="mt-4 space-y-3">
            {mentors.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <MentorPortrait
                  id={m.id}
                  name={m.name}
                  headshot={m.headshot}
                  size="xs"
                  className={m.firstChoice ? "border-accent/70" : undefined}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 text-paper">{m.name}</p>
                  <p className="mt-0.5 font-mono text-[0.625rem] uppercase leading-4 tracking-[0.1em] text-paper-subtle">
                    {m.firstChoice ? <span className="text-accent">First choice · </span> : null}
                    {m.interestOnly
                      ? "Interest, no time yet"
                      : m.times
                        ? `${m.times} ${m.times === 1 ? "time" : "times"} picked`
                        : <span className="text-warning">Pick a time</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-paper-subtle">None yet — choose in step 01.</p>
        )}
      </section>

      <section aria-labelledby="apply-panel-next" className="border-t border-line pt-6">
        <h2 id="apply-panel-next" className="mono-label text-paper-subtle">
          After you apply
        </h2>
        <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-paper-muted">
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="font-mono text-[0.6875rem] leading-6 text-accent tabular">1</span>
            <span>Founders matches applicants to mentors by interests and availability.</span>
          </li>
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="font-mono text-[0.6875rem] leading-6 text-accent tabular">2</span>
            <span>Selected students get an email to confirm a time.</span>
          </li>
          <li className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="font-mono text-[0.6875rem] leading-6 text-accent tabular">3</span>
            <span>{APPLICATION_COPY.noReservation}</span>
          </li>
        </ol>
      </section>

      {deadlineLabel ? (
        <section aria-labelledby="apply-panel-deadline" className="border-t border-line pt-6">
          <h2 id="apply-panel-deadline" className="mono-label text-paper-subtle">
            Deadline
          </h2>
          <p className="mt-2 font-mono text-sm text-paper tabular">{deadlineLabel}</p>
        </section>
      ) : null}
    </div>
  );
}

/** What's done and what's left, right above the submit button. */
export function ReviewChecklist({
  progress,
  onJump,
}: {
  progress: SectionProgress[];
  onJump: (domId: string) => void;
}) {
  const { done, total } = requiredProgress(progress);
  return (
    <div>
      <p className="mono-label flex items-baseline justify-between gap-4 text-paper-subtle">
        <span>Review</span>
        <span className="tabular">
          <span className={done === total ? "text-success" : "text-paper"}>{done}</span> / {total} required steps
        </span>
      </p>
      <ol className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
        {SECTIONS.map((section) => {
          const p = progress.find((x) => x.id === section.id)!;
          const state = stepState(section, p);
          return (
            <li key={section.id} className="bg-ink-900">
              <a
                href={`#${sectionDomId(section.id)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onJump(sectionDomId(section.id));
                }}
                className="flex min-h-12 items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-150 hover:bg-paper/[0.03]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.5625rem] tabular",
                    state === "complete"
                      ? "border-accent/70 bg-accent-soft text-accent"
                      : state === "optional"
                        ? "border-dotted border-line-strong text-paper-subtle"
                        : "border-dashed border-line-strong text-paper-muted",
                  )}
                >
                  {state === "complete" ? <CheckIcon className="size-2.5" strokeWidth={2.5} /> : section.index}
                </span>
                <span className={cn("min-w-0 truncate", state === "complete" ? "text-paper" : "text-paper-muted")}>
                  {section.short}
                </span>
                <span className="sr-only">
                  {" "}
                  — step {section.index} of {SECTION_COUNT}: {STEP_STATE_TEXT[state]}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
