"use client";

import { forwardRef } from "react";
import { AlertIcon } from "@/components/ui/icons";

export interface SummaryItem {
  key: string;
  message: string;
  /** Element to focus; null when the error isn't tied to a field. */
  targetId: string | null;
}

/**
 * Shown after a failed submit. Receives focus so screen-reader and keyboard users land on it;
 * each link moves focus to the field that needs attention.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, { title: string; items: SummaryItem[]; onJump: (id: string) => void }>(
  function ErrorSummary({ title, items, onJump }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        tabIndex={-1}
        aria-labelledby="apply-error-summary-title"
        className="rounded-md border border-danger/35 bg-danger-soft px-5 py-4 focus-visible:outline-offset-4"
      >
        <p id="apply-error-summary-title" className="flex items-center gap-2 font-semibold text-text">
          <AlertIcon className="size-4 shrink-0 text-danger" />
          {title}
        </p>
        <ul className="mt-1.5 pl-6 text-sm leading-relaxed">
          {items.map((item) => (
            <li key={item.key} className="list-disc marker:text-danger">
              {item.targetId ? (
                <a
                  href={`#${item.targetId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onJump(item.targetId!);
                  }}
                  className="inline-flex min-h-11 items-center py-1 text-text underline decoration-danger/50 underline-offset-[3px] transition-colors duration-150 hover:decoration-danger"
                >
                  {item.message}
                </a>
              ) : (
                <span className="inline-flex min-h-11 items-center py-1 text-text">{item.message}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
