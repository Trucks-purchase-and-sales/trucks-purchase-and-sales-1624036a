# FIND-002 — Seller vehicle-proposal wizard: completeness, relevance, reliability

## Verified current state

Checked directly against the database and the code before writing this plan.

- Reference tables are populated and readable with the public key. A direct REST read of
  `ref_vehicle_brands` and `ref_vehicle_categories` with the publishable key returns rows, both
  with and without an `Authorization: Bearer` header. So the opaque-key handling is **not** a
  confirmed root cause of empty selectors; the earlier emptiness came from the tables being empty
  before seeding. Categories in DB: `utilitaire`, `camion_porteur`, `tracteur_routier`,
  `semi_remorque`, `remorque`, `engin_special`.
- `src/lib/reference-data.functions.ts` still maps every result with `data ?? []`, so a genuine
  query failure (RLS change, network, bad key) is indistinguishable from an empty catalog. That is
  a real reliability defect even though it is not today's cause.
- `body_type` / `body_type_other` **are** already rendered in Step 1 with `applies_to` filtering and
  an "Autre" free-text follow-up, and category change already resets brand/model/body_type. The
  stated gap no longer exists; this plan verifies rather than re-implements it.
- `missingSubmissionFields()` in `src/lib/wilmet-constants.ts` is already the single source of truth
  and is called both client-side (`submitAll`) and server-side (`submitOpportunity`).

## Real remaining defects

1. **Silent reference failures.** `data ?? []` hides errors; `getReferenceData` cannot report a
   partial failure, so a broken table degrades to "no options" with no signal.
2. **Category-blind required fields.** `SUBMISSION_REQUIRED_FIELDS` demands `fuel_type`, `mileage`
   and `gross_vehicle_weight` from every category. A `semi_remorque` / `remorque` has no engine and
   no odometer, so a seller of a trailer is blocked by fields that do not exist for the asset.
3. **Engine fields shown for non-powered assets.** Step 2 renders Énergie, Boîte, Norme Euro,
   puissance for trailers as well.
4. **Hard-coded lists where a referential exists.** Énergie and Boîte read `FUEL_OPTIONS` /
   `GEARBOX_OPTIONS` constants while `ref_fuel_types` and `ref_gearbox_types` are seeded; Euro
   already reads the referential. This is the inconsistency to close.
5. **Weak numeric input constraints.** `mileage` has only `min=0`; `gross_vehicle_weight` is a free
   text string ("3.5 t, 19 t…"), price has no bound; no unit suffixes on several numeric fields.
6. **No visible retry affordance at catalog level.** `RefCombobox` handles per-field fallback, but
   there is no single banner telling the seller the catalog failed and offering one retry.
7. **No test tooling.** Repo has no vitest/jest; only `eslint` and TypeScript.

## Planned changes

### 1. Reference-data loading, honest errors

`src/lib/reference-data.functions.ts`:
- Keep the publishable server client, but align its fetch with `client.server.ts`: send `apikey`
  and drop a `Bearer <opaque key>` Authorization header, so the function is immune to key-format
  changes.
- Collect per-table errors instead of swallowing them. Return
  `{ ...lists, failed: string[] }`. If **every** table errors, throw so the query enters an error
  state; if some fail, return the good lists plus `failed` so the UI can warn precisely.

`opportunities.new.tsx`:
- Add a `staleTime` (5 min) and `retry: 1` on the `reference-data` query.
- Render a single dismissible banner above the wizard steps when `refState.error` or
  `failed.length > 0`: "Catalogue indisponible — la saisie libre reste possible" + a **Réessayer**
  button wired to `refetch`. Per-field `RefCombobox` fallback behaviour stays as-is.

### 2. Dependent selects and stale resets

Centralise the cascade in one helper (`applyCategoryChange`, `applyBrandChange`) instead of inline
`set(...)` chains, so every reset path is identical:
- Category change → clear `brand`, `model`, `body_type`, `body_type_other`, and any
  category-irrelevant technical values (see §3).
- Brand change → clear `model` only.
- Body type change away from `autre` → clear `body_type_other`.
- Keep the existing "unknown current value is kept as a selectable option" behaviour so old drafts
  (e.g. literal "Renault Trucks") never lose their value.
- Model stays a combobox with free-text fallback when the brand has no seeded model.

### 3. Category-aware relevance (`src/lib/wilmet-constants.ts`)

Introduce one exported classifier used by both UI and validation:

```ts
export type CategoryProfile = { powered: boolean; hasOdometer: boolean; hasPtac: boolean };
export function categoryProfile(slug?: string | null): CategoryProfile;
```

- `utilitaire`, `camion_porteur`, `tracteur_routier`, `engin_special` → powered, odometer, PTAC.
- `semi_remorque`, `remorque` → not powered, no odometer; weight captured as PTC rather than PTAC.
- Unknown / null category → treated as powered (permissive default, never blocks).

Step 2 hides Énergie, Boîte de vitesses, Norme Euro, puissance and Kilométrage for non-powered
categories, and relabels the weight field "PTC" for trailers.

### 4. Validation, one shared source of truth

`SUBMISSION_REQUIRED_FIELDS` entries gain an optional `appliesTo?: (p: CategoryProfile) => boolean`:

- always required: `vehicle_category`, `brand`, `model`, `body_type` (+ `body_type_other` if
  `autre`), `first_registration_date`, `city`, `country`, `general_condition`,
  `desired_price_excl_tax`.
- powered only: `fuel_type`, `mileage`, `vehicle_runs`.
- weight (`gross_vehicle_weight`) required for all, label switching PTAC/PTC.

`missingSubmissionFields(rec)` reads `rec.vehicle_category`, derives the profile and filters
accordingly. Both callers are unchanged, so client and server stay in lockstep by construction.
`submitOpportunity` must also `select` any newly consulted column. Existing conditional rules
(immobilisation reason, CT validity date) are preserved, with the immobilisation rule only applying
to powered categories. Drafts (`saveOpportunity`) stay fully permissive — no change.

### 5. Input constraints and microcopy

Light touch, no new form library:
- `mileage`: `type=number`, `min=0`, `max=3000000`, `step=1000`, suffix "km", hint "Compteur actuel".
- `desired_price_excl_tax`: `min=0`, `max=2000000`, suffix "€ HT".
- `first_registration_date`: `max` = today, `min` = 1980-01-01.
- Weight: keep the existing text column (no schema change) but add `inputMode="decimal"`,
  placeholder "19", suffix "t", and a light client-side sanity hint above 60 t.
- Dimension fields keep mm units in their labels.
- Values are clamped only on blur, never while typing, so nothing fights the user.

### 6. Referential-driven fuel and gearbox

Énergie and Boîte switch to `refs.fuelTypes` / `refs.gearboxTypes` with `FUEL_OPTIONS` /
`GEARBOX_OPTIONS` kept as the hard-coded fallback when the referential is empty or failed. Slugs
already match the DB enums, so stored values are unchanged.

### 7. Verification

No test framework exists and none will be added. Verification uses repo tooling plus a scripted
browser pass:
- `tsgo` typecheck and `eslint` clean on changed files.
- A Playwright script (kept under `/tmp`, not committed) signed in as a seller that: loads
  `/opportunities/new`, asserts the category/brand/country comboboxes have options, picks
  `camion_porteur` → Mercedes-Benz → Actros → Fourgon, checks the model list changes with the brand,
  then switches the category to `semi_remorque` and asserts engine fields disappear and the reset
  fired.
- A submit attempt on an empty draft to confirm the toast lists exactly the required fields and
  jumps to the right step, and that saving a draft still succeeds with nothing filled.

## Files expected to change

- `src/lib/reference-data.functions.ts` — key-safe fetch, per-table error surfacing, `failed[]`.
- `src/lib/wilmet-constants.ts` — `categoryProfile`, `appliesTo` on required fields, updated
  `missingSubmissionFields`.
- `src/lib/opportunities.functions.ts` — select the columns the validator needs; unchanged rules
  otherwise.
- `src/routes/_authenticated/opportunities.new.tsx` — catalog error banner + retry, cascade helpers,
  category-aware Step 2, referential-driven fuel/gearbox, numeric constraints and units.

No migration, no schema change, no RLS/grant/role change, no change to OCR, voice, photos, autosave,
the seller gate or the FIND-001 fixes.

## Risks

- Making some fields conditional relaxes validation for trailers; that is intentional and matches
  the Aug 3 business spec.
- Sellers with old powered drafts are unaffected — the required set for powered categories is
  identical to today.
- Referential-driven fuel/gearbox could shift labels if the seeded labels differ from the constants;
  slugs are identical, so stored data cannot drift.
