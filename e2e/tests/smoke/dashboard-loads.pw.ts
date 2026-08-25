import { expect, test } from "@playwright/test";
import { logInAsPartner } from "../helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "../helpers/seller";

// Smoke journey 2/5: load dashboard. Distinct from login.pw.ts -- that only
// checks the URL redirect after auth; this checks the dashboard actually
// renders its real content, which would catch a client-side render crash
// that leaves a blank page despite landing on the right URL.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Smoke: dashboard loads", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let seller: SellerIdentity;

  test.beforeEach(async () => {
    seller = await provisionSeller(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "smoke-dashboard",
    );
  });

  test.afterEach(async () => {
    if (seller) await cleanupSeller(seller);
  });

  test("the dashboard renders its core heading and primary action", async ({ page }) => {
    await logInAsPartner(page, seller.email, seller.password);

    await expect(page.getByRole("heading", { name: "Mes opportunités" })).toBeVisible();
    // .first() -- the header nav and the page body both have a "Proposer un
    // véhicule" link with the same accessible name; this only needs to know
    // one of them rendered, not which.
    await expect(page.getByRole("link", { name: "Proposer un véhicule" }).first()).toBeVisible();
  });
});
