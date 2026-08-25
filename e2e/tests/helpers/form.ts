import type { Page } from "@playwright/test";

/**
 * Locates the Field wrapper (a shared "space-y-1.5" div containing a label
 * and its control) by the label's substring text. This app's Field
 * components never wire htmlFor/id to their control (see
 * phase4-e2e-smoke-suite.txt Finding #2, confirmed again in the opportunity
 * wizard and the buyer request form), so getByLabel cannot resolve any of
 * them -- and the two implementations nest the label at different depths
 * relative to the control (one level apart in the buyer form, two in the
 * opportunity wizard), so climbing a fixed number of parents from the label
 * breaks on whichever one it wasn't written against. Selecting the wrapper
 * directly by its shared class and searching downward for the control
 * works for both regardless of nesting depth. Substring (not exact) match
 * on the label because required fields append "*" and optional ones append
 * "(optionnel)" to the label text.
 */
function fieldWrapper(page: Page, labelSubstring: string) {
  return page
    .locator("div.space-y-1\\.5")
    .filter({ has: page.locator("label", { hasText: labelSubstring }) })
    .first();
}

export function labeledInput(page: Page, labelSubstring: string) {
  return fieldWrapper(page, labelSubstring).locator("input");
}

/** Opens a SearchableCombobox (components/pickers/SearchableCombobox.tsx) by
 * its label and picks the first listed option -- used when the test only
 * needs *a* valid value, not a specific one. */
export async function selectFirstComboboxOption(page: Page, labelSubstring: string) {
  await fieldWrapper(page, labelSubstring).locator('button[role="combobox"]').click();
  await page.getByRole("option").first().click();
}
