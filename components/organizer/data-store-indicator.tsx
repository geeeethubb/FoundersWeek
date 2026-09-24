import { cn } from "@/lib/cn";
import type { DataStoreStatus } from "@/lib/organizer/data-store-view";
import { formatInstant } from "@/lib/time";

/**
 * Which database the organizer view is reading, and whether it's usable — so a disconnected
 * live database is obvious at a glance. Line style follows the site's certainty language:
 * solid = live, dashed = local/not the real thing, solid red = down.
 * Never renders connection strings (the status arrives pre-redacted from lib/organizer/data-store).
 */
const STATE_STYLES: Record<DataStoreStatus["state"], { frame: string; mark: string; tone: string; label: string }> = {
  live: {
    frame: "border-success/40 border-solid",
    mark: "bg-success border-success",
    tone: "text-success",
    label: "Live",
  },
  local: {
    frame: "border-warning/45 border-dashed",
    mark: "border-warning border-dashed bg-transparent",
    tone: "text-warning",
    label: "Local",
  },
  down: {
    frame: "border-danger/50 border-solid",
    mark: "border-danger bg-danger",
    tone: "text-danger",
    label: "Offline",
  },
};

export function DataStoreIndicator({ status, className }: { status: DataStoreStatus; className?: string }) {
  const s = STATE_STYLES[status.state];
  return (
    <section
      aria-labelledby="data-store-heading"
      className={cn("rounded-sm border bg-ink-950/60 px-4 py-3.5 text-sm", s.frame, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="data-store-heading" className="mono-label text-paper-subtle">
          Data store
        </h2>
        <span className={cn("mono-label inline-flex items-center gap-2", s.tone)}>
          <span aria-hidden className={cn("inline-block size-2 rounded-full border", s.mark)} />
          {s.label}
        </span>
      </div>
      <p className="mt-2.5 font-semibold text-paper">{status.headline}</p>
      <p className="mt-0.5 font-mono text-xs text-paper-muted">
        {status.provider}
        {status.schema ? <> · schema {status.schema}</> : null}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-paper-muted">{status.detail}</p>
      {status.hint ? <p className="mt-2 break-words font-mono text-[0.6875rem] leading-relaxed text-paper-subtle">{status.hint}</p> : null}
      <p className="mt-2 font-mono text-[0.6875rem] text-paper-subtle">
        Checked <time dateTime={status.checkedAt}>{formatInstant(status.checkedAt)}</time>
      </p>
    </section>
  );
}
