import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { logInAsPartner } from "./helpers/login";

// Requires a service-role key to provision a throwaway seller identity, same
// as partner-auth-journey.pw.ts. Skips cleanly without it.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet opportunity CRUD journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  let service: SupabaseClient;
  let userId: string;
  let email: string;
  let password: string;

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    email = `e2e-pw-crud-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    password = `Wilmet-PW-${randomUUID()}!Aa1`;

    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "E2E", last_name: "CrudJourney" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`provision test seller: ${created.error?.message}`);
    }
    userId = created.data.user.id;

    const profile = await service.from("profiles").upsert(
      {
        id: userId,
        first_name: "E2E",
        last_name: "CrudJourney",
        email,
        is_active: true,
        partner_kind: "seller",
        city: "E2E staging",
        country: "BE",
      },
      { onConflict: "id" },
    );
    if (profile.error) throw new Error(`upsert test seller profile: ${profile.error.message}`);

    // handle_new_user auto-assigns a default role; clear it before setting
    // the intended one (see partner-auth-journey.pw.ts for why).
    const clearedRoles = await service.from("user_roles").delete().eq("user_id", userId);
    if (clearedRoles.error) throw new Error(`clear default role: ${clearedRoles.error.message}`);

    const role = await service.from("user_roles").insert({ user_id: userId, role: "partenaire" });
    if (role.error) throw new Error(`assign partenaire role: ${role.error.message}`);
  });

  test.afterAll(async () => {
    if (!userId) return;
    // vehicle_opportunities rows don't cascade-delete with their owning
    // user (see tests/staging/security.staging.ts's afterAll) -- remove
    // them explicitly before deleting the identity itself.
    await service.from("vehicle_opportunities").delete().eq("partenaire_id", userId);
    await service.auth.admin.deleteUser(userId);
  });

  test("a seller can create a vehicle opportunity draft and see it on their dashboard", async ({
    page,
  }) => {
    await logInAsPartner(page, email, password);

    await page.goto("/opportunities/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const cards = page.locator('a[href^="/opportunities/"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByText("Brouillon", { exact: true })).toBeVisible();

    await cards.first().click();
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);
  });
});
