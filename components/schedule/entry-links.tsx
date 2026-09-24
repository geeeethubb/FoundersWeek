/**
 * Official information links for an entry (`entry.links`, e.g. "Event information" for the
 * Sep 29 panel, "Dan Caruso on LinkedIn"). External: open in a new tab, marked ↗ and announced.
 *
 * Props
 * - `links`: `{ label, url }[]` (renders nothing when empty).
 * - `variant`: "inline" (small underlined links, default) or "button" (full-width secondary buttons).
 * - `className`: extra classes for the wrapper.
 *
 * The inline variant is `relative z-10`, so it stays clickable inside a row whose title link is
 * stretched over the row.
 */
import { buttonClasses } from "@/components/ui/button";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function EntryLinks({
  links,
  variant = "inline",
  className,
}: {
  links: { label: string; url: string }[];
  variant?: "inline" | "button";
  className?: string;
}) {
  if (!links.length) return null;
  if (variant === "button") {
    return (
      <div className={cn("grid gap-2", className)}>
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}
          >
            {l.label}
            <ArrowUpRightIcon className="size-4" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ))}
      </div>
    );
  }
  return (
    <ul className={cn("relative z-10 flex flex-wrap gap-x-5 gap-y-1", className)}>
      {links.map((l) => (
        <li key={l.url}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent md:min-h-8"
          >
            {l.label}
            <ArrowUpRightIcon className="size-3.5 text-text-subtle" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
