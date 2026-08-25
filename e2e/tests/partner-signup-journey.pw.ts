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

  test("a new seller can sign up and land on their dashboard", async ({ page }) => {
    email = `e2e-signup-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
    // 15-char minimum (src/lib/password-policy.ts).
    const password = `Wilmet-Signup-${randomUUID()}!Aa1`;

    // Diagnostics only -- the real Supabase Auth signup call goes straight
    // from the browser to Supabase, not through our own API, so a rate
    // limit or config-driven error on that call is otherwise invisible. Kept
    // permanently: this is exactly what surfaced over_email_send_rate_limit
    // (Supabase's own built-in mailer quota, not an app or test bug) the
    // first time this test ran for real.
    page.on("response", (res) => {
      if (res.url().includes("/auth/v1/signup")) {
        console.log(`[diagnostic] Supabase signup response: ${res.status()}`);
        res
          .text()
          .then((body) => console.log("[diagnostic] Supabase signup body:", body))
          .catch(() => undefined);
      }
    });

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

    // With "Confirm email" off on this disposable project, signUp() returns
    // a session immediately -- submit() calls onAuthenticated(), which
    // resolves the role home and redirects. A brand-new seller has no
    // user_roles row yet, so resolveRoleHome() falls through to its default,
    // "/dashboard" (src/hooks/useRoleHome.ts) -- same destination as
    // partner-auth-journey.pw.ts's login test.
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
