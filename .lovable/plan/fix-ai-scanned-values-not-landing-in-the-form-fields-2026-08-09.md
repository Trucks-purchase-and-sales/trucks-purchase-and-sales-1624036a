# Fix: AI-scanned values not landing in the form fields

## What I found

The "Garder + Appliquer" step does push the values into the wizard state — the problem is the **format** of those values. Free-text fields (VIN, immatriculation, année, kilométrage, ville, code postal, dimensions, dates) do fill correctly. Everything that is a dropdown or a picker silently stays empty, because the AI returns a human label while the field only accepts an internal code.

Confirmed mismatches between what the AI is told to return and what the form accepts:

| Field | AI returns | Form expects |
|---|---|---|
| Norme Euro | "Euro 6" | `euro_6` |
| Suspension | "pneumatique", "lames" | `lam_lam`, `lam_r`, `r_r` |
| Boîte | "robotisee" (not an option any more) | `manuelle` / `automatique` |
| Carrosserie | "tautliner", "caisse"… free list | slug from the reference table (`tautliner`, `benne_ampliroll`, `bdf`, …) |
| Pays | "France" | ISO code `FR` (EU-27 only) |
| Carburant / Cabine / Essieux | usually right, but capitalised or accented variants fail | exact lowercase code |
| Marque / Modèle | "MERCEDES", "Mercedes-Benz" | must match a reference label exactly |

Two extra causes for the marque/modèle case: the brand list is filtered by the selected **catégorie de véhicule** (which the AI never extracts), so a correct brand can be filtered out; and the model list only opens once the brand resolves to a known reference brand.

## Fix plan

1. **Normalise on the server** (`src/lib/ocr.functions.ts`)
   - Align the extraction prompt with the real option codes (Euro, suspension, boîte, carrosserie, cabine, essieux, carburant) and ask for the country as an ISO-2 code.
   - Add a mapping layer after the AI answer: lowercase/strip accents, then map each enum field onto its allowed code list (e.g. "Euro 6"/"EU6" → `euro_6`, "pneumatique" → `r_r`, "France"/"FRA" → `FR`). Drop the detection if no safe match instead of returning an unusable value.
   - Resolve `brand` and `model` against the reference tables (`ref_vehicle_brands`, `ref_vehicle_models`) with a case/accent-insensitive and punctuation-tolerant match ("MERCEDES" → "Mercedes-Benz"), and return the canonical label. Also infer `vehicle_category` when the brand belongs to a single category.
   - Validate `body_type` against `ref_body_types` slugs.

2. **Make the apply step safe** (`src/routes/_authenticated/opportunities.new.tsx`)
   - Apply `vehicle_category` before `brand` so the brand list is not filtered against an empty category, and don't clear a brand that came from the scan.
   - Skip empty/unresolved values so an existing manual entry is never overwritten with a blank.

3. **Visible feedback in the dialog** (`src/components/ocr/OcrPrefillDialog.tsx`)
   - Show dropdown detections as their human label but keep the code underneath, and flag any detection that could not be mapped as "non reconnu" so it is obvious it will not be applied rather than silently disappearing.
   - After applying, the toast lists how many fields were actually filled.

4. **Verify end-to-end** with a real scan (registration document + dashboard photo) and confirm each mapped dropdown shows the expected selection in steps 1-3.

## Technical notes

- Normalisation lives server-side so the audit rows in `ocr_field_detections` store the same canonical value the form receives.
- No schema change required; only the prompt, the post-processing, and the apply/merge logic change.
