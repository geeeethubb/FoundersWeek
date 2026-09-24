"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import { useOrganizerRequest } from "./use-organizer-request";

const MAX = 5000;

export function NotesForm({ applicationId, notes }: { applicationId: string; notes: string }) {
  const id = useId();
  const [value, setValue] = useState(notes);
  const [savedValue, setSavedValue] = useState(notes);
  const [justSaved, setJustSaved] = useState(false);
  const { send, error, pending } = useOrganizerRequest();
  const dirty = value.replace(/\s+$/, "") !== savedValue;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!dirty) return;
        const ok = await send(`/api/organizer/applications/${applicationId}`, "PATCH", { organizerNotes: value });
        if (ok) {
          setSavedValue(value.replace(/\s+$/, ""));
          setJustSaved(true);
        }
      }}
    >
      <label htmlFor={`${id}-notes`} className="sr-only">
        Organizer notes
      </label>
      <textarea
        id={`${id}-notes`}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setJustSaved(false);
        }}
        rows={5}
        maxLength={MAX}
        placeholder="Private notes for the organizer team — fit, follow-ups, who emailed whom…"
        aria-describedby={`${id}-hint`}
        className="field-control min-h-32 resize-y text-[0.9375rem] leading-relaxed"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p id={`${id}-hint`} aria-live="polite" className="text-xs text-paper-subtle">
          {error ? (
            <span role="alert" className="inline-flex items-start gap-1.5 text-sm text-danger">
              <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </span>
          ) : justSaved && !dirty ? (
            <span className="text-success">Notes saved.</span>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            <>Never shown to students or mentors.</>
          )}
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.6875rem] text-paper-subtle tabular">
            {value.length}/{MAX}
          </span>
          <Button type="submit" size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending} className="max-sm:h-11">
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
