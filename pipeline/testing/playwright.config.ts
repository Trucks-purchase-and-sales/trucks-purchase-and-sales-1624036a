import { defineConfig, devices } from "@playwright/test";
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
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
