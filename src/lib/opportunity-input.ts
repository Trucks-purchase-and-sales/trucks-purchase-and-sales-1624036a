import { z } from "zod";

/**
 * Shared draft input contract for the seller vehicle proposal wizard.
 * Kept in a client-safe module so it can be unit-checked without pulling
 * the server function graph.
 */

// Full draft schema — all optional to allow saving partial drafts.
export const opportunityInput = z.object({
  id: z.string().uuid().optional(),
  vehicle_type: z.string().optional().nullable(),
  vehicle_category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  // `year` is no longer collected: it is derived from first_registration_date.
  first_registration_date: z.string().optional().nullable(),
  mileage: z.number().int().optional().nullable(),
  registration_number: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  visible_on_site: z.string().optional().nullable(),
  fuel_type: z.string().optional().nullable(),
  gearbox: z.string().optional().nullable(),
  power: z.string().optional().nullable(),
  euro_standard: z.string().optional().nullable(),
  gross_vehicle_weight: z.string().optional().nullable(),
  payload: z.string().optional().nullable(),
  axle_configuration: z.string().optional().nullable(),
  cabin_type: z.string().optional().nullable(),
  equipment: z.array(z.string()).optional().nullable(),
  general_condition: z.string().optional().nullable(),
  vehicle_runs: z.string().optional().nullable(),
  technical_inspection_status: z.string().optional().nullable(),
  maintenance_status: z.string().optional().nullable(),
  known_defects: z.string().optional().nullable(),
  expected_repairs: z.string().optional().nullable(),
  additional_comments: z.string().optional().nullable(),
  desired_price_excl_tax: z.number().optional().nullable(),
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
  free_of_commitment: z.string().optional().nullable(),
  special_conditions: z.string().optional().nullable(),
  onsite_contact_name: z.string().optional().nullable(),
  onsite_contact_phone: z.string().optional().nullable(),
  onsite_contact_email: z.string().optional().nullable(),
  vat_recoverable: z.string().optional().nullable(),
  has_accident: z.string().optional().nullable(),
  has_breakdown: z.string().optional().nullable(),
  maintenance_history: z.string().optional().nullable(),
  body_type: z.string().optional().nullable(),
  body_type_other: z.string().optional().nullable(),
  wheelbase_mm: z.number().int().optional().nullable(),
  suspension_type: z.string().optional().nullable(),
  tyre_size: z.string().optional().nullable(),
  box_height_mm: z.number().int().optional().nullable(),
  box_width_mm: z.number().int().optional().nullable(),
  box_depth_mm: z.number().int().optional().nullable(),
  not_running_reason: z.string().optional().nullable(),
  inspection_valid_until: z.string().optional().nullable(),
  has_service_book: z.string().optional().nullable(),
  key_code: z.string().optional().nullable(),
  keys_count: z.number().int().min(1).max(4).optional().nullable(),
  defects_and_comments: z.string().optional().nullable(),
  free_of_pledge: z.string().optional().nullable(),

  has_air_conditioning: z.string().optional().nullable(),
  has_heating: z.string().optional().nullable(),
  has_hydraulic_hook: z.string().optional().nullable(),
  has_crane: z.string().optional().nullable(),
  crane_details: z.string().optional().nullable(),
  other_equipment_details: z.string().optional().nullable(),
  location_url: z.string().optional().nullable(),
  tail_lift_present: z.string().optional().nullable(),
  tail_lift_homologated: z.string().optional().nullable(),
  tail_lift_homologation_book: z.string().optional().nullable(),
  tail_lift_maintenance_book: z.string().optional().nullable(),
  tail_lift_condition: z.string().optional().nullable(),
  tail_lift_comment: z.string().optional().nullable(),
});

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
  vin: "VIN / numéro de châssis",
  city: "Ville",
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

// Normalise: empty strings -> null.
function clean(v: unknown) {
  if (v === "" || v === undefined) return null;
  return v;
}
export function normalise<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = Array.isArray(v) ? v : clean(v);
  return out as T;
}
