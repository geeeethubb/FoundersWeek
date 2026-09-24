"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, LinkIcon } from "@/components/ui/icons";

/** Read-only URL with a Copy button (falls back to selecting the text). */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={id}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="field-control min-w-0 flex-1 truncate font-mono text-xs"
        />
        <Button
          variant="secondary"
          className="h-[2.875rem] shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              input.current?.focus();
              input.current?.select();
            }
          }}
        >
          {copied ? <CheckIcon className="size-4 text-success" /> : <LinkIcon className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </p>
    </div>
  );
}
