"use client";

/**
 * Share an event: "Copy link" (Clipboard API, with a select-and-copy fallback and, failing that,
 * a visible read-only field) plus the native share sheet where the browser supports it.
 * Status is announced politely for screen readers.
 *
 * Props
 * - `path`: site-relative path to share, e.g. "/schedule/how-to-make-10k-a-month-in-college".
 * - `title`: shared title (native share sheet).
 * - `text`: optional one-line summary for the native share sheet.
 * - `className`: extra classes for the wrapper.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, LinkIcon, ShareIcon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Status = "idle" | "copied" | "manual" | "shared";

const noopSubscribe = () => () => {};

/** True after hydration when the browser offers navigator.share (false on the server). */
function useCanNativeShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

function legacyCopy(value: string): boolean {
  const el = document.createElement("textarea");
  el.value = value;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(el);
  return ok;
}

export function ShareActions({
  path,
  title,
  text,
  className,
}: {
  path: string;
  title: string;
  text?: string;
  className?: string;
}) {
  const canShare = useCanNativeShare();
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(resetTimer.current ?? undefined), []);
  useEffect(() => {
    if (status === "manual") manualRef.current?.select();
  }, [status]);

  function absoluteUrl() {
    return new URL(path, window.location.origin).toString();
  }

  function flash(next: Status) {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (next !== "manual") resetTimer.current = setTimeout(() => setStatus("idle"), 2500);
  }

  async function copy() {
    const value = absoluteUrl();
    setUrl(value);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        flash("copied");
        return;
      }
    } catch {
      // Permission denied or insecure context — fall through.
    }
    flash(legacyCopy(value) ? "copied" : "manual");
  }

  async function share() {
    try {
      await navigator.share({ title, text, url: absoluteUrl() });
      flash("shared");
    } catch {
      // User dismissed the sheet, or sharing failed — nothing to announce.
    }
  }

  const message =
    status === "copied"
      ? "Link copied to clipboard."
      : status === "shared"
        ? "Shared."
        : status === "manual"
          ? "Couldn’t copy automatically. The link is selected below so you can copy it."
          : "";

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClasses({ variant: "secondary", className: "min-h-11 flex-1" })}>
          {status === "copied" ? <CheckIcon className="size-4 text-success" /> : <LinkIcon className="size-4" />}
          {status === "copied" ? "Link copied" : "Copy link"}
        </button>
        {canShare ? (
          <button type="button" onClick={share} className={buttonClasses({ variant: "secondary", className: "min-h-11 flex-1" })}>
            <ShareIcon className="size-4" />
            Share…
          </button>
        ) : null}
      </div>
      {status === "manual" && url ? (
        <div className="mt-3">
          <label htmlFor="share-url" className="text-sm font-medium text-text-muted">
            Event link
          </label>
          <input
            id="share-url"
            ref={manualRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="field-control mt-1.5 text-sm"
          />
        </div>
      ) : null}
      <p aria-live="polite" className={cn("mt-2 min-h-5 text-sm", status === "manual" ? "text-text-muted" : "text-success")}>
        {message}
      </p>
    </div>
  );
}
