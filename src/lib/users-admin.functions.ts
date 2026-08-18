import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";
function fail(where: string, err: unknown): never {
  console.error(`[users-admin:${where}]`, err);
  throw new Error(GENERIC);
}

const ADMIN_ROLES = ["admin", "platform_admin"] as const;
const STAFF_ROLES = ["admin", "platform_admin", "company_management", "sales_manager", "sales_agent", "external_agent"] as const;

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ADMIN_ROLES as unknown as string[]);
  if (error) fail("assertAdmin", error);
  if (!data || data.length === 0) throw new Error("Non autorisé");
}

export type ExternalUserKind = "client" | "seller";

/**
 * External account directory. Clients (buyers) and sellers (partners) are two
 * distinct populations; the type is set at signup and never switched here.
 */
export const adminListExternalUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["client", "seller"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);

    const { data: rows, error } = await sb
      .from("profiles")
      .select("id, first_name, last_name, company_name, email, phone, city, country, created_at, partner_kind, is_active")
      .eq("partner_kind", data.kind)
      .order("created_at", { ascending: false });
    if (error) fail("adminListExternalUsers", error);

    const allIds = (rows ?? []).map((p: { id: string }) => p.id);
    // Never show staff accounts in an external directory.
    let staffIds = new Set<string>();
    if (allIds.length) {
      const { data: staff } = await sb
        .from("user_roles")
        .select("user_id")
        .in("user_id", allIds)
        .in("role", STAFF_ROLES as unknown as string[]);
      staffIds = new Set((staff ?? []).map((r: { user_id: string }) => r.user_id));
    }
    const profiles = (rows ?? []).filter((p: { id: string }) => !staffIds.has(p.id));
    const ids = profiles.map((p: { id: string }) => p.id);

    const counts: Record<string, number> = {};
    if (ids.length) {
      if (data.kind === "seller") {
        const { data: opps } = await sb.from("vehicle_opportunities").select("partenaire_id").in("partenaire_id", ids);
        for (const o of opps ?? []) counts[o.partenaire_id] = (counts[o.partenaire_id] ?? 0) + 1;
      } else {
        const { data: leads } = await sb.from("buyer_leads").select("user_id").in("user_id", ids);
        for (const l of leads ?? []) counts[l.user_id] = (counts[l.user_id] ?? 0) + 1;
      }
    }
    return { profiles, counts };
  });

export const userSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas modifier votre propre compte ici.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { error } = await admin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    if (error) fail("userSetActive", error);
    await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    await admin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.active ? "user_enable" : "user_disable",
      entity_type: "profiles",
      entity_id: data.userId,
      metadata: {},
    });
    return { ok: true };
  });

/** Count everything that would be orphaned by deleting this account. */
async function dependencyCount(admin: any, userId: string) {
  const [opps, leads, demands, listings, scans, assignedOpps, assignedDemands] = await Promise.all([
    admin.from("vehicle_opportunities").select("id", { count: "exact", head: true }).eq("partenaire_id", userId),
    admin.from("buyer_leads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("demand_opportunities").select("id", { count: "exact", head: true }).eq("client_id", userId),
    admin.from("sale_listings").select("id", { count: "exact", head: true }).eq("created_by", userId),
    admin.from("ocr_scans").select("id", { count: "exact", head: true }).eq("uploader_id", userId),
    admin.from("vehicle_opportunities").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", userId),
    admin.from("demand_opportunities").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", userId),
  ]);
  return (
    (opps.count ?? 0) + (leads.count ?? 0) + (demands.count ?? 0) +
    (listings.count ?? 0) + (scans.count ?? 0) + (assignedOpps.count ?? 0) + (assignedDemands.count ?? 0)
  );
}

/** Admin-only hard delete. Blocked while the account still holds any record. */
export const userDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", data.userId);
    const targetIsAdmin = (targetRoles ?? []).some((r: { role: string }) =>
      (ADMIN_ROLES as readonly string[]).includes(r.role));
    if (targetIsAdmin) {
      const { data: admins } = await admin.from("user_roles").select("user_id").in("role", ADMIN_ROLES as unknown as string[]);
      const others = new Set((admins ?? []).map((r: { user_id: string }) => r.user_id));
      others.delete(data.userId);
      if (others.size === 0) throw new Error("Il doit rester au moins un administrateur.");
    }

    const total = await dependencyCount(admin, data.userId);
    if (total > 0) {
      throw new Error(
        `Ce compte est rattaché à ${total} dossier(s). Désactivez-le, ou transférez ses dossiers avant suppression.`,
      );
    }

    await admin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "user_delete",
      entity_type: "profiles",
      entity_id: data.userId,
      metadata: {},
    });
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    await admin.from("profiles").delete().eq("id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) fail("userDelete", error);
    return { ok: true };
  });
