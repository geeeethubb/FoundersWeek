// Start the isolated `next dev` server the Playwright suite runs against (playwright.config.ts →
// webServer). Can also be run by hand to debug the suite: `node scripts/dev/e2e-server.mjs`.
//
//   Port 3200 · distDir .next-e2e (never the default .next) · demo content on · drafts off ·
//   fixed organizer password + app secret · generous application rate limits.
//
// `--no-demo` starts the second server instead: the site exactly as students see it (production
// content only — no demo mentors or events), for tests/e2e/production-content.spec.ts.
//
//   Port 3201 (E2E_NODEMO_PORT) · distDir .next-e2e-nodemo · demo content off · drafts off ·
//   its own fresh PGlite in ./.data/e2e-nodemo (it only serves public pages; nothing is written).
//
// Database (main server)
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

const NO_DEMO = process.argv.includes("--no-demo");
// Keep ports in sync with tests/e2e/support/env.ts.
const MAIN_PORT = Number(process.env.E2E_PORT ?? 3200);
const E2E_PORT = NO_DEMO ? Number(process.env.E2E_NODEMO_PORT ?? MAIN_PORT + 1) : MAIN_PORT;
const E2E_DIST_DIR = NO_DEMO ? ".next-e2e-nodemo" : ".next-e2e";
const E2E_ORGANIZER_PASSWORD = "e2e-organizer-password-123";
// Test-only signing secret (≥ 32 characters). Never used outside this suite.
// Keep in sync with tests/e2e/support/env.ts.
const E2E_APP_SECRET = "e2e-only-app-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

let databaseUrl;
let databaseLabel;
if (NO_DEMO) {
  rmSync(path.join(root, ".data", "e2e-nodemo"), { recursive: true, force: true });
  databaseUrl = "pglite:./.data/e2e-nodemo";
  databaseLabel = "fresh PGlite at ./.data/e2e-nodemo";
} else if (process.env.E2E_DATABASE_URL?.trim()) {
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
  DATABASE_SCHEMA: NO_DEMO ? "" : (process.env.E2E_DATABASE_SCHEMA ?? ""),
  SHOW_DEMO_CONTENT: NO_DEMO ? "false" : "true",
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

console.log(
  `[e2e-server] next dev on http://localhost:${E2E_PORT} · distDir ${E2E_DIST_DIR} · demo content ${NO_DEMO ? "off" : "on"} · database: ${databaseLabel}`,
);

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
