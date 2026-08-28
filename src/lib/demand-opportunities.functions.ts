/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing throughout this file (raw
   Supabase client passed around untyped), unrelated to the FD-014 fix touching adminRejectBuyerLead
   below. Retyping it properly cascades into the return types of listDemandOpportunities and
   getDemandOpportunity, which several other route files destructure loosely -- out of scope here. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";
function fail(where: string, err: unknown): never {
  console.error(`[demand-opp:${where}]`, err);
  throw new Error(GENERIC);
}

const INTERNAL_STAFF = ["admin", "platform_admin", "company_management", "sales_manager"] as const;
const INTERNAL_ALL = [...INTERNAL_STAFF, "sales_agent", "external_agent"] as const;

async function getRoles(sb: any, userId: string): Promise<string[]> {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if (error) fail("getRoles", error);
  return (data ?? []).map((r: any) => r.role as string);
}

async function assertStaff(sb: any, userId: string) {
  const roles = await getRoles(sb, userId);
  if (!roles.some((r) => (INTERNAL_STAFF as readonly string[]).includes(r))) {
    throw new Error("Non autorisé");
  }
}

async function assertInternal(sb: any, userId: string) {
  const roles = await getRoles(sb, userId);
  if (!roles.some((r) => (INTERNAL_ALL as readonly string[]).includes(r))) {
    throw new Error("Non autorisé");
  }
  return roles;
}

/** Named assignment groups the caller belongs to. */
async function myGroupIds(sb: any, userId: string): Promise<string[]> {
  const { data } = await sb.from("staff_group_members").select("group_id").eq("user_id", userId);
  return (data ?? []).map((m: any) => m.group_id as string);
}

async function myGroups(
  sb: any,
  userId: string,
  seesAll: boolean,
): Promise<("purchase" | "sales")[]> {
  if (seesAll) return ["purchase", "sales"];
  const { data } = await sb.from("profiles").select("staff_scope").eq("id", userId).maybeSingle();
  const scope = (data?.staff_scope ?? "both") as "purchase" | "sales" | "both";
  return scope === "both" ? ["purchase", "sales"] : [scope];
}

/* ---------- Buyer lead detail (admin) ---------- */

export const adminGetBuyerLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: lead, error } = await sb
      .from("buyer_leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail("getBuyerLead", error);
    if (!lead) throw new Error("Demande introuvable");
    const { data: history } = await sb
      .from("buyer_lead_status_history")
      .select("*")
      .eq("buyer_lead_id", data.id)
      .order("created_at", { ascending: false });
    const { data: demand } = await sb
      .from("demand_opportunities")
      .select("id, reference_number, status, stage, assigned_sales_agent_id, created_at")
      .eq("buyer_lead_id", data.id)
      .maybeSingle();
    return { lead, history: history ?? [], demand };
  });

/* ---------- Convert buyer lead -> demand opportunity ---------- */

const ConvertInput = z.object({
  id: z.string().uuid(),
  // Optional: when omitted the demand goes to the sales group pool.
  agentId: z.string().uuid().nullable().optional(),
});

export const adminConvertBuyerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConvertInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertStaff(sb, context.userId);
    const agentId = data.agentId ?? null;

    const { data: lead, error: leadErr } = await sb
      .from("buyer_leads")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (leadErr) fail("convert.getLead", leadErr);
    if (!lead) throw new Error("Demande introuvable");

    const { data: existing } = await sb
      .from("demand_opportunities")
      .select("id")
      .eq("buyer_lead_id", data.id)
      .maybeSingle();
    if (existing?.id) {
      return { id: existing.id, alreadyExisted: true };
    }

    const insert = {
      buyer_lead_id: lead.id,
      client_id: lead.user_id,
      assigned_sales_agent_id: agentId,
      assigned_group: "sales" as const,
      status: "qualifiee" as const,
      stage: "sourcing" as const,
      brand: lead.preferred_brand,
      model: lead.preferred_model,
      body_type: lead.body_type,
      vehicle_type: lead.vehicle_type,
      vehicle_category: lead.vehicle_category,
      year_min: lead.min_year,
      max_budget_ht: lead.max_budget_ht,
      max_mileage: lead.max_mileage,
      min_euro_norm: lead.min_euro_norm,
      fuel_type: lead.fuel_type,
      gearbox: lead.gearbox,
      city: lead.city,
      country: lead.country,
      notes: lead.message,
    };

    const { data: created, error: insErr } = await sb
      .from("demand_opportunities")
      .insert(insert)
      .select("id")
      .single();
    if (insErr) fail("convert.insert", insErr);

    const { error: updErr } = await sb
      .from("buyer_leads")
      .update({ status: "converted", assigned_sales_agent_id: agentId, assigned_group: "sales" })
      .eq("id", lead.id);
    if (updErr) fail("convert.updateLead", updErr);

    if (agentId) {
      await sb.from("notifications").insert({
        user_id: agentId,
        type: "demand_assigned",
        title: "Nouvelle demande client à traiter",
        body: `${lead.reference_number ?? "Demande"} — ${lead.first_name} ${lead.last_name}`,
      });
    }

    return { id: created.id, alreadyExisted: false };
  });

/* ---------- Assign / reassign a demand opportunity ---------- */

export const assignDemandOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        agentId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertStaff(sb, context.userId);
    const { error } = await sb
      .from("demand_opportunities")
      .update({ assigned_sales_agent_id: data.agentId, assigned_group: "sales" })
      .eq("id", data.id);
    if (error) fail("assignDemand", error);
    if (data.agentId) {
      await sb.from("notifications").insert({
        user_id: data.agentId,
        type: "demand_assigned",
        title: "Une demande client vous a été assignée",
      });
    }
    return { ok: true };
  });

/* ---------- Request info / Reject on buyer lead ---------- */

export const adminBuyerLeadRequestInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), message: z.string().min(2).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: lead } = await sb
      .from("buyer_leads")
      .select("user_id, reference_number")
      .eq("id", data.id)
      .maybeSingle();
    if (lead?.user_id) {
      await sb.from("notifications").insert({
        user_id: lead.user_id,
        type: "info_request",
        title: "Wilmet demande des informations",
        body: data.message,
      });
    }
    const { error } = await sb
      .from("buyer_leads")
      .update({ status: "a_qualifier" })
      .eq("id", data.id);
    if (error) fail("requestInfo", error);
    return { ok: true };
  });

export const adminRejectBuyerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { error } = await sb
      .from("buyer_leads")
      .update({ status: "perdu", reject_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) fail("reject", error);
    return { ok: true };
  });

/* ---------- Demand opportunities list & detail ---------- */

export const listDemandOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scope: z.enum(["mine", "all"]).default("all") }).parse(d ?? { scope: "all" }),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const roles = await assertInternal(sb, context.userId);
    const isStaff = roles.some((r) => (INTERNAL_STAFF as readonly string[]).includes(r));
    const isExternal = roles.includes("external_agent");

    let q = sb
      .from("demand_opportunities")
      .select(
        "id, reference_number, status, stage, assigned_sales_agent_id, assigned_group, assigned_group_id, brand, model, max_budget_ht, city, country, buyer_lead_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.scope === "mine") {
      q = q.eq("assigned_sales_agent_id", context.userId);
    } else if (isExternal) {
      q = q.eq("assigned_sales_agent_id", context.userId);
    } else if (!isStaff) {
      const [groups, groupIds] = await Promise.all([
        myGroups(sb, context.userId, false),
        myGroupIds(sb, context.userId),
      ]);
      const parts = [`assigned_sales_agent_id.eq.${context.userId}`];
      if (groupIds.length) parts.push(`assigned_group_id.in.(${groupIds.join(",")})`);
      parts.push(`and(assigned_sales_agent_id.is.null,assigned_group.in.(${groups.join(",")}))`);
      q = q.or(parts.join(","));
    }

    const { data: rows, error } = await q;
    if (error) fail("list", error);

    const buyerIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.buyer_lead_id).filter(Boolean)),
    );
    const buyerMap: Record<string, any> = {};
    if (buyerIds.length) {
      const { data: buyers } = await sb
        .from("buyer_leads")
        .select("id, first_name, last_name, email, company_name, reference_number")
        .in("id", buyerIds);
      for (const b of buyers ?? []) buyerMap[b.id] = b;
    }

    const agentIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.assigned_sales_agent_id).filter(Boolean)),
    );
    const agentMap: Record<string, any> = {};
    if (agentIds.length) {
      const { data: agents } = await sb
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", agentIds);
      for (const a of agents ?? []) agentMap[a.id] = a;
    }

    return { rows: rows ?? [], buyers: buyerMap, agents: agentMap };
  });

export const getDemandOpportunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: opp, error } = await sb
      .from("demand_opportunities")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail("get", error);
    if (!opp) throw new Error("Opportunité introuvable");

    const { data: lead } = await sb
      .from("buyer_leads")
      .select("*")
      .eq("id", opp.buyer_lead_id)
      .maybeSingle();
    const { data: history } = await sb
      .from("demand_opportunity_status_history")
      .select("*")
      .eq("demand_opportunity_id", opp.id)
      .order("created_at", { ascending: false });
    const { data: agent } = opp.assigned_sales_agent_id
      ? await sb
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("id", opp.assigned_sales_agent_id)
          .maybeSingle()
      : { data: null };
    const { data: match } = opp.matched_vehicle_opportunity_id
      ? await sb
          .from("vehicle_opportunities")
          .select("id, reference_number, brand, model, year, desired_price_excl_tax, status")
          .eq("id", opp.matched_vehicle_opportunity_id)
          .maybeSingle()
      : { data: null };

    return { opp, lead, history: history ?? [], agent, matchedVehicle: match };
  });

/* ---------- Update stage / status ---------- */

const StageInput = z.object({
  id: z.string().uuid(),
  stage: z.enum(["qualification", "sourcing", "proposition", "negociation", "cloture"]).optional(),
  status: z
    .enum([
      "nouvelle",
      "qualifiee",
      "en_recherche",
      "proposition_envoyee",
      "negociation",
      "gagnee",
      "perdue",
      "archivee",
    ])
    .optional(),
  lost_reason: z.string().max(200).optional(),
});

export const updateDemandStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StageInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {};
    if (data.stage) patch.stage = data.stage;
    if (data.status) patch.status = data.status;
    if (data.lost_reason) patch.lost_reason = data.lost_reason;
    if (data.status && ["gagnee", "perdue", "archivee"].includes(data.status))
      patch.closed_at = new Date().toISOString();
    const { error } = await sb.from("demand_opportunities").update(patch).eq("id", data.id);
    if (error) fail("updateStage", error);
    return { ok: true };
  });

/* ---------- Link a vehicle opportunity as the match ---------- */

export const linkVehicleMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        demandId: z.string().uuid(),
        vehicleOpportunityId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const patch: Record<string, unknown> = {
      matched_vehicle_opportunity_id: data.vehicleOpportunityId,
    };
    if (data.vehicleOpportunityId) {
      patch.stage = "proposition";
      patch.status = "proposition_envoyee";
    }
    const { error } = await sb.from("demand_opportunities").update(patch).eq("id", data.demandId);
    if (error) fail("linkMatch", error);
    return { ok: true };
  });

/* ---------- Suggest vehicles for a demand ---------- */

export const suggestVehiclesForDemand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: d0, error: e0 } = await sb
      .from("demand_opportunities")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) fail("suggest.get", e0);
    if (!d0) throw new Error("Introuvable");

    let q = sb
      .from("vehicle_opportunities")
      .select(
        "id, reference_number, brand, model, year, mileage, desired_price_excl_tax, city, country, status",
      )
      .in("status", ["en_cours_analyse", "offre_envoyee", "en_negociation", "achetee"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (d0.brand) q = q.ilike("brand", `%${d0.brand}%`);
    if (d0.max_budget_ht) q = q.lte("desired_price_excl_tax", d0.max_budget_ht);
    if (d0.year_min) q = q.gte("year", d0.year_min);
    const { data: rows, error } = await q;
    if (error) fail("suggest.query", error);
    return { rows: rows ?? [] };
  });
