import { expect, test } from "@playwright/test";
import { logInAsPartner } from "../helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "../helpers/seller";

// Smoke journey 3/5: create the primary record. Trimmed from
// opportunity-crud-journey.pw.ts's fuller create+edit coverage -- this only
// needs to prove the seller-side core transaction (create a vehicle
// opportunity) still works, not exercise every field.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Smoke: create opportunity", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let seller: SellerIdentity;

  test.beforeEach(async () => {
    seller = await provisionSeller(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "smoke-create",
    );
  });

  test.afterEach(async () => {
    if (seller) await cleanupSeller(seller);
  });

  test("a seller can create a vehicle opportunity draft and see it on their dashboard", async ({
    page,
  }) => {
    await logInAsPartner(page, seller.email, seller.password);

    await page.goto("/opportunities/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // Exclude the header's own "Proposer un véhicule" link, which also
    // matches a bare a[href^="/opportunities/"] selector.
    const cards = page.locator('a[href^="/opportunities/"]:not([href="/opportunities/new"])');
    await expect(cards).toHaveCount(1);
  });
});
