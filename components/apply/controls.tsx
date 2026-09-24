"use client";

/**
 * Form controls for the application. Native inputs throughout (keyboard, autofill and screen
 * readers just work); checkboxes and radios are drawn with an indicator while the real input stays
 * in the accessibility tree (`peer sr-only`, inside a `relative` label so focusing never scrolls).
 *
 * Every control wires `aria-invalid` + `aria-describedby` (hint, counter, error).
 */
import { useState, type ComponentProps, type ReactNode } from "react";
import { FieldError, errorId, hintId } from "@/components/ui/field";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { countWords } from "@/lib/words";

function ids(...parts: (string | false | null | undefined)[]): string | undefined {
  const list = parts.filter(Boolean) as string[];
  return list.length ? list.join(" ") : undefined;
}

/** Label text shared by every field. */
export function Label({
  htmlFor,
  children,
  optional,
  as: Tag = "label",
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: boolean;
  as?: "label" | "legend";
  className?: string;
}) {
  return (
    <Tag
      {...(Tag === "label" ? { htmlFor } : {})}
      className={cn("block text-[0.9375rem] font-medium leading-snug text-text", className)}
    >
      {children}
      {optional ? <span className="font-normal text-text-subtle"> (optional)</span> : null}
    </Tag>
  );
}

export function Hint({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <p id={hintId(id)} className={cn("mt-1 text-sm leading-relaxed text-text-subtle", className)}>
      {children}
    </p>
  );
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
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      {hint ? <Hint id={id}>{hint}</Hint> : null}
      <input
        id={id}
        className="field-control mt-2"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, error && errorId(id))}
        {...input}
      />
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain textarea
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
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      {hint ? <Hint id={id}>{hint}</Hint> : null}
      <textarea
        id={id}
        rows={2}
        className="field-control mt-2 min-h-20 resize-y"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, error && errorId(id))}
        {...textarea}
      />
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
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-2">
        <select
          id={id}
          className={cn("field-control cursor-pointer appearance-none pr-10", !select.value && "text-text-subtle")}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids(error && errorId(id))}
          {...select}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-text">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
      </div>
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Textarea with a light word counter
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
  hint?: ReactNode;
  error?: string;
  className?: string;
};

export function WordCountTextarea({ id, label, value, wordLimit, hint, error, className, ...textarea }: TextareaProps) {
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
          ? `Almost at the ${wordLimit}-word limit.`
          : lastState === "over"
            ? `Back under the ${wordLimit}-word limit.`
            : "",
    );
  }

  const counterId = `${id}-count`;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? <Hint id={id}>{hint}</Hint> : null}
      <textarea
        id={id}
        value={value}
        rows={4}
        className="field-control mt-2 min-h-28 resize-y"
        aria-invalid={error ? true : undefined}
        aria-describedby={ids(hint ? hintId(id) : null, counterId, error && errorId(id))}
        {...textarea}
      />
      <div className="flex items-start justify-between gap-4">
        <FieldError id={id}>{error}</FieldError>
        <p
          id={counterId}
          className={cn(
            "ml-auto mt-2 shrink-0 text-xs tabular transition-colors duration-150",
            state === "over" ? "font-medium text-danger" : state === "near" ? "text-warning" : "text-text-subtle",
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
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border border-text-subtle bg-surface transition-colors duration-150",
          "peer-checked:border-accent-strong peer-checked:[&>span]:scale-100",
          "peer-aria-invalid:border-danger",
          className,
        )}
      >
        <span className="size-2.5 scale-0 rounded-full bg-accent-strong transition-transform duration-150" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-xs border border-text-subtle bg-surface transition-colors duration-150",
        "peer-checked:border-accent peer-checked:bg-accent peer-checked:[&>svg]:opacity-100",
        "peer-aria-invalid:border-danger",
        className,
      )}
    >
      <CheckIcon className="size-3 text-accent-ink opacity-0 transition-opacity duration-150" strokeWidth={2.5} />
    </span>
  );
}

/** Focus ring for a label that wraps a visually hidden input (accent-strong: 5.5:1 on white). */
export const WRAPPED_FOCUS =
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent-strong";

// ---------------------------------------------------------------------------
// Radio chip (participation, stage, first choice)
// ---------------------------------------------------------------------------

type ChipProps = Omit<ComponentProps<"input">, "id" | "type" | "className" | "children"> & {
  id: string;
  children: ReactNode;
  invalid?: boolean;
  /** Second line under the label (read as the radio's description, not its name). */
  description?: ReactNode;
  /** Id of the group's error message, announced with each radio while the group is invalid. */
  errorMessageId?: string;
};

export function RadioChip({ id, children, invalid, description, errorMessageId, ...input }: ChipProps) {
  const labelId = description ? `${id}-label` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative inline-flex min-h-11 cursor-pointer gap-2.5 rounded-md border bg-surface px-3.5 text-[0.9375rem] text-text transition-colors duration-150",
        description ? "items-start py-3" : "items-center py-2",
        invalid ? "border-danger/60" : "border-line-strong hover:border-[#bdbdb9]",
        "has-[input:checked]:border-accent has-[input:checked]:bg-accent-soft",
        "has-[input:disabled]:cursor-not-allowed",
        WRAPPED_FOCUS,
      )}
    >
      {/* ARIA 1.2 lists aria-invalid on radiogroup rather than radio, but browsers expose it on native
          radios and screen readers announce it there; the group's error is also linked below. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <input
        id={id}
        type="radio"
        className="peer sr-only"
        aria-invalid={invalid || undefined}
        aria-labelledby={labelId}
        aria-describedby={ids(descriptionId, invalid && errorMessageId)}
        {...input}
      />
      <ChoiceIndicator type="radio" className={description ? "mt-px" : undefined} />
      {description ? (
        <span className="min-w-0">
          <span id={labelId} className="block font-medium leading-snug">
            {children}
          </span>
          <span id={descriptionId} className="mt-0.5 block text-sm leading-snug text-text-subtle">
            {description}
          </span>
        </span>
      ) : (
        <span>{children}</span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Checkbox row (acknowledgments, "I can make …")
// ---------------------------------------------------------------------------

type CheckboxRowProps = Omit<ComponentProps<"input">, "id" | "type" | "className" | "children"> & {
  id: string;
  children: ReactNode;
  error?: string;
  description?: ReactNode;
  className?: string;
};

export function CheckboxRow({ id, children, error, description, className, ...input }: CheckboxRowProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn(
          "relative -mx-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-sm px-2 py-2.5 transition-colors duration-150 hover:bg-surface-subtle",
          "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:hover:bg-transparent",
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
        <span className="min-w-0 text-[0.9375rem] leading-relaxed text-text">
          {children}
          {description ? <span className="block text-sm text-text-subtle">{description}</span> : null}
        </span>
      </label>
      <FieldError id={id} className="mt-1">
        {error}
      </FieldError>
    </div>
  );
}
