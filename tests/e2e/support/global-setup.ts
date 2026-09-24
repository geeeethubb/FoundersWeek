/**
 * Warm up `next dev` before the first spec: compile the main routes one at a time so the first
 * tests don't spend their budget on cold compiles (and don't race each other for them).
 * Both servers are warmed: the main one (demo content on) and the production-content one.
 */
import type { FullConfig } from "@playwright/test";
import { E2E_BASE_URL, E2E_NODEMO_BASE_URL } from "./env";

const ROUTES = [
  "/",
  "/office-hours",
  "/office-hours/patrick-haddox",
  "/apply?mentor=elliott-notrica",
  "/schedule",
  "/schedule/dan-caruso-fireside-chat",
  "/schedule/how-to-make-10k-a-month-in-college/calendar.ics",
  "/schedule/calendar.ics",
  "/organizers/login",
  "/api/health",
  "/sitemap.xml",
];

/** production-content.spec.ts only visits these. */
const NODEMO_ROUTES = ["/", "/office-hours", "/schedule"];

async function warm(baseURL: string, routes: string[], label: string) {
  for (const route of routes) {
    const started = Date.now();
    try {
      const res = await fetch(baseURL + route, { redirect: "manual", signal: AbortSignal.timeout(180_000) });
      await res.arrayBuffer();
      console.log(`[e2e warm-up${label}] ${res.status} ${route} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.log(`[e2e warm-up${label}] failed ${route}: ${String(error)}`);
    }
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0]?.use.baseURL as string | undefined) ?? E2E_BASE_URL;
  await warm(baseURL, ROUTES, "");
  await warm(E2E_NODEMO_BASE_URL, NODEMO_ROUTES, " · no demo");
}
