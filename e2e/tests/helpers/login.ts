import { expect, type Page } from "@playwright/test";

export async function logInAsPartner(page: Page, email: string, password: string) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The cookie-consent banner is fixed to the bottom of the viewport and
  // intercepts clicks on other bottom-anchored controls (e.g. the
  // opportunity wizard's footer buttons) until dismissed. A fresh browser
  // context sees it on every run, so clear it once here for every caller.
  const acceptCookies = page.getByRole("button", { name: "J'ai compris" });
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  }
}
