"use client";

/**
 * Replaces the form once the server has committed the application (never before).
 * Says plainly that this is an application, not an appointment; hands over the private status
 * link (with copy); explains what happens next; and lists the mentors and times chosen.
 */
import { forwardRef, useRef, useState } from "react";
import { DemoBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon, CheckIcon, LinkIcon, LockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { ApplicationStatusBadge, AvailabilityBadge, type AvailabilityKind } from "@/components/ui/status";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { INTEREST_COPY } from "@/lib/mentors";
import { formatInstant } from "@/lib/time";
import { FirstChoiceTag, Phrases } from "./mentor-section";

export interface ConfirmedMentor {
  id: string;
  name: string;
  identity: string | null;
  headshot: { src: string; alt: string; width: number; height: number } | null;
  demo: boolean;
  firstChoice: boolean;
  interestOnly: boolean;
  options: { key: string; label: string; kind: AvailabilityKind }[];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const Confirmation = forwardRef<
  HTMLHeadingElement,
  { firstName: string; email: string; statusUrl: string; submittedAt: string; mentors: ConfirmedMentor[] }
>(function Confirmation({ firstName, email, statusUrl, submittedAt, mentors }, headingRef) {
  const interest = mentors.filter((m) => m.interestOnly);
  const steps = [
    "Founders reviews applications and matches students to mentors based on interests and availability.",
    <>
      If you’re selected, Founders emails <span className="text-paper [overflow-wrap:anywhere]">{email}</span> to confirm a time.
      Nothing is booked until you confirm.
    </>,
    "Check your private status link any time — it updates as your application moves along.",
  ];

  return (
    <section aria-labelledby="apply-confirmation-title" className="animate-fade-up" data-apply-success="">
      {/* Receipt header */}
      <div className="relative overflow-hidden rounded-sm border border-line-strong bg-ink-850">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0" />
        <ReceivedMark className="pointer-events-none absolute -right-10 -top-10 hidden size-72 sm:block md:right-4 md:top-1/2 md:size-64 md:-translate-y-1/2" />
        <div className="relative px-5 py-8 sm:px-10 sm:py-12 md:pr-80">
          <p className="mono-label flex flex-wrap items-center gap-x-3 gap-y-2 text-success">
            <span className="inline-flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full border border-success/50 bg-success-soft">
                <CheckIcon className="size-3" strokeWidth={2.25} />
              </span>
              Saved
            </span>
            <span aria-hidden className="h-px w-5 bg-line-strong" />
            <time dateTime={submittedAt} className="text-paper-muted">
              {formatInstant(submittedAt)}
            </time>
          </p>
          <h3
            ref={headingRef}
            id="apply-confirmation-title"
            tabIndex={-1}
            className="mt-6 font-wide text-[2.25rem] font-bold leading-[0.95] tracking-[-0.035em] text-paper focus:outline-none sm:text-6xl"
          >
            Application
            <br />
            <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.01em]">received.</span>
          </h3>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper-muted">
            Thanks{firstName ? `, ${firstName}` : ""}. Your application is saved.{" "}
            <strong className="font-semibold text-paper">This is an application, not a confirmed appointment.</strong>{" "}
            {APPLICATION_COPY.noReservation}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="mono-label text-paper-subtle">Status</span>
            <ApplicationStatusBadge status="submitted" />
          </div>
        </div>
      </div>

      <div className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12 md:py-12">
        <StatusLinkBox statusUrl={statusUrl} />

        <div>
          <h4 className="mono-label text-paper-subtle">What happens next</h4>
          <ol className="mt-4 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 text-[0.9375rem] leading-relaxed text-paper-muted">
                <span className="pt-0.5 font-mono text-xs text-accent tabular">{String(i + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {interest.length ? (
            <div className="mt-6 rounded-sm border border-dotted border-line-strong px-4 py-3.5">
              <p className="flex flex-wrap items-center gap-2">
                <AvailabilityBadge kind="in-progress" />
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-paper-muted">
                You expressed interest in <span className="text-paper">{joinNames(interest.map((m) => m.name))}</span>,
                whose availability isn’t finalized yet. {INTEREST_COPY.followUp} {INTEREST_COPY.noReservation}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line pt-10">
        <h4 className="mono-label text-paper-subtle">Mentors you chose</h4>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {mentors.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="flex min-w-0 items-center gap-4">
                <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="sm" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="font-semibold text-paper">{m.name}</span>
                    {m.firstChoice ? <FirstChoiceTag /> : null}
                    {m.demo ? <DemoBadge /> : null}
                  </p>
                  {m.identity ? <p className="mt-0.5 text-sm text-paper-muted">{m.identity}</p> : null}
                </div>
              </div>
              <div className="pl-16 sm:pl-0 sm:text-right">
                {m.interestOnly ? (
                  <p className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="font-mono text-xs leading-5 text-paper-muted">Interest · no time yet</span>
                    <AvailabilityBadge kind="in-progress" />
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.options.map((o) => (
                      <li key={o.key} className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Phrases text={o.label} className="font-mono text-xs leading-5 text-paper tabular" />
                        <AvailabilityBadge kind={o.kind} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-sm leading-relaxed text-paper-subtle">
            While you wait, see what else is happening during Founders Week.
          </p>
          <ButtonLink href="/schedule" variant="secondary" size="lg" className="w-full sm:w-auto">
            Explore the Calendar
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
});

function StatusLinkBox({ statusUrl }: { statusUrl: string }) {
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
    <div className="relative self-start rounded-sm border border-accent/50 bg-ink-850 p-5 sm:p-6">
      <span aria-hidden className="absolute left-1.5 top-1.5 size-2.5 border-l border-t border-accent" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 size-2.5 border-b border-r border-accent" />
      <h4 className="mono-label flex items-center gap-2 text-paper">
        <LockIcon className="size-3.5 text-accent" />
        Your private status link
      </h4>
      <p className="mt-3 text-sm leading-relaxed text-paper-muted">
        <strong className="font-semibold text-paper">Save this link.</strong> It’s how you check your status — no
        account needed. Anyone with it can see your status, so keep it to yourself.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="apply-status-link" className="sr-only">
          Private status link
        </label>
        <input
          ref={inputRef}
          id="apply-status-link"
          readOnly
          value={statusUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="field-control min-w-0 flex-1 truncate font-mono text-[0.8125rem]"
        />
        <Button variant="primary" onClick={copy} className="h-11 shrink-0 sm:w-32">
          {copied === "copied" ? (
            <>
              <CheckIcon className="size-4" />
              Copied
            </>
          ) : (
            <>
              <LinkIcon className="size-4" />
              Copy link
            </>
          )}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-paper-subtle">
        {copied === "copied"
          ? "Link copied to your clipboard."
          : copied === "failed"
            ? "Couldn’t copy automatically — the link is selected, so copy it manually."
            : ""}
      </p>
      <a
        href={statusUrl}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        Open your status page
        <ArrowRightIcon className="size-3.5" />
      </a>
    </div>
  );
}

/** Decorative: concentric orbits with the orange point docked at the center — "received". */
function ReceivedMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={className} fill="none">
      <circle cx="100" cy="100" r="92" stroke="rgb(244 239 231 / 0.10)" strokeWidth="0.75" />
      <circle cx="100" cy="100" r="68" stroke="rgb(244 239 231 / 0.14)" strokeWidth="0.75" strokeDasharray="2 3" />
      <circle cx="100" cy="100" r="44" stroke="rgb(244 239 231 / 0.22)" strokeWidth="0.75" />
      <path d="M100 8 A92 92 0 0 1 185 65" stroke="rgb(255 95 5 / 0.8)" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M100 32 V56 M100 144 V168 M32 100 H56 M144 100 H168" stroke="rgb(244 239 231 / 0.3)" strokeWidth="0.75" />
      <circle cx="100" cy="100" r="5" fill="#ff5f05" />
      <circle cx="100" cy="100" r="11" stroke="rgb(255 95 5 / 0.5)" strokeWidth="0.75" />
    </svg>
  );
}
