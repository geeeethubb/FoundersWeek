/**
 * How each application option (a mentor's availability window or slot) reads in the form:
 *
 *   label  — "Thu, Oct 1 · 10:00–11:30 AM CT", "Fri, Oct 2 · Morning, before noon CT"
 *   phrase — the same time in a sentence: "I can make Thu, Oct 1, 10:00–11:30 AM CT",
 *            "I can make Fri, Oct 2, morning (before noon CT)"
 *   detail — what's still open, e.g. "Exact appointment times will be set within this window."
 *   kind   — the shared availability vocabulary (components/ui/status.tsx), for status views.
 *
 * Server-computed from public mentor content only. Pure.
 */
import type { AvailabilityKind } from "@/components/ui/status";
import type { Mentor, SessionFormat } from "@/content/types";
import { EXACT_TIME_TO_BE_CONFIRMED } from "@/lib/mentors";
import { describeTime, formatDate, TZ_LABEL } from "@/lib/time";
import type { ApplicationCatalog } from "./catalog";

export interface OptionPresentation {
  kind: AvailabilityKind;
  /** e.g. "Thu, Oct 1 · 10:00–11:30 AM CT", "Fri, Oct 2 · Morning, before noon CT" */
  label: string;
  /** Sentence form, e.g. "Thu, Oct 1, 10:00–11:30 AM CT", "Fri, Oct 2, morning (before noon CT)" */
  phrase: string;
  /** e.g. "Exact appointment times will be set within this window." */
  detail: string;
}

const FORMAT_LABELS: Record<SessionFormat, string> = { "in-person": "In person", virtual: "Virtual", hybrid: "Hybrid" };

/** "Thu, Oct 1 · 10:00–11:30 AM CT" → "Thu, Oct 1, 10:00–11:30 AM CT". */
function labelToPhrase(label: string): string {
  return label.replace(" · ", ", ");
}

/** "Morning, before noon" → "morning (before noon CT)"; "Afternoon" → "afternoon CT". */
function roughPhrase(bare: string): string {
  const [part, ...rest] = bare.split(", ");
  const lead = part.charAt(0).toLowerCase() + part.slice(1);
  return rest.length ? `${lead} (${rest.join(", ")} ${TZ_LABEL})` : `${lead} ${TZ_LABEL}`;
}

export function presentOptions(catalog: ApplicationCatalog, mentors: Mentor[]): Record<string, OptionPresentation> {
  const byId = new Map(mentors.map((m) => [m.id, m]));
  const out: Record<string, OptionPresentation> = {};
  for (const entry of catalog.mentors) {
    const mentor = byId.get(entry.id);
    for (const option of entry.options) {
      const window = option.kind === "window" ? mentor?.availability.find((w) => w.id === option.id) : undefined;
      const slot = option.kind === "slot" ? mentor?.slots.find((s) => s.id === option.id) : undefined;
      if (window && window.time.kind === "tba") {
        // Date set, time not: "I can make Thu, Oct 1 (exact time to be confirmed)".
        const date = formatDate(window.date, "short");
        out[option.key] = {
          kind: "window-approx",
          label: `${date} · ${EXACT_TIME_TO_BE_CONFIRMED}`,
          phrase: `${date} (exact time to be confirmed)`,
          detail: "We’ll share the exact time once it’s set. Tell us below when you’re free that day.",
        };
      } else if (window) {
        const exact = window.time.kind === "exact";
        const time = describeTime(window.time);
        const date = formatDate(window.date, "short");
        out[option.key] = {
          kind: exact ? "window" : "window-approx",
          label: `${date} · ${time.label}`,
          phrase: exact || window.time.kind === "tba" ? `${date}, ${time.label}` : `${date}, ${roughPhrase(time.bare)}`,
          detail: exact
            ? "Exact appointment times will be set within this window."
            : "Exact times will be shared once confirmed.",
        };
      } else if (slot) {
        const extras = [slot.format ? FORMAT_LABELS[slot.format] : null, slot.location ?? null].filter(Boolean).join(" · ");
        out[option.key] =
          slot.status === "confirmed"
            ? {
                kind: "confirmed",
                label: option.label,
                phrase: labelToPhrase(option.label),
                detail: extras || `Time confirmed by ${entry.firstName}.`,
              }
            : {
                kind: "proposed",
                label: option.label,
                phrase: labelToPhrase(option.label),
                detail: `Not yet confirmed by ${entry.firstName}${extras ? ` · ${extras}` : ""}`,
              };
      } else {
        out[option.key] = {
          kind: option.certainty,
          label: option.label,
          phrase: labelToPhrase(option.label),
          detail: option.detail,
        };
      }
    }
  }
  return out;
}
