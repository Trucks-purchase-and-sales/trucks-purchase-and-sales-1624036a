import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";

function fail(where: string, error: unknown): never {
  console.error(`[sale-listings.functions:${where}]`, error);
  throw new Error(GENERIC);
}

const INTERNAL_ROLES = ["admin", "platform_admin", "company_management", "sales_manager", "sales_agent"] as const;

type Ctx = { role: string; seesAll: boolean; isExternal: boolean; groupIds: string[] };

async function assertInternal(sb: any, userId: string): Promise<Ctx> {
  const [{ data: roles, error }, { data: profile }, { data: memberships }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("profiles").select("is_external").eq("id", userId).maybeSingle(),
    sb.from("staff_group_members").select("group_id").eq("user_id", userId),
  ]);
  if (error) fail("assertInternal", error);
  const all = (roles ?? []).map((r: { role: string }) => r.role as string);
  const role = all.find((r: string) => (INTERNAL_ROLES as readonly string[]).includes(r));
  if (!role) throw new Error("Non autorisé");
  const isExternal = profile?.is_external === true;
  return {
    role,
    seesAll: role !== "sales_agent" && !isExternal,
    isExternal,
    groupIds: (memberships ?? []).map((m: { group_id: string }) => m.group_id),
  };
}

const listingStatus = z.enum(["brouillon", "publiee", "reservee", "vendue", "retiree"]);

/** Create the sale listing from a purchased opportunity (one per opportunity). */
export const createSaleListingFromOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    opportunityId: z.string().uuid(),
    title: z.string().min(3).max(180),
    description: z.string().max(4000).optional(),
    salePrice: z.number().positive(),
    vatRegime: z.string().max(40).optional(),
    availability: z.string().max(40).optional(),
    city: z.string().max(120).optional(),
    country: z.string().max(120).optional(),
    photoIds: z.array(z.string().uuid()).default([]),
    assignedSalesAgentId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);

    const { data: opp, error: oppErr } = await sb
      .from("vehicle_opportunities")
      .select("id, status, purchase_price_excl_tax, city, country")
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (oppErr) fail("createSaleListing.opp", oppErr);
    if (!opp) throw new Error("Opportunité introuvable");
    if (!["achetee", "livree"].includes(opp.status)) {
      throw new Error("Le véhicule doit être acheté avant de créer une offre de vente.");
    }

    const { data: existing } = await sb.from("sale_listings").select("id")
      .eq("vehicle_opportunity_id", data.opportunityId).maybeSingle();
    if (existing) throw new Error("Une offre de vente existe déjà pour cette opportunité.");

    const { data: row, error } = await sb.from("sale_listings").insert({
      vehicle_opportunity_id: data.opportunityId,
      title: data.title,
      description: data.description ?? null,
      sale_price_excl_tax: data.salePrice,
      vat_regime: data.vatRegime ?? null,
      availability: data.availability ?? null,
      city: data.city ?? opp.city ?? null,
      country: data.country ?? opp.country ?? null,
      photo_ids: data.photoIds,
      purchase_price_snapshot: opp.purchase_price_excl_tax ?? null,
      assigned_sales_agent_id: data.assignedSalesAgentId ?? null,
      assigned_group: "sales",
      created_by: context.userId,
      status: "brouillon",
    }).select("id, reference_number").single();
    if (error) fail("createSaleListing.insert", error);
    return { id: row.id as string, reference: row.reference_number as string | null };
  });

/** All listings visible to the caller. */
export const listSaleListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d ? z.object({
    status: z.array(listingStatus).optional(),
  }).parse(d) : {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);
    let q = sb.from("sale_listings")
      .select("*, vehicle_opportunities(reference_number, brand, model, year, mileage, vehicle_type)")
      .order("created_at", { ascending: false });
    if (data?.status?.length) q = q.in("status", data.status);
    if (!me.seesAll) {
      const parts = [`assigned_sales_agent_id.eq.${context.userId}`];
      if (me.groupIds.length) parts.push(`assigned_group_id.in.(${me.groupIds.join(",")})`);
      if (!me.isExternal) parts.push("assigned_sales_agent_id.is.null");
      q = q.or(parts.join(","));
    }
    const { data: rows, error } = await q;
    if (error) fail("listSaleListings", error);
    return { rows: rows ?? [] };
  });

export const getSaleListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: row, error } = await sb.from("sale_listings")
      .select("*, vehicle_opportunities(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail("getSaleListing", error);
    if (!row) throw new Error("Offre de vente introuvable");
    const { data: photos } = await sb.from("vehicle_photos")
      .select("id, storage_path, category, is_main_photo, sort_order")
      .eq("vehicle_opportunity_id", row.vehicle_opportunity_id)
      .order("sort_order");
    return { listing: row, photos: photos ?? [] };
  });

/** Get the listing attached to an opportunity, if any. */
export const getSaleListingByOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: row, error } = await sb.from("sale_listings")
      .select("id, reference_number, status, sale_price_excl_tax, purchase_price_snapshot, sold_price_excl_tax")
      .eq("vehicle_opportunity_id", data.opportunityId)
      .maybeSingle();
    if (error) fail("getSaleListingByOpportunity", error);
    return { listing: row ?? null };
  });

export const updateSaleListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().min(3).max(180).optional(),
    description: z.string().max(4000).nullable().optional(),
    salePrice: z.number().positive().nullable().optional(),
    vatRegime: z.string().max(40).nullable().optional(),
    availability: z.string().max(40).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    photoIds: z.array(z.string().uuid()).optional(),
    status: listingStatus.optional(),
    assignedSalesAgentId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch['title'] = data.title;
    if (data.description !== undefined) patch['description'] = data.description;
    if (data.salePrice !== undefined) patch['sale_price_excl_tax'] = data.salePrice;
    if (data.vatRegime !== undefined) patch['vat_regime'] = data.vatRegime;
    if (data.availability !== undefined) patch['availability'] = data.availability;
    if (data.city !== undefined) patch['city'] = data.city;
    if (data.country !== undefined) patch['country'] = data.country;
    if (data.notes !== undefined) patch['notes'] = data.notes;
    if (data.photoIds !== undefined) patch['photo_ids'] = data.photoIds;
    if (data.assignedSalesAgentId !== undefined) patch['assigned_sales_agent_id'] = data.assignedSalesAgentId;
    if (data.status !== undefined) {
      if (data.status === "vendue") throw new Error("Utilisez « Marquer vendue » pour clôturer l'offre.");
      patch['status'] = data.status;
      if (data.status === "publiee") patch['published_at'] = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await sb.from("sale_listings").update(patch).eq("id", data.id);
    if (error) fail("updateSaleListing", error);
    // On publication, alert buyers whose open demand matches this vehicle.
    if (data.status === "publiee") {
      const { notifyBuyersForListing } = await import("@/lib/sale-listing-notify.server");
      const { notified } = await notifyBuyersForListing(data.id);
      return { ok: true, notified };
    }
    return { ok: true };
  });

/** Close the listing as sold and flip the source opportunity to livrée. */
export const markSaleListingSold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    soldPrice: z.number().positive(),
    soldTo: z.string().min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: row, error: readErr } = await sb.from("sale_listings")
      .select("id, vehicle_opportunity_id").eq("id", data.id).maybeSingle();
    if (readErr) fail("markSold.read", readErr);
    if (!row) throw new Error("Offre de vente introuvable");

    const { error } = await sb.from("sale_listings").update({
      status: "vendue",
      sold_price_excl_tax: data.soldPrice,
      sold_to: data.soldTo,
      sold_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) fail("markSold.update", error);

    const { error: oppErr } = await sb.from("vehicle_opportunities").update({
      status: "livree",
      final_sale_price_eur: data.soldPrice,
      won_at: new Date().toISOString(),
    }).eq("id", row.vehicle_opportunity_id);
    if (oppErr) fail("markSold.opp", oppErr);
    return { ok: true };
  });
