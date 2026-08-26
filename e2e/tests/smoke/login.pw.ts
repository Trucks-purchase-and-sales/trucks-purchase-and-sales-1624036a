import { test } from "@playwright/test";
import { logInAsPartner } from "../helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "../helpers/seller";

// Smoke journey 1/5: login. Deliberately minimal -- logInAsPartner() already
// asserts the /dashboard redirect, so this is purely "does the auth form
// still work end to end." Whether the dashboard itself renders anything
// useful is a separate concern, covered by dashboard-loads.pw.ts.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Smoke: login", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let seller: SellerIdentity;

  test.beforeEach(async () => {
    seller = await provisionSeller(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "smoke-login",
    );
  });

  test.afterEach(async () => {
    if (seller) await cleanupSeller(seller);
  });

  test("a partner can log in through the real form and reach their dashboard", async ({ page }) => {
    await logInAsPartner(page, seller.email, seller.password);
  });
});
