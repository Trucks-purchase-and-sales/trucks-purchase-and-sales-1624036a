// Server-only: matches a freshly published sale listing against open buyer demands
// and notifies the interested buyers (and the sales staff following the demand).
// Notifications are service-role inserts because clients cannot write that table.

const OPEN_DEMAND_STATUSES = [
  "nouvelle",
  "qualifiee",
  "en_recherche",
  "proposition_envoyee",
  "negociation",
] as const;

type DemandRow = {
  id: string;
  client_id: string | null;
  assigned_sales_agent_id: string | null;
  brand: string | null;
  model: string | null;
  vehicle_type: string | null;
  vehicle_category: string | null;
  max_budget_ht: number | null;
  max_mileage: number | null;
  year_min: number | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Rule-based relevance: budget fits and at least brand, category or vehicle type matches. */
function isRelevant(
  demand: DemandRow,
  opp: {
    brand: string | null; model: string | null; vehicle_type: string | null;
    vehicle_category: string | null; mileage: number | null; year: number | null;
  },
  price: number | null,
): boolean {
  if (price != null && demand.max_budget_ht != null && price > Number(demand.max_budget_ht) * 1.1) return false;
  if (demand.max_mileage != null && opp.mileage != null && opp.mileage > demand.max_mileage * 1.15) return false;
  if (demand.year_min != null && opp.year != null && opp.year < demand.year_min) return false;

  const brandMatch = !!norm(demand.brand) && norm(demand.brand) === norm(opp.brand);
  const categoryMatch = !!norm(demand.vehicle_category) && norm(demand.vehicle_category) === norm(opp.vehicle_category);
  const typeMatch = !!norm(demand.vehicle_type) && norm(demand.vehicle_type) === norm(opp.vehicle_type);
  return brandMatch || categoryMatch || typeMatch;
}

export async function notifyBuyersForListing(listingId: string): Promise<{ notified: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  const { data: listing, error } = await sb
    .from("sale_listings")
    .select("id, reference_number, title, sale_price_excl_tax, vehicle_opportunity_id, vehicle_opportunities(brand, model, vehicle_type, vehicle_category, mileage, year)")
    .eq("id", listingId)
    .maybeSingle();
  if (error || !listing) {
    console.error("[sale-listing-notify] listing read failed", error);
    return { notified: 0 };
  }
  const opp = (listing.vehicle_opportunities ?? {}) as {
    brand: string | null; model: string | null; vehicle_type: string | null;
    vehicle_category: string | null; mileage: number | null; year: number | null;
  };
  const price = listing.sale_price_excl_tax != null ? Number(listing.sale_price_excl_tax) : null;

  const { data: demands, error: dErr } = await sb
    .from("demand_opportunities")
    .select("id, client_id, assigned_sales_agent_id, brand, model, vehicle_type, vehicle_category, max_budget_ht, max_mileage, year_min")
    .in("status", OPEN_DEMAND_STATUSES as unknown as string[]);
  if (dErr) {
    console.error("[sale-listing-notify] demands read failed", dErr);
    return { notified: 0 };
  }

  const matches = (demands ?? []).filter((d: DemandRow) => isRelevant(d, opp, price));
  if (matches.length === 0) return { notified: 0 };

  const label = [opp.brand, opp.model].filter(Boolean).join(" ") || listing.title;
  const recipients = new Set<string>();
  for (const m of matches as DemandRow[]) {
    if (m.client_id) recipients.add(m.client_id);
    if (m.assigned_sales_agent_id) recipients.add(m.assigned_sales_agent_id);
  }
  if (recipients.size === 0) return { notified: 0 };

  const rows = [...recipients].map((userId) => ({
    user_id: userId,
    type: "sale_listing_published",
    title: "Nouveau véhicule correspondant à une demande",
    body: `${label}${price != null ? ` — ${Math.round(price).toLocaleString("fr-FR")} € HT` : ""}`,
    vehicle_opportunity_id: listing.vehicle_opportunity_id,
  }));

  const { error: nErr } = await sb.from("notifications").insert(rows);
  if (nErr) {
    console.error("[sale-listing-notify] notification insert failed", nErr);
    return { notified: 0 };
  }
  return { notified: rows.length };
}

/** Create the draft sale listing for a just-purchased opportunity (idempotent). */
export async function ensureDraftListingForPurchase(opportunityId: string, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  const { data: existing } = await sb.from("sale_listings").select("id")
    .eq("vehicle_opportunity_id", opportunityId).maybeSingle();
  if (existing) return;

  const { data: opp, error } = await sb
    .from("vehicle_opportunities")
    .select("id, brand, model, version, year, mileage, city, country, purchase_price_excl_tax, availability, vat_recoverable")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error || !opp) {
    console.error("[sale-listing-notify] opp read failed", error);
    return;
  }

  const title = [opp.brand, opp.model, opp.version, opp.year].filter(Boolean).join(" ") || "Véhicule";
  const { data: photos } = await sb.from("vehicle_photos")
    .select("id").eq("vehicle_opportunity_id", opportunityId).order("sort_order");

  const { error: insErr } = await sb.from("sale_listings").insert({
    vehicle_opportunity_id: opportunityId,
    title,
    sale_price_excl_tax: null,
    availability: opp.availability ?? null,
    city: opp.city ?? null,
    country: opp.country ?? null,
    photo_ids: (photos ?? []).map((p: { id: string }) => p.id),
    purchase_price_snapshot: opp.purchase_price_excl_tax ?? null,
    assigned_group: "sales",
    created_by: userId,
    status: "brouillon",
  });
  if (insErr) console.error("[sale-listing-notify] draft listing insert failed", insErr);
}
