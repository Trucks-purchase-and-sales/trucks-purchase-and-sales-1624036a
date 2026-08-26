import { expect, test } from "@playwright/test";
import { logInAsPartner } from "../helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "../helpers/seller";

// Smoke journey 5/5: logout.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Smoke: logout", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let seller: SellerIdentity;

  test.beforeEach(async () => {
    seller = await provisionSeller(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "smoke-logout",
    );
  });

  test.afterEach(async () => {
    if (seller) await cleanupSeller(seller);
  });

  test("logging out returns to the public auth boundary", async ({ page }) => {
    await logInAsPartner(page, seller.email, seller.password);

    // The dashboard header has two dropdown-menu triggers (notification
    // bell, then profile menu) that both get aria-haspopup="menu" from
    // Radix, so a bare "first()" grabs the bell instead. The profile
    // trigger is the only one styled with rounded-full.
    await page.locator('button.rounded-full[aria-haspopup="menu"]').click();
    await page.getByText("Se déconnecter", { exact: true }).click();

    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
  });
});
