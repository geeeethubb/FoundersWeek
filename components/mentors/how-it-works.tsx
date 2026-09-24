/**
 * HowItWorks — the office-hours process as a numbered three-step sequence (not cards).
 *
 * Props
 * - `layout`: "stack" (default; vertical list, fits a side column) · "row" (three columns from md up).
 * - `headingLevel`: element for step titles. Default "h3".
 * - `className`: extra classes for the outer element.
 *
 * Ends with the shared application promise (APPLICATION_COPY), worded exactly as elsewhere.
 */
import { InfoIcon } from "@/components/ui/icons";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    title: "Apply once",
    body: "Pick the mentors and times that work for you. One application covers every mentor.",
  },
  {
    title: "Founders matches",
    body: "Founders matches applicants with mentors based on interests and availability.",
  },
  {
    title: "Confirm by email",
    body: "Selected students get an email to confirm their appointment.",
  },
] as const;

export function HowItWorks({
  layout = "stack",
  headingLevel: Heading = "h3",
  className,
}: {
  layout?: "stack" | "row";
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const row = layout === "row";
  return (
    <div className={className}>
      <ol className={cn("grid border-y border-line", row && "md:grid-cols-3")}>
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className={cn(
              "grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 py-5",
              i > 0 && "border-t border-line",
              row && "md:block md:px-7 md:py-8",
              row && i > 0 && "md:border-t-0 md:border-l",
              row && i === 0 && "md:pl-0",
            )}
          >
            <span className={cn("pt-0.5 font-mono text-sm font-medium text-accent tabular", row && "md:mb-5 md:block")}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <Heading className="font-wide text-base font-semibold tracking-[-0.01em] text-paper sm:text-lg">
                {step.title}
              </Heading>
              <p className="mt-1 max-w-sm text-[0.9375rem] leading-relaxed text-paper-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 flex gap-3 text-sm leading-relaxed text-paper-muted">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-paper-subtle" />
        <span>
          {APPLICATION_COPY.limited}{" "}
          <strong className="font-medium text-paper">{APPLICATION_COPY.noReservation}</strong>
        </span>
      </p>
    </div>
  );
}
