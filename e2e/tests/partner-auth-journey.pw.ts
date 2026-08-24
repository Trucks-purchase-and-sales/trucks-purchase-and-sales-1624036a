import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

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

  let service: SupabaseClient;
  let userId: string;
  let email: string;
  let password: string;

  test.beforeAll(async () => {
    service = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    email = `e2e-pw-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    password = `Wilmet-PW-${randomUUID()}!Aa1`;

    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "E2E", last_name: "Playwright" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`provision test partner: ${created.error?.message}`);
    }
    userId = created.data.user.id;

    const profile = await service.from("profiles").upsert(
      {
        id: userId,
        first_name: "E2E",
        last_name: "Playwright",
        email,
        is_active: true,
        partner_kind: "seller",
        city: "E2E staging",
        country: "BE",
      },
      { onConflict: "id" },
    );
    if (profile.error) throw new Error(`upsert test partner profile: ${profile.error.message}`);

    // handle_new_user auto-assigns a default role on insert; clear it before
    // setting the intended one, otherwise the explicit insert below can hit
    // the same user_roles unique-constraint conflict found earlier this
    // session in tests/staging/security.staging.ts.
    const clearedRoles = await service.from("user_roles").delete().eq("user_id", userId);
    if (clearedRoles.error) throw new Error(`clear default role: ${clearedRoles.error.message}`);

    const role = await service.from("user_roles").insert({ user_id: userId, role: "partenaire" });
    if (role.error) throw new Error(`assign partenaire role: ${role.error.message}`);
  });

  test.afterAll(async () => {
    if (!userId) return;
    await service.auth.admin.deleteUser(userId);
  });

  async function logIn(page: import("@playwright/test").Page) {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }

  test("a partner can log in through the real form and reach their dashboard", async ({ page }) => {
    await logIn(page);
    await expect(page.getByRole("heading", { name: "Mes opportunités" })).toBeVisible();
  });

  test("a partner is denied the internal admin area and redirected to their own dashboard", async ({
    page,
  }) => {
    await logIn(page);

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Mes opportunités" })).toBeVisible();
  });

  test("logging out returns to the public auth boundary", async ({ page }) => {
    await logIn(page);

    await page.locator('button[aria-haspopup="menu"]').first().click();
    await page.getByText("Se déconnecter", { exact: true }).click();

    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
  });
});
