import { defineConfig } from "@playwright/test";
import { E2E_BASE_URL, E2E_NODEMO_BASE_URL } from "./tests/e2e/support/env";

/**
 * End-to-end suite (tests/e2e) proving the product owner's checklist for the simplified site:
 *   navigation (1), home (2), office-hours (3), apply (4), calendar (5), organizer (6),
 *   a11y-smoke (7), plus production-content (exact production lineup and calendar).
 *
 *   npm run test:e2e                          # fresh PGlite database in ./.data/e2e
 *   E2E_DATABASE_URL=postgres://… npm run test:e2e   # the same suite against a real Postgres
 *
 * Two servers (scripts/dev/e2e-server.mjs), both `next dev` with drafts off:
 *   - port 3200, distDir .next-e2e: demo content on (the organizer capacity test needs the demo
 *     slot), a fixed organizer password and relaxed rate limits. Every spec runs here except…
 *   - port 3201, distDir .next-e2e-nodemo (`--no-demo`): production content only, exactly as
 *     students see it (five mentors, 13 calendar entries). production-content.spec.ts runs here.
 * Every spec creates its own data with unique e2e-… emails, so a non-empty database is fine.
 *
 * Projects: "desktop" (1440×900) runs everything; "mobile" (390×844, touch) runs every spec whose
 * layout matters on phones (all but the organizer dashboard, whose table is desktop-first).
 */

// Request logs are noise; errors (stderr) always show. E2E_SERVER_LOG=1 shows everything.
// E2E_REUSE_SERVER=1 reuses servers you started by hand (debugging only; normal runs start fresh ones).
const reuseExistingServer = Boolean(process.env.E2E_REUSE_SERVER);
const serverOutput = { stdout: process.env.E2E_SERVER_LOG ? "pipe" : "ignore", stderr: "pipe" } as const;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  globalSetup: "./tests/e2e/support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  // First compiles in `next dev` are slow; keep generous budgets.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: E2E_BASE_URL,
    browserName: "chromium",
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    // Instant scrolling (the app honors prefers-reduced-motion), so geometry checks are stable.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testMatch: /(navigation|home|office-hours|apply|calendar|a11y-smoke|production-content)\.spec\.ts$/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: [
    {
      command: "node scripts/dev/e2e-server.mjs",
      // A cheap route: page compiles happen in global setup, one at a time.
      url: `${E2E_BASE_URL}/robots.txt`,
      timeout: 300_000,
      reuseExistingServer,
      ...serverOutput,
    },
    {
      command: "node scripts/dev/e2e-server.mjs --no-demo",
      url: `${E2E_NODEMO_BASE_URL}/robots.txt`,
      timeout: 300_000,
      reuseExistingServer,
      ...serverOutput,
    },
  ],
});
