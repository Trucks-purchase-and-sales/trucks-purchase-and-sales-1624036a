import type { BuyerLeadInput } from "./buyer-leads.schema";

const cleanText = (v?: string | null) => (v && v.length ? v : null);

export type ReferrerInfo = { code: string; ownerId: string; canOwnLeads: boolean } | null;

/**
 * Single source of truth for the buyer_leads row shape. Both the anonymous
 * public endpoint and the authenticated server function build the row here so
 * the two paths cannot drift.
 * `ownerUserId` is always decided server-side; it is never read from the body.
 */
export function buildBuyerLeadRow(args: {
  id: string;
  data: BuyerLeadInput;
  ownerUserId: string | null;
  referrer: ReferrerInfo;
  assignedGroup: "sales" | null;
}) {
  const { id, data: d, ownerUserId, referrer: ref, assignedGroup } = args;
  return {
    id,
    user_id: ownerUserId,
    vehicle_category: cleanText(d.vehicle_category),
    assigned_group: assignedGroup,
    vehicle_type: cleanText(d.vehicle_type),
    body_type: cleanText(d.body_type),
    preferred_brand: cleanText(d.preferred_brand),
    preferred_model: cleanText(d.preferred_model),
    intended_use: cleanText(d.intended_use),
    usage_country: cleanText(d.usage_country),
    min_year: d.min_year ?? null,
    max_mileage: d.max_mileage ?? null,
    min_euro_norm: cleanText(d.min_euro_norm),
    fuel_type: cleanText(d.fuel_type),
    gearbox: cleanText(d.gearbox),
    ptac_kg: d.ptac_kg ?? null,
    payload_kg: d.payload_kg ?? null,
    required_equipment: d.required_equipment ?? [],
    wanted_equipment: d.wanted_equipment ?? [],
    max_budget_ht: d.max_budget_ht ?? null,
    currency: d.currency ?? "EUR",
    budget_flexible: cleanText(d.budget_flexible ?? null),
    buy_timeline: cleanText(d.buy_timeline ?? null),
    financing_needed: cleanText(d.financing_needed ?? null),
    first_name: d.first_name,
    last_name: d.last_name,
    company_name: cleanText(d.company_name),
    email: d.email,
    phone: cleanText(d.phone),
    country: cleanText(d.country),
    city: cleanText(d.city),
    message: cleanText(d.message),
    gdpr_consent: d.gdpr_consent,
    locale: d.locale ?? "fr",
    source: ref ? `affiliate:${ref.code}` : "public_form",
    referred_by: ref?.ownerId ?? null,
    referral_code: ref?.code ?? null,
    assigned_sales_agent_id: ref?.canOwnLeads ? ref.ownerId : null,
  };
}
