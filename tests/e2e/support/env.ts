/**
 * Values shared by playwright.config.ts, the specs and scripts/dev/e2e-server.mjs (which keeps its
 * own copy — it's plain Node). Test-only; never used by the app itself.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_ORGANIZER_PASSWORD = "e2e-organizer-password-123";

/**
 * A second server with demo content OFF (`e2e-server.mjs --no-demo`): the lineup, counts and
 * calendar exactly as students see them. Used only by production-content.spec.ts.
 */
export const E2E_NODEMO_PORT = Number(process.env.E2E_NODEMO_PORT ?? E2E_PORT + 1);
export const E2E_NODEMO_BASE_URL = `http://localhost:${E2E_NODEMO_PORT}`;
