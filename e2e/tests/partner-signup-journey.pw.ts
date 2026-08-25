import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { labeledInput } from "./helpers/form";

// Real self-service signup needs no pre-provisioned identity -- that's the
// whole point of this test, as opposed to partner-auth-journey.pw.ts's
// login test which signs into an account created via the admin API. A
// service-role key is still required to find and delete the created
// account afterward, so this skips cleanly without one rather than
// leaving orphaned accounts in the disposable project.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet partner signup journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY (for cleanup only)",
  );

  let service: SupabaseClient;
  let email: string;

  test.beforeAll(() => {
    service = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });

  test.afterEach(async () => {
    if (!email) return;
    // supabase.auth.signUp() (anon key, client-side) doesn't return an
    // admin-deletable reference directly; look the id up via the profile
    // handle_new_user creates for every new auth.users row instead.
    const profile = await service.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profile.data?.id) {
      await service.auth.admin.deleteUser(profile.data.id);
    }
  });

  test("a new seller can sign up and reach the email-confirmation screen", async ({ page }) => {
    email = `e2e-signup-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    // 15-char minimum (src/lib/password-policy.ts).
    const password = `Wilmet-Signup-${randomUUID()}!Aa1`;

    await page.goto("/auth?mode=signup&kind=seller", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Créer un compte partenaire", { exact: true })).toBeVisible();

    // "Nom" must be anchored (not a plain substring) -- as a substring it
    // also matches "Prénom" (contains "nom"), the same collision fixed in
    // buyer-request-journey.pw.ts. Same Field component (auth.tsx), same
    // bug shape.
    await labeledInput(page, "Prénom").fill("E2E");
    await labeledInput(page, /^Nom/i).fill("Playwright");
    await labeledInput(page, "Email").fill(email);
    await labeledInput(page, "Téléphone").fill("+32470000000");
    await labeledInput(page, "Ville").fill("Anvers");
    // Pays defaults to "France" already; Société and Type de partenaire
    // are optional and left untouched.
    await labeledInput(page, "Mot de passe").fill(password);

    await page.getByRole("button", { name: "Créer mon compte" }).click();

    // This staging project requires email confirmation before a session
    // is issued (the same reason every other test's identity provisioning
    // uses the admin API with email_confirm: true instead of real
    // signup), so the real signup flow's own success state -- not a
    // dashboard redirect -- is the correct assertion here.
    await expect(page.getByText("Vérifiez votre boîte e-mail", { exact: true })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });
});
