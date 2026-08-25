import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { labeledInput, selectFirstComboboxOption } from "./helpers/form";

// Anonymous submission needs no test identity -- buyer_leads allows a public
// anon INSERT by design. A service-role key is still required to clean up
// the created row afterward (buyer_leads has no self-service delete path
// for an anonymous submitter to use), so this still skips cleanly without
// one rather than leaving rows behind in the disposable project.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet buyer request journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY (for cleanup only)",
  );

  let service: SupabaseClient;
  let createdLeadId: string | undefined;

  test.beforeAll(() => {
    service = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  test.afterEach(async () => {
    if (createdLeadId) {
      await service.from("buyer_leads").delete().eq("id", createdLeadId);
      createdLeadId = undefined;
    }
  });

  test("an anonymous visitor can submit a buyer request and reach the confirmation page", async ({
    page,
  }) => {
    await page.goto("/chercher-un-vehicule/", { waitUntil: "domcontentloaded" });

    // The category/type comboboxes are clickable immediately, but their
    // option lists come from an async reference-data fetch -- opening one
    // before it resolves shows an empty "no results" list, not a missing
    // element, so the earlier failure hung waiting for an option that was
    // never going to appear rather than failing fast.
    await expect(page.getByText("Chargement des référentiels…")).not.toBeVisible();

    // Step 1 (Véhicule recherché): only vehicle_category/vehicle_type are
    // required -- any valid option works, the test isn't asserting on the
    // specific vehicle searched for.
    await selectFirstComboboxOption(page, "Catégorie de véhicule");
    await selectFirstComboboxOption(page, "Type de véhicule");
    await page.getByRole("button", { name: "Continuer" }).click();

    // Steps 2 and 3 (Critères techniques, Budget & délai) are entirely
    // optional per buyerLeadSchema -- advance without filling anything.
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();

    // Step 4 (Vos coordonnées): first_name, last_name, email and
    // gdpr_consent are the only other required fields in the whole schema.
    const email = `e2e-buyer-${Date.now()}@example.test`;
    await labeledInput(page, "Prénom").fill("E2E");
    await labeledInput(page, "Nom").fill("Playwright");
    await labeledInput(page, "Email").fill(email);
    await page.getByRole("checkbox").check();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/public/buyer-leads") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Envoyer ma demande" }).click(),
    ]);
    const body = (await response.json()) as { id?: string };
    createdLeadId = body.id;

    await expect(page).toHaveURL(/\/chercher-un-vehicule\/merci/);
    await expect(page.getByText("Votre recherche a bien été transmise à Wilmet.")).toBeVisible();
  });
});
