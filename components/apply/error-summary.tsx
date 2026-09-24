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
        className="rounded-sm border border-danger/50 bg-danger-soft px-5 py-4 focus-visible:outline-offset-4"
      >
        <p id="apply-error-summary-title" className="flex items-center gap-2 font-semibold text-paper">
          <AlertIcon className="size-4 shrink-0 text-danger" />
          {title}
        </p>
        <ul className="mt-3 space-y-1.5 pl-6 text-sm">
          {items.map((item) => (
            <li key={item.key} className="list-disc marker:text-danger">
              {item.targetId ? (
                <a
                  href={`#${item.targetId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onJump(item.targetId!);
                  }}
                  className="text-paper underline decoration-danger/60 underline-offset-[3px] transition-colors duration-150 hover:decoration-danger"
                >
                  {item.message}
                </a>
              ) : (
                <span className="text-paper">{item.message}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
