import { defineConfig, devices } from "@playwright/test";

// Lightweight Playwright setup tuned for CI: chromium only, retries on CI,
// never reuses an already-running local server. The "@smoke" suite is what
// gates this repo's CI — it must stay fast and it must stay runnable with
// zero environment variables (see e2e/demo-zero-config.spec.ts): this repo's
// own CLAUDE.md invariant is that demo mode "must keep working with no
// environment variables at all", and the e2e job is where that promise gets
// enforced instead of just asserted.
//
// PLAYWRIGHT_BASE_URL targets an already-deployed environment instead of
// localhost. When it's set, `webServer` is omitted entirely — not just
// skipped via reuseExistingServer — so Playwright never spins up a local
// `npm run start` that nothing points at and never masks a real network
// failure behind its 60s startup timeout.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          // `npm run start` has no `-p` flag in this repo's package.json
          // (only `dev` does, on 3001) — `next start` defaults to 3000,
          // matching the `url` below. Verified empirically before wiring
          // this in: nothing else was listening on the port.
          command: "npm run start",
          url: "http://localhost:3000",
          // JAMAIS de reprise d'un serveur deja lance : avec
          // `!process.env.CI`, un `next start` resterait ecoute sur le port
          // et Playwright le REUTILISERAIT apres un rebuild -- la suite
          // testerait alors l'ancien build en silence.
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: "ignore",
          stderr: "pipe",
        },
      }),
});
