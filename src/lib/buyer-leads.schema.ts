import { z } from "zod";

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
  min_year: z.number().int().min(1970).max(2100).optional().nullable(),
  max_mileage: z.number().int().min(0).max(3_000_000).optional().nullable(),
  min_euro_norm: z.string().optional().or(z.literal("")),
  fuel_type: z.string().optional().or(z.literal("")),
  gearbox: z.string().optional().or(z.literal("")),
  ptac_kg: z.number().int().min(0).max(200_000).optional().nullable(),
  payload_kg: z.number().int().min(0).max(200_000).optional().nullable(),
  required_equipment: z.array(z.string()).optional().default([]),
  wanted_equipment: z.array(z.string()).optional().default([]),
  // step 3
  max_budget_ht: z.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().default("EUR"),
  budget_flexible: z.enum(["oui", "non", "selon_opportunite"]).optional(),
  buy_timeline: z.enum(["immediat", "sous_7j", "sous_30j", "sous_3m", "projet_futur"]).optional(),
  financing_needed: z.enum(["oui", "non", "a_discuter"]).optional(),
  // step 4 — contact
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  company_name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(200),
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
