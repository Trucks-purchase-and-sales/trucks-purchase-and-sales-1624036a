import { expect, test } from "@playwright/test";
import { labeledInput } from "./helpers/form";
import { logInAsPartner } from "./helpers/login";
import { cleanupSeller, provisionSeller, type SellerIdentity } from "./helpers/seller";

// Requires a service-role key to provision a throwaway seller identity, same
// as partner-auth-journey.pw.ts. Skips cleanly without it.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

test.describe("Wilmet opportunity CRUD journey", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_ROLE_KEY,
    "requires E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY",
  );

  // A fresh identity per test, not a shared one across the whole file: both
  // tests here create their own opportunity and assert an exact card count,
  // so sharing one seller across tests would make that count depend on
  // execution order -- exactly the kind of cross-test coupling that caused
  // a real bug earlier this session in tests/staging/security.staging.ts.
  let seller: SellerIdentity;

  test.beforeEach(async () => {
    seller = await provisionSeller(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, "crud");
  });

  test.afterEach(async () => {
    if (seller) await cleanupSeller(seller);
  });

  test("a seller can create a vehicle opportunity draft and see it on their dashboard", async ({
    page,
  }) => {
    await logInAsPartner(page, seller.email, seller.password);

    await page.goto("/opportunities/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // Exclude the header's own "Proposer un véhicule" button, which links
    // to /opportunities/new and also matches a bare a[href^="/opportunities/"]
    // selector -- the actual card grid links go to /opportunities/{id}.
    const cards = page.locator('a[href^="/opportunities/"]:not([href="/opportunities/new"])');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByText("Brouillon", { exact: true })).toBeVisible();

    await cards.first().click();
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);
  });

  test("a seller can edit an existing draft and see the change reflected", async ({ page }) => {
    await logInAsPartner(page, seller.email, seller.password);

    await page.goto("/opportunities/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const cards = page.locator('a[href^="/opportunities/"]:not([href="/opportunities/new"])');
    await expect(cards).toHaveCount(1);
    await cards.first().click();
    await expect(page).toHaveURL(/\/opportunities\/[^/]+$/);

    // Drafts are edited by re-entering the same wizard with ?id=, not on
    // the detail page itself (opportunities.$id.tsx only shows a
    // "Continuer le brouillon" link back into it while status is brouillon).
    await page.getByRole("link", { name: "Continuer le brouillon" }).click();
    await expect(page).toHaveURL(/\/opportunities\/new\?id=/);

    await labeledInput(page, "Ville").fill("Anvers");
    await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Anvers", { exact: true })).toBeVisible();
  });
});
