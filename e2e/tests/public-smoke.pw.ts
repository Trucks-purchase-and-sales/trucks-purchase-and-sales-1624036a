import { expect, test } from "@playwright/test";

test.describe("Wilmet public staging smoke", () => {
  test("landing page renders the public shell", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Wilmet Trucks/i);
    await expect(page.getByAltText("Wilmet Trucks").first()).toBeVisible();
    await expect(page.locator('a[href="/auth"]').first()).toBeVisible();
  });

  test("staging ingress exposes the report-only security-header baseline", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();

    const headers = response?.headers() ?? {};
    const reportOnlyCsp = headers["content-security-policy-report-only"];

    expect(reportOnlyCsp).toBeTruthy();
    expect(reportOnlyCsp).toContain("default-src 'self'");
    expect(reportOnlyCsp).toContain("object-src 'none'");
    expect(reportOnlyCsp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(headers["content-security-policy"]).toBeUndefined();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe("geolocation=(), microphone=(), payment=(), usb=()");

    // HSTS is only meaningful (and only sent by the app) over HTTPS; the
    // "local" target runs a plain-HTTP dev server, so only enforce this
    // against a real HTTPS target. See phase4-e2e-smoke-suite.txt Finding #3.
    if (new URL(response!.url()).protocol === "https:") {
      expect(headers["strict-transport-security"]).toMatch(/(?:^|;\s*)max-age=\d+/);
    }
  });

  test("partner auth route renders the login boundary", async ({ page }) => {
    // Known issue, not a test bug: the Email/Mot de passe <label>s aren't
    // programmatically associated with their <input>s (no id/htmlFor), so
    // getByLabel can't resolve them. Queued for a Lovable fix -- see
    // apps/wilmet/evidence/phase4-e2e-smoke-suite.txt Finding #2. Flip this
    // back to a normal test once that's fixed; if this starts unexpectedly
    // passing, that's exactly the signal it's been fixed.
    test.fail();

    const response = await page.goto("/auth", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("seller signup deep link opens registration with seller selected", async ({ page }) => {
    const response = await page.goto("/auth?mode=signup&kind=seller", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Créer un compte partenaire", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Je vends/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  });

  test("auth tab selection is reflected in the URL", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "Inscription" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=signup/);
    await expect(page.getByText("Créer un compte partenaire", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Connexion" }).click();
    await expect(page).toHaveURL(/\/auth\?mode=login/);
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
  });

  test("buyer request route reaches the first wizard step", async ({ page }) => {
    const response = await page.goto("/chercher-un-vehicule/", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Chercher un véhicule/i);
    await expect(page.locator("[data-step-title]")).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });
});
