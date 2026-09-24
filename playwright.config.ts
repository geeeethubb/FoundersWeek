import { defineConfig } from "@playwright/test";
import { E2E_BASE_URL } from "./tests/e2e/support/env";

/**
 * End-to-end suite (tests/e2e) proving the product owner's verification checklist.
 *
 *   npm run test:e2e                          # fresh PGlite database in ./.data/e2e
 *   E2E_DATABASE_URL=postgres://… npm run test:e2e   # the same suite against a real Postgres
 *
 * The server is scripts/dev/e2e-server.mjs: `next dev` on port 3200 with its own distDir
 * (.next-e2e), demo content on, drafts off, a fixed organizer password and relaxed rate limits.
 * Every spec creates its own data with unique e2e-… emails, so a non-empty database is fine.
 *
 * Projects: "desktop" (1440×900) runs everything; "mobile" (390×844, touch) runs the specs whose
 * layout matters on phones.
 */
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
      testMatch: /(priorities|mentors|a11y-smoke)\.spec\.ts$/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: "node scripts/dev/e2e-server.mjs",
    // A cheap route: page compiles happen in global setup, one at a time.
    url: `${E2E_BASE_URL}/robots.txt`,
    timeout: 300_000,
    reuseExistingServer: false,
    // Request logs are noise; errors (stderr) always show. E2E_SERVER_LOG=1 shows everything.
    stdout: process.env.E2E_SERVER_LOG ? "pipe" : "ignore",
    stderr: "pipe",
  },
});
