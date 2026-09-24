/**
 * Application validation shared by the browser form and the API route. The server always
 * re-validates with the same schema against the same catalog — client checks are a courtesy.
 *
 * Error paths match form field names so errors can be attached to the right input.
 */
import { z } from "zod";
import { countWords } from "@/lib/words";
import type { ApplicationCatalog } from "./catalog";
import { mentorNeedsBroadAvailability, parseOptionKey } from "./catalog";
import { LIMITS, PARTICIPATION_OPTIONS, STAGE_OPTIONS, YEAR_OPTIONS } from "./constants";

/** Raw values as held by the form (all strings/booleans; nothing pre-parsed). */
export interface ApplicationFormValues {
  idempotencyKey: string;
  fullName: string;
  email: string;
  year: string;
  major: string;
  participation: string;
  teamName: string;
  teammates: string;
  stage: string;
  workingOn: string;
  question: string;
  mentorIds: string[];
  firstChoiceMentorId: string;
  availability: string[];
  availabilityNotes: string;
  link: string;
  acknowledgeNoGuarantee: boolean;
  consentToShare: boolean;
  /** Mentor profile the student arrived from, if any (analytics for organizers). */
  referrerMentorId: string;
  /** Honeypot. Real people never see or fill it. */
  nickname: string;
  /** Milliseconds between the form rendering and submission. */
  elapsedMs: number;
}

export type ApplicationFieldName = keyof ApplicationFormValues;

export function emptyApplicationValues(idempotencyKey: string): ApplicationFormValues {
  return {
    idempotencyKey,
    fullName: "",
    email: "",
    year: "",
    major: "",
    participation: "individual",
    teamName: "",
    teammates: "",
    stage: "",
    workingOn: "",
    question: "",
    mentorIds: [],
    firstChoiceMentorId: "",
    availability: [],
    availabilityNotes: "",
    link: "",
    acknowledgeNoGuarantee: false,
    consentToShare: false,
    referrerMentorId: "",
    nickname: "",
    elapsedMs: 0,
  };
}

const trimmed = (max: number, requiredMessage?: string) => {
  const base = z.string().trim().max(max, `Keep this under ${max} characters.`);
  return requiredMessage ? base.min(1, requiredMessage) : base;
};

const longAnswer = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(LIMITS.longAnswerChars, `Keep this under ${LIMITS.longAnswerChars} characters.`)
    .refine((v) => countWords(v) <= LIMITS.longAnswerWords, {
      message: `Keep this to ${LIMITS.longAnswerWords} words or fewer.`,
    });

/** Adds https:// when someone types "example.com". Empty stays empty. */
export function normalizeLink(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname.includes("."));
  } catch {
    return false;
  }
}

export function isAllowedEmail(email: string, domains: string[]): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domains.some((d) => domain === d.toLowerCase());
}

/** "Vik", "Vik and Ron", "Vik, Elliott and Ron". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function createApplicationSchema(options: { catalog: ApplicationCatalog; emailDomains: string[] }) {
  const { catalog, emailDomains } = options;
  const mentorsById = new Map(catalog.mentors.map((m) => [m.id, m]));
  const domainHint = emailDomains.map((d) => `@${d}`).join(" or ");

  return z
    .object({
      idempotencyKey: z.uuid("Something went wrong preparing the form. Reload the page and try again."),
      fullName: trimmed(LIMITS.fullName, "Enter your full name."),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, "Enter your Illinois email.")
        .max(254, "That email is too long.")
        .pipe(z.email(`Enter a valid email address ending in ${domainHint}.`))
        .refine((v) => isAllowedEmail(v, emailDomains), {
          message: `Use your Illinois email (ending in ${domainHint}).`,
        }),
      year: z.enum(YEAR_OPTIONS.map((o) => o.value) as [string, ...string[]], {
        error: "Choose your year.",
      }),
      major: trimmed(LIMITS.major, "Enter your major (or “Undeclared”)."),
      participation: z.enum(PARTICIPATION_OPTIONS.map((o) => o.value) as [string, ...string[]], {
        error: "Choose whether you’re applying individually or with a team.",
      }),
      teamName: trimmed(LIMITS.teamName),
      teammates: trimmed(LIMITS.teammates),
      stage: z.enum(STAGE_OPTIONS.map((o) => o.value) as [string, ...string[]], {
        error: "Choose the option that best describes where you are.",
      }),
      workingOn: longAnswer("Tell us what you’re working on or interested in exploring."),
      question: longAnswer("Tell us the question or challenge you’d like help with."),
      mentorIds: z
        .array(z.string())
        .min(1, "Choose at least one mentor.")
        .refine((ids) => new Set(ids).size === ids.length, { message: "Each mentor can only be chosen once." }),
      firstChoiceMentorId: z.string().min(1, "Choose your first-choice mentor."),
      availability: z.array(z.string()),
      availabilityNotes: trimmed(LIMITS.availabilityNotes),
      // Length is checked after normalizing, which may add "https://".
      link: z
        .string()
        .transform(normalizeLink)
        .pipe(z.string().max(LIMITS.link, `Keep links under ${LIMITS.link} characters.`))
        .refine((v) => v === "" || isHttpUrl(v), { message: "Enter a full link, like https://example.com." }),
      acknowledgeNoGuarantee: z.literal(true, {
        error: "Please confirm you understand that applying doesn’t guarantee an appointment.",
      }),
      consentToShare: z.literal(true, {
        error: "Please agree to share your answers with the mentor(s) you’re matched with.",
      }),
      referrerMentorId: z.string().max(100).optional().default(""),
      nickname: z.string().max(200).optional().default(""),
      elapsedMs: z.number().int().nonnegative().optional().default(0),
    })
    .superRefine((v, ctx) => {
      for (const id of v.mentorIds) {
        if (!mentorsById.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["mentorIds"],
            message: "One of the mentors you picked is no longer available. Check your choices.",
          });
          return;
        }
      }
      if (v.mentorIds.length && !v.mentorIds.includes(v.firstChoiceMentorId)) {
        ctx.addIssue({
          code: "custom",
          path: ["firstChoiceMentorId"],
          message: "Choose your first choice from the mentors you selected.",
        });
      }

      const chosen = new Set(v.availability);
      if (chosen.size !== v.availability.length) {
        ctx.addIssue({ code: "custom", path: ["availability"], message: "You picked the same time twice." });
      }
      for (const key of v.availability) {
        const parsed = parseOptionKey(key);
        const owner = parsed
          ? catalog.mentors.find((m) => m.options.some((o) => o.key === key))
          : undefined;
        if (!parsed || !owner || !v.mentorIds.includes(owner.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["availability"],
            message: "One of the times you ticked isn’t for a mentor you picked. Check your times.",
          });
          return;
        }
      }
      // Pending mentor schedules never block an application: students describe when they're
      // generally free (broad availability). That note is needed for any chosen mentor whose times
      // aren't set yet (no options, or only a date with the time still to be confirmed);
      // otherwise a listed time or the note is enough.
      const notes = v.availabilityNotes.trim();
      const pending = v.mentorIds
        .map((id) => mentorsById.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m) && mentorNeedsBroadAvailability(m!))
        .map((m) => m.firstName);
      if (!notes && pending.length) {
        ctx.addIssue({
          code: "custom",
          path: ["availabilityNotes"],
          message: `Tell us when you’re generally free during Founders Week. ${joinNames(pending)}’s times aren’t set yet.`,
        });
      } else if (v.availability.length === 0 && !notes) {
        ctx.addIssue({
          code: "custom",
          path: ["availabilityNotes"],
          message: "Tell us when you’re generally free during Founders Week (or pick one of the listed times).",
        });
      }
    });
}

export type ApplicationSchema = ReturnType<typeof createApplicationSchema>;
export type ValidApplication = z.output<ApplicationSchema>;

/**
 * Flatten zod issues to `{ fieldName: firstMessage }`. Per-mentor availability errors use
 * keys like "availability.patrick-haddox".
 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
