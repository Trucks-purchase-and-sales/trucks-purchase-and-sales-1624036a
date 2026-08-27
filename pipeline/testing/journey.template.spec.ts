import { test, expect } from "@playwright/test";
// V2P journey template — copy into tests/e2e/<feature>.spec.ts and fill in.
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
