/**
 * The POST /api/applications contract, shared by the route (lib/applications/submit.ts) and the
 * browser form. Pure — safe on server and client.
 */

export const APPLICATIONS_ENDPOINT = "/api/applications";

/** Largest request body the API accepts. The form's longest answers fit well under this. */
export const MAX_APPLICATION_BODY_BYTES = 32 * 1024;

export type SubmitErrorCode =
  | "forbidden"
  | "unsupported-media-type"
  | "too-large"
  | "invalid-json"
  | "validation"
  | "rejected"
  | "rate-limited"
  | "closed"
  | "unavailable"
  | "server-error";

export interface SubmitSuccess {
  ok: true;
  id: string;
  /** Site-relative private status link, e.g. "/apply/status/<token>". */
  statusUrl: string;
  /** True when this idempotency key was already stored (retry or double submit). */
  replay: boolean;
}

export interface SubmitFailure {
  ok: false;
  error: SubmitErrorCode;
  message: string;
  title?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export type SubmitResponse = SubmitSuccess | SubmitFailure;

/** Student-facing copy for failures. The server's `message` is preferred when present. */
export const SUBMIT_COPY = {
  networkOrServer: "We couldn’t submit your application. Your answers are still here, so please try again.",
  validationTitle: "Please fix the highlighted answers",
  rejected: "We couldn’t accept this submission. Check your answers and try again in a moment.",
  forbidden: "This submission was blocked for security reasons. Reload the page and try again.",
  tooLarge: "Your answers are too long to send. Shorten them a bit and try again.",
  unavailable: "We can’t save applications right now. Your answers are still here, so try again in a little while.",
  closed: "We aren’t taking office-hours applications right now.",
} as const;

/** "about 20 minutes", "about 3 hours" — for rate-limit messages. */
export function describeWait(seconds: number): string {
  if (seconds < 90) return "a minute or two";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * `email`: this student already has several saved applications today. `network`: many
 * applications came from the same network (e.g. campus Wi-Fi) in the last hour.
 */
export function rateLimitMessage(retryAfterSeconds: number, kind: "email" | "network" = "email"): string {
  const wait = describeWait(retryAfterSeconds);
  return kind === "network"
    ? `A lot of applications just came from your network. Please wait ${wait} and try again. Your answers are still here.`
    : `You’ve already sent several applications today. Please wait ${wait} and try again. Your answers are still here.`;
}

/** Narrow an unknown JSON body to a success response (must carry an id and a status link). */
export function isSubmitSuccess(body: unknown): body is SubmitSuccess {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    b.ok === true &&
    typeof b.id === "string" &&
    b.id.length > 0 &&
    typeof b.statusUrl === "string" &&
    b.statusUrl.startsWith("/apply/status/")
  );
}
