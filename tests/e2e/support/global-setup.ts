/**
 * Warm up `next dev` before the first spec: compile the main routes one at a time so the first
 * tests don't spend their budget on cold compiles (and don't race each other for them).
 */
import type { FullConfig } from "@playwright/test";
import { E2E_BASE_URL } from "./env";

const ROUTES = [
  "/",
  "/office-hours",
  "/office-hours/patrick-haddox",
  "/schedule",
  "/schedule/dan-caruso-fireside-chat",
  "/schedule/how-to-make-10k-a-month-in-college/calendar.ics",
  "/organizers/login",
  "/sitemap.xml",
];

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0]?.use.baseURL as string | undefined) ?? E2E_BASE_URL;
  for (const route of ROUTES) {
    const started = Date.now();
    try {
      const res = await fetch(baseURL + route, { redirect: "manual", signal: AbortSignal.timeout(180_000) });
      await res.arrayBuffer();
      console.log(`[e2e warm-up] ${res.status} ${route} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.log(`[e2e warm-up] failed ${route}: ${String(error)}`);
    }
  }
}
