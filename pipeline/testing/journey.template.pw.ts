import { test, expect } from "@playwright/test";
// V2P journey template — copy into your own e2e specs directory and fill
// in. Named .pw.ts here (not .spec.ts) so a root-level `bun test` doesn't
// try to auto-discover and execute this file itself: Bun's default test
// globbing matches *.spec.ts/*.test.ts regardless of what's actually
// imported, so a Playwright-only file with that suffix fails immediately
// with "Cannot find module '@playwright/test'" the moment `@playwright/
// test` isn't a root dependency (real failure hit wiring this file into
// Wilmet's own CI). If your app's unit-test runner doesn't do whole-repo
// discovery (or isn't Bun), *.spec.ts is fine — just watch for this if it
// does.
test.describe("<FEATURE> journey", () => {
  test("user can <do the thing>", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL ?? "test@example.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD ?? "CHANGE_ME");
    await page.getByRole("button", { name: /log ?in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    // create → assert → edit → assert → delete → assert
  });

  test("normal user is DENIED admin action (authz regression)", async ({ page }) => {
    // log in as a non-admin, attempt an admin-only route/action, assert it is blocked
    await page.goto("/admin");
    await expect(page.getByText(/forbidden|not authorized|404/i)).toBeVisible();
  });
});
