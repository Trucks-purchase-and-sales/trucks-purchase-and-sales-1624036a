import { expect, test } from "@playwright/test";
import { logInAsPartner } from "./helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "./helpers/seller";

// Requires a service-role key because it provisions a throwaway partner
// identity through the real Supabase Auth admin API (mirrors
// tests/staging/security.staging.ts's provisionIdentity pattern), then
// exercises the actual browser login/logout/role-restriction UI against it.
// Skips cleanly instead of failing when these aren't set, so the existing
// credential-free public-smoke suite is unaffected.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet partner auth journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  // These three tests only read role/session state -- none of them create
  // an opportunity -- so it's safe for them to share one identity via
  // beforeAll rather than provisioning fresh per test.
  let partner: SellerIdentity;

  test.beforeAll(async () => {
    partner = await provisionSeller(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, "auth");
  });

  test.afterAll(async () => {
    if (partner) await cleanupSeller(partner);
  });

  test("a partner can log in through the real form and reach their dashboard", async ({ page }) => {
    await logInAsPartner(page, partner.email, partner.password);
    await expect(page.getByRole("heading", { name: "Mes opportunités" })).toBeVisible();
  });

  test("a partner is denied the internal admin area and redirected to their own dashboard", async ({
    page,
  }) => {
    await logInAsPartner(page, partner.email, partner.password);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Mes opportunités" })).toBeVisible();
  });

  test("logging out returns to the public auth boundary", async ({ page }) => {
    await logInAsPartner(page, partner.email, partner.password);

    // The dashboard header has two dropdown-menu triggers (notification
    // bell, then profile menu) that both get aria-haspopup="menu" from
    // Radix, so a bare "first()" grabs the bell instead. The profile
    // trigger is the only one styled with rounded-full (see
    // ProfileMenu/NotificationBell in src/routes/_authenticated/route.tsx).
    await page.locator('button.rounded-full[aria-haspopup="menu"]').click();
    await page.getByText("Se déconnecter", { exact: true }).click();

    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
  });
});
