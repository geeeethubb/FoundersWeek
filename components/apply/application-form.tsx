"use client";

/**
 * The office-hours application, embedded at /office-hours#apply: one short form in three groups
 * (About you · Your interests · Submit), one submission for every mentor a student picks.
 *
 * - Validation uses the SAME zod schema as the API (createApplicationSchema). A field shows its
 *   error once the student has changed it and moved on, then live; everything shows on submit,
 *   with a focused error summary. Validation never clears an answer.
 * - Submission is idempotent: one key per form session, reused across retries (and kept with the
 *   draft). Success is shown ONLY when the server answers ok with an application id; after any
 *   failure every answer stays.
 * - Drafts: the in-progress answers (everything except the honeypot) are kept in sessionStorage,
 *   restored on mount — before the URL's mentor preselection is merged in — and cleared after a
 *   successful submission. So a student can open a mentor's profile and come back.
 * - Mentor CTAs link to `/office-hours?mentor=<id>[&window|slot=<id>]#apply`. The first render is
 *   prefilled on the server; when those parameters change while the form is open, the selection is
 *   MERGED into the current answers (nothing is cleared), announced, and the mentor brought into view.
 *   Back/Forward never merge, and a plain "#apply" link only scrolls.
 * - Removing the mentor (or time) the URL preselected drops those parameters from the address bar,
 *   so a reload doesn't add the mentor back; notices about a removed mentor go away.
 */
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, errorId } from "@/components/ui/field";
import { AlertIcon, ArrowRightIcon, InfoIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/primitives";
import {
  APPLICATIONS_ENDPOINT,
  SUBMIT_COPY,
  isSubmitSuccess,
  rateLimitMessage,
  type SubmitFailure,
} from "@/lib/applications/api-contract";
import type { ApplicationCatalog } from "@/lib/applications/catalog";
import { LIMITS, PARTICIPATION_OPTIONS, STAGE_OPTIONS, YEAR_OPTIONS } from "@/lib/applications/constants";
import { isBlankDraft, parseDraft, serializeDraft, toDraftValues } from "@/lib/applications/draft";
import {
  mergePrefill,
  mergeSearchParams,
  prefillParamsFrom,
  prefillParamsKey,
  resolvePrefill,
  type ApplicationPrefill,
  type ApplySearchParams,
} from "@/lib/applications/prefill";
import { normalizeLink } from "@/lib/applications/schema";
import { cn } from "@/lib/cn";
import { APPLY_ANCHOR } from "@/lib/schedule/entries";
import { Confirmation } from "./confirmation";
import { CheckboxRow, Label, RadioChip, SelectField, TextField, WordCountTextarea } from "./controls";
import { ErrorSummary, type SummaryItem } from "./error-summary";
import {
  CROSS_FIELD_KEYS,
  FORM_GROUPS,
  PLACEHOLDER_KEY,
  applyLinkAction,
  createValidator,
  effectiveFirstChoice,
  emptyFormState,
  fieldId,
  focusTargetId,
  groupDomId,
  mergeAnnouncement,
  newIdempotencyKey,
  noticeAfterRemoval,
  orderErrors,
  prefillNotice,
  removesUrlSelection,
  samePrefill,
  toSubmissionValues,
  withoutPrefillParams,
  type FieldErrors,
  type FormGroupId,
  type FormState,
  type SelectionNotice,
} from "./form-model";
import {
  AvailabilityFields,
  FirstChoicePicker,
  MentorPicker,
  type ApplyMentorProfiles,
  type OptionPresentations,
} from "./mentor-section";

export interface ApplicationFormProps {
  catalog: ApplicationCatalog;
  emailDomains: string[];
  /** Server-computed label/phrase per option key. */
  presentations: OptionPresentations;
  /** Verified role/company/headshot per mentor id, for the mentor rows. */
  profiles: ApplyMentorProfiles;
  /** Selection resolved on the server from the URL of the first render. */
  prefill: ApplicationPrefill;
  /** sessionStorage key for the in-progress draft (scoped to this site). */
  draftKey: string;
  /** Set when submissions are closed: the form is shown for preview but disabled. */
  closed: { title: string; message: string } | null;
}

type Banner = { tone: "danger" | "warning"; title: string; message: string; retry: boolean };

/** `replay`: the server already had this form session's submission and kept the original. */
type SuccessResult = { statusUrl: string; snapshot: FormState; replay: boolean };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bring the application's heading into view, just below the sticky header (html scroll-padding-top). */
function scrollToApplication() {
  document
    .getElementById(APPLY_ANCHOR)
    ?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Drop ?mentor/window/slot from the address bar (hash and other parameters kept), without navigating. */
function dropUrlSelection() {
  try {
    window.history.replaceState(null, "", withoutPrefillParams(window.location.href));
  } catch {
    // Some browsers throttle history updates; the selection itself is already saved in the draft.
  }
}

const subscribeNothing = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function readDraft(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota): the form still works, it just won't remember.
  }
}

export function ApplicationForm({
  catalog,
  emailDomains,
  presentations,
  profiles,
  prefill,
  draftKey,
  closed,
}: ApplicationFormProps) {
  const validate = useMemo(() => createValidator(catalog, emailDomains), [catalog, emailDomains]);

  const [state, setState] = useState<FormState>(() => ({ ...emptyFormState(), ...prefill }));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [summaryFocusToken, setSummaryFocusToken] = useState(0);
  const [bannerFocusToken, setBannerFocusToken] = useState(0);
  const [notice, setNotice] = useState<SelectionNotice | null>(() => prefillNotice(catalog, prefill, presentations, 0));
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const restoredRef = useRef(false);
  const submittingRef = useRef(false);
  const changedRef = useRef(new Set<string>());
  const summaryRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ---------------------------------------------------------------------------
  // Draft: restore once on mount (then merge the URL's preselection), save on every change
  // ---------------------------------------------------------------------------

  // The URL's preselection as the router has it now (during a client navigation `window.location`
  // still shows the previous page while this renders).
  const searchParams = useSearchParams();
  const urlParams = prefillParamsFrom(searchParams);
  const urlParamsKey = prefillParamsKey(urlParams);

  // The server (and the hydration pass) can't see sessionStorage: restore right after hydration,
  // during render (React's "adjust state" pattern), so nothing else runs with the blank answers.
  const hydrated = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);
  if (hydrated && !draftReady) {
    setDraftReady(true);
    // Follow the URL, not the `prefill` prop: Back to this page can re-render it from the router
    // cache as first rendered, after the student removed that mentor (which also dropped the
    // parameters from the URL) — and that mentor must not come back.
    const live = resolvePrefill(catalog, urlParams);
    const stale = !samePrefill(live, prefill);
    const draft = parseDraft(readDraft(draftKey), catalog);
    if (draft) {
      // The draft first, then whatever the URL preselects on top of it (merge only ever adds).
      const merged = mergePrefill({ ...draft.values, nickname: "" }, live);
      const outcome = merged.outcome;
      setState(merged.state);
      setDirty(true);
      // Say what the link added; if it added nothing new, the server-rendered note still holds.
      if (outcome && (outcome.mentorAdded || outcome.optionAdded)) {
        setNotice({
          id: 1,
          kind: "top",
          message: mergeAnnouncement(catalog, outcome, presentations),
          mentorId: outcome.mentorId,
          optionKey: outcome.optionAdded,
        });
      } else if (stale) {
        setNotice(prefillNotice(catalog, live, presentations, 1));
      }
    } else if (stale) {
      setState((prev) => ({ ...prev, ...live }));
      setNotice(prefillNotice(catalog, live, presentations, 1));
    }
  }

  // One idempotency key per form session — a restored draft continues its session (so a retry
  // after navigating away is still the same submission), and its fill time keeps counting.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = parseDraft(readDraft(draftKey), catalog);
    idempotencyKeyRef.current = draft?.key ?? newIdempotencyKey();
    startedAtRef.current = draft?.startedAt ?? Date.now();
  }, [catalog, draftKey]);

  useEffect(() => {
    if (!draftReady || phase === "success") return;
    const values = toDraftValues(state);
    writeDraft(
      draftKey,
      isBlankDraft(values)
        ? null
        : serializeDraft({ key: idempotencyKeyRef.current, startedAt: startedAtRef.current, values }),
    );
  }, [draftReady, draftKey, phase, state]);

  // ---------------------------------------------------------------------------
  // Prefill merges: the URL's mentor/window/slot changed while the form is open
  // ---------------------------------------------------------------------------

  const [seenParamsKey, setSeenParamsKey] = useState(urlParamsKey);
  // Set by Back/Forward: the parameters of the entry being restored. They were merged when that
  // entry was first visited, and the answers since (including any mentor the student removed) are
  // what counts — a traversal never merges.
  const [traversedParamsKey, setTraversedParamsKey] = useState<string | null>(null);
  // A CTA whose URL equals the current one doesn't change the URL; the click listener queues it.
  const [queuedParams, setQueuedParams] = useState<ApplySearchParams | null>(null);

  /** Render-phase merge (React's "adjust state when inputs change" pattern). */
  function mergeFrom(params: ApplySearchParams) {
    if (phase === "success") return;
    const merged = mergeSearchParams(state, catalog, params);
    if (!merged.outcome) return;
    if (merged.changed) {
      setState(merged.state);
      setDirty(true);
      setServerErrors((prev) => {
        const keys = Object.keys(prev).filter((k) => CROSS_FIELD_KEYS.has(k));
        if (!keys.length) return prev;
        const next = { ...prev };
        for (const key of keys) delete next[key];
        return next;
      });
    }
    const outcome = merged.outcome;
    setNotice((prev) => ({
      id: (prev?.id ?? 1) + 1,
      kind: "merge",
      message: mergeAnnouncement(catalog, outcome, presentations),
      mentorId: outcome.mentorId,
      optionKey: outcome.optionAdded,
    }));
    setHighlightId(outcome.mentorId);
  }

  if (urlParamsKey !== seenParamsKey) {
    setSeenParamsKey(urlParamsKey);
    const traversal = urlParamsKey === traversedParamsKey;
    if (traversedParamsKey !== null) setTraversedParamsKey(null);
    if (!traversal) mergeFrom(urlParams);
  }
  if (queuedParams) {
    setQueuedParams(null);
    mergeFrom(queuedParams);
  }

  // Back/Forward: remember which parameters are being restored, so they aren't merged again.
  useEffect(() => {
    function onPopState() {
      setTraversedParamsKey(prefillParamsKey(prefillParamsFrom(new URLSearchParams(window.location.search))));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Same-page CTAs pointing at the URL we're already on: handle them here (Next wouldn't
  // navigate, so the URL — and useSearchParams — wouldn't change). Fragment-only links ("#apply"),
  // unknown mentors and a submitted application only scroll (see `applyLinkAction`).
  const canMerge = phase !== "success";
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const action = applyLinkAction(anchor.getAttribute("href") ?? "", window.location.href, catalog, { canMerge });
      if (action.kind === "navigate") return;
      event.preventDefault();
      if (action.kind === "merge") setQueuedParams(action.params);
      else scrollToApplication();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [catalog, canMerge]);

  // After a merge (any Select/Apply action while the form is open): every Apply action lands on
  // the section heading, just below the sticky header (html scroll-padding-top), with the
  // "added" message directly beneath it. The mentor's row stays highlighted further down.
  const mergedNoticeId = notice?.kind === "merge" ? notice.id : 0;
  const mergedMentorId = notice?.kind === "merge" ? notice.mentorId : null;
  useEffect(() => {
    if (!mergedNoticeId || !mergedMentorId) return;
    // Next.js applies its own #apply scroll in the same commit; run after it.
    const frame = requestAnimationFrame(() => {
      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      document.getElementById("apply-heading")?.scrollIntoView({ block: "start", behavior });
      document.getElementById("apply-merge-notice")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [mergedNoticeId, mergedMentorId]);

  // The highlight on a just-added mentor fades after a moment.
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightId, mergedNoticeId]);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  // Warn before closing the tab with unsaved answers (the draft survives in-site navigation).
  useEffect(() => {
    if (!dirty || phase === "success") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, phase]);

  useEffect(() => {
    if (summaryFocusToken) summaryRef.current?.focus();
  }, [summaryFocusToken]);

  useEffect(() => {
    if (bannerFocusToken) bannerRef.current?.focus();
  }, [bannerFocusToken]);

  useEffect(() => {
    if (phase !== "success") return;
    topRef.current?.scrollIntoView({ block: "start" });
    confirmationHeadingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const allErrors = useMemo(
    () => validate(toSubmissionValues(state, catalog, { idempotencyKey: PLACEHOLDER_KEY, elapsedMs: LIMITS.minFillMs })),
    [validate, state, catalog],
  );

  const visibleErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [key, message] of Object.entries(allErrors)) {
      if (submitAttempted || touched.has(key)) out[key] = message;
    }
    for (const [key, message] of Object.entries(serverErrors)) if (!(key in out)) out[key] = message;
    return out;
  }, [allErrors, serverErrors, submitAttempted, touched]);

  const summaryItems: SummaryItem[] = useMemo(
    () =>
      orderErrors(visibleErrors).map(([key, message]) => ({
        key,
        message,
        targetId: focusTargetId(key, state, catalog),
      })),
    [visibleErrors, state, catalog],
  );

  // ---------------------------------------------------------------------------
  // Updates
  // ---------------------------------------------------------------------------

  function markChanged(...keys: string[]) {
    for (const key of keys) changedRef.current.add(key);
    setDirty(true);
    setServerErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  }

  function update<K extends keyof FormState>(name: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [name]: value }));
    markChanged(name);
  }

  /** A field (or group) was left: validate it from now on if the student changed it. */
  function touch(key: string) {
    if (!changedRef.current.has(key)) return;
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  function toggleMentor(mentorId: string, checked: boolean) {
    setState((prev) => {
      const mentorIds = checked
        ? [...prev.mentorIds.filter((id) => id !== mentorId), mentorId]
        : prev.mentorIds.filter((id) => id !== mentorId);
      // Keep an explicit first choice while it's still selected; one mentor is automatically first.
      const current = effectiveFirstChoice(prev);
      const firstChoiceMentorId = mentorIds.includes(current) ? current : mentorIds.length === 1 ? mentorIds[0] : "";
      return { ...prev, mentorIds, firstChoiceMentorId };
    });
    markChanged("mentorIds", "firstChoiceMentorId", "availability", "availabilityNotes");
    if (!checked) forget({ mentorId });
  }

  function toggleOption(key: string, checked: boolean) {
    setState((prev) => ({
      ...prev,
      availability: checked ? [...prev.availability.filter((k) => k !== key), key] : prev.availability.filter((k) => k !== key),
    }));
    markChanged("availability", "availabilityNotes");
    if (!checked) forget({ optionKey: key });
  }

  /**
   * The student removed a mentor or a time: notices about it are stale, and if a link preselected
   * it, its parameters leave the address bar — so a reload doesn't add it back.
   */
  function forget(removed: { mentorId?: string; optionKey?: string }) {
    setNotice((prev) => noticeAfterRemoval(prev, removed));
    if (removed.mentorId) setHighlightId((prev) => (prev === removed.mentorId ? null : prev));
    if (removesUrlSelection(catalog, window.location.search, removed)) dropUrlSelection();
  }

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const anchor = el.closest("label") ?? el;
    anchor.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  function failWith(status: number, body: Partial<SubmitFailure> | null, retryAfterHeader: string | null) {
    if (status === 400 && body?.error === "validation" && body.fieldErrors) {
      setServerErrors(body.fieldErrors);
      setSubmitAttempted(true);
      setSummaryFocusToken((n) => n + 1);
      return;
    }
    let next: Banner;
    if (status === 429) {
      const retry = body?.retryAfterSeconds ?? Number(retryAfterHeader ?? 0);
      next = { tone: "warning", title: "Too many attempts", message: body?.message ?? rateLimitMessage(retry || 600), retry: false };
    } else if (status === 403 && body?.error === "closed") {
      next = {
        tone: "warning",
        title: body.title ?? "Applications are closed",
        message: body.message ?? SUBMIT_COPY.closed,
        retry: false,
      };
    } else if (status === 403) {
      next = { tone: "danger", title: "Your application wasn’t submitted", message: SUBMIT_COPY.forbidden, retry: false };
    } else if (status === 503) {
      next = {
        tone: "warning",
        title: body?.title ?? "Applications are temporarily unavailable",
        message: body?.message ?? SUBMIT_COPY.unavailable,
        retry: true,
      };
    } else if (status === 413) {
      next = { tone: "danger", title: "Your application wasn’t submitted", message: SUBMIT_COPY.tooLarge, retry: false };
    } else if (status === 400 && body?.error === "rejected") {
      next = {
        tone: "danger",
        title: "Your application wasn’t submitted",
        message: body.message ?? SUBMIT_COPY.rejected,
        retry: true,
      };
    } else {
      next = { tone: "danger", title: "Your application wasn’t submitted", message: SUBMIT_COPY.networkOrServer, retry: true };
    }
    setBanner(next);
    setBannerFocusToken((n) => n + 1);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || closed || phase === "success") return;

    const idempotencyKey = (idempotencyKeyRef.current ??= newIdempotencyKey());
    const startedAt = startedAtRef.current || Date.now();
    const elapsedMs = Math.max(0, Math.round(Date.now() - startedAt));
    const values = toSubmissionValues(state, catalog, { idempotencyKey, elapsedMs });

    setSubmitAttempted(true);
    setBanner(null);
    if (Object.keys(validate(values)).length > 0) {
      setSummaryFocusToken((n) => n + 1);
      return;
    }

    submittingRef.current = true;
    setPhase("submitting");
    let succeeded = false;
    try {
      const res = await fetch(APPLICATIONS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && isSubmitSuccess(body)) {
        succeeded = true;
        writeDraft(draftKey, null);
        setServerErrors({});
        setResult({
          statusUrl: new URL(body.statusUrl, window.location.origin).href,
          snapshot: state,
          replay: body.replay === true,
        });
        setPhase("success");
        return;
      }
      failWith(res.ok ? 500 : res.status, body as Partial<SubmitFailure> | null, res.headers.get("retry-after"));
    } catch {
      failWith(0, null, null);
    } finally {
      submittingRef.current = false;
      if (!succeeded) setPhase("idle");
    }
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  if (phase === "success" && result) {
    const snap = result.snapshot;
    const first = effectiveFirstChoice(snap);
    const ordered = [first, ...catalog.mentors.map((m) => m.id).filter((id) => id !== first && snap.mentorIds.includes(id))];
    const names = ordered.flatMap((id) => catalog.mentors.find((m) => m.id === id)?.name ?? []);
    return (
      <div ref={topRef}>
        <Confirmation
          ref={confirmationHeadingRef}
          firstName={snap.fullName.trim().split(/\s+/u)[0] ?? ""}
          email={snap.email.trim().toLowerCase()}
          statusUrl={result.statusUrl}
          mentorNames={names}
          replay={result.replay}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  const disabled = Boolean(closed);
  const submitting = phase === "submitting";
  const err = (key: string) => visibleErrors[key];
  const team = state.participation === "team";
  const domain = emailDomains[0] ?? "illinois.edu";

  return (
    <div ref={topRef}>
      {submitAttempted && summaryItems.length > 0 ? (
        <div className="mb-10 max-w-2xl">
          <ErrorSummary ref={summaryRef} title={SUBMIT_COPY.validationTitle} items={summaryItems} onJump={jumpTo} />
        </div>
      ) : null}

      <div role="status">
        {notice?.kind === "top" || notice?.kind === "merge" ? (
          <p
            key={notice.id}
            id={notice.kind === "merge" ? "apply-merge-notice" : undefined}
            tabIndex={notice.kind === "merge" ? -1 : undefined}
            className="animate-fade-up mb-10 flex max-w-2xl items-start gap-3 rounded-md bg-accent-soft px-4 py-3 text-[0.9375rem] leading-relaxed text-text focus:outline-none"
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent-strong" />
            <span>{notice.message}</span>
          </p>
        ) : null}
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        aria-labelledby="apply-heading"
        aria-describedby={disabled ? "apply-closed-notice" : undefined}
        aria-busy={submitting || undefined}
      >
        <fieldset disabled={disabled} className={cn("min-w-0", disabled && "opacity-60")}>
          {/* About you ------------------------------------------------------------------ */}
          <FormGroup id="about" description="So we know who you are and how to reach you.">
            <TextField
              id={fieldId("fullName")}
              label="Full name"
              autoComplete="name"
              value={state.fullName}
              maxLength={LIMITS.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              onBlur={() => touch("fullName")}
              error={err("fullName")}
            />
            <TextField
              id={fieldId("email")}
              label="Illinois email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder={`netid@${domain}`}
              value={state.email}
              onChange={(e) => update("email", e.target.value)}
              onBlur={() => touch("email")}
              error={err("email")}
            />
            <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
              <SelectField
                id={fieldId("year")}
                label="Year"
                placeholder="Choose your year"
                options={YEAR_OPTIONS}
                value={state.year}
                onChange={(e) => {
                  update("year", e.target.value);
                  setTouched((prev) => new Set(prev).add("year"));
                }}
                onBlur={() => touch("year")}
                error={err("year")}
              />
              <TextField
                id={fieldId("major")}
                label="Major"
                placeholder="e.g. Computer Engineering"
                value={state.major}
                maxLength={LIMITS.major}
                onChange={(e) => update("major", e.target.value)}
                onBlur={() => touch("major")}
                error={err("major")}
              />
            </div>
            <fieldset aria-describedby={err("participation") ? errorId(fieldId("participation")) : undefined}>
              <Label as="legend">Are you applying individually or with a team?</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {PARTICIPATION_OPTIONS.map((option) => (
                  <RadioChip
                    key={option.value}
                    id={fieldId(`participation-${option.value}`)}
                    name="participation"
                    value={option.value}
                    checked={state.participation === option.value}
                    onChange={() => update("participation", option.value)}
                    invalid={Boolean(err("participation"))}
                    errorMessageId={errorId(fieldId("participation"))}
                  >
                    {option.label}
                  </RadioChip>
                ))}
              </div>
              <FieldError id={fieldId("participation")}>{err("participation")}</FieldError>
            </fieldset>
            {team ? (
              <div className="animate-fade-up grid gap-x-5 gap-y-7 sm:grid-cols-2">
                <TextField
                  id={fieldId("teamName")}
                  label="Team name"
                  optional
                  value={state.teamName}
                  maxLength={LIMITS.teamName}
                  onChange={(e) => update("teamName", e.target.value)}
                  onBlur={() => touch("teamName")}
                  error={err("teamName")}
                />
                <TextField
                  id={fieldId("teammates")}
                  label="Teammates"
                  optional
                  placeholder="e.g. Priya Shah, Jordan Lee"
                  value={state.teammates}
                  maxLength={LIMITS.teammates}
                  onChange={(e) => update("teammates", e.target.value)}
                  onBlur={() => touch("teammates")}
                  error={err("teammates")}
                />
              </div>
            ) : null}
          </FormGroup>

          {/* Your interests -------------------------------------------------------------- */}
          <FormGroup id="interests" description="Who you’d like to meet, when you’re free and what you’d like to talk about.">
            <MentorPicker
              catalog={catalog}
              profiles={profiles}
              state={state}
              error={err("mentorIds")}
              highlightId={highlightId}
              onToggle={toggleMentor}
              onLeave={() => touch("mentorIds")}
            />
            <FirstChoicePicker
              catalog={catalog}
              state={state}
              error={err("firstChoiceMentorId")}
              onChoose={(id) => update("firstChoiceMentorId", id)}
              onLeave={() => touch("firstChoiceMentorId")}
            />
            <AvailabilityFields
              catalog={catalog}
              presentations={presentations}
              state={state}
              errors={visibleErrors}
              onToggleOption={toggleOption}
              onNotesChange={(value) => {
                setState((prev) => ({ ...prev, availabilityNotes: value }));
                markChanged("availabilityNotes", "availability");
              }}
              onLeave={(key) => touch(key)}
            />
            <fieldset
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) touch("stage");
              }}
              aria-describedby={err("stage") ? errorId(fieldId("stage")) : undefined}
            >
              <Label as="legend">Where is your idea or startup right now?</Label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {STAGE_OPTIONS.map((option) => (
                  <RadioChip
                    key={option.value}
                    id={fieldId(`stage-${option.value}`)}
                    name="stage"
                    value={option.value}
                    checked={state.stage === option.value}
                    onChange={() => update("stage", option.value)}
                    invalid={Boolean(err("stage"))}
                    errorMessageId={errorId(fieldId("stage"))}
                    description={option.description}
                  >
                    {option.label}
                  </RadioChip>
                ))}
              </div>
              <FieldError id={fieldId("stage")}>{err("stage")}</FieldError>
            </fieldset>
            <WordCountTextarea
              id={fieldId("workingOn")}
              label="What are you working on or exploring?"
              hint="A few sentences is enough (100 words max)."
              wordLimit={LIMITS.longAnswerWords}
              value={state.workingOn}
              onChange={(e) => update("workingOn", e.target.value)}
              onBlur={() => touch("workingOn")}
              error={err("workingOn")}
            />
            <WordCountTextarea
              id={fieldId("question")}
              label="What question would you like help with?"
              hint="A few sentences is enough (100 words max)."
              wordLimit={LIMITS.longAnswerWords}
              value={state.question}
              onChange={(e) => update("question", e.target.value)}
              onBlur={() => touch("question")}
              error={err("question")}
            />
            <TextField
              id={fieldId("link")}
              label="Website or demo link"
              optional
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://"
              value={state.link}
              maxLength={LIMITS.link}
              onChange={(e) => update("link", e.target.value)}
              onBlur={() => {
                const normalized = normalizeLink(state.link);
                if (normalized !== state.link) setState((prev) => ({ ...prev, link: normalized }));
                touch("link");
              }}
              error={err("link")}
            />
          </FormGroup>

          {/* Submit ---------------------------------------------------------------------- */}
          <FormGroup id="submit" description="Two quick confirmations, then you’re done.">
            <div className="space-y-1">
              <CheckboxRow
                id={fieldId("acknowledgeNoGuarantee")}
                checked={state.acknowledgeNoGuarantee}
                onChange={(e) => update("acknowledgeNoGuarantee", e.target.checked)}
                onBlur={() => touch("acknowledgeNoGuarantee")}
                error={err("acknowledgeNoGuarantee")}
              >
                I understand that applying doesn’t guarantee an appointment.
              </CheckboxRow>
              <CheckboxRow
                id={fieldId("consentToShare")}
                checked={state.consentToShare}
                onChange={(e) => update("consentToShare", e.target.checked)}
                onBlur={() => touch("consentToShare")}
                error={err("consentToShare")}
              >
                I agree that Founders may share my relevant answers with the mentor(s) I’m matched with.
              </CheckboxRow>
            </div>

            <div className="space-y-5 pt-1">
              {banner ? (
                <div ref={bannerRef} tabIndex={-1} className="focus:outline-none">
                  <Notice tone={banner.tone} title={banner.title} role="alert">
                    <p>{banner.message}</p>
                    {banner.retry && !disabled ? (
                      <Button
                        variant="secondary"
                        className="mt-3 h-11 bg-surface"
                        disabled={submitting}
                        onClick={() => formRef.current?.requestSubmit()}
                      >
                        Try again
                      </Button>
                    ) : null}
                  </Notice>
                </div>
              ) : null}
              <Button
                type="submit"
                size="lg"
                variant={disabled ? "secondary" : "primary"}
                disabled={disabled || submitting}
                className="w-full px-6 font-semibold sm:w-auto sm:min-w-56"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Submitting…
                  </>
                ) : disabled ? (
                  <>
                    <AlertIcon className="size-4" />
                    Submissions unavailable
                  </>
                ) : (
                  <>
                    Submit application
                    <ArrowRightIcon className="size-4" />
                  </>
                )}
              </Button>
              <p className="sr-only" aria-live="polite">
                {submitting ? "Submitting your application…" : ""}
              </p>
            </div>
          </FormGroup>
        </fieldset>

        {/* Honeypot: invisible to people and assistive tech; bots fill it in. Never saved. */}
        <div aria-hidden="true" className="absolute -left-[10000px] top-auto size-px overflow-hidden">
          <label htmlFor="apply-nickname">Nickname</label>
          <input
            id="apply-nickname"
            name="nickname"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={state.nickname}
            onChange={(e) => setState((prev) => ({ ...prev, nickname: e.target.value }))}
          />
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One of the three groups: heading on the left from lg, fields in a comfortable column. */
function FormGroup({ id, description, children }: { id: FormGroupId; description?: ReactNode; children: ReactNode }) {
  const group = FORM_GROUPS.find((g) => g.id === id)!;
  const domId = groupDomId(id);
  return (
    <div
      id={domId}
      className="border-t border-line py-10 first:border-t-0 first:pt-0 last:pb-0 md:py-12 md:first:pt-0 md:last:pb-0 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-16"
    >
      <div className="mb-7 lg:mb-0">
        <h3 id={`${domId}-title`} className="text-lg font-semibold tracking-tight text-text">
          {group.title}
        </h3>
        {description ? <p className="mt-1 text-sm leading-relaxed text-text-subtle">{description}</p> : null}
      </div>
      <div className="min-w-0 max-w-2xl space-y-8">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-text/25 border-t-text motion-reduce:animate-none"
    />
  );
}
