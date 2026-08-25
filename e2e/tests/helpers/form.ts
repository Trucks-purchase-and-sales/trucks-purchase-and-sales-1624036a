import type { Page } from "@playwright/test";

/**
 * Locates the Field wrapper (a shared "space-y-1.5" div containing a label
 * and its control) by the label text. This app's Field components never
 * wire htmlFor/id to their control (see phase4-e2e-smoke-suite.txt Finding
 * #2, confirmed again in the opportunity wizard and the buyer request
 * form), so getByLabel cannot resolve any of them -- and the two
 * implementations nest the label at different depths relative to the
 * control (one level apart in the buyer form, two in the opportunity
 * wizard), so climbing a fixed number of parents from the label breaks on
 * whichever one it wasn't written against. Selecting the wrapper directly
 * by its shared class and searching downward for the control works for
 * both regardless of nesting depth.
 *
 * Accepts a plain string OR a RegExp. A plain string does a
 * case-insensitive SUBSTRING match (Playwright's hasText default) -- fine
 * for most labels, but a real bug once: "Nom" as a string also matched
 * "Prénom" (contains "nom") and, being first in the form, silently
 * absorbed the fill meant for the actual "Nom" field while leaving it
 * empty, with no error anywhere -- only a validation toast the test
 * wasn't checking for. Pass an anchored RegExp (e.g. /^Nom/i) for any
 * label that is a substring of another label on the same page.
 */
function fieldWrapper(page: Page, label: string | RegExp) {
  return page
    .locator("div.space-y-1\\.5")
    .filter({ has: page.locator("label", { hasText: label }) })
    .first();
}

export function labeledInput(page: Page, label: string | RegExp) {
  return fieldWrapper(page, label).locator("input");
}

/** Opens a SearchableCombobox (components/pickers/SearchableCombobox.tsx) by
 * its label and picks the first listed option -- used when the test only
 * needs *a* valid value, not a specific one. */
export async function selectFirstComboboxOption(page: Page, label: string | RegExp) {
  await fieldWrapper(page, label).locator('button[role="combobox"]').click();
  await page.getByRole("option").first().click();
}
