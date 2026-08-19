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
    expect(reportOnlyCsp).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    );
    expect(headers["content-security-policy"]).toBeUndefined();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "geolocation=(), microphone=(), payment=(), usb=()",
    );
    expect(headers["strict-transport-security"]).toMatch(/(?:^|;\s*)max-age=\d+/);
  });

  test("partner auth route renders the login boundary", async ({ page }) => {
    const response = await page.goto("/auth", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Connexion partenaire", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
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
