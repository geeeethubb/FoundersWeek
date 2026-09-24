/**
 * Deployment "Setup" checklist for the organizer sign-in page (visible before sign-in) and the
 * dashboard. Renders `getSetupStatus()` (lib/setup-status.ts) — non-secret by construction: each
 * check is a setting name, ok/not ok, a short status and a fix. Never pass secret values, lengths,
 * connection strings or hosts in here.
 */
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { DataStoreStatus } from "@/lib/organizer/data-store-view";
import type { SetupCheck, SetupKey, SetupStatus } from "@/lib/setup-status";
import { formatInstant } from "@/lib/time";
import { Code } from "./bits";

export const SETUP_CHECK_LABELS: Record<SetupKey, { title: string; setting: string }> = {
  "app-secret": { title: "Signing secret", setting: "APP_SECRET" },
  database: { title: "Application database", setting: "DATABASE_URL or POSTGRES_URL" },
  "organizer-password": { title: "Organizer password", setting: "ORGANIZER_PASSWORD" },
  "applications-switch": { title: "Applications switch", setting: "applications.open in content/site.ts" },
};

/** Settings without which nobody can sign in (sessions are signed with APP_SECRET). */
const SIGN_IN_KEYS: readonly SetupKey[] = ["organizer-password", "app-secret"];

export function signInBlockers(status: SetupStatus): SetupCheck[] {
  return status.checks.filter((c) => SIGN_IN_KEYS.includes(c.key) && !c.ok);
}

/** "ok (local PGlite)" → "OK (local PGlite)"; "missing" → "Missing". */
function statusText(status: string): string {
  if (/^ok\b/i.test(status)) return `OK${status.slice(2)}`;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Fix text may name a command in backticks (`npm run db:migrate`). */
function withCode(text: string): React.ReactNode {
  return text.split(/`([^`]+)`/g).map((part, i) => (i % 2 ? <Code key={i}>{part}</Code> : part));
}

const DATA_STORE_TONE: Record<DataStoreStatus["state"], { dot: string; label: string }> = {
  live: { dot: "bg-success", label: "Live" },
  local: { dot: "bg-accent", label: "Local" },
  down: { dot: "bg-danger", label: "Offline" },
};

export function SetupChecklist({
  status,
  dataStore,
  id = "setup",
  className,
}: {
  status: SetupStatus;
  /** Dashboard only: which database the organizer view is reading, already redacted. */
  dataStore?: DataStoreStatus;
  id?: string;
  className?: string;
}) {
  const failing = status.checks.filter((c) => !c.ok);
  const total = status.checks.length;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("rounded-md border border-line bg-surface p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-lg font-semibold text-text">
          Setup
        </h2>
        <p className={cn("text-sm font-medium", failing.length ? "text-danger" : "text-success")}>
          {failing.length
            ? `${failing.length} of ${total} need${failing.length === 1 ? "s" : ""} attention`
            : `All ${total} checks pass`}
        </p>
      </div>

      {dataStore ? <DataStoreLine status={dataStore} /> : null}

      <ul className="mt-3 divide-y divide-line">
        {status.checks.map((check) => (
          <CheckRow key={check.key} check={check} />
        ))}
      </ul>

      {!status.applicationsOpen ? (
        <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-text-muted">
          Students can’t submit applications until the signing secret, database and applications switch are all set.
        </p>
      ) : null}
    </section>
  );
}

/** One line when the check passes; setting name and fix underneath when it doesn't. */
function CheckRow({ check }: { check: SetupCheck }) {
  const label = SETUP_CHECK_LABELS[check.key];
  return (
    <li className="flex gap-3 py-2.5">
      <span
        className={cn(
          "mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
          check.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        {check.ok ? <CheckIcon className="size-3" /> : <AlertIcon className="size-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-medium text-text" title={check.ok ? label.setting : undefined}>
            {label.title}
            <span className="sr-only">{check.ok ? ` (${label.setting}) is OK` : " needs attention"}</span>
          </p>
          <p className={cn("text-sm", check.ok ? "text-text-muted" : "font-medium text-danger")}>{statusText(check.status)}</p>
        </div>
        {check.ok ? null : (
          <>
            <p className="mt-1 text-xs text-text-subtle">
              <Code className="text-xs">{label.setting}</Code>
            </p>
            {check.fix ? <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{withCode(check.fix)}</p> : null}
          </>
        )}
      </div>
    </li>
  );
}

function DataStoreLine({ status }: { status: DataStoreStatus }) {
  const tone = DATA_STORE_TONE[status.state];
  return (
    <div className="mt-3 rounded-md bg-surface-subtle px-3.5 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", tone.dot)} />
        <span className="font-medium text-text">{status.headline}</span>
        <span className="text-text-subtle">· {status.provider}</span>
        <span className="sr-only">({tone.label})</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        {status.detail}{" "}
        <span className="whitespace-nowrap text-text-subtle">
          Checked <time dateTime={status.checkedAt}>{formatInstant(status.checkedAt)}</time>
        </span>
      </p>
      {status.hint ? <p className="mt-1 break-words text-xs leading-relaxed text-text-subtle">{status.hint}</p> : null}
    </div>
  );
}

/**
 * Shown instead of the sign-in form when a sign-in setting is missing: explains that nobody can
 * sign in until it's set (names only, never values).
 */
export function SignInUnavailable({ blockers, setupHref = "#setup" }: { blockers: SetupCheck[]; setupHref?: string }) {
  const names = blockers.map((b) => SETUP_CHECK_LABELS[b.key].setting);
  const plural = names.length > 1;
  return (
    <div role="status" className="rounded-md bg-warning-soft px-4 py-4 text-sm leading-relaxed">
      <p className="flex items-center gap-2 font-semibold text-text">
        <AlertIcon className="size-4 shrink-0 text-warning" />
        Sign-in isn’t available yet
      </p>
      <p className="mt-1.5 text-text-muted">
        Nobody can sign in until{" "}
        {names.map((n, i) => (
          <span key={n}>
            {i ? " and " : null}
            <Code>{n}</Code>
          </span>
        ))}{" "}
        {plural ? "are" : "is"} set correctly on this deployment and the site is redeployed. Organizer sign-in needs
        both the organizer password and the signing secret.
      </p>
      <p className="mt-2">
        <a href={setupHref} className="font-medium text-text underline underline-offset-4">
          See Setup for the fix
        </a>
      </p>
    </div>
  );
}
