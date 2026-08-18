import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";
function fail(where: string, err: unknown): never {
  console.error(`[staff:${where}]`, err);
  throw new Error(GENERIC);
}

export const STAFF_ROLES = [
  "platform_admin",
  "admin",
  "company_management",
  "sales_manager",
  "sales_agent",
  "external_agent",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffScope = "purchase" | "sales" | "both";

const ADMIN_ROLES = ["admin", "platform_admin"] as const;

/** Management roles always cover both sides; the perimeter only applies to sales agents. */
const MANAGEMENT_ROLES = ["platform_admin", "admin", "company_management", "sales_manager"] as const;
function effectiveScope(role: StaffRole | undefined, scope: StaffScope): StaffScope {
  return role && (MANAGEMENT_ROLES as readonly string[]).includes(role) ? "both" : scope;
}

/**
 * profiles.is_external is derived metadata only: authorization comes from the
 * explicit external_agent role, never from this flag.
 */
function derivedIsExternal(role: StaffRole): boolean {
  return role === "external_agent";
}


async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ADMIN_ROLES as unknown as string[]);
  if (error) fail("assertAdmin", error);
  if (!data || data.length === 0) throw new Error("Non autorisé");
}

async function audit(admin: any, actorId: string, action: string, entityId: string, metadata: unknown) {
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "staff",
    entity_id: entityId,
    metadata: metadata ?? {},
  });
}

/* ---------------- List ---------------- */

export const staffList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);

    const { data: roleRows, error } = await sb
      .from("user_roles")
      .select("user_id, role")
      .in("role", STAFF_ROLES as unknown as string[]);
    if (error) fail("staffList.roles", error);

    const roleByUser: Record<string, StaffRole> = {};
    for (const r of roleRows ?? []) roleByUser[r.user_id] = r.role as StaffRole;
    const ids = Object.keys(roleByUser);
    if (ids.length === 0) return { staff: [] as any[] };

    const { data: profiles } = await sb
      .from("profiles")
      .select("id, first_name, last_name, email, phone, staff_scope, is_active, created_at, commission_rate, is_external")
      .in("id", ids);

    // Workload: assigned offer opportunities + demand opportunities
    const [{ data: opps }, { data: demands }] = await Promise.all([
      sb.from("vehicle_opportunities").select("assigned_sales_agent_id").in("assigned_sales_agent_id", ids),
      sb.from("demand_opportunities").select("assigned_sales_agent_id").in("assigned_sales_agent_id", ids),
    ]);
    const load: Record<string, number> = {};
    for (const o of [...(opps ?? []), ...(demands ?? [])]) {
      const k = o.assigned_sales_agent_id as string | null;
      if (k) load[k] = (load[k] ?? 0) + 1;
    }

    const { data: memberships } = await sb.from("staff_group_members").select("group_id, user_id").in("user_id", ids);
    const groupsByUser: Record<string, string[]> = {};
    for (const m of memberships ?? []) {
      (groupsByUser[m.user_id] ??= []).push(m.group_id as string);
    }

    const staff = (profiles ?? []).map((p: any) => ({
      ...p,
      role: roleByUser[p.id],
      assigned_count: load[p.id] ?? 0,
      group_ids: groupsByUser[p.id] ?? [],
      is_self: p.id === context.userId,
    }));
    staff.sort((a: any, b: any) =>
      STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) ||
      String(a.last_name ?? "").localeCompare(String(b.last_name ?? "")),
    );
    return { staff };
  });

/* ---------------- Create ---------------- */

const CreateInput = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().nullable(),
  role: z.enum(STAFF_ROLES),
  scope: z.enum(["purchase", "sales", "both"]),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  // Accepted for backward compatibility but ignored: externality comes from the role.
  isExternal: z.boolean().optional(),

  password: z.string().min(10).max(72),
});

export const staffCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const email = data.email.trim().toLowerCase();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.firstName, last_name: data.lastName },
    });
    if (error || !created?.user) {
      console.error("[staff:staffCreate]", error);
      throw new Error(
        String((error as any)?.message ?? "").toLowerCase().includes("already")
          ? "Un compte existe déjà avec cet e-mail."
          : GENERIC,
      );
    }
    const uid = created.user.id as string;

    const { error: pErr } = await admin.from("profiles").upsert({
      id: uid,
      first_name: data.firstName,
      last_name: data.lastName,
      email,
      phone: data.phone ?? null,
      staff_scope: effectiveScope(data.role, data.scope),
      // Management roles carry no commission rate and are never external contractors.
      commission_rate: (MANAGEMENT_ROLES as readonly string[]).includes(data.role) ? null : (data.commissionRate ?? null),
      is_external: (MANAGEMENT_ROLES as readonly string[]).includes(data.role) ? false : (data.isExternal ?? false),
      partner_kind: null,
      is_active: true,
    });
    if (pErr) fail("staffCreate.profile", pErr);

    await admin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rErr) fail("staffCreate.role", rErr);

    await audit(admin, context.userId, "staff_create", uid, { email, role: data.role, scope: data.scope });
    return { ok: true, userId: uid };
  });

/* ---------------- Update ---------------- */

const UpdateInput = z.object({
  userId: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  scope: z.enum(["purchase", "sales", "both"]).optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  isExternal: z.boolean().optional(),
});

export const staffUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    if (data.role && data.userId === context.userId && !(ADMIN_ROLES as readonly string[]).includes(data.role)) {
      throw new Error("Vous ne pouvez pas retirer votre propre rôle administrateur.");
    }
    if (data.role && !(ADMIN_ROLES as readonly string[]).includes(data.role)) {
      await assertLastAdminGuard(admin, data.userId);
    }

    const patch: Record<string, unknown> = { partner_kind: null };
    if (data.firstName !== undefined) patch.first_name = data.firstName;
    if (data.lastName !== undefined) patch.last_name = data.lastName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.commissionRate !== undefined) patch.commission_rate = data.commissionRate;
    if (data.isExternal !== undefined) patch.is_external = data.isExternal;
    if (data.scope !== undefined || data.role !== undefined) {
      const nextScope = (data.scope ?? "both") as StaffScope;
      if (data.role !== undefined && (MANAGEMENT_ROLES as readonly string[]).includes(data.role)) {
        patch.staff_scope = "both";
      } else if (data.scope !== undefined) {
        patch.staff_scope = nextScope;
      }
    }
    // Management roles carry no commission rate and are never external contractors.
    if (data.role !== undefined && (MANAGEMENT_ROLES as readonly string[]).includes(data.role)) {
      patch.commission_rate = null;
      patch.is_external = false;
    }
    const { error: pErr } = await admin.from("profiles").update(patch).eq("id", data.userId);
    if (pErr) fail("staffUpdate.profile", pErr);

    if (data.role) {
      await admin.from("user_roles").delete().eq("user_id", data.userId);
      const { error: rErr } = await admin.from("user_roles").insert({ user_id: data.userId, role: data.role });
      if (rErr) fail("staffUpdate.role", rErr);
    }
    await audit(admin, context.userId, "staff_update", data.userId, {
      role: data.role ?? null,
      scope: data.scope ?? null,
    });
    return { ok: true };
  });

async function assertLastAdminGuard(admin: any, targetUserId: string) {
  const { data: target } = await admin.from("user_roles").select("role").eq("user_id", targetUserId);
  const wasAdmin = (target ?? []).some((r: any) => (ADMIN_ROLES as readonly string[]).includes(r.role));
  if (!wasAdmin) return;
  const { data: admins } = await admin.from("user_roles").select("user_id").in("role", ADMIN_ROLES as unknown as string[]);
  const others = new Set((admins ?? []).map((r: any) => r.user_id as string));
  others.delete(targetUserId);
  if (others.size === 0) throw new Error("Il doit rester au moins un administrateur.");
}

/* ---------------- Activate / deactivate ---------------- */

export const staffSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (!data.active && data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    if (!data.active) await assertLastAdminGuard(admin, data.userId);

    const { error } = await admin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    if (error) fail("staffSetActive", error);
    // Also block/unblock at the auth level so existing sessions cannot refresh.
    await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    await audit(admin, context.userId, data.active ? "staff_enable" : "staff_disable", data.userId, {});
    return { ok: true };
  });

/* ---------------- Reset password ---------------- */

export const staffResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(10).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) fail("staffResetPassword", error);
    await audit(admin, context.userId, "staff_reset_password", data.userId, {});
    return { ok: true };
  });

/* ---------------- Delete ---------------- */

export const staffDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), transferToId: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await assertLastAdminGuard(admin, data.userId);

    const [{ count: oppCount }, { count: demandCount }] = await Promise.all([
      admin.from("vehicle_opportunities").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", data.userId),
      admin.from("demand_opportunities").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", data.userId),
    ]);
    const total = (oppCount ?? 0) + (demandCount ?? 0);
    if (total > 0 && !data.transferToId) {
      throw new Error(`Cet employé a ${total} dossier(s) assigné(s). Choisissez un employé pour le transfert.`);
    }
    if (data.transferToId) {
      await admin.from("vehicle_opportunities").update({ assigned_sales_agent_id: data.transferToId }).eq("assigned_sales_agent_id", data.userId);
      await admin.from("demand_opportunities").update({ assigned_sales_agent_id: data.transferToId }).eq("assigned_sales_agent_id", data.userId);
      await admin.from("buyer_leads").update({ assigned_sales_agent_id: data.transferToId }).eq("assigned_sales_agent_id", data.userId);
    }

    await audit(admin, context.userId, "staff_delete", data.userId, { transferred: total });
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) fail("staffDelete", error);
    return { ok: true };
  });

/* ---------------- Own scope (used by the UI to shape menus) ---------------- */

export const myStaffContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: roles }, { data: profile }, { data: memberships }] = await Promise.all([
      sb.from("user_roles").select("role").eq("user_id", context.userId),
      sb.from("profiles").select("staff_scope, is_active, is_external").eq("id", context.userId).maybeSingle(),
      sb.from("staff_group_members").select("group_id").eq("user_id", context.userId),
    ]);
    return {
      role: ((roles ?? [])[0]?.role ?? null) as StaffRole | "partenaire" | null,
      scope: (profile?.staff_scope ?? "both") as StaffScope,
      isActive: profile?.is_active !== false,
      isExternal: profile?.is_external === true,
      groupIds: (memberships ?? []).map((m: any) => m.group_id as string),
    };
  });

/* ---------------- Assignment groups ---------------- */

export const groupList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const [{ data: groups, error }, { data: members }] = await Promise.all([
      sb.from("staff_groups").select("*").order("name"),
      sb.from("staff_group_members").select("group_id, user_id"),
    ]);
    if (error) fail("groupList", error);
    const byGroup: Record<string, string[]> = {};
    for (const m of members ?? []) (byGroup[m.group_id] ??= []).push(m.user_id as string);
    return { groups: (groups ?? []).map((g: any) => ({ ...g, member_ids: byGroup[g.id] ?? [] })) };
  });

const GroupInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  side: z.enum(["purchase", "sales", "both"]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isExternal: z.boolean().default(false),
  memberIds: z.array(z.string().uuid()).default([]),
});

export const groupSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GroupInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const row = {
      name: data.name.trim(),
      side: data.side,
      is_active: data.isActive,
      is_default: data.isDefault,
      is_external: data.isExternal,
    };
    let groupId = data.id ?? null;
    if (groupId) {
      const { error } = await admin.from("staff_groups").update(row).eq("id", groupId);
      if (error) fail("groupSave.update", error);
    } else {
      const { data: created, error } = await admin.from("staff_groups").insert(row).select("id").single();
      if (error) fail("groupSave.insert", error);
      groupId = created.id as string;
    }

    // Only one default group per side.
    if (data.isDefault) {
      await admin.from("staff_groups").update({ is_default: false }).neq("id", groupId).eq("side", data.side);
    }

    await admin.from("staff_group_members").delete().eq("group_id", groupId);
    if (data.memberIds.length) {
      const { error } = await admin
        .from("staff_group_members")
        .insert(data.memberIds.map((uid) => ({ group_id: groupId, user_id: uid })));
      if (error) fail("groupSave.members", error);
    }
    await audit(admin, context.userId, data.id ? "group_update" : "group_create", groupId as string, row);
    return { ok: true, id: groupId };
  });

export const groupDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("staff_groups").delete().eq("id", data.id);
    if (error) fail("groupDelete", error);
    await audit(admin, context.userId, "group_delete", data.id, {});
    return { ok: true };
  });
