/**
 * Form field scaffolding. Inputs use the `field-control` utility (globals.css).
 * Wire accessibility explicitly: the control gets `aria-invalid` and
 * `aria-describedby={describedBy(id, { hint, error })}`.
 */
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";

export function hintId(id: string) {
  return `${id}-hint`;
}
export function errorId(id: string) {
  return `${id}-error`;
}
export function describedBy(id: string, parts: { hint?: boolean; error?: boolean }): string | undefined {
  const ids = [parts.hint && hintId(id), parts.error && errorId(id)].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldLabel({
  htmlFor,
  children,
  optional,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 flex items-baseline gap-2 text-[0.9375rem] font-medium text-paper", className)}>
      <span>{children}</span>
      {optional ? <span className="mono-label text-paper-subtle">Optional</span> : null}
    </label>
  );
}

export function FieldHint({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <p id={hintId(id)} className={cn("mt-2 text-sm leading-relaxed text-paper-subtle", className)}>
      {children}
    </p>
  );
}

export function FieldError({ id, children, className }: { id: string; children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p id={errorId(id)} className={cn("mt-2 flex items-start gap-1.5 text-sm text-danger", className)}>
      <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
