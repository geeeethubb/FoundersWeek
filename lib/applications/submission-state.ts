/**
 * Whether the office-hours application can accept submissions right now.
 * Used by /apply (to disable the form with an explanation) and enforced again by the API.
 */
import "server-only";
import { getSite } from "@/content";
import { getAppSecret, isNonProductionDeploy } from "@/lib/config";
import { getPersistenceStatus } from "@/lib/db/client";

export type SubmissionClosedReason =
  | "closed"
  | "not-yet-open"
  | "deadline-passed"
  | "not-configured"
  | "database-unavailable";

export type SubmissionState =
  | { open: true; deadline: string | null }
  | {
      open: false;
      reason: SubmissionClosedReason;
      /** Short student-facing heading. */
      title: string;
      /** Student-facing explanation. */
      message: string;
      /** Setup hint for organizers. Only populated outside production deploys. */
      organizerHint: string | null;
      deadline: string | null;
      opensAt: string | null;
    };

export async function getSubmissionState(now: Date = new Date()): Promise<SubmissionState> {
  const { applications } = getSite();
  const deadline = applications.deadline;
  const opensAt = applications.opensAt;
  const hintsAllowed = isNonProductionDeploy();
  const closed = (
    reason: SubmissionClosedReason,
    title: string,
    message: string,
    organizerHint: string | null = null,
  ): SubmissionState => ({
    open: false,
    reason,
    title,
    message,
    organizerHint: hintsAllowed ? organizerHint : null,
    deadline,
    opensAt,
  });

  if (!applications.open) {
    return closed(
      "closed",
      "Applications are closed",
      "The office-hours application isn’t accepting submissions right now.",
      "Set applications.open to true in content/site.ts to reopen.",
    );
  }
  if (opensAt && now < new Date(opensAt)) {
    return closed("not-yet-open", "Applications open soon", "The office-hours application isn’t open yet.");
  }
  if (deadline && now > new Date(deadline)) {
    return closed(
      "deadline-passed",
      "The application deadline has passed",
      "Thanks for your interest — the office-hours application is closed.",
    );
  }
  if (!getAppSecret()) {
    return closed(
      "not-configured",
      "Applications open soon",
      "The office-hours application is still being set up. Please check back shortly.",
      "APP_SECRET is missing or shorter than 32 characters. Add it in Vercel → Production, then redeploy. /api/health shows every setting.",
    );
  }
  // Never let a slow database hold up the page: after 8s treat it as temporarily unavailable
  // (the connection attempt keeps going in the background for the next request).
  const persistence = await Promise.race([
    getPersistenceStatus(),
    new Promise<Awaited<ReturnType<typeof getPersistenceStatus>>>((resolve) =>
      setTimeout(
        () => resolve({ ready: false, reason: "unreachable", detail: "The database is taking too long to respond." }),
        8_000,
      ),
    ),
  ]);
  if (!persistence.ready) {
    const notConfigured = persistence.reason === "not-configured";
    return closed(
      notConfigured ? "not-configured" : "database-unavailable",
      notConfigured ? "Applications open soon" : "Applications are temporarily unavailable",
      notConfigured
        ? "The office-hours application is still being set up. Please check back shortly."
        : "We can’t save applications right now. Please try again in a little while.",
      `${persistence.detail} See README → Database setup, or /api/health.`,
    );
  }
  return { open: true, deadline };
}
