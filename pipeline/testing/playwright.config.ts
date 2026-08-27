import { defineConfig, devices } from "@playwright/test";

// No default here on purpose, matching this pipeline's own "never guess the
// target" rule (see the k6 scripts and e2e/playwright.config.ts). A guessed
// default is actively misleading for this class of app: Lovable's shared
// vite-tanstack-config defaults the dev server to port 8080, not Vite's
// often-assumed 5173 -- confirmed the hard way running this exact template
// against a second Lovable app during the Phase 7 dry-run, where a stale
// 5173 default would have silently pointed Playwright at nothing.
const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error(
    "BASE_URL is required; never guess the test target (see e2e/playwright.config.ts's own rule).",
  );
}

export default defineConfig({
  testDir: "../../tests",
  // Matches journey.template.pw.ts's own naming, not Playwright's default
  // *.spec.ts/*.test.ts -- see that file's header comment for why: those
  // suffixes collide with a Bun-based root test runner's default
  // auto-discovery on some setups (confirmed the hard way on Wilmet).
  testMatch: "**/*.pw.ts",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
