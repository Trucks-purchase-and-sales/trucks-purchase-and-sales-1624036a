import { expect, test } from "@playwright/test";
import { logInAsStaff } from "./helpers/login";
import { cleanupStaff, provisionStaff, type StaffIdentity } from "./helpers/staff";

// Neither sale_listings nor demand_opportunities have a "new" form the way
// vehicle_opportunities and buyer_leads do -- both routes/_authenticated/
// admin.sale-listings.index.tsx and admin.demand-opportunities.index.tsx
// are read-only list views (grep confirmed no create button/dialog in
// either). Both are only ever created by staff converting an existing
// record: sale_listings from a vehicle_opportunity already purchased
// (SaleListingPanel.tsx, gated on opp.status in ["achetee", "livree"] --
// itself the end of a multi-stage purchase workflow), demand_opportunities
// from a buyer_lead (adminConvertBuyerLead, a single-click action with no
// such prerequisite chain). This test covers the simpler of the two;
// sale_listings creation would need seeding a whole purchased-opportunity
// precondition first, left for a follow-up.
//
// Requires a service-role key to provision the staff identity and seed
// the buyer_lead directly (bypassing the anonymous submission UI already
// covered by buyer-request-journey.pw.ts -- this test is about the
// staff-side conversion, not the public intake form).
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet demand opportunity conversion journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let staff: StaffIdentity;
  let leadId: string;

  test.beforeEach(async () => {
    staff = await provisionStaff(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, "convert");

    // first_name/last_name/email are the only NOT NULL columns without a
    // usable default (staging-schema.sql) -- everything else is left at
    // its default, since this test only exercises the conversion action,
    // not the lead's own fields.
    const lead = await staff.service
      .from("buyer_leads")
      .insert({ first_name: "E2E", last_name: "Conversion", email: "e2e-lead@example.test" })
      .select("id")
      .single();
    if (lead.error || !lead.data) {
      throw new Error(`seed test buyer_lead: ${lead.error?.message}`);
    }
    leadId = lead.data.id as string;
  });

  test.afterEach(async () => {
    // demand_opportunities.buyer_lead_id would block the buyer_leads
    // delete via FK otherwise -- remove the child row first.
    await staff.service.from("demand_opportunities").delete().eq("buyer_lead_id", leadId);
    await staff.service.from("buyer_leads").delete().eq("id", leadId);
    await cleanupStaff(staff);
  });

  test("staff can convert a buyer lead into a demand opportunity", async ({ page }) => {
    await logInAsStaff(page, staff.email, staff.password);

    await page.goto(`/admin/buyer-leads/${leadId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Convertir en opportunité" }).click();

    await expect(page).toHaveURL(/\/admin\/demand-opportunities\/[^/]+$/);
    // Not the "Opportunité créée" toast -- Sonner toasts auto-dismiss and
    // this assertion would race the navigation. The status badge is
    // deterministic instead: adminConvertBuyerLead always inserts new
    // demands as "qualifiee" (src/lib/demand-opportunities.functions.ts).
    await expect(page.getByText("Qualifiée", { exact: true })).toBeVisible();
  });
});
