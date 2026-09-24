// Start the isolated `next dev` server the Playwright suite runs against (playwright.config.ts →
// webServer). Can also be run by hand to debug the suite: `node scripts/dev/e2e-server.mjs`.
//
//   Port 3200 · distDir .next-e2e (never the default .next) · demo content on · drafts off ·
//   fixed organizer password + app secret · generous application rate limits.
//
// Database
//   - E2E_DATABASE_URL set  → used as DATABASE_URL, so the SAME suite runs against a real Postgres
//     (Neon/Supabase/local). Optional E2E_DATABASE_SCHEMA → DATABASE_SCHEMA. The suite only creates
//     its own data (unique e2e-… emails) and never deletes anything it didn't create.
//   - otherwise             → a fresh embedded PGlite database in ./.data/e2e (deleted on start).
//
// Values set here win over .env.local (Next never overrides variables already in process.env).
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
const E2E_DIST_DIR = ".next-e2e";
const E2E_ORGANIZER_PASSWORD = "e2e-organizer-password-123";
// Test-only signing secret (≥ 32 characters). Never used outside this suite.
// Keep in sync with tests/e2e/support/env.ts.
const E2E_APP_SECRET = "e2e-only-app-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

let databaseUrl;
let databaseLabel;
if (process.env.E2E_DATABASE_URL?.trim()) {
  databaseUrl = process.env.E2E_DATABASE_URL.trim();
  databaseLabel = "E2E_DATABASE_URL (external Postgres)";
} else {
  rmSync(path.join(root, ".data", "e2e"), { recursive: true, force: true });
  databaseUrl = "pglite:./.data/e2e";
  databaseLabel = "fresh PGlite at ./.data/e2e";
}

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_DIST_DIR: E2E_DIST_DIR,
  PORT: String(E2E_PORT),
  NEXT_PUBLIC_SITE_URL: `http://localhost:${E2E_PORT}`,
  DATABASE_URL: databaseUrl,
  DATABASE_SCHEMA: process.env.E2E_DATABASE_SCHEMA ?? "",
  SHOW_DEMO_CONTENT: "true",
  SHOW_DRAFT_CONTENT: "false",
  ORGANIZER_PASSWORD: E2E_ORGANIZER_PASSWORD,
  APP_SECRET: E2E_APP_SECRET,
  APPLICATION_RATE_LIMIT_PER_HOUR: "1000",
  APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY: "1000",
  // Never send real acknowledgment emails from the test server.
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
};
if (!env.DATABASE_SCHEMA) delete env.DATABASE_SCHEMA;

console.log(`[e2e-server] next dev on http://localhost:${E2E_PORT} · distDir ${E2E_DIST_DIR} · database: ${databaseLabel}`);

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "dev", "-p", String(E2E_PORT)], {
  cwd: root,
  env,
  stdio: "inherit",
});

function stop() {
  if (server.exitCode !== null || server.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

server.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
process.on("exit", stop);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}
