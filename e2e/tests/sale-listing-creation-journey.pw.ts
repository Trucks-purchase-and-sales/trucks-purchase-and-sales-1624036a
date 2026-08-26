import { expect, test } from "@playwright/test";
import { labeledInput } from "./helpers/form";
import { logInAsStaff } from "./helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "./helpers/seller";
import { cleanupStaff, provisionStaff, type StaffIdentity } from "./helpers/staff";

// sale_listings has no "new" form (admin.sale-listings.index.tsx is a
// read-only list, grep-confirmed) -- it's only created via
// SaleListingPanel.tsx, embedded in an opportunity's admin detail page and
// gated on opp.status being "achetee" or "livree" (the end of a multi-stage
// purchase workflow: brouillon -> envoyee -> ... -> achetee). Walking that
// whole pipeline through the UI just to reach this precondition would test
// the purchase workflow, not sale-listing creation -- seeded directly
// instead, the same way every other test this session seeds its
// precondition state rather than re-driving an unrelated flow through the
// UI to get there.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet sale listing creation journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let seller: SellerIdentity;
  let staff: StaffIdentity;
  let opportunityId: string;

  test.beforeEach(async () => {
    seller = await provisionSeller(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "sale-listing-owner",
    );
    staff = await provisionStaff(
      SUPABASE_URL as string,
      SERVICE_ROLE_KEY as string,
      "sale-listing-staff",
    );

    // tg_opp_partner_column_guard (staging-schema.sql) only restricts
    // inserts made as an authenticated seller/partner role -- a
    // service-role insert has no auth.uid(), so neither of its branches
    // apply and this goes through untouched, same as every other
    // service-role-seeded precondition this session.
    const opp = await seller.service
      .from("vehicle_opportunities")
      .insert({
        partenaire_id: seller.userId,
        status: "achetee",
        brand: "Volvo",
        model: "FH16",
        year: 2020,
        purchase_price_excl_tax: 15000,
      })
      .select("id")
      .single();
    if (opp.error || !opp.data) {
      throw new Error(`seed test vehicle_opportunity: ${opp.error?.message}`);
    }
    opportunityId = opp.data.id as string;
  });

  test.afterEach(async () => {
    // sale_listings.vehicle_opportunity_id would block deleting the
    // opportunity via FK otherwise -- remove the child row first.
    await seller.service.from("sale_listings").delete().eq("vehicle_opportunity_id", opportunityId);
    await cleanupSeller(seller);
    await cleanupStaff(staff);
  });

  test("staff can transform a purchased opportunity into a sale listing", async ({ page }) => {
    await logInAsStaff(page, staff.email, staff.password);

    await page.goto(`/admin/opportunities/${opportunityId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Transformer en offre de vente" }).click();

    // Title is prefilled from brand/model/year (SaleListingPanel.tsx's
    // defaultTitle) -- only price is genuinely empty and required.
    await labeledInput(page, "Prix de vente").fill("18000");
    await page.getByRole("button", { name: "Créer l'offre" }).click();

    await expect(page.getByRole("link", { name: "Ouvrir l'offre de vente" })).toBeVisible();
  });
});
