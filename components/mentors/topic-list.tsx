/**
 * TopicList — "Ask me about" / "Useful for" chips.
 *
 * Props
 * - `topics`: approved strings from the mentor (never inferred). Draft values only reach here in
 *   draft preview; pass `draft` so they read as unapproved (dashed amber outline).
 * - `draft`: render as draft. Default false.
 * - `size`: "sm" (roster rows) · "md" (profile). Default "md".
 * - `label`: accessible name for the list (e.g. "Topics Ron can help with").
 */
import { cn } from "@/lib/cn";

export function TopicList({
  topics,
  draft = false,
  size = "md",
  label,
  className,
}: {
  topics: string[];
  draft?: boolean;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  if (topics.length === 0) return null;
  return (
    <ul aria-label={label} className={cn("flex flex-wrap", size === "sm" ? "gap-1.5" : "gap-2", className)}>
      {topics.map((topic) => (
        <li
          key={topic}
          className={cn(
            "rounded-xs border text-paper",
            draft ? "border-dashed border-warning/45" : "border-line-strong",
            size === "sm" ? "px-2 py-1 text-[0.8125rem] leading-tight" : "px-2.5 py-1.5 text-sm leading-snug",
          )}
        >
          {topic}
        </li>
      ))}
    </ul>
  );
}
