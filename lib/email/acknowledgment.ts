/**
 * "We received your application" email. An acknowledgment only — never an acceptance.
 * Sent after the application is committed, best-effort: a failure here never changes what the
 * applicant was told on screen.
 *
 * Says once that nothing is reserved (APPLICATION_COPY.noReservation), and once how long a session
 * is (from `site.officeHours`).
 */
import "server-only";
import { getEmailConfig } from "@/lib/config";
import { APPLICATION_COPY, SESSION_COPY, type SessionLength } from "@/lib/applications/constants";
import { INTEREST_COPY } from "@/lib/mentors";
import { sendEmail, type EmailConfig, type SendResult } from "./resend";

export interface AcknowledgmentInput {
  applicationId: string;
  to: string;
  firstName: string;
  /** Absolute URL of the private status page. */
  statusUrl: string;
  /** The event's short name, as it reads in a sentence ("Founders Week"). */
  siteName: string;
  orgName: string;
  /** The session rule (`site.officeHours`): how long each session is. */
  officeHours: SessionLength;
  /** Rank order; the first is the first choice. */
  mentors: { name: string; schedulingInProgress: boolean }[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAcknowledgmentEmail(input: AcknowledgmentInput): { subject: string; text: string; html: string } {
  const subject = "We received your office-hours application";
  const mentorLines = input.mentors.map((m, i) => {
    const notes = [i === 0 ? "first choice" : null, m.schedulingInProgress ? "scheduling in progress" : null].filter(Boolean);
    return notes.length ? `${m.name} (${notes.join(", ")})` : m.name;
  });
  // Mentors still scheduling get the follow-up promise; the no-reservation line is said once, last.
  const interestNote = input.mentors.some((m) => m.schedulingInProgress) ? INTEREST_COPY.followUp : null;

  const paragraphs = [
    `Hi ${input.firstName},`,
    `Thanks for applying for office hours during ${input.siteName}. We got your application.`,
    `${APPLICATION_COPY.limited} ${SESSION_COPY.email(input.officeHours)}`,
    interestNote,
    `This email is just a receipt. ${APPLICATION_COPY.noReservation}`,
  ].filter((p): p is string => Boolean(p));

  const text = [
    ...paragraphs,
    `Mentors you chose:\n${mentorLines.map((l) => `- ${l}`).join("\n")}`,
    `Check your status any time with your private link (keep it to yourself):\n${input.statusUrl}`,
    `Best,\n${input.orgName}`,
  ].join("\n\n");

  const p = (s: string) => `<p style="margin:0 0 16px">${escapeHtml(s)}</p>`;
  const html = [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#262626;max-width:560px">`,
    ...paragraphs.map(p),
    `<p style="margin:0 0 8px"><strong>Mentors you chose</strong></p>`,
    `<ul style="margin:0 0 16px;padding-left:20px">${mentorLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
    `<p style="margin:0 0 8px"><strong>Your private status link</strong> (keep it to yourself)</p>`,
    `<p style="margin:0 0 16px"><a href="${escapeHtml(input.statusUrl)}" style="color:#a35500">${escapeHtml(input.statusUrl)}</a></p>`,
    `<p style="margin:0 0 16px">Best,<br>${escapeHtml(input.orgName)}</p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}

/**
 * Send the acknowledgment if email is configured. Never throws; logs failures without PII.
 */
export async function sendApplicationAcknowledgment(
  input: AcknowledgmentInput,
  options: { config?: EmailConfig | null; fetchImpl?: typeof fetch } = {},
): Promise<SendResult | { ok: false; status: null; reason: "not-configured" }> {
  const config = options.config === undefined ? getEmailConfig() : options.config;
  if (!config) return { ok: false, status: null, reason: "not-configured" };
  try {
    const message = buildAcknowledgmentEmail(input);
    const result = await sendEmail(
      config,
      { to: input.to, ...message, idempotencyKey: `application-ack-${input.applicationId}` },
      { fetchImpl: options.fetchImpl },
    );
    if (!result.ok) console.error(`[email] acknowledgment not sent (${result.reason}${result.status ? ` ${result.status}` : ""})`);
    return result;
  } catch {
    console.error("[email] acknowledgment not sent (unexpected error)");
    return { ok: false, status: null, reason: "unexpected" };
  }
}
