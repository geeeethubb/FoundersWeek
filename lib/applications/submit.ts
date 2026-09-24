/**
 * POST /api/applications — the only way an application is stored.
 *
 * Never fakes success: `ok: true` is returned only after the transaction commits (201), or when
 * the same idempotency key was already committed (200 replay). Everything else is an honest
 * failure the form can explain while keeping the student's answers.
 *
 * Order of checks: origin → content type → size → submissions open → JSON → schema → spam
 * → idempotent replay → rate limits → one transaction → acknowledgment email (after commit,
 * best-effort, never affects the response).
 *
 * Logging never includes answers, names, emails or IPs.
 */
import "server-only";
import { getMentors as loadMentors, getSite as loadSite } from "@/content";
import type { Mentor, SiteSettings } from "@/content/types";
import { getSiteUrl } from "@/lib/config";
import { DatabaseUnavailableError, getDb as connectDb, type Database } from "@/lib/db/client";
import {
  sendApplicationAcknowledgment,
  type AcknowledgmentInput,
} from "@/lib/email/acknowledgment";
import { hashIdentifier } from "@/lib/security/crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { clientIp, isSameOriginRequest } from "@/lib/security/request";
import { statusPath } from "@/lib/security/status-token";
import {
  MAX_APPLICATION_BODY_BYTES,
  rateLimitMessage,
  SUBMIT_COPY,
  type SubmitFailure,
  type SubmitSuccess,
} from "./api-contract";
import { buildApplicationCatalog, parseOptionKey, type ApplicationCatalog } from "./catalog";
import { LIMITS } from "./constants";
import { findApplicationIdByIdempotencyKey, firstNameOf, insertApplication, type NewApplicationRecord } from "./repository";
import { createApplicationSchema, toFieldErrors, type ValidApplication } from "./schema";
import { getSubmissionState as loadSubmissionState, type SubmissionState } from "./submission-state";

export interface SubmitDeps {
  getDb: () => Promise<Database>;
  getSubmissionState: () => Promise<SubmissionState>;
  getMentors: () => Mentor[];
  getSite: () => SiteSettings;
  /** Runs work after the response is sent. The route passes Next's `after`. */
  schedule: (task: () => Promise<unknown>) => void;
  sendAcknowledgment: (input: AcknowledgmentInput) => Promise<unknown>;
  siteUrl: () => string;
  env: Record<string, string | undefined>;
}

const defaultDeps: SubmitDeps = {
  getDb: connectDb,
  getSubmissionState: () => loadSubmissionState(),
  getMentors: loadMentors,
  getSite: loadSite,
  schedule: (task) => {
    void task().catch(() => {});
  },
  sendAcknowledgment: (input) => sendApplicationAcknowledgment(input),
  siteUrl: getSiteUrl,
  env: process.env,
};

// ---------------------------------------------------------------------------
// Rate limits (documented in README → Configuration)
// ---------------------------------------------------------------------------

export const DEFAULT_RATE_LIMITS = { perIpPerHour: 10, perEmailPerDay: 5 } as const;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * APPLICATION_RATE_LIMIT_PER_HOUR (per IP, default 10) and
 * APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY (per Illinois email, default 5).
 */
export function getApplicationRateLimits(env: Record<string, string | undefined> = process.env) {
  return {
    perIpPerHour: positiveInt(env.APPLICATION_RATE_LIMIT_PER_HOUR, DEFAULT_RATE_LIMITS.perIpPerHour),
    perEmailPerDay: positiveInt(env.APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY, DEFAULT_RATE_LIMITS.perEmailPerDay),
  };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const NO_STORE = { "Cache-Control": "no-store" };

function respond(status: number, body: SubmitSuccess | SubmitFailure, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

function fail(status: number, error: SubmitFailure["error"], message: string, extra: Partial<SubmitFailure> = {}) {
  return respond(status, { ok: false, error, message, ...extra });
}

/** Log without PII: error class, driver code and constraint only. */
function logFailure(stage: string, error: unknown) {
  const e = error as { name?: string; code?: string; constraint?: string };
  console.error(
    `[applications] ${stage} failed: ${e?.name ?? "Error"}${e?.code ? ` code=${e.code}` : ""}${
      e?.constraint ? ` constraint=${e.constraint}` : ""
    }`,
  );
}

// ---------------------------------------------------------------------------
// Body reading with a hard cap
// ---------------------------------------------------------------------------

class BodyTooLargeError extends Error {}

async function readCappedText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Mapping a validated application to database rows
// ---------------------------------------------------------------------------

export function toApplicationRecord(
  data: ValidApplication,
  catalog: ApplicationCatalog,
  meta: { ipHash: string | null; userAgent: string | null },
): NewApplicationRecord {
  const others = data.mentorIds.filter((id) => id !== data.firstChoiceMentorId);
  const mentorIds = [data.firstChoiceMentorId, ...others];
  const availability = data.availability.flatMap((key) => {
    const parsed = parseOptionKey(key);
    const owner = catalog.mentors.find((m) => m.options.some((o) => o.key === key));
    return parsed && owner ? [{ mentorId: owner.id, kind: parsed.kind, optionId: parsed.id }] : [];
  });
  const isTeam = data.participation === "team";
  const referrer = catalog.mentors.some((m) => m.id === data.referrerMentorId) ? data.referrerMentorId : null;
  return {
    idempotencyKey: data.idempotencyKey,
    fullName: data.fullName,
    email: data.email,
    year: data.year,
    major: data.major,
    participation: data.participation,
    teamName: isTeam && data.teamName ? data.teamName : null,
    teammates: isTeam && data.teammates ? data.teammates : null,
    stage: data.stage,
    workingOn: data.workingOn,
    question: data.question,
    linkUrl: data.link || null,
    availabilityNotes: data.availabilityNotes || null,
    referrerMentorId: referrer,
    submittedIpHash: meta.ipHash,
    userAgent: meta.userAgent ? meta.userAgent.slice(0, 300) : null,
    mentorIds,
    availability,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleApplicationSubmission(
  request: Request,
  overrides: Partial<SubmitDeps> = {},
): Promise<Response> {
  const deps: SubmitDeps = { ...defaultDeps, ...overrides };

  if (!isSameOriginRequest(request)) return fail(403, "forbidden", SUBMIT_COPY.forbidden);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return fail(415, "unsupported-media-type", "Send the application as JSON.");
  }

  let raw: string;
  try {
    raw = await readCappedText(request, MAX_APPLICATION_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail(413, "too-large", SUBMIT_COPY.tooLarge);
    return fail(400, "invalid-json", SUBMIT_COPY.networkOrServer);
  }

  try {
    const state = await deps.getSubmissionState();
    if (!state.open) {
      const unavailable = state.reason === "not-configured" || state.reason === "database-unavailable";
      return unavailable
        ? fail(503, "unavailable", state.message, { title: state.title })
        : fail(403, "closed", state.message, { title: state.title });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail(400, "invalid-json", SUBMIT_COPY.networkOrServer);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail(400, "invalid-json", SUBMIT_COPY.networkOrServer);
    }

    const site = deps.getSite();
    const catalog = buildApplicationCatalog(deps.getMentors());
    const schema = createApplicationSchema({ catalog, emailDomains: site.applications.emailDomains });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "validation", SUBMIT_COPY.validationTitle, { fieldErrors: toFieldErrors(parsed.error) });
    }
    const data = parsed.data;

    // Spam: a filled honeypot or an impossibly fast submission. Nothing is stored, and we don't
    // pretend it worked.
    if (data.nickname.trim() !== "" || data.elapsedMs < LIMITS.minFillMs) {
      return fail(400, "rejected", SUBMIT_COPY.rejected);
    }

    const db = await deps.getDb();

    // Retries and double-clicks: same key → same application, no second row, no rate-limit cost.
    const existing = await findApplicationIdByIdempotencyKey(db, data.idempotencyKey);
    if (existing) {
      return respond(200, { ok: true, id: existing, statusUrl: statusPath(existing), replay: true });
    }

    const ip = clientIp(request);
    const limits = getApplicationRateLimits(deps.env);
    const perIp = await consumeRateLimit(db, {
      bucket: "application:ip",
      key: ip,
      limit: limits.perIpPerHour,
      windowSeconds: 60 * 60,
    });
    const perEmail = perIp.allowed
      ? await consumeRateLimit(db, {
          bucket: "application:email",
          key: data.email.trim().toLowerCase(),
          limit: limits.perEmailPerDay,
          windowSeconds: 24 * 60 * 60,
        })
      : perIp;
    if (!perEmail.allowed) {
      const retry = perEmail.retryAfterSeconds;
      return respond(
        429,
        { ok: false, error: "rate-limited", message: rateLimitMessage(retry), retryAfterSeconds: retry },
        { "Retry-After": String(retry) },
      );
    }

    const record = toApplicationRecord(data, catalog, {
      ipHash: ip === "unknown" ? null : hashIdentifier("ip", ip),
      userAgent: request.headers.get("user-agent"),
    });
    const { id, replay } = await insertApplication(db, record);
    const statusUrl = statusPath(id);

    // Committed. Acknowledge by email after the response — never for replays, never blocking.
    if (!replay) {
      const byId = new Map(catalog.mentors.map((m) => [m.id, m]));
      const ack: AcknowledgmentInput = {
        applicationId: id,
        to: data.email,
        firstName: firstNameOf(data.fullName),
        statusUrl: `${deps.siteUrl()}${statusUrl}`,
        siteName: site.name,
        orgName: site.org.name,
        mentors: record.mentorIds.map((mentorId) => ({
          name: byId.get(mentorId)?.name ?? mentorId,
          schedulingInProgress: byId.get(mentorId)?.scheduling === "in-progress",
        })),
      };
      try {
        deps.schedule(async () => {
          try {
            await deps.sendAcknowledgment(ack);
          } catch (error) {
            logFailure("acknowledgment email", error);
          }
        });
      } catch (error) {
        logFailure("scheduling acknowledgment email", error);
      }
    }

    return respond(replay ? 200 : 201, { ok: true, id, statusUrl, replay });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logFailure("database connection", error);
      return fail(503, "unavailable", SUBMIT_COPY.unavailable);
    }
    logFailure("submission", error);
    return fail(500, "server-error", SUBMIT_COPY.networkOrServer);
  }
}
