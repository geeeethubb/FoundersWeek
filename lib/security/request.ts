import "server-only";

/**
 * Best-effort client IP for rate limiting. On Vercel, prefer the headers Vercel's edge sets itself
 * (clients can't forge them); elsewhere fall back to the first x-forwarded-for entry.
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL) {
    const vercel =
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
    if (vercel) return vercel;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * CSRF guard for state-changing requests. Browsers always send Origin on cross-origin
 * POST/PATCH/DELETE, so a mismatched Origin (or Sec-Fetch-Site: cross-site) is rejected.
 * Requests without either header come from non-browser clients and can't carry a victim's cookies
 * cross-site.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  return Boolean(host) && originHost === host;
}

export function jsonError(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, error, message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}
