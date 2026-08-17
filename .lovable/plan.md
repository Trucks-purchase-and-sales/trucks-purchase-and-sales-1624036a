# FIND-002 — Reference data seeding + form completeness

## Root cause

Verified by direct database counts: all eleven `ref_*` tables contain **0 rows**
(`ref_vehicle_categories`, `ref_vehicle_brands`, `ref_category_brands`, `ref_vehicle_models`,
`ref_vehicle_types`, `ref_fuel_types`, `ref_gearbox_types`, `ref_euro_standards`,
`ref_body_types`, `ref_countries`, `ref_equipment`).

The wizard reads them through `getReferenceData()`, so:

- Category, brand and country comboboxes render with an empty list and no explanation.
- Category → brand → model cascading cannot work (no `ref_category_brands` rows).
- Country picker filters on EU-27 against an empty table, so no country can be chosen.

Two other verified defects:

- `PHOTO_CATEGORIES` in `src/lib/wilmet-constants.ts` defines no entry with `required: true`,
  so `REQUIRED_PHOTO_CATEGORIES` is `[]` and both the client check and the server check in
  `submitOpportunity` pass trivially. The Aug 9 plan explicitly requires the manufacturer
  plate / VIN photo. Note: the dashboard photo category was already consolidated into a single
  `tableau_de_bord` labelled "Tableau de bord avec moteur allumé", so no new enum value is needed.
- `body_type` / `body_type_other` exist in the DB and in the wizard state type, but the wizard
  renders no carrosserie selector.

## Migration — idempotent reference seeding

One migration, all statements `INSERT ... ON CONFLICT (pk) DO UPDATE` so re-running is safe and
never duplicates. No schema change, no RLS or GRANT change.

- **Categories** (`ref_vehicle_categories`): utilitaire, camion-porteur, tracteur-routier,
  semi-remorque, remorque, engin/matériel spécifique.
- **Vehicle types** (`ref_vehicle_types`): aligned with the existing `vehicle_type` DB enum values
  only (utilitaire, camion_porteur, tracteur_routier, semi_remorque, remorque, benne,
  frigorifique, plateau, fourgon, autre) so stored values stay enum-compatible.
- **Brands** (`ref_vehicle_brands`): established European players —
  Mercedes-Benz, MAN, Scania, Volvo, DAF, Iveco, Renault (Renault Trucks merged in, per the
  Aug 3 plan), Ford Trucks, Fiat, Peugeot, Citroën, Opel, Nissan, Toyota, Volkswagen,
  Isuzu, Mitsubishi Fuso, plus trailer makers Schmitz Cargobull, Krone, Kögel, Lecitrailer,
  Fruehauf, Chereau, Benalu, Samro, Wielton, Berger, Legras, Autre.
- **Category → brand** (`ref_category_brands`): LCV brands mapped to `utilitaire`; truck brands to
  porteur/tracteur; trailer brands to semi-remorque/remorque. `Autre` is mapped to every category
  as a safety valve.
- **Models** (`ref_vehicle_models`): a realistic, non-exhaustive set per brand (e.g. Actros,
  Atego, Axor, Sprinter, Vito; TGX, TGS, TGL, TGM; R-Series, S-Series, P-Series; FH, FM, FL;
  XF, CF, LF; Stralis, S-Way, Eurocargo, Daily; T, D, Master, Trafic, Kangoo; Transit,
  Ducato, Boxer, Jumper, Crafter, Movano, Sprinter …). The UI keeps a free-text fallback when the
  brand has no models, so gaps never block a seller.
- **Body types** (`ref_body_types`) with `applies_to`: exact Aug 3 business lists.
  - Porteur: Fourgon, Frigo, Tautliner, Benne, Plateau, Ampliroll, Châssis, BDF, Citerne,
    Malaxeur, Porte-engins, Porte-voitures, Nacelle, Dépannage, Grumier, BOM, Balayeuse,
    Aspirateur, Transport animal, Porte-boissons, Autre.
  - Semi-remorque: Fourgon, Frigo, Tautliner, Benne, Plateau, Citerne, Autre.
  - Shared slugs get `applies_to` containing both categories.
- **Fuel** (`ref_fuel_types`) and **gearbox** (`ref_gearbox_types`): slugs identical to the
  `fuel_type` and `gearbox` DB enums (diesel/essence/electrique/hybride/gnv/autre;
  manuelle/automatique — `robotisee` intentionally omitted per the Aug 3 plan).
- **Euro standards** (`ref_euro_standards`): euro_3, euro_4, euro_5, euro_6 only.
- **Countries** (`ref_countries`): the full EU-27 with FR/EN names, France/Belgium/Netherlands/
  Germany/Spain/Italy given higher priority for ordering.
- **Equipment** (`ref_equipment`): only items not already covered by a dedicated field —
  groupe froid, GPS, caméra de recul, régulateur de vitesse, ralentisseur, attelage remorque,
  double couchette, boîte à outils, essieu relevable, roue de secours, chariot embarqué.

## Form changes

### New field — Carrosserie

Added to Step 1, right after Modèle: a combobox on `ref_body_types` filtered by the selected
category (`applies_to`), plus a conditional required free-text `body_type_other` when
`Autre` is chosen. Free-text fallback if the lookup returns nothing. No duplicate: the existing
`vehicle_type` field is kept as-is and is not touched.

### Reference-data states

`getReferenceData` is wrapped so the wizard can show, per selector:
loading skeleton, error with a retry, and an explicit "referential unavailable — enter freely"
fallback that swaps the combobox for a text input instead of a dead empty dropdown.

### Required photos

Marked `required: true` on `plaque_vin` (manufacturer plate / VIN) and `tableau_de_bord`
(dashboard, engine running). This automatically activates the already-written client-side and
server-side blocking checks. Draft saving is unaffected.

### Final-submission validation (draft stays permissive)

Enforced only on submit, mirrored client-side (toast + jump to the offending step) and
server-side in `submitOpportunity` (integrity):

- vehicle_category, brand, model
- body_type (+ body_type_other when `autre`)
- first_registration_date, mileage
- fuel_type, gross_vehicle_weight
- general_condition, vehicle_runs
- city, country
- desired_price_excl_tax
- the two required photo categories

Existing conditional rules (immobilisation reason, CT validity date) are preserved unchanged.
Everything else remains optional.

## Files expected to change

- `supabase/migrations/<ts>_seed_reference_data.sql` (new, via the migration tool)
- `src/lib/wilmet-constants.ts` — `required` flags on photo categories; submission-required field list
- `src/lib/reference-data.functions.ts` — expose `body_types.applies_to` cleanly (already selected) and error surfacing
- `src/routes/_authenticated/opportunities.new.tsx` — carrosserie field, loading/error/empty states, submit validation
- `src/lib/opportunities.functions.ts` — server-side submit validation of the required business fields

## Risks and compatibility

- Seeding is upsert-based, so existing manual rows are updated, never duplicated; no data loss.
- Slugs are deliberately kept enum-compatible for fuel, gearbox and vehicle type; body types are
  free-form text in the DB so no enum risk there.
- New submit-time requirements can block sellers who already have an old draft missing a field.
  Mitigation: the error message names the field and the wizard jumps to its step; drafts remain
  saveable at any completeness level.
- Renault Trucks merged into Renault at the referential level only. Existing opportunities holding
  the literal string "Renault Trucks" keep their value; the UI's "keep current value" fallback
  makes sure it still displays and remains selectable.
- No RLS, GRANT, routing or authorization change. No publish.
