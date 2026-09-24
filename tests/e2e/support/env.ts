/**
 * Values shared by playwright.config.ts, the specs and scripts/dev/e2e-server.mjs (which keeps its
 * own copy — it's plain Node). Test-only; never used by the app itself.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_ORGANIZER_PASSWORD = "e2e-organizer-password-123";
