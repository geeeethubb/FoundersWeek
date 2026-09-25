"use client";

/**
 * Replaces the form once the server has committed the application (never before). Short: it's
 * saved, here's the private status link (with copy), and what happens next in one line (which also
 * says how long a session is, from `site.officeHours`).
 *
 * `replay`: the server already had this submission (a retry or double submit of the same form
 * session) and kept the ORIGINAL — the answers on screen may have been edited since, so nothing
 * from them (mentors, name, email) is repeated; the status link shows what was received.
 */
import { forwardRef, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, CheckIcon, LinkIcon } from "@/components/ui/icons";
import { SESSION_COPY, type SessionLength } from "@/lib/applications/constants";

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const Confirmation = forwardRef<
  HTMLHeadingElement,
  {
    firstName: string;
    email: string;
    statusUrl: string;
    mentorNames: string[];
    /** The session rule (`site.officeHours`). */
    officeHours: SessionLength;
    replay?: boolean;
  }
>(function Confirmation({ firstName, email, statusUrl, mentorNames, officeHours, replay = false }, headingRef) {
  return (
    <section
      aria-labelledby="apply-confirmation-title"
      data-apply-success=""
      className="animate-fade-up max-w-2xl rounded-md border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon className="size-4" strokeWidth={2.5} />
        </span>
        <h3
          ref={headingRef}
          id="apply-confirmation-title"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-text focus:outline-none"
        >
          Application received
        </h3>
      </div>

      {replay ? (
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          This application was already received, so nothing new was sent and nothing changed. Your private status
          link below shows what Founders received. This is an application, not a confirmed appointment.
        </p>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          Thanks{firstName ? `, ${firstName}` : ""}. Your application
          {mentorNames.length ? ` to meet ${joinNames(mentorNames)}` : ""} is saved. This is an application, not a
          confirmed appointment.
        </p>
      )}

      <StatusLink statusUrl={statusUrl} />

      <p className="mt-6 border-t border-line pt-5 text-[0.9375rem] leading-relaxed text-text-muted">
        <span className="font-semibold text-text">What happens next:</span> if you’re matched, Founders will email{" "}
        {replay ? (
          "the address on your application"
        ) : (
          <span className="text-text [overflow-wrap:anywhere]">{email}</span>
        )}{" "}
        {SESSION_COPY.confirmation(officeHours)}. Nothing is booked until you confirm.
      </p>
    </section>
  );
});

function StatusLink({ statusUrl }: { statusUrl: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(statusUrl);
      } else {
        inputRef.current?.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
      }
      setCopied("copied");
      window.setTimeout(() => setCopied("idle"), 2500);
    } catch {
      inputRef.current?.select();
      setCopied("failed");
    }
  }

  return (
    <div className="mt-6">
      <label htmlFor="apply-status-link" className="block text-[0.9375rem] font-medium text-text">
        Private status link
      </label>
      <p id="apply-status-link-hint" className="mt-1 text-sm leading-relaxed text-text-subtle">
        Save it to check your status any time. You don’t need an account, but anyone with the link can see your status.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id="apply-status-link"
          readOnly
          value={statusUrl}
          aria-describedby="apply-status-link-hint"
          onFocus={(e) => e.currentTarget.select()}
          className="field-control min-h-11 min-w-0 flex-1 truncate text-sm"
        />
        <Button variant="secondary" onClick={copy} className="h-11 shrink-0 sm:w-32">
          {copied === "copied" ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
          {copied === "copied" ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-1.5 min-h-5 text-sm text-text-subtle">
        {copied === "copied"
          ? "Link copied to your clipboard."
          : copied === "failed"
            ? "Couldn’t copy it automatically. The link is selected, so copy it yourself."
            : ""}
      </p>
      <a
        href={statusUrl}
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-medium text-accent-strong underline decoration-accent/60 underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong"
      >
        Open your status page
        <ArrowRightIcon className="size-3.5" />
      </a>
    </div>
  );
}
