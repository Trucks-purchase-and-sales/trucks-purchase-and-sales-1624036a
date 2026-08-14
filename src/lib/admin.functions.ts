import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";

function fail(where: string, error: unknown): never {
  console.error(`[admin.functions:${where}]`, error);
  throw new Error(GENERIC);
}

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "platform_admin"]);
  if (error) fail("assertAdmin", error);
  if (!data || data.length === 0) throw new Error("Non autorisé");
}

const INTERNAL_ROLES = ["admin", "platform_admin", "company_management", "sales_manager", "sales_agent"] as const;

export type StaffGroup = "purchase" | "sales";

type InternalCtx = {
  role: string;
  scope: "purchase" | "sales" | "both";
  seesAll: boolean;
  isExternal: boolean;
  groups: StaffGroup[];
  groupIds: string[];
};

export function groupsForScope(scope: "purchase" | "sales" | "both"): StaffGroup[] {
  return scope === "both" ? ["purchase", "sales"] : [scope];
}

/**
 * Staff gate. Returns the caller's single role, their employee scope and the
 * named assignment groups they belong to. Sales agents see records assigned to
 * them, records held by one of their groups, or unassigned records in their
 * scope pool. External contractors (profiles.is_external) only ever see their
 * own records. Managers, direction and admins see everything.
 */
async function assertInternal(sb: any, userId: string): Promise<InternalCtx> {
  const [{ data: roles, error }, { data: profile }, { data: memberships }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("profiles").select("staff_scope, is_external").eq("id", userId).maybeSingle(),
    sb.from("staff_group_members").select("group_id").eq("user_id", userId),
  ]);
  if (error) fail("assertInternal", error);
  const allRoles = (roles ?? []).map((r: { role: string }) => r.role as string);
  const role = allRoles.find((r: string) => (INTERNAL_ROLES as readonly string[]).includes(r));
  if (!role) throw new Error("Non autorisé");
  const isExternal = profile?.is_external === true;
  const seesAll = role !== "sales_agent" && !isExternal;
  const scope = seesAll ? "both" : ((profile?.staff_scope ?? "both") as "purchase" | "sales" | "both");
  const groupIds = (memberships ?? []).map((m: { group_id: string }) => m.group_id);
  return { role, scope, seesAll, isExternal, groups: groupsForScope(scope), groupIds };
}

/**
 * Row filter for staff who don't see everything: their own records, records
 * held by one of their named groups, or the unassigned pool of their scope.
 */
function agentVisibilityOr(me: InternalCtx, userId: string): string {
  const parts = [`assigned_sales_agent_id.eq.${userId}`];
  if (me.isExternal) {
    parts.push(`partenaire_id.eq.${userId}`);
    return parts.join(",");
  }
  if (me.groupIds.length) parts.push(`assigned_group_id.in.(${me.groupIds.join(",")})`);
  parts.push(`and(assigned_sales_agent_id.is.null,assigned_group.in.(${me.groups.join(",")}))`);
  return parts.join(",");
}

/** Can this caller see one specific row? */
function canSeeRow(me: InternalCtx, userId: string, row: any): boolean {
  if (me.seesAll) return true;
  if (row.assigned_sales_agent_id === userId) return true;
  if (me.isExternal) return row.partenaire_id === userId;
  if (row.assigned_group_id && me.groupIds.includes(row.assigned_group_id)) return true;
  return !row.assigned_sales_agent_id && me.groups.includes((row.assigned_group ?? "purchase") as StaffGroup);
}

const listFilterSchema = z.object({
  status: z.array(z.string()).optional(),
  ownerSide: z.enum(["partenaire","wilmet"]).optional(),
  vehicleType: z.string().optional(),
  partenaireId: z.string().uuid().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  pending: z.boolean().optional(),
  includeUnassigned: z.boolean().optional(),
}).partial();

const LEAD_INBOX_STATUSES = ["envoyee", "en_cours_analyse"] as const;

export const adminListOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d ? listFilterSchema.parse(d) : {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);

    let q = sb
      .from("vehicle_opportunities")
      .select("id, reference_number, status, brand, model, year, mileage, city, desired_price_excl_tax, submitted_at, created_at, updated_at, partenaire_id, vehicle_type, owner_side, assigned_sales_agent_id, assigned_group, assigned_group_id, withdrawn_at, purchase_price_excl_tax, purchase_reference, qualified_at")
      .neq("status", "brouillon")
      .order("updated_at", { ascending: false });
    // Opportunities view = qualified onwards. Only rows still sitting in the raw
    // lead inbox (no individual owner yet) are hidden here; once a lead is
    // assigned to a sales person it must show up in the opportunities list.
    // Set includeUnassigned to also see the raw lead inbox.
    if (!data?.includeUnassigned) {
      q = q.or(`assigned_sales_agent_id.not.is.null,status.not.in.(${LEAD_INBOX_STATUSES.join(",")})`);
    }
    // A sales agent sees their own records plus their group pool.
    if (!me.seesAll) q = q.or(agentVisibilityOr(me, context.userId));



    if (data?.status?.length) q = q.in("status", data.status);
    if (data?.ownerSide) q = q.eq("owner_side", data.ownerSide);
    if (data?.vehicleType) q = q.eq("vehicle_type", data.vehicleType);
    if (data?.partenaireId) q = q.eq("partenaire_id", data.partenaireId);
    if (data?.minPrice != null) q = q.gte("desired_price_excl_tax", data.minPrice);
    if (data?.maxPrice != null) q = q.lte("desired_price_excl_tax", data.maxPrice);
    if (data?.fromDate) q = q.gte("submitted_at", data.fromDate);
    if (data?.toDate) q = q.lte("submitted_at", data.toDate);
    if (data?.pending) q = q.in("status", ["envoyee"]);

    const { data: rows, error } = await q;
    if (error) fail("adminListOpportunities.rows", error);

    const ids = (rows ?? []).map((r: { partenaire_id: string }) => r.partenaire_id);
    const profiles: Record<string, { first_name: string; last_name: string; company_name: string | null; email: string }> = {};
    if (ids.length) {
      const { data: ps } = await sb.from("profiles").select("id, first_name, last_name, company_name, email").in("id", ids);
      for (const p of ps ?? []) profiles[p.id] = p;
    }
    const oppIds = (rows ?? []).map((r: { id: string }) => r.id);
    const mainByOpp: Record<string, string> = {};
    if (oppIds.length) {
      const { data: photos } = await sb.from("vehicle_photos")
        .select("vehicle_opportunity_id, storage_path, is_main_photo, sort_order")
        .in("vehicle_opportunity_id", oppIds)
        .order("is_main_photo", { ascending: false })
        .order("sort_order");
      for (const p of photos ?? []) if (!mainByOpp[p.vehicle_opportunity_id]) mainByOpp[p.vehicle_opportunity_id] = p.storage_path;
    }
    return { rows: rows ?? [], profiles, mainByOpp };
  });

export const adminGetOpportunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);
    const { data: opp } = await sb.from("vehicle_opportunities").select("*").eq("id", data.id).maybeSingle();
    if (!opp) throw new Error("Introuvable");
    if (!canSeeRow(me, context.userId, opp)) throw new Error("Non autorisé");


    const [photosRes, historyRes, notesRes, reqsRes, profileRes] = await Promise.all([
      sb.from("vehicle_photos").select("*").eq("vehicle_opportunity_id", data.id).order("is_main_photo", { ascending: false }).order("sort_order"),
      sb.from("opportunity_status_history").select("*").eq("vehicle_opportunity_id", data.id).order("created_at"),
      sb.from("internal_notes").select("*").eq("vehicle_opportunity_id", data.id).order("created_at", { ascending: false }),
      sb.from("information_requests").select("*").eq("vehicle_opportunity_id", data.id).order("created_at"),
      sb.from("profiles").select("*").eq("id", opp.partenaire_id).maybeSingle(),
    ]);
    return {
      opp, photos: photosRes.data ?? [], history: historyRes.data ?? [],
      notes: notesRes.data ?? [], infoRequests: reqsRes.data ?? [], profile: profileRes.data,
    };
  });

export const adminChangeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["en_cours_analyse","offre_envoyee","en_negociation","achetee","livree","refusee","archivee"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    // Post-qualification stages require an assigned sales agent.
    const POST_QUAL = ["offre_envoyee","en_negociation","achetee","livree"];
    if (POST_QUAL.includes(data.status)) {
      const { data: opp } = await sb.from("vehicle_opportunities").select("assigned_sales_agent_id").eq("id", data.id).maybeSingle();
      if (!opp?.assigned_sales_agent_id) throw new Error("Assignez d'abord un commercial à cette opportunité.");
    }
    const { error } = await sb.from("vehicle_opportunities").update({ status: data.status }).eq("id", data.id);
    if (error) fail("adminChangeStatus", error);
    return { ok: true };
  });

export const adminAddNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("internal_notes")
      .insert({ vehicle_opportunity_id: data.id, admin_id: context.userId, note: data.note });
    if (error) fail("adminAddNote", error);
    return { ok: true };
  });

export const adminRequestInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), message: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("information_requests")
      .insert({ vehicle_opportunity_id: data.id, admin_id: context.userId, message: data.message });
    if (error) fail("adminRequestInfo", error);
    await sb.from("vehicle_opportunities").update({ status: "en_cours_analyse" }).eq("id", data.id);
    return { ok: true };
  });

// Client / seller directories and account deletion live in users-admin.functions.ts.
// A partner's type (client or seller) is fixed at signup and no longer switchable.



export const adminHandoverToPartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), message: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities")
      .update({ owner_side: "partenaire", status: "en_cours_analyse", handover_message: data.message })
      .eq("id", data.id);
    if (error) fail("adminHandoverToPartenaire", error);
    // Log an information_request to keep the exchange trail visible
    await sb.from("information_requests")
      .insert({ vehicle_opportunity_id: data.id, admin_id: context.userId, message: data.message });
    return { ok: true };
  });

export const adminReclaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities")
      .update({ owner_side: "wilmet", handover_message: "Wilmet a repris la main sur l'opportunité." })
      .eq("id", data.id);
    if (error) fail("adminReclaim", error);
    return { ok: true };
  });

export const adminListSalesAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertInternal(sb, context.userId);
    const { data: roles } = await sb.from("user_roles").select("user_id").in("role", ["sales_agent","sales_manager"]);
    const ids = Array.from(new Set((roles ?? []).map((r: { user_id: string }) => r.user_id)));
    if (ids.length === 0) return { agents: [] };
    const { data: profiles } = await sb.from("profiles").select("id, first_name, last_name, email").in("id", ids);
    return { agents: profiles ?? [] };
  });

const ASSIGNERS = ["admin", "platform_admin", "sales_manager"] as const;

export const adminAssignSalesAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    agentId: z.string().uuid().nullable(),
    group: z.enum(["purchase", "sales"]).optional(),
    groupId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);
    if (!(ASSIGNERS as readonly string[]).includes(me.role)) throw new Error("Non autorisé");
    const { data: current } = await sb
      .from("vehicle_opportunities")
      .select("assigned_sales_agent_id, status, assigned_group, assigned_group_id")
      .eq("id", data.id)
      .maybeSingle();
    const wasUnassigned = !current?.assigned_sales_agent_id;
    const payload: Record<string, unknown> = { assigned_sales_agent_id: data.agentId };
    // Keep a group on the record so that unassigning returns it to the group pool.
    payload.assigned_group = data.group ?? current?.assigned_group ?? "purchase";
    if (data.groupId !== undefined) payload.assigned_group_id = data.groupId;
    // First-time assignment qualifies the lead into an opportunity.
    if (data.agentId && wasUnassigned && (LEAD_INBOX_STATUSES as readonly string[]).includes(current?.status ?? "")) {
      payload.status = "en_cours_analyse";
      payload.qualified_at = new Date().toISOString();
    }
    const { error } = await sb.from("vehicle_opportunities").update(payload).eq("id", data.id);
    if (error) fail("adminAssignSalesAgent", error);
    return { ok: true };
  });

/** Send a lead straight to a group pool (no individual owner) and qualify it. */
export const adminAssignToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    group: z.enum(["purchase", "sales"]).default("purchase"),
    groupId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);
    if (!(ASSIGNERS as readonly string[]).includes(me.role)) throw new Error("Non autorisé");
    const { error } = await sb.from("vehicle_opportunities").update({
      assigned_sales_agent_id: null,
      assigned_group: data.group,
      ...(data.groupId !== undefined ? { assigned_group_id: data.groupId } : {}),
      status: "en_cours_analyse",
      qualified_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) fail("adminAssignToGroup", error);
    return { ok: true };
  });

export const adminListLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const me = await assertInternal(sb, context.userId);
    // Seller leads sit in the purchase group: a sales-only agent has no business here.
    if (me.isExternal || !me.groups.includes("purchase")) return { rows: [], profiles: {} as Record<string, any> };
    const { data: rows, error } = await sb
      .from("vehicle_opportunities")
      .select("id, reference_number, status, brand, model, year, mileage, city, country, desired_price_excl_tax, vehicle_type, vehicle_category, first_registration_date, fuel_type, gearbox, euro_standard, general_condition, availability, vat_recoverable, keys_count, defects_and_comments, submitted_at, created_at, updated_at, partenaire_id, quality_score")
      .is("assigned_sales_agent_id", null)
      .in("status", LEAD_INBOX_STATUSES as unknown as string[])
      .order("submitted_at", { ascending: false });

    if (error) fail("adminListLeads", error);
    const COMPLETION_FIELDS = [
      "brand", "model", "vehicle_type", "vehicle_category", "first_registration_date",
      "mileage", "city", "country", "desired_price_excl_tax", "fuel_type", "gearbox",
      "euro_standard", "general_condition", "availability", "vat_recoverable", "keys_count",
      "defects_and_comments",
    ];
    const withPct = (rows ?? []).map((r: Record<string, unknown>) => {
      const filled = COMPLETION_FIELDS.filter((k) => {
        const v = r[k];
        return v !== null && v !== undefined && v !== "" ;
      }).length;
      return { ...r, completion_pct: Math.round((filled / COMPLETION_FIELDS.length) * 100) };
    });
    const ids = withPct.map((r: { partenaire_id: string }) => r.partenaire_id);
    const profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: ps } = await sb.from("profiles").select("id, first_name, last_name, company_name, email, city, country").in("id", ids);
      for (const p of ps ?? []) profiles[p.id] = p;
    }
    return { rows: withPct, profiles };

  });

export const adminDisqualifyLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities")
      .update({ status: "refusee", close_reason: data.reason, lost_at: new Date().toISOString(), owner_side: "wilmet" })
      .eq("id", data.id);
    if (error) fail("adminDisqualifyLead", error);
    return { ok: true };
  });

export const adminConvertToPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    price: z.number().positive(),
    reference: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities").update({
      status: "achetee",
      purchase_price_excl_tax: data.price,
      purchased_at: new Date().toISOString(),
      purchase_reference: data.reference ?? null,
      owner_side: "wilmet",
    }).eq("id", data.id);
    if (error) fail("adminConvertToPurchase", error);
    // Automatically prepare the sale offer as a draft; the sales rep only sets
    // the price and publishes.
    const { ensureDraftListingForPurchase } = await import("@/lib/sale-listing-notify.server");
    await ensureDraftListingForPurchase(data.id, context.userId);
    return { ok: true };
  });

export const adminExportOpportunitiesCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d ? listFilterSchema.parse(d) : {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    let q = sb.from("vehicle_opportunities")
      .select("reference_number, status, owner_side, brand, model, year, mileage, city, country, desired_price_excl_tax, purchase_price_excl_tax, purchase_reference, submitted_at, updated_at, partenaire_id, vehicle_type")
      .neq("status", "brouillon");
    if (data?.status?.length) q = q.in("status", data.status);
    if (data?.ownerSide) q = q.eq("owner_side", data.ownerSide);
    if (data?.vehicleType) q = q.eq("vehicle_type", data.vehicleType);
    if (data?.partenaireId) q = q.eq("partenaire_id", data.partenaireId);
    if (data?.minPrice != null) q = q.gte("desired_price_excl_tax", data.minPrice);
    if (data?.maxPrice != null) q = q.lte("desired_price_excl_tax", data.maxPrice);
    if (data?.fromDate) q = q.gte("submitted_at", data.fromDate);
    if (data?.toDate) q = q.lte("submitted_at", data.toDate);
    const { data: rows, error } = await q;
    if (error) fail("adminExportOpportunitiesCsv", error);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.partenaire_id)));
    const profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: ps } = await sb.from("profiles").select("id, first_name, last_name, company_name, email").in("id", ids);
      for (const p of ps ?? []) profiles[p.id] = p;
    }
    const cols = [
      "reference","statut","proprietaire","marque","modele","annee","kilometrage","ville","pays","type","prix_ht","prix_achat","po",
      "envoyee_le","maj_le","partenaire","societe","email"
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(";")];
    for (const r of rows ?? []) {
      const p = profiles[r.partenaire_id];
      lines.push([
        r.reference_number, r.status, r.owner_side, r.brand, r.model, r.year, r.mileage,
        r.city, r.country, r.vehicle_type, r.desired_price_excl_tax, r.purchase_price_excl_tax, r.purchase_reference,
        r.submitted_at, r.updated_at, p ? `${p.first_name} ${p.last_name}` : "", p?.company_name ?? "", p?.email ?? "",
      ].map(esc).join(";"));
    }
    return { csv: lines.join("\n"), count: rows?.length ?? 0 };
  });

/* ============ Full commercial lifecycle actions ============ */

export const adminMarkDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    deliveredAt: z.string().optional(),
    notes: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities").update({
      status: "livree",
      delivered_at: data.deliveredAt ?? new Date().toISOString(),
      delivery_notes: data.notes ?? null,
      owner_side: "wilmet",
    }).eq("id", data.id);
    if (error) fail("adminMarkDelivered", error);
    return { ok: true };
  });

export const adminCloseOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    outcome: z.enum(["won", "lost"]),
    reason: z.string().optional(),
    force: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (data.outcome === "won") {
      const nowIso = new Date().toISOString();
      const { error } = await sb.from("vehicle_opportunities").update({
        status: "livree",
        won_at: nowIso,
        delivered_at: nowIso,
        owner_side: "wilmet",
      }).eq("id", data.id);
      if (error) fail("adminCloseOpportunity.won", error);
    } else {
      if (!data.reason) throw new Error("Motif requis pour une clôture en perdu.");
      const { error } = await sb.from("vehicle_opportunities").update({
        status: "refusee",
        lost_at: new Date().toISOString(),
        close_reason: data.reason,
        owner_side: "wilmet",
      }).eq("id", data.id);
      if (error) fail("adminCloseOpportunity.lost", error);
    }
    return { ok: true };
  });

export const adminReopenOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("vehicle_opportunities").update({
      status: "en_cours_analyse",
      won_at: null, lost_at: null, close_reason: null,
    }).eq("id", data.id);
    if (error) fail("adminReopenOpportunity", error);
    return { ok: true };
  });

/* ============ Activity feed ============ */

export const listOpportunityActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("opportunity_activities")
      .select("id, kind, body, due_at, done_at, author_id, created_at")
      .eq("vehicle_opportunity_id", data.id)
      .order("created_at", { ascending: false });
    if (error) fail("listOpportunityActivities", error);
    return { activities: rows ?? [] };
  });

export const addOpportunityActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    kind: z.enum(["note", "call", "email", "meeting", "task"]),
    body: z.string().min(1),
    dueAt: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("opportunity_activities").insert({
      vehicle_opportunity_id: data.id,
      kind: data.kind,
      body: data.body,
      due_at: data.dueAt ?? null,
      author_id: context.userId,
    });
    if (error) fail("addOpportunityActivity", error);
    return { ok: true };
  });

export const completeOpportunityActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ activityId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("opportunity_activities")
      .update({ done_at: new Date().toISOString() })
      .eq("id", data.activityId);
    if (error) fail("completeOpportunityActivity", error);
    return { ok: true };
  });
