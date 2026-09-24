"use client";

/**
 * Form controls for the application. Native inputs throughout (keyboard, autofill and screen
 * readers just work); checkboxes and radios are visually replaced by drawn indicators while the
 * real input stays in the accessibility tree (`peer sr-only`).
 *
 * Every control wires `aria-invalid` + `aria-describedby` (hint, counter, error).
 */
import { useState, type ComponentProps, type ReactNode } from "react";
import { FieldError, FieldHint, FieldLabel, errorId, hintId } from "@/components/ui/field";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { countWords } from "@/lib/words";

function ids(...parts: (string | false | null | undefined)[]): string | undefined {
  const list = parts.filter(Boolean) as string[];
  return list.length ? list.join(" ") : undefined;
}

// ---------------------------------------------------------------------------
// Text input
// ---------------------------------------------------------------------------

type InputProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
};

export function TextField({ id, label, hint, error, optional, className, ...input }: InputProps) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={id}
        className="field-control"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, error && errorId(id))}
        {...input}
      />
      {hint ? <FieldHint id={id}>{hint}</FieldHint> : null}
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain textarea (short optional notes)
// ---------------------------------------------------------------------------

type PlainTextareaProps = Omit<ComponentProps<"textarea">, "id" | "className"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
};

export function TextAreaField({ id, label, hint, error, optional, className, ...textarea }: PlainTextareaProps) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        rows={2}
        className="field-control min-h-20 resize-y"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, error && errorId(id))}
        {...textarea}
      />
      {hint ? <FieldHint id={id}>{hint}</FieldHint> : null}
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

type SelectProps = Omit<ComponentProps<"select">, "id" | "className" | "children"> & {
  id: string;
  label: ReactNode;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  className?: string;
};

export function SelectField({ id, label, placeholder, options, error, className, ...select }: SelectProps) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <select
          id={id}
          className={cn("field-control cursor-pointer appearance-none pr-10", !select.value && "text-paper-subtle")}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids(error && errorId(id))}
          {...select}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-paper">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-paper-subtle" />
      </div>
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Textarea with a live word counter
// ---------------------------------------------------------------------------

type CounterState = "ok" | "near" | "over";

function counterState(words: number, limit: number): CounterState {
  if (words > limit) return "over";
  if (words >= Math.floor(limit * 0.9)) return "near";
  return "ok";
}

type TextareaProps = Omit<ComponentProps<"textarea">, "id" | "className" | "value"> & {
  id: string;
  label: ReactNode;
  value: string;
  wordLimit: number;
  /** Shown between the label and the textarea (examples are more useful before typing). */
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
};

export function WordCountTextarea({
  id,
  label,
  value,
  wordLimit,
  hint,
  error,
  optional,
  className,
  ...textarea
}: TextareaProps) {
  const words = countWords(value);
  const state = counterState(words, wordLimit);

  // Announce only when crossing a threshold, not on every keystroke.
  const [lastState, setLastState] = useState<CounterState>(state);
  const [announcement, setAnnouncement] = useState("");
  if (state !== lastState) {
    setLastState(state);
    setAnnouncement(
      state === "over"
        ? `Over the ${wordLimit}-word limit.`
        : state === "near"
          ? `Approaching the ${wordLimit}-word limit.`
          : lastState === "over"
            ? `Back within the ${wordLimit}-word limit.`
            : "",
    );
  }

  const counterId = `${id}-count`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      {hint ? (
        <FieldHint id={id} className="-mt-0.5 mb-3">
          {hint}
        </FieldHint>
      ) : null}
      <textarea
        id={id}
        value={value}
        rows={4}
        className="field-control min-h-28 resize-y"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, counterId, error && errorId(id))}
        {...textarea}
      />
      <div className="mt-2 flex items-start justify-between gap-4">
        <FieldError id={id} className="mt-0">
          {error}
        </FieldError>
        <p
          id={counterId}
          className={cn(
            "ml-auto shrink-0 font-mono text-xs tabular transition-colors duration-150",
            state === "over" ? "text-danger" : state === "near" ? "text-warning" : "text-paper-subtle",
          )}
        >
          {words} / {wordLimit} words
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkbox / radio indicators
// ---------------------------------------------------------------------------

/** Drawn box/dot that mirrors the preceding `peer` input's checked state. */
export function ChoiceIndicator({ type, className }: { type: "checkbox" | "radio"; className?: string }) {
  if (type === "radio") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line-strong bg-ink-950 transition-colors duration-150",
          "peer-checked:border-accent peer-checked:[&>span]:scale-100 peer-disabled:opacity-60",
          className,
        )}
      >
        <span className="size-2 scale-0 rounded-full bg-accent transition-transform duration-150" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-xs border border-line-strong bg-ink-950 transition-colors duration-150",
        "peer-checked:border-accent peer-checked:bg-accent peer-checked:[&>svg]:opacity-100 peer-disabled:opacity-60",
        "peer-aria-invalid:border-danger",
        className,
      )}
    >
      <CheckIcon className="size-3 text-accent-ink opacity-0 transition-opacity duration-150" strokeWidth={2.25} />
    </span>
  );
}

/** Focus ring for a label that wraps a visually hidden input. */
export const WRAPPED_FOCUS =
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent";

// ---------------------------------------------------------------------------
// Single checkbox row (consent, acknowledgments)
// ---------------------------------------------------------------------------

type CheckboxRowProps = Omit<ComponentProps<"input">, "id" | "type" | "className" | "children"> & {
  id: string;
  children: ReactNode;
  error?: string;
  description?: ReactNode;
};

export function CheckboxRow({ id, children, error, description, ...input }: CheckboxRowProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          "relative flex min-h-11 cursor-pointer items-start gap-3.5 rounded-sm border px-4 py-3.5 transition-colors duration-150",
          error ? "border-danger/60" : "border-line-strong hover:border-paper/30",
          "has-[input:checked]:bg-ink-850",
          WRAPPED_FOCUS,
        )}
      >
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={ids(error && errorId(id))}
          {...input}
        />
        <ChoiceIndicator type="checkbox" className="mt-[3px]" />
        <span className="min-w-0 text-[0.9375rem] leading-relaxed text-paper">
          {children}
          {description ? <span className="mt-1 block text-sm text-paper-subtle">{description}</span> : null}
        </span>
      </label>
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

/** Legend styled like a field label. */
export function Legend({ children, optional, className }: { children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <legend className={cn("mb-3 flex items-baseline gap-2 text-[0.9375rem] font-medium text-paper", className)}>
      <span>{children}</span>
      {optional ? <span className="mono-label text-paper-subtle">Optional</span> : null}
    </legend>
  );
}
