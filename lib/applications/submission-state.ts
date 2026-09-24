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
      "Online applications aren’t available yet",
      "Submissions are turned off until this site’s secure storage is configured. Please check back soon.",
      "Set APP_SECRET (≥ 32 random characters). See README → Configuration.",
    );
  }
  const persistence = await getPersistenceStatus();
  if (!persistence.ready) {
    const notConfigured = persistence.reason === "not-configured";
    return closed(
      notConfigured ? "not-configured" : "database-unavailable",
      notConfigured ? "Online applications aren’t available yet" : "Applications are temporarily unavailable",
      notConfigured
        ? "Submissions are turned off until this site’s application database is configured. Please check back soon."
        : "We can’t save applications right now. Please try again in a little while.",
      `${persistence.detail} See README → Database.`,
    );
  }
  return { open: true, deadline };
}
