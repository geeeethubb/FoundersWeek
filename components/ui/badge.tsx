/**
 * Badges. Line style carries certainty everywhere on the site:
 *   solid = confirmed · dashed = planned/proposed · dotted = to be announced.
 */
import type { ConfirmationStatus, Involvement } from "@/content/types";
import { cn } from "@/lib/cn";
import {
  INVOLVEMENT_DESCRIPTIONS,
  INVOLVEMENT_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
} from "@/lib/schedule/entries";
import { PickMark } from "./icons";

export type BadgeTone = "accent" | "accent-solid" | "neutral" | "muted" | "success" | "warning" | "danger" | "info";
export type LineStyle = "solid" | "dashed" | "dotted";

const tones: Record<BadgeTone, string> = {
  "accent-solid": "border-accent bg-accent text-accent-ink",
  accent: "border-line-accent text-accent",
  neutral: "border-line-strong text-paper",
  muted: "border-line text-paper-muted",
  success: "border-success/40 text-success",
  warning: "border-warning/45 text-warning",
  danger: "border-danger/45 text-danger",
  info: "border-info/40 text-info",
};

const lines: Record<LineStyle, string> = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
};

export function Badge({
  tone = "neutral",
  line = "solid",
  className,
  children,
  title,
}: {
  tone?: BadgeTone;
  line?: LineStyle;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 font-mono text-[0.6875rem] font-medium uppercase leading-none tracking-[0.08em]",
        tones[tone],
        lines[line],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Hosted (filled orange) > Supported (orange outline) > Part of Founders Week (neutral outline). */
/**
 * Hosted (filled orange) > Co-hosted (orange outline on an orange wash) > Supported (orange outline)
 * > Part of Founders Week (neutral outline).
 */
export function InvolvementBadge({ involvement, className }: { involvement: Involvement; className?: string }) {
  const tone: BadgeTone =
    involvement === "hosted"
      ? "accent-solid"
      : involvement === "cohosted" || involvement === "supported"
        ? "accent"
        : "muted";
  return (
    <Badge
      tone={tone}
      className={cn(involvement === "cohosted" && "border-accent bg-accent-soft", className)}
      title={INVOLVEMENT_DESCRIPTIONS[involvement]}
    >
      {INVOLVEMENT_LABELS[involvement]}
    </Badge>
  );
}

/** "Related event" marker for events outside the official Founders Week program. */
export function RelatedBadge({ className }: { className?: string }) {
  return (
    <Badge tone="muted" line="dashed" className={className} title="Related to Founders Week, outside the official program">
      Related event
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: ConfirmationStatus; className?: string }) {
  const map: Record<ConfirmationStatus, { tone: BadgeTone; line: LineStyle }> = {
    confirmed: { tone: "success", line: "solid" },
    planned: { tone: "warning", line: "dashed" },
    tentative: { tone: "warning", line: "dotted" },
    canceled: { tone: "danger", line: "solid" },
  };
  const { tone, line } = map[status];
  return (
    <Badge tone={tone} line={line} className={className} title={STATUS_DESCRIPTIONS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PickBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-accent",
        className,
      )}
    >
      <PickMark className="size-2" />
      Founders pick
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="info" line="dashed" className={className} title="Fictional demo content — not shown in production">
      Demo
    </Badge>
  );
}

export function DraftBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" line="dashed" className={className} title="Draft — not visible on the public site">
      Draft
    </Badge>
  );
}
