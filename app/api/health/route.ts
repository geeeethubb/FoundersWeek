/**
 * GET /api/health — non-secret deployment readiness (which settings are present and whether the
 * database is reachable). Contains no applicant data, secret values or connection details.
 */
import { getSetupStatus } from "@/lib/setup-status";

// First request after deploy may create the tables; allow time for that.
export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSetupStatus();
  return Response.json(
    {
      applications: status.applicationsOpen ? "open" : "not-ready",
      checks: status.checks.map(({ key, ok, status: s, fix }) => ({ key, ok, status: s, fix })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
