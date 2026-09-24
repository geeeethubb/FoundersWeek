"use client";

/**
 * The office-hours application, embedded at /office-hours#apply: six numbered steps, one
 * submission for every mentor a student picks.
 *
 * - Validation uses the SAME zod schema as the API (createApplicationSchema). A field shows its
 *   error once the student has changed it and moved on, then live; everything shows on submit.
 * - Submission is idempotent: one key per form session, reused across retries. Success is shown
 *   ONLY when the server answers ok with an application id; after any failure the answers stay.
 * - Mentor CTAs elsewhere on the page link to `/office-hours?mentor=<id>[&window|slot=<id>]#apply`.
 *   The first render is prefilled on the server; when those parameters change while the form is
 *   open, the selection is MERGED into the current answers (nothing is cleared), announced in a
 *   live region, and the mentor's card is brought into view.
 */
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { AlertIcon, ArrowRightIcon, InfoIcon, LockIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Notice } from "@/components/ui/primitives";
import {
  APPLICATIONS_ENDPOINT,
  SUBMIT_COPY,
  isSubmitSuccess,
  rateLimitMessage,
  type SubmitFailure,
} from "@/lib/applications/api-contract";
import type { ApplicationCatalog } from "@/lib/applications/catalog";
import {
  APPLICATION_COPY,
  LIMITS,
  PARTICIPATION_OPTIONS,
  STAGE_OPTIONS,
  YEAR_OPTIONS,
} from "@/lib/applications/constants";
import {
  mergeSearchParams,
  prefillParamsFrom,
  prefillParamsKey,
  type ApplicationPrefill,
  type ApplySearchParams,
} from "@/lib/applications/prefill";
import { emptyApplicationValues, normalizeLink } from "@/lib/applications/schema";
import { cn } from "@/lib/cn";
import { APPLY_ANCHOR, APPLY_PATH } from "@/lib/schedule/entries";
import { Confirmation, type ConfirmedMentor } from "./confirmation";
import {
  CheckboxRow,
  ChoiceIndicator,
  Legend,
  SelectField,
  TextAreaField,
  TextField,
  WordCountTextarea,
  WRAPPED_FOCUS,
} from "./controls";
import { ErrorSummary, type SummaryItem } from "./error-summary";
import {
  PLACEHOLDER_KEY,
  SECTIONS,
  SECTION_COUNT,
  SUBMIT_BLOCK_ID,
  createValidator,
  effectiveAvailability,
  effectiveFirstChoice,
  fieldId,
  focusTargetId,
  mentorCheckboxId,
  mentorRowId,
  mergeAnnouncement,
  newIdempotencyKey,
  orderErrors,
  prefillNote,
  sectionDomId,
  sectionProgress,
  toSubmissionValues,
  type FieldErrors,
  type FormState,
  type SectionDef,
  type SectionId,
} from "./form-model";
import { FirstChoiceTag, MentorSection, present, type ApplyMentorProfiles, type OptionPresentations } from "./mentor-section";
import { ProgressPanel, ReviewChecklist, type PanelMentor } from "./progress-panel";

export interface ApplicationFormProps {
  catalog: ApplicationCatalog;
  emailDomains: string[];
  /** Server-computed label/detail/line style per option key. */
  presentations: OptionPresentations;
  /** Verified role/company/headshot per mentor id, for the portraits. */
  profiles: ApplyMentorProfiles;
  /** Selection resolved on the server from the URL of the first render. */
  prefill: ApplicationPrefill;
  /** Set when submissions are closed: the form is shown for preview but disabled. */
  closed: { title: string; message: string } | null;
  deadlineLabel: string | null;
}

type Banner = { tone: "danger" | "warning"; title: string; message: string; retry: boolean };

type SuccessResult = { statusUrl: string; submittedAt: string; snapshot: FormState };

type SelectionNotice = { id: number; kind: "prefill" | "merge"; message: string; mentorId: string };

const MENTOR_ERROR_KEYS = (key: string) =>
  key === "mentorIds" || key === "firstChoiceMentorId" || key === "availability" || key.startsWith("availability.");

function initialState(prefill: ApplicationPrefill): FormState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, elapsedMs, ...empty } = emptyApplicationValues("");
  return { ...empty, ...prefill };
}

function sectionDef(id: SectionId): SectionDef {
  return SECTIONS.find((s) => s.id === id)!;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ApplicationForm({
  catalog,
  emailDomains,
  presentations,
  profiles,
  prefill,
  closed,
  deadlineLabel,
}: ApplicationFormProps) {
  const validate = useMemo(() => createValidator(catalog, emailDomains), [catalog, emailDomains]);
  const byId = useMemo(() => new Map(catalog.mentors.map((m) => [m.id, m])), [catalog]);

  const [state, setState] = useState<FormState>(() => initialState(prefill));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [banner, setBanner] = useState<Banner | null>(null);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [summaryFocusToken, setSummaryFocusToken] = useState(0);
  const [bannerFocusToken, setBannerFocusToken] = useState(0);
  const [notice, setNotice] = useState<SelectionNotice | null>(() => {
    const message = prefillNote(catalog, prefill, presentations);
    return message && prefill.mentorIds[0] ? { id: 0, kind: "prefill", message, mentorId: prefill.mentorIds[0] } : null;
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const mountedAtRef = useRef(0);
  const submittingRef = useRef(false);
  const changedRef = useRef(new Set<string>());
  const summaryRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ---------------------------------------------------------------------------
  // Prefill merges: the URL's mentor/window/slot changed while the form is open
  // ---------------------------------------------------------------------------

  const searchParams = useSearchParams();
  const urlParams = prefillParamsFrom(searchParams);
  const urlParamsKey = prefillParamsKey(urlParams);
  const [seenParamsKey, setSeenParamsKey] = useState(urlParamsKey);
  // A CTA whose URL equals the current one doesn't change the URL; the click listener queues it.
  const [queuedParams, setQueuedParams] = useState<ApplySearchParams | null>(null);

  /** Render-phase merge (React's "adjust state when inputs change" pattern). */
  function mergeFrom(params: ApplySearchParams) {
    if (phase === "success") return;
    const merged = mergeSearchParams(state, catalog, params);
    if (!merged.outcome) return;
    if (merged.changed) {
      setState(merged.state);
      setServerErrors((prev) => {
        const keys = Object.keys(prev).filter(MENTOR_ERROR_KEYS);
        if (!keys.length) return prev;
        const next = { ...prev };
        for (const key of keys) delete next[key];
        return next;
      });
    }
    setNotice((prev) => ({
      id: (prev?.id ?? 0) + 1,
      kind: "merge",
      message: mergeAnnouncement(catalog, merged.outcome!, presentations),
      mentorId: merged.outcome!.mentorId,
    }));
    setHighlightId(merged.outcome.mentorId);
  }

  if (urlParamsKey !== seenParamsKey) {
    setSeenParamsKey(urlParamsKey);
    mergeFrom(urlParams);
  }
  if (queuedParams) {
    setQueuedParams(null);
    mergeFrom(queuedParams);
  }

  // Same-page CTAs pointing at the URL we're already on: handle them here (Next wouldn't
  // navigate, so the URL — and useSearchParams — wouldn't change).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== APPLY_PATH) return;
      if (window.location.pathname !== APPLY_PATH || url.hash !== `#${APPLY_ANCHOR}`) return;
      if (url.search !== window.location.search) return; // a real navigation — merged when the URL changes
      const params = prefillParamsFrom(url.searchParams);
      if (!prefillParamsKey(params).replace(/\|/g, "")) return;
      event.preventDefault();
      setQueuedParams(params);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // After a merge: bring the mentor's card into view and put focus on its checkbox.
  const mergedNoticeId = notice?.kind === "merge" ? notice.id : 0;
  const mergedMentorId = notice?.kind === "merge" ? notice.mentorId : null;
  useEffect(() => {
    if (!mergedNoticeId || !mergedMentorId) return;
    // Next.js applies its own #apply scroll in the same commit; run after it.
    const frame = requestAnimationFrame(() => {
      const row = document.getElementById(mentorRowId(mergedMentorId));
      const note = document.getElementById("apply-selection-notice");
      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      if (row && note) {
        // Keep the "added" message AND the mentor's card on screen together when they fit;
        // otherwise center the card (the live region still announces the message).
        const headerOffset = 96;
        const noteTop = note.getBoundingClientRect().top;
        const span = row.getBoundingClientRect().bottom - noteTop;
        if (span < window.innerHeight - headerOffset - 24) {
          window.scrollTo({ top: window.scrollY + noteTop - headerOffset, behavior });
        } else {
          row.scrollIntoView({ block: "center", behavior });
        }
      } else {
        row?.scrollIntoView({ block: "center", behavior });
      }
      document.getElementById(mentorCheckboxId(mergedMentorId))?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [mergedNoticeId, mergedMentorId]);

  // The outline on a just-added mentor fades after a moment.
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightId, mergedNoticeId]);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  // One idempotency key per form session, kept across retries.
  useEffect(() => {
    idempotencyKeyRef.current ??= newIdempotencyKey();
    mountedAtRef.current = Date.now();
  }, []);

  // Warn before leaving with unsaved answers.
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
      orderErrors(
        visibleErrors,
        catalog.mentors.map((m) => m.id),
      ).map(([key, message]) => ({
        key,
        message,
        targetId: focusTargetId(key, state, catalog),
      })),
    [visibleErrors, state, catalog],
  );

  const progress = useMemo(() => sectionProgress(state, allErrors), [state, allErrors]);

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
      const firstChoiceMentorId = mentorIds.includes(current)
        ? current
        : mentorIds.length === 1
          ? mentorIds[0]
          : "";
      return { ...prev, mentorIds, firstChoiceMentorId };
    });
    markChanged("mentorIds", "firstChoiceMentorId", "availability", `availability.${mentorId}`);
  }

  function toggleOption(key: string, checked: boolean) {
    setState((prev) => ({
      ...prev,
      availability: checked ? [...prev.availability.filter((k) => k !== key), key] : prev.availability.filter((k) => k !== key),
    }));
    const owner = catalog.mentors.find((m) => m.options.some((o) => o.key === key));
    markChanged("availability", ...(owner ? [`availability.${owner.id}`] : []));
  }

  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const block = el.tagName === "SECTION" || id === SUBMIT_BLOCK_ID ? "start" : "center";
    const anchor = block === "start" ? el : (el.closest("label") ?? el);
    anchor.scrollIntoView({ block, behavior: prefersReducedMotion() ? "auto" : "smooth" });
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
      next = {
        tone: "warning",
        title: "Too many attempts",
        message: body?.message ?? rateLimitMessage(retry || 600),
        retry: false,
      };
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
    const elapsedMs = Math.max(0, Math.round(Date.now() - (mountedAtRef.current || Date.now())));
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
        setServerErrors({});
        setResult({
          statusUrl: new URL(body.statusUrl, window.location.origin).href,
          submittedAt: new Date().toISOString(),
          snapshot: state,
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
    const picked = new Set(effectiveAvailability(snap, catalog));
    const ordered = [first, ...catalog.mentors.map((m) => m.id).filter((id) => id !== first && snap.mentorIds.includes(id))];
    const mentors: ConfirmedMentor[] = ordered.flatMap((id) => {
      const m = byId.get(id);
      if (!m) return [];
      const profile = profiles[m.id];
      const identity = profile ? [profile.role, profile.company].filter(Boolean).join(" · ") || null : m.affiliation;
      return [
        {
          id: m.id,
          name: m.name,
          identity,
          headshot: profile?.headshot ?? null,
          demo: m.demo,
          firstChoice: m.id === first,
          interestOnly: m.options.length === 0,
          options: m.options
            .filter((o) => picked.has(o.key))
            .map((o) => ({ key: o.key, ...present(o, presentations) })),
        },
      ];
    });
    return (
      <div ref={topRef}>
        <Confirmation
          ref={confirmationHeadingRef}
          firstName={snap.fullName.trim().split(/\s+/u)[0] ?? ""}
          email={snap.email.trim().toLowerCase()}
          statusUrl={result.statusUrl}
          submittedAt={result.submittedAt}
          mentors={mentors}
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
  const first = effectiveFirstChoice(state);
  const chosen = new Set(state.availability);
  const panelMentors: PanelMentor[] = catalog.mentors
    .filter((m) => state.mentorIds.includes(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      headshot: profiles[m.id]?.headshot ?? null,
      firstChoice: first === m.id,
      interestOnly: m.options.length === 0,
      times: m.options.filter((o) => chosen.has(o.key)).length,
    }))
    .sort((a, b) => Number(b.firstChoice) - Number(a.firstChoice));
  const domainHint = emailDomains.map((d) => `@${d}`).join(" or ");

  return (
    <div
      ref={topRef}
      className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_15.5rem] xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-16"
    >
      <div className="min-w-0">
        {submitAttempted && summaryItems.length > 0 ? (
          <div className="mb-10">
            <ErrorSummary ref={summaryRef} title={SUBMIT_COPY.validationTitle} items={summaryItems} onJump={jumpTo} />
          </div>
        ) : null}

        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          aria-labelledby="apply-heading"
          aria-describedby={disabled ? "apply-closed-notice" : undefined}
          aria-busy={submitting || undefined}
          className="relative"
        >
          <fieldset disabled={disabled} className={cn("min-w-0", disabled && "opacity-60")}>
            <legend className="sr-only">Office Hours application</legend>

            {/* 01 Mentors & times ----------------------------------------------------- */}
            <FormSection
              def={sectionDef("mentors")}
              description="Choose who you’d like to meet — one application covers every mentor — then the times that work for you."
            >
              <div aria-live="polite" aria-atomic="true">
                {notice ? (
                  <p
                    key={notice.id}
                    id="apply-selection-notice"
                    className="animate-fade-up mb-6 flex items-start gap-3 border-l-2 border-accent bg-accent-soft/60 py-3 pl-4 pr-4 text-sm leading-relaxed text-paper"
                  >
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{notice.message}</span>
                  </p>
                ) : null}
              </div>
              <MentorSection
                catalog={catalog}
                presentations={presentations}
                profiles={profiles}
                state={state}
                errors={visibleErrors}
                highlightId={highlightId}
                onToggleMentor={toggleMentor}
                onFirstChoice={(id) => update("firstChoiceMentorId", id)}
                onToggleOption={toggleOption}
                onGroupLeave={touch}
              />
              <TextAreaField
                className="mt-8"
                id={fieldId("availabilityNotes")}
                label="Anything about your schedule?"
                optional
                placeholder="e.g. Class until 10:50 on Thursday"
                value={state.availabilityNotes}
                maxLength={LIMITS.availabilityNotes}
                onChange={(e) => update("availabilityNotes", e.target.value)}
                onBlur={() => touch("availabilityNotes")}
                hint="Conflicts, a preferred time, travel — anything that helps Founders schedule you."
                error={err("availabilityNotes")}
              />
            </FormSection>

            {/* 02 About you ------------------------------------------------------------ */}
            <FormSection def={sectionDef("about")} description="So Founders knows who’s applying and how to reach you.">
              <div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
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
                  placeholder={`netid${domainHint.split(" ")[0]}`}
                  value={state.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={() => touch("email")}
                  hint={`Your ${domainHint} address — that’s where Founders will reach you.`}
                  error={err("email")}
                />
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
                  placeholder="e.g. Computer Engineering, or Undeclared"
                  value={state.major}
                  maxLength={LIMITS.major}
                  onChange={(e) => update("major", e.target.value)}
                  onBlur={() => touch("major")}
                  error={err("major")}
                />
              </div>
            </FormSection>

            {/* 03 Solo or team ------------------------------------------------------------ */}
            <FormSection def={sectionDef("team")} description="Office hours are open to solo founders and teams alike.">
              <fieldset>
                <Legend>Are you applying individually or with a team?</Legend>
                <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
                  {PARTICIPATION_OPTIONS.map((option) => {
                    const id = fieldId(`participation-${option.value}`);
                    return (
                      <label
                        key={option.value}
                        htmlFor={id}
                        className={cn(
                          "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-line-strong px-4 py-3 transition-colors duration-150 hover:border-paper/30",
                          "has-[input:checked]:border-accent has-[input:checked]:bg-ink-850",
                          WRAPPED_FOCUS,
                        )}
                      >
                        <input
                          id={id}
                          type="radio"
                          name="participation"
                          value={option.value}
                          className="peer sr-only"
                          checked={state.participation === option.value}
                          onChange={() => update("participation", option.value)}
                        />
                        <ChoiceIndicator type="radio" />
                        <span className="text-[0.9375rem] text-paper">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {state.participation === "team" ? (
                <div className="animate-fade-up mt-7 grid gap-x-6 gap-y-7 border-l border-line-strong pl-5 sm:grid-cols-2 sm:pl-6">
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
                    hint="Names only."
                    error={err("teammates")}
                  />
                </div>
              ) : null}
            </FormSection>

            {/* 04 Your project ---------------------------------------------------------- */}
            <FormSection
              def={sectionDef("project")}
              description="A few sentences is plenty. The mentor you’re matched with reads this to prepare."
            >
              <fieldset
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) touch("stage");
                }}
                aria-describedby={err("stage") ? `${fieldId("stage")}-error` : undefined}
              >
                <Legend>Where are you right now?</Legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STAGE_OPTIONS.map((option, i) => {
                    const id = fieldId(`stage-${option.value}`);
                    return (
                      <label
                        key={option.value}
                        htmlFor={id}
                        className={cn(
                          "relative flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border px-4 py-3.5 transition-colors duration-150",
                          err("stage") ? "border-danger/60" : "border-line-strong hover:border-paper/30",
                          "has-[input:checked]:border-accent has-[input:checked]:bg-ink-850",
                          WRAPPED_FOCUS,
                        )}
                      >
                        <input
                          id={id}
                          type="radio"
                          name="stage"
                          value={option.value}
                          className="peer sr-only"
                          checked={state.stage === option.value}
                          onChange={() => update("stage", option.value)}
                        />
                        <ChoiceIndicator type="radio" className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="text-[0.9375rem] font-medium text-paper">{option.label}</span>
                            <span aria-hidden className="font-mono text-[0.625rem] text-paper-subtle tabular">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-paper-subtle">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <FieldError id={fieldId("stage")}>{err("stage")}</FieldError>
              </fieldset>

              <div className="mt-10 space-y-9">
                <WordCountTextarea
                  id={fieldId("workingOn")}
                  label="What are you working on or interested in exploring?"
                  hint={
                    <>
                      For example: “An app that helps student orgs split costs” or “Nothing yet — I’m curious about
                      climate tech.”
                    </>
                  }
                  wordLimit={LIMITS.longAnswerWords}
                  value={state.workingOn}
                  onChange={(e) => update("workingOn", e.target.value)}
                  onBlur={() => touch("workingOn")}
                  error={err("workingOn")}
                />
                <WordCountTextarea
                  id={fieldId("question")}
                  label="What specific question or challenge would you like help with?"
                  hint={
                    <>
                      For example: “How do I know if anyone will pay for this?” or “How did you find your first
                      co-founder?”
                    </>
                  }
                  wordLimit={LIMITS.longAnswerWords}
                  value={state.question}
                  onChange={(e) => update("question", e.target.value)}
                  onBlur={() => touch("question")}
                  error={err("question")}
                />
              </div>
            </FormSection>

            {/* 05 Link ---------------------------------------------------------------- */}
            <FormSection
              def={sectionDef("links")}
              description="A website, demo or pitch deck gives a mentor context quickly. No deck? Skip this — it’s optional."
            >
              <TextField
                id={fieldId("link")}
                label="Website, demo or deck link"
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
                hint="Make sure anyone with the link can view it."
                error={err("link")}
                className="sm:max-w-xl"
              />
            </FormSection>

            {/* 06 Confirm -------------------------------------------------------------- */}
            <FormSection def={sectionDef("confirm")} description="Two quick confirmations and you’re done.">
              <div className="space-y-3">
                <CheckboxRow
                  id={fieldId("acknowledgeNoGuarantee")}
                  checked={state.acknowledgeNoGuarantee}
                  onChange={(e) => update("acknowledgeNoGuarantee", e.target.checked)}
                  onBlur={() => touch("acknowledgeNoGuarantee")}
                  error={err("acknowledgeNoGuarantee")}
                  description={APPLICATION_COPY.limited}
                >
                  I understand that applying doesn’t guarantee an appointment.
                </CheckboxRow>
                <CheckboxRow
                  id={fieldId("consentToShare")}
                  checked={state.consentToShare}
                  onChange={(e) => update("consentToShare", e.target.checked)}
                  onBlur={() => touch("consentToShare")}
                  error={err("consentToShare")}
                  description="Founders organizers review every application. Relevant answers go only to the mentor(s) you’re matched with."
                >
                  I agree that Founders may share my relevant answers with the mentor(s) I’m matched with so they can
                  prepare.
                </CheckboxRow>
              </div>

              {/* Honeypot: invisible to people and assistive tech; bots fill it in. */}
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
            </FormSection>
          </fieldset>

          {/* Review & submit ------------------------------------------------------------ */}
          <div
            id={SUBMIT_BLOCK_ID}
            tabIndex={-1}
            className="border-t border-line pt-10 focus:outline-none md:grid md:grid-cols-[4.5rem_minmax(0,1fr)]"
          >
            <p aria-hidden className="hidden font-mono text-sm text-accent md:block md:pt-1">
              →
            </p>
            <div className="min-w-0 space-y-6">
              <ReviewChecklist progress={progress} onJump={jumpTo} />

              {banner ? (
                <div ref={bannerRef} tabIndex={-1} className="focus:outline-none">
                  <Notice tone={banner.tone} title={banner.title} role="alert">
                    <p>{banner.message}</p>
                    {banner.retry && !disabled ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3 h-10"
                        disabled={submitting}
                        onClick={() => formRef.current?.requestSubmit()}
                      >
                        Try again
                      </Button>
                    ) : null}
                  </Notice>
                </div>
              ) : null}
              <div className="overflow-hidden rounded-sm border border-line-strong bg-ink-850">
                {panelMentors.length ? (
                  <div className="border-b border-line px-5 py-4 sm:px-6">
                    <p className="mono-label text-paper-subtle">You’re applying to meet</p>
                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                      {panelMentors.map((m) => (
                        <li key={m.id} className="flex min-w-0 items-center gap-2.5">
                          <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="xs" />
                          <span className="text-sm text-paper">{m.name}</span>
                          {m.firstChoice ? <FirstChoiceTag className="h-5 px-1.5 text-[0.625rem]" /> : null}
                          {m.interestOnly ? (
                            <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-paper-subtle">
                              Interest
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
                  {closed ? (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-paper">
                        <AlertIcon className="size-3.5 shrink-0 text-warning" />
                        {closed.title}
                      </p>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-paper-muted">{closed.message}</p>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-paper">
                        <LockIcon className="size-3.5 shrink-0 text-accent" />
                        One application, every mentor you chose
                      </p>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-paper-muted">
                        You’ll get a private link to check your status. {APPLICATION_COPY.noReservation}
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    variant={disabled ? "secondary" : "primary"}
                    disabled={disabled || submitting}
                    className={cn(
                      "h-13 w-full shrink-0 px-6 text-[1.0625rem] sm:w-auto sm:min-w-56",
                      disabled && "border-dashed",
                    )}
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
                </div>
              </div>
              <p className="sr-only" aria-live="polite">
                {submitting ? "Submitting your application…" : ""}
              </p>
            </div>
          </div>
        </form>
      </div>

      <aside aria-label="Application progress" className="hidden lg:block">
        <div className="sticky top-24">
          <ProgressPanel progress={progress} mentors={panelMentors} deadlineLabel={deadlineLabel} onJump={jumpTo} />
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function FormSection({ def, description, children }: { def: SectionDef; description?: ReactNode; children: ReactNode }) {
  const id = sectionDomId(def.id);
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="border-t border-line py-10 first-of-type:border-t-0 first-of-type:pt-0 focus:outline-none md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:py-14 md:first-of-type:pt-2"
    >
      <p aria-hidden className="mb-3 flex items-baseline gap-1.5 font-mono tabular md:mb-0 md:block md:pt-1.5">
        <span className="text-sm text-accent">{def.index}</span>
        <span className="text-xs text-paper-subtle md:mt-1 md:block">/ {SECTION_COUNT}</span>
      </p>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3
            id={`${id}-title`}
            className="font-wide text-[1.625rem] font-bold leading-tight tracking-[-0.025em] text-paper sm:text-[1.875rem]"
          >
            <span className="sr-only">
              Step {def.index} of {SECTION_COUNT}:{" "}
            </span>
            {def.title}
          </h3>
          {def.optional ? <span className="mono-label text-paper-subtle">Optional</span> : null}
        </div>
        {description ? <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-paper-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink motion-reduce:animate-none"
    />
  );
}
