import { z } from "zod";

/**
 * Optional numeric field. Accepts "", null, undefined and NaN (empty <input type=number>)
 * and turns them into null. A filled but non-numeric value keeps a readable message.
 */
const optionalNumber = (opts: { min: number; max: number; int?: boolean }) =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : v; // keep original so Zod reports a type error
    }
    return v;
  }, (opts.int ? z.number({ message: "Valeur numérique invalide" }).int("Nombre entier attendu") : z.number({ message: "Valeur numérique invalide" }))
    .min(opts.min, `Valeur minimale : ${opts.min}`)
    .max(opts.max, `Valeur maximale : ${opts.max}`)
    .nullable());

export const buyerLeadSchema = z.object({
  // step 1
  vehicle_category: z.string().min(1),
  vehicle_type: z.string().min(1),
  body_type: z.string().optional().or(z.literal("")),
  preferred_brand: z.string().optional().or(z.literal("")),
  preferred_model: z.string().optional().or(z.literal("")),
  intended_use: z.string().optional().or(z.literal("")),
  usage_country: z.string().optional().or(z.literal("")),
  // step 2
  min_year: optionalNumber({ min: 1970, max: 2100, int: true }).optional(),
  max_mileage: optionalNumber({ min: 0, max: 3_000_000, int: true }).optional(),
  min_euro_norm: z.string().optional().or(z.literal("")),
  fuel_type: z.string().optional().or(z.literal("")),
  gearbox: z.string().optional().or(z.literal("")),
  ptac_kg: optionalNumber({ min: 0, max: 200_000, int: true }).optional(),
  payload_kg: optionalNumber({ min: 0, max: 200_000, int: true }).optional(),
  required_equipment: z.array(z.string()).optional().default([]),
  wanted_equipment: z.array(z.string()).optional().default([]),
  // step 3
  max_budget_ht: optionalNumber({ min: 0, max: 10_000_000 }).optional(),
  currency: z.string().default("EUR"),
  budget_flexible: z.enum(["oui", "non", "selon_opportunite"]).optional(),
  buy_timeline: z.enum(["immediat", "sous_7j", "sous_30j", "sous_3m", "projet_futur"]).optional(),
  financing_needed: z.enum(["oui", "non", "a_discuter"]).optional(),
  // step 4 — contact
  first_name: z.string().trim().min(1, "Champ requis").max(80),
  last_name: z.string().trim().min(1, "Champ requis").max(80),
  company_name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Adresse e-mail invalide").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().max(2).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  gdpr_consent: z.literal(true),
  locale: z.string().max(5).default("fr"),
  // Anti-spam honeypot — must remain empty. Real users don't see this field.
  website: z.string().max(0).optional().or(z.literal("")),
  // Affiliate attribution: code carried from ?ref= on any public page.
  referral_code: z.string().trim().max(40).optional().or(z.literal("")),

});

export type BuyerLeadInput = z.infer<typeof buyerLeadSchema>;

/** Human labels used in user-facing validation messages (never schema internals). */
export const BUYER_FIELD_LABELS: Record<string, string> = {
  vehicle_category: "Catégorie de véhicule",
  vehicle_type: "Type de véhicule",
  body_type: "Carrosserie",
  preferred_brand: "Marque souhaitée",
  preferred_model: "Modèle souhaité",
  intended_use: "Usage prévu",
  usage_country: "Pays d'utilisation",
  min_year: "Année minimum",
  max_mileage: "Kilométrage maximum",
  min_euro_norm: "Norme Euro minimum",
  fuel_type: "Carburant",
  gearbox: "Boîte de vitesses",
  ptac_kg: "PTAC (kg)",
  payload_kg: "Charge utile (kg)",
  max_budget_ht: "Budget maximum HT",
  currency: "Devise",
  budget_flexible: "Flexibilité du budget",
  buy_timeline: "Délai d'achat",
  financing_needed: "Financement",
  first_name: "Prénom",
  last_name: "Nom",
  company_name: "Société",
  email: "E-mail",
  phone: "Téléphone",
  country: "Pays",
  city: "Ville",
  message: "Message",
  gdpr_consent: "Consentement RGPD",
};

export type BuyerLeadParseResult =
  | { ok: true; data: BuyerLeadInput }
  | { ok: false; message: string; fields: string[]; issues: unknown };

/**
 * Safe parser shared by the public API route and any server-side caller.
 * Never surfaces raw Zod output: callers get a short French sentence plus field names.
 */
export function parseBuyerLead(payload: unknown): BuyerLeadParseResult {
  const parsed = buyerLeadSchema.safeParse(payload);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fields = Array.from(
    new Set(parsed.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean)),
  );
  const labels = fields.map((f) => BUYER_FIELD_LABELS[f] ?? f);
  const message = labels.length
    ? `Merci de vérifier : ${labels.slice(0, 4).join(", ")}${labels.length > 4 ? "…" : ""}.`
    : "Certains champs du formulaire sont invalides.";
  return { ok: false, message, fields, issues: parsed.error.issues };
}
