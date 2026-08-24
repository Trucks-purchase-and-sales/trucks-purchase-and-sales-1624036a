import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const targetLabel = process.env.PLAYWRIGHT_TARGET_LABEL;

if (!baseURL) {
  throw new Error("PLAYWRIGHT_BASE_URL is required; never guess the Wilmet test target.");
}

if (targetLabel !== "wilmet-staging" && targetLabel !== "local") {
  throw new Error(
    "PLAYWRIGHT_TARGET_LABEL must be 'wilmet-staging' or 'local'. Production targets are intentionally unsupported.",
  );
}

const parsedBaseURL = new URL(baseURL);
if (targetLabel === "wilmet-staging" && parsedBaseURL.protocol !== "https:") {
  throw new Error("Wilmet staging browser tests require an HTTPS base URL.");
}

if (
  targetLabel === "local" &&
  parsedBaseURL.hostname !== "localhost" &&
  parsedBaseURL.hostname !== "127.0.0.1"
) {
  throw new Error("The 'local' Playwright target may only use localhost/127.0.0.1.");
}

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.pw.ts",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: parsedBaseURL.toString(),
    // The app renders French by default and switches based on the browser's
    // reported locale after hydration (src/i18n/index.ts). Without pinning
    // this, Playwright's en-US default causes every French-text assertion
    // to fail against a real, working app — not an app bug.
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
