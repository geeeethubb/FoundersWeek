/**
 * How each application option is shown in the form, using the shared availability vocabulary
 * (components/ui/status.tsx):
 *   exact window → "window" (dashed) · rough window, e.g. "Friday morning" → "window-approx" (dotted)
 *   proposed slot → "proposed" (dashed amber) · confirmed slot → "confirmed" (solid green)
 *
 * The catalog's label/detail repeat what the badge already says ("…exact times forthcoming"), so
 * the form uses this server-computed presentation: label = when, detail = what's still open.
 * Pure; reads only public mentor content.
 */
import type { AvailabilityKind } from "@/components/ui/status";
import type { Mentor, SessionFormat } from "@/content/types";
import { describeTime, formatDate } from "@/lib/time";
import type { ApplicationCatalog } from "./catalog";

export interface OptionPresentation {
  kind: AvailabilityKind;
  /** e.g. "Thu, Oct 1 · 10:00–11:30 AM CT", "Fri, Oct 2 · Morning, before noon CT" */
  label: string;
  /** e.g. "Exact appointment times will be set within this window." */
  detail: string;
}

const FORMAT_LABELS: Record<SessionFormat, string> = { "in-person": "In person", virtual: "Virtual", hybrid: "Hybrid" };

export function presentOptions(catalog: ApplicationCatalog, mentors: Mentor[]): Record<string, OptionPresentation> {
  const byId = new Map(mentors.map((m) => [m.id, m]));
  const out: Record<string, OptionPresentation> = {};
  for (const entry of catalog.mentors) {
    const mentor = byId.get(entry.id);
    for (const option of entry.options) {
      const window = option.kind === "window" ? mentor?.availability.find((w) => w.id === option.id) : undefined;
      const slot = option.kind === "slot" ? mentor?.slots.find((s) => s.id === option.id) : undefined;
      if (window) {
        const exact = window.time.kind === "exact";
        out[option.key] = {
          kind: exact ? "window" : "window-approx",
          label: `${formatDate(window.date, "short")} · ${describeTime(window.time).label}`,
          detail: exact
            ? "Exact appointment times will be set within this window."
            : "Exact times will be shared once confirmed.",
        };
      } else if (slot) {
        const extras = [slot.format ? FORMAT_LABELS[slot.format] : null, slot.location ?? null].filter(Boolean).join(" · ");
        out[option.key] =
          slot.status === "confirmed"
            ? { kind: "confirmed", label: option.label, detail: extras || `Time confirmed by ${entry.firstName}.` }
            : {
                kind: "proposed",
                label: option.label,
                detail: `Not yet confirmed by ${entry.firstName}${extras ? ` · ${extras}` : ""}`,
              };
      } else {
        out[option.key] = { kind: option.certainty, label: option.label, detail: option.detail };
      }
    }
  }
  return out;
}
