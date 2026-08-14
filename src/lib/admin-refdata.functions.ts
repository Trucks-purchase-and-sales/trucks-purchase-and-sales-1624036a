import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";

function fail(where: string, error: unknown): never {
  console.error(`[admin-refdata:${where}]`, error);
  throw new Error(GENERIC);
}

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "platform_admin"]);
  if (error) fail("assertAdmin", error);
  if (!data || data.length === 0) throw new Error("Non autorisé");
}

/** Tables that share the shape { slug, label / label_fr, is_active, sort_order? }. */
export const REF_TABLES = [
  { key: "ref_vehicle_categories", label: "Catégories de véhicule", bilingual: true, ordered: true },
  { key: "ref_vehicle_types", label: "Types de véhicule", bilingual: true, ordered: true },
  { key: "ref_vehicle_brands", label: "Marques", bilingual: false, ordered: true },
  { key: "ref_fuel_types", label: "Carburants", bilingual: true, ordered: false },
  { key: "ref_gearbox_types", label: "Boîtes de vitesse", bilingual: true, ordered: false },
  { key: "ref_euro_standards", label: "Normes Euro", bilingual: false, ordered: true },
  { key: "ref_equipment", label: "Équipements", bilingual: true, ordered: false },
  { key: "ref_body_types", label: "Carrosseries", bilingual: true, ordered: false },
] as const;

export type RefTableKey = typeof REF_TABLES[number]["key"];

const RefKey = z.enum(REF_TABLES.map((t) => t.key) as [RefTableKey, ...RefTableKey[]]);

export const adminListRefTable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: RefKey }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data: rows, error } = await sb.from(data.table).select("*");
    if (error) fail(`list.${data.table}`, error);
    return { rows: rows ?? [] };
  });

const UpsertRow = z.object({
  table: RefKey,
  row: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const adminUpsertRefRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertRow.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const pkey = "slug";
    const { error } = await sb.from(data.table).upsert(data.row, { onConflict: pkey });
    if (error) fail(`upsert.${data.table}`, error);
    return { ok: true };
  });

export const adminDeleteRefRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: RefKey, slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from(data.table).delete().eq("slug", data.slug);
    if (error) fail(`delete.${data.table}`, error);
    return { ok: true };
  });

/* ---------- Site content ---------- */

export const adminListSiteContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("site_content").select("*").order("key");
    if (error) fail("listSiteContent", error);
    return { rows: data ?? [] };
  });

export const adminUpsertSiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    key: z.string().min(1),
    locale: z.string().min(2).max(5).default("fr"),
    value: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("site_content").upsert({
      key: data.key, locale: data.locale, value: data.value, updated_by: context.userId,
    }, { onConflict: "key,locale" });
    if (error) fail("upsertSiteContent", error);
    return { ok: true };
  });

/* ---------- Audit logs ---------- */

export const adminListAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("audit_logs")
      .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail("listAudit", error);
    return { rows: data ?? [] };
  });

/* ---------- Buyer leads (admin overview) ---------- */

/** Statuses considered "treated": converted or closed. Hidden from the working list. */
const BUYER_LEAD_ARCHIVED = ["converted", "gagne", "perdu", "archive"] as const;

export const adminListBuyerLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ archived: z.boolean().default(false) }).parse(d ?? { archived: false }),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    let q = sb.from("buyer_leads")
      .select("id, reference_number, status, first_name, last_name, email, phone, company_name, city, country, preferred_brand, preferred_model, max_budget_ht, created_at, source, assigned_sales_agent_id")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = `(${BUYER_LEAD_ARCHIVED.join(",")})`;
    q = data.archived ? q.in("status", BUYER_LEAD_ARCHIVED as unknown as string[]) : q.not("status", "in", list);
    const { data: rows, error } = await q;
    if (error) fail("listBuyerLeads", error);
    return { rows: rows ?? [] };
  });


/* ---------- Broadcast notifications ---------- */

const APP_ROLES = ["partenaire", "buyer", "sales_agent", "sales_manager", "company_management", "admin", "platform_admin"] as const;

const BroadcastInput = z.object({
  title: z.string().min(2).max(140),
  body: z.string().max(1000).optional(),
  audience: z.enum(["all", "role"]),
  role: z.enum(APP_ROLES).optional(),
  type: z.string().min(2).max(40).default("broadcast"),
});

export const adminBroadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BroadcastInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    let userIds: string[] = [];
    if (data.audience === "all") {
      const { data: rows, error } = await admin.from("profiles").select("id");
      if (error) fail("broadcast.listAll", error);
      userIds = (rows ?? []).map((r: { id: string }) => r.id);
    } else {
      if (!data.role) throw new Error("Rôle requis");
      const { data: rows, error } = await admin.from("user_roles").select("user_id").eq("role", data.role);
      if (error) fail("broadcast.listRole", error);
      userIds = Array.from(new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)));
    }

    if (userIds.length === 0) return { ok: true, count: 0 };

    const chunkSize = 500;
    let total = 0;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize).map((uid) => ({
        user_id: uid,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
      }));
      const { error } = await admin.from("notifications").insert(chunk);
      if (error) fail("broadcast.insert", error);
      total += chunk.length;
    }

    await admin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "notification_broadcast",
      entity_type: "notifications",
      metadata: { audience: data.audience, role: data.role ?? null, count: total, title: data.title },
    });

    return { ok: true, count: total };
  });

export const adminListRecentBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("audit_logs")
      .select("id, action, metadata, created_at, actor_id")
      .eq("action", "notification_broadcast")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) fail("listBroadcasts", error);
    return { rows: data ?? [] };
  });

