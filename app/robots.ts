/**
 * robots.txt — public pages are crawlable; organizer pages, the API and applicant status links
 * (/apply/status/<token> — the URL is the credential) are not. Vercel preview deployments are
 * kept out of search entirely.
 */
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config";

const PRIVATE_PATHS = ["/organizers", "/api/", "/apply/status/"];

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  if (process.env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
