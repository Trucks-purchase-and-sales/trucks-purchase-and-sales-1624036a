import type { Page } from "@playwright/test";

/**
 * Locates the <input> sibling of a Field/Label pair by the label's
 * substring text. This app's shared Field components never wire
 * htmlFor/id to their control (see phase4-e2e-smoke-suite.txt Finding #2,
 * confirmed again in the opportunity wizard and the buyer request form),
 * so getByLabel cannot resolve any of them. Substring (not exact) match
 * because required fields append "*" and optional ones append "(optionnel)"
 * to the label text.
 */
export function labeledInput(page: Page, labelSubstring: string) {
  return page.locator("label").filter({ hasText: labelSubstring }).locator("xpath=../../input");
}

/** Opens a SearchableCombobox (components/pickers/SearchableCombobox.tsx) by
 * its label and picks the first listed option -- used when the test only
 * needs *a* valid value, not a specific one. */
export async function selectFirstComboboxOption(page: Page, labelSubstring: string) {
  const trigger = page
    .locator("label")
    .filter({ hasText: labelSubstring })
    .locator("xpath=../../button[@role='combobox']");
  await trigger.click();
  await page.getByRole("option").first().click();
}
