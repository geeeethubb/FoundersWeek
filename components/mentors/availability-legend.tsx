/**
 * Reference blocks for reading the office-hours pages.
 *
 * - `AvailabilityLegend` — the five availability states (components/ui/status.tsx) with a
 *   one-line meaning each. Props: `variant` ("list" — hairline rows, default · "compact" — a
 *   five-up strip that wraps to two/one columns on small screens), `className`.
 * - `ApplicationVsAppointment` — how an application's status differs from an appointment, and
 *   that students get a private status link after applying. Props: `layout` ("split" side by side
 *   from md up · "stack"), `headingLevel` ("h3" | "h4", default "h3"), `className`.
 */
import { ChevronRightIcon } from "@/components/ui/icons";
import {
  ApplicationStatusBadge,
  AppointmentStatusBadge,
  AVAILABILITY_KIND_DESCRIPTIONS,
  AvailabilityBadge,
  type AvailabilityKind,
} from "@/components/ui/status";
import { APPLICATION_STATUS_DESCRIPTIONS, type ApplicationStatus } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";

const KINDS: AvailabilityKind[] = ["window", "window-approx", "in-progress", "proposed", "confirmed"];

export function AvailabilityLegend({
  variant = "list",
  className,
}: {
  variant?: "list" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <dl
        className={cn(
          "grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-5",
          className,
        )}
      >
        {KINDS.map((kind) => (
          <div key={kind} className="bg-ink-900 px-4 py-4 last:sm:col-span-2 last:lg:col-span-1">
            <dt>
              <AvailabilityBadge kind={kind} />
            </dt>
            <dd className="mt-2.5 text-[0.8125rem] leading-relaxed text-paper-muted">
              {AVAILABILITY_KIND_DESCRIPTIONS[kind]}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn("border-b border-line", className)}>
      {KINDS.map((kind) => (
        <div
          key={kind}
          className="grid gap-x-8 gap-y-2 border-t border-line py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center"
        >
          <dt>
            <AvailabilityBadge kind={kind} />
          </dt>
          <dd className="text-[0.9375rem] leading-relaxed text-paper-muted">{AVAILABILITY_KIND_DESCRIPTIONS[kind]}</dd>
        </div>
      ))}
    </dl>
  );
}

const APPLICATION_FLOW: ApplicationStatus[] = ["submitted", "under_review", "selected", "confirmed"];

function Flow({ children, label }: { children: React.ReactNode[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {children.map((child, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 ? <ChevronRightIcon className="size-3.5 text-paper-subtle" /> : null}
          {child}
        </li>
      ))}
    </ol>
  );
}

export function ApplicationVsAppointment({
  layout = "split",
  headingLevel: Heading = "h3",
  className,
}: {
  layout?: "split" | "stack";
  headingLevel?: "h3" | "h4";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-sm border border-line bg-line",
        layout === "split" && "md:grid-cols-2",
        className,
      )}
    >
      <div className="bg-ink-900 p-5 sm:p-6">
        <Heading className="font-wide text-base font-semibold tracking-[-0.01em] text-paper">
          Application status
        </Heading>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-muted">
          Where your application stands. After you apply, you get a private status link to check it any time.
        </p>
        <div className="mt-5">
          <Flow label="Application status, in order">
            {APPLICATION_FLOW.map((s) => (
              <ApplicationStatusBadge key={s} status={s} />
            ))}
          </Flow>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-paper-subtle">{APPLICATION_STATUS_DESCRIPTIONS.waitlisted}</p>
      </div>
      <div className="bg-ink-900 p-5 sm:p-6">
        <Heading className="font-wide text-base font-semibold tracking-[-0.01em] text-paper">Appointment</Heading>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-muted">
          The specific time you’re matched with a mentor. It isn’t final until it’s confirmed — applying or expressing
          interest never reserves one.
        </p>
        <div className="mt-5">
          <Flow label="Appointment status, in order">
            {[
              <AppointmentStatusBadge key="proposed" status="proposed" />,
              <AppointmentStatusBadge key="confirmed" status="confirmed" />,
            ]}
          </Flow>
        </div>
      </div>
    </div>
  );
}
