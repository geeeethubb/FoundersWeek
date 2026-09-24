/** Badges — small, quiet labels for event involvement and status. */
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

// Light theme: orange is only ever a fill/border; accent text uses accent-strong (5.5:1 on white).
const tones: Record<BadgeTone, string> = {
  "accent-solid": "border-accent bg-accent text-accent-ink",
  accent: "border-accent/50 bg-accent-soft text-accent-strong",
  neutral: "border-line-strong bg-surface text-text-muted",
  muted: "border-line bg-surface-subtle text-text-subtle",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
  info: "border-info/25 bg-info-soft text-info",
};

// Line style no longer carries meaning in the simplified design; kept for API compatibility.
const lines: Record<LineStyle, string> = {
  solid: "border-solid",
  dashed: "border-solid",
  dotted: "border-solid",
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
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 text-xs font-semibold leading-none",
        tones[tone],
        lines[line],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Hosted (orange fill) · Co-hosted / Supported (orange tint) · Part of Founders Week (neutral). */
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
      className={className}
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
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong", className)}
    >
      <PickMark className="size-2" />
      Founders pick
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="info" line="dashed" className={className} title="Fictional demo content, never shown in production">
      Demo
    </Badge>
  );
}

export function DraftBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" line="dashed" className={className} title="Draft, hidden on the public site">
      Draft
    </Badge>
  );
}
