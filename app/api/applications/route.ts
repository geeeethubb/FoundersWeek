/**
 * Office-hours applications. All logic (validation, spam checks, idempotency, rate limits,
 * persistence, acknowledgment email) lives in lib/applications/submit.ts so it can be tested
 * without a server.
 */
import { after } from "next/server";
import { handleApplicationSubmission } from "@/lib/applications/submit";

// First request after deploy may create the tables; allow time for that.
export const maxDuration = 60;

export async function POST(request: Request) {
  // `after` keeps the acknowledgment email off the response path (and alive on serverless).
  return handleApplicationSubmission(request, { schedule: (task) => after(task) });
}
