import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { labeledInput, selectFirstComboboxOption } from "../helpers/form";

// Smoke journey 4/5: the money/critical path. For a lead-generation
// marketplace like Wilmet, the anonymous buyer request is exactly this --
// it's how a visitor becomes a qualified lead. Anonymous submission needs no
// test identity (buyer_leads allows a public anon INSERT by design); a
// service-role key is still required to clean up the created row afterward.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Smoke: buyer request (money path)", () => {
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
    // A full 4-step wizard interaction plus submission legitimately takes
    // longer than the default 30s (playwright.config.ts) under a cold CI
    // start.
    test.setTimeout(60_000);

    await page.goto("/chercher-un-vehicule/", { waitUntil: "domcontentloaded" });

    // The category/type comboboxes are clickable immediately, but their
    // option lists come from an async reference-data fetch -- opening one
    // before it resolves shows an empty "no results" list, not a missing
    // element, so this waits for the fetch instead of racing it.
    await expect(page.getByText("Chargement des référentiels…")).not.toBeVisible();

    // Step 1 (Véhicule recherché): only vehicle_category/vehicle_type are
    // required -- any valid option works.
    await selectFirstComboboxOption(page, "Catégorie de véhicule");
    await selectFirstComboboxOption(page, "Type de véhicule");
    await page.getByRole("button", { name: "Continuer" }).click();

    // Steps 2 and 3 (Critères techniques, Budget & délai) are entirely
    // optional per buyerLeadSchema -- advance without filling anything.
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();

    // Step 4 (Vos coordonnées): first_name, last_name, email and
    // gdpr_consent are the only other required fields in the whole schema.
    // "Nom" must be anchored (not a plain substring) -- as a substring it
    // also matches "Prénom" and, being first in the form, silently absorbs
    // this fill while leaving the real Nom field empty.
    const email = `e2e-buyer-smoke-${Date.now()}@example.test`;
    await labeledInput(page, "Prénom").fill("E2E");
    await labeledInput(page, /^Nom/i).fill("Playwright");
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
