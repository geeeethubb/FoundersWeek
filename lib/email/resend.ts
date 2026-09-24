/**
 * Minimal transactional email over Resend's HTTP API (https://resend.com/docs/api-reference).
 * No SDK: one fetch with a hard timeout. Callers treat email as best-effort.
 *
 * Never log message contents or recipients — only status codes.
 */
import "server-only";

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export const EMAIL_TIMEOUT_MS = 5000;

export interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Resend de-duplicates sends with the same key for 24 hours. */
  idempotencyKey?: string;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; status: number | null; reason: string };

export async function sendEmail(
  config: EmailConfig,
  message: EmailMessage,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SendResult> {
  const { fetchImpl = fetch, timeoutMs = EMAIL_TIMEOUT_MS } = options;
  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, reason: "http-error" };
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: body?.id ?? null };
  } catch (error) {
    const name = (error as Error)?.name;
    return { ok: false, status: null, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }
}
