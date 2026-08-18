import { z } from "zod";

/**
 * Shared draft input contract for the seller vehicle proposal wizard.
 * Kept in a client-safe module so it can be unit-checked without pulling
 * the server function graph.
 *
 * Drafts stay partial, but every value that is present is bounded and
 * structurally validated. Final-submission completeness remains a separate
 * business rule in wilmet-constants.ts.
 */

const SHORT_TEXT = 120;
const LONG_TEXT = 4_000;

const text = (max = SHORT_TEXT) => z.string().trim().max(max);
const optionalText = (max = SHORT_TEXT) => text(max).optional().nullable();
const yesNo = z.enum(["oui", "non"]);

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === "" || z.string().email().safeParse(value).success, "Adresse e-mail invalide.")
  .optional()
  .nullable();

const optionalUrl = z
  .string()
  .trim()
  .max(2_048)
  .refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL invalide : seuls les liens HTTP(S) sont acceptés.")
  .optional()
  .nullable();

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Date invalide.");

const firstRegistrationDate = isoDate.refine(
  (value) => value <= new Date().toISOString().slice(0, 10),
  "La date de première mise en circulation ne peut pas être dans le futur.",
);

const phone = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => value === "" || /^[0-9+().\s/-]+$/.test(value),
    "Numéro de téléphone invalide.",
  );

// Full draft schema — all optional to allow saving partial drafts.
export const opportunityInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_type: optionalText(80),
  vehicle_category: optionalText(80),
  brand: optionalText(),
  model: optionalText(),
  version: optionalText(),
  // `year` is no longer collected: it is derived from first_registration_date.
  first_registration_date: firstRegistrationDate.optional().nullable(),
  mileage: z.number().int().min(0).max(3_000_000).optional().nullable(),
  registration_number: optionalText(32),
  // Some industrial/legacy chassis identifiers are not exactly 17 characters.
  vin: optionalText(64),
  city: optionalText(),
  postal_code: optionalText(24),
  country: optionalText(),
  visible_on_site: z.enum(["oui", "non", "sur_rendez_vous"]).optional().nullable(),
  fuel_type: optionalText(80),
  gearbox: optionalText(80),
  power: optionalText(80),
  euro_standard: optionalText(80),
  gross_vehicle_weight: optionalText(40),
  payload: optionalText(40),
  axle_configuration: optionalText(40),
  cabin_type: optionalText(80),
  equipment: z.array(text()).max(30).optional().nullable(),
  general_condition: z.enum(["bon", "moyen", "mauvais"]).optional().nullable(),
  vehicle_runs: yesNo.optional().nullable(),
  technical_inspection_status: yesNo.optional().nullable(),
  maintenance_status: yesNo.optional().nullable(),
  known_defects: optionalText(LONG_TEXT),
  expected_repairs: optionalText(LONG_TEXT),
  additional_comments: optionalText(LONG_TEXT),
  desired_price_excl_tax: z.number().min(0).max(2_000_000).optional().nullable(),
  price_negotiable: z
    .enum(["oui", "non", "a_discuter"], {
      message: "Valeur de négociabilité invalide : choisissez Oui, Non ou À discuter.",
    })
    .optional()
    .nullable(),
  availability: z
    .enum(["immediate", "sous_7_jours", "sous_30_jours", "a_confirmer"], {
      message:
        "Valeur de disponibilité invalide : choisissez Immédiate, Sous 7 jours, Sous 30 jours ou À confirmer.",
    })
    .optional()
    .nullable(),
  free_of_commitment: yesNo.optional().nullable(),
  special_conditions: optionalText(LONG_TEXT),
  onsite_contact_name: optionalText(),
  onsite_contact_phone: phone.optional().nullable(),
  onsite_contact_email: optionalEmail,
  vat_recoverable: z.enum(["oui", "non", "marge"]).optional().nullable(),
  has_accident: z.enum(["oui", "non", "a_verifier"]).optional().nullable(),
  has_breakdown: yesNo.optional().nullable(),
  maintenance_history: optionalText(80),
  body_type: optionalText(80),
  body_type_other: optionalText(),
  wheelbase_mm: z.number().int().min(0).max(30_000).optional().nullable(),
  suspension_type: optionalText(80),
  tyre_size: optionalText(80),
  box_height_mm: z.number().int().min(0).max(20_000).optional().nullable(),
  box_width_mm: z.number().int().min(0).max(20_000).optional().nullable(),
  box_depth_mm: z.number().int().min(0).max(30_000).optional().nullable(),
  not_running_reason: optionalText(LONG_TEXT),
  inspection_valid_until: isoDate.optional().nullable(),
  has_service_book: yesNo.optional().nullable(),
  key_code: optionalText(80),
  keys_count: z.number().int().min(1).max(4).optional().nullable(),
  defects_and_comments: optionalText(LONG_TEXT),
  free_of_pledge: yesNo.optional().nullable(),

  has_air_conditioning: yesNo.optional().nullable(),
  has_heating: yesNo.optional().nullable(),
  has_hydraulic_hook: yesNo.optional().nullable(),
  has_crane: yesNo.optional().nullable(),
  crane_details: optionalText(1_000),
  other_equipment_details: optionalText(1_000),
  location_url: optionalUrl,
  tail_lift_present: yesNo.optional().nullable(),
  tail_lift_homologated: yesNo.optional().nullable(),
  tail_lift_homologation_book: yesNo.optional().nullable(),
  tail_lift_maintenance_book: yesNo.optional().nullable(),
  tail_lift_condition: z.enum(["fonctionnel", "a_reviser", "hors_service"]).optional().nullable(),
  tail_lift_comment: optionalText(1_000),
}).strip();

export type OpportunityInput = z.infer<typeof opportunityInput>;

/** Legacy availability values emitted by an earlier build / stale open tab. */
const LEGACY_AVAILABILITY: Record<string, string> = {
  "15_30_jours": "sous_30_jours",
  moins_15_jours: "a_confirmer",
  plus_30_jours: "a_confirmer",
};

/** French labels used in user-facing validation messages. */
const FIELD_LABELS: Record<string, string> = {
  vehicle_category: "Catégorie de véhicule",
  brand: "Marque",
  model: "Modèle",
  body_type: "Carrosserie",
  body_type_other: "Carrosserie (autre)",
  first_registration_date: "Date de 1re immatriculation",
  mileage: "Kilométrage",
  registration_number: "Immatriculation",
  vin: "VIN / numéro de châssis",
  city: "Ville",
  postal_code: "Code postal",
  country: "Pays",
  visible_on_site: "Visible sur place",
  fuel_type: "Carburant",
  gearbox: "Boîte de vitesses",
  power: "Puissance",
  euro_standard: "Norme Euro",
  gross_vehicle_weight: "PTAC",
  payload: "Charge utile",
  keys_count: "Nombre de clés",
  wheelbase_mm: "Empattement",
  box_height_mm: "Hauteur de caisse",
  box_width_mm: "Largeur de caisse",
  box_depth_mm: "Longueur de caisse",
  desired_price_excl_tax: "Prix souhaité HT",
  price_negotiable: "Prix négociable",
  availability: "Disponibilité",
  free_of_pledge: "Libre de tout gage",
  onsite_contact_name: "Contact sur place (nom)",
  onsite_contact_phone: "Contact sur place (téléphone)",
  onsite_contact_email: "Contact sur place (e-mail)",
  general_condition: "État général",
  vehicle_runs: "Le véhicule roule",
  not_running_reason: "Motif d'immobilisation",
  technical_inspection_status: "Contrôle technique",
  inspection_valid_until: "Validité du contrôle technique",
  has_accident: "Antécédent d'accident",
  location_url: "Lien de localisation",
  equipment: "Équipements",
};

function labelFor(path: (string | number | symbol)[]): string {
  const key = String(path[0] ?? "");
  return FIELD_LABELS[key] ?? key;
}

/**
 * Compatibility bridge: rewrite only known stale availability values before
 * strict enum validation. The current UI already emits valid enum values.
 */
export function bridgeLegacyValues(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const av = obj.availability;
  if (typeof av === "string" && LEGACY_AVAILABILITY[av]) obj.availability = LEGACY_AVAILABILITY[av];
  return obj;
}

/**
 * Parse a draft payload. Never lets a ZodError / raw JSON blob reach the UI:
 * throws a concise French Error naming the offending field(s).
 */
export function parseOpportunityInput(raw: unknown): OpportunityInput {
  const bridged = bridgeLegacyValues(raw);
  const result = opportunityInput.safeParse(bridged);
  if (result.success) return result.data;
  // Detailed diagnostics stay server-side only.
  console.error("[opportunity-input] validation failed", JSON.stringify(result.error.issues));
  const fields = Array.from(new Set(result.error.issues.map((i) => labelFor(i.path))));
  throw new Error(`Données du formulaire invalides : ${fields.join(", ")}.`);
}

// Normalise: empty strings -> null. String values have already been trimmed by Zod.
function clean(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}
export function normalise<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = Array.isArray(v) ? v : clean(v);
  return out as T;
}
