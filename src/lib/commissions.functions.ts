// Commission engine — server functions.
// All authenticated via requireSupabaseAuth (bearer attached by src/start.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── helpers ───────────────────────────────────────────────────────────────

async function isAdminOrManager(ctx: { supabase: unknown; userId: string }) {
  const sb = ctx.supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          in: (
            c: string,
            v: string[],
          ) => Promise<{ data: Array<{ role: string }> | null }>;
        };
      };
    };
  };
  const { data } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["admin", "platform_admin", "sales_manager"]);
  return {
    hasAccess: !!(data && data.length > 0),
    roles: (data ?? []).map((r) => r.role),
    isAdmin: (data ?? []).some((r) =>
      ["admin", "platform_admin"].includes(r.role),
    ),
  };
}

// ── Commissions ──────────────────────────────────────────────────────────

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        status: z
          .enum(["draft", "approved", "paid", "cancelled"])
          .optional()
          .nullable(),
        partenaireId: z.string().uuid().optional().nullable(),
        from: z.string().optional().nullable(),
        to: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    type Row = {
      id: string;
      vehicle_opportunity_id: string;
      partenaire_id: string | null;
      basis: string;
      basis_amount_eur: number;
      rule_kind: string;
      rule_value: number;
      computed_amount_eur: number;
      status: string;
      approved_at: string | null;
      paid_at: string | null;
      created_at: string;
      vehicle_opportunities:
        | { reference_number: string | null; brand: string | null; model: string | null }
        | null;
      profiles:
        | { first_name: string | null; last_name: string | null; company_name: string | null; email: string | null }
        | null;
    };
    let q = context.supabase
      .from("opportunity_commissions")
      .select(
        `id,vehicle_opportunity_id,partenaire_id,basis,basis_amount_eur,rule_kind,rule_value,computed_amount_eur,status,approved_at,paid_at,created_at,
         vehicle_opportunities!inner(reference_number,brand,model),
         profiles:partenaire_id(first_name,last_name,company_name,email)`,
      )
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.partenaireId) q = q.eq("partenaire_id", data.partenaireId);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = (await q) as {
      data: Row[] | null;
      error: unknown;
    };
    if (error) {
      console.error("[commissions.list]", error);
      throw new Error("Impossible de charger les commissions.");
    }
    return { commissions: rows ?? [] };
  });

export const approveCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");
    const { data: comm } = await context.supabase
      .from("opportunity_commissions")
      .select("partenaire_id,computed_amount_eur")
      .eq("id", data.id)
      .maybeSingle();
    if (!comm?.partenaire_id) {
      throw new Error("Sélectionnez d'abord le bénéficiaire de la commission.");
    }
    const { error } = await context.supabase
      .from("opportunity_commissions")
      .update({
        status: "approved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) {
      console.error("[commissions.approve]", error);
      throw new Error("Validation impossible.");
    }
    return { ok: true };
  });

export const markCommissionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        reference: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");

    const { data: comm, error: cErr } = await context.supabase
      .from("opportunity_commissions")
      .select("id,status,notes")
      .eq("id", data.id)
      .single();
    if (cErr || !comm) throw new Error("Commission introuvable.");
    if (comm.status === "paid") return { ok: true };

    const { error: uErr } = await context.supabase
      .from("opportunity_commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        notes: data.reference ? `Réf. versement : ${data.reference}` : comm.notes,
      })
      .eq("id", data.id);
    if (uErr) {
      console.error("[commissions.pay-mark]", uErr);
      throw new Error("Impossible de marquer la commission versée.");
    }
    return { ok: true };
  });

export const cancelCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");
    const { error } = await context.supabase
      .from("opportunity_commissions")
      .update({ status: "cancelled", notes: data.reason ?? null })
      .eq("id", data.id);
    if (error) {
      console.error("[commissions.cancel]", error);
      throw new Error("Annulation impossible.");
    }
    return { ok: true };
  });

// ── Commission rules ─────────────────────────────────────────────────────

export const listCommissionRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("commission_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error("Impossible de charger les règles.");
    return { rules: data ?? [] };
  });

export const upsertCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(120),
        active: z.boolean().default(true),
        applies_to: z.enum(["all", "partner", "country", "vehicle_type"]),
        match_value: z.string().optional().nullable(),
        basis: z.enum(["purchase", "sale"]),
        rule_kind: z.enum(["pct_of_purchase", "pct_of_margin", "flat"]),
        rule_value: z.number().nonnegative(),
        priority: z.number().int().default(0),
        notes: z.string().optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");
    const row = {
      name: data.name,
      active: data.active,
      applies_to: data.applies_to,
      match_value: data.match_value ?? null,
      basis: data.basis,
      rule_kind: data.rule_kind,
      rule_value: data.rule_value,
      priority: data.priority,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("commission_rules")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error("Mise à jour impossible.");
    } else {
      const { error } = await context.supabase
        .from("commission_rules")
        .insert(row);
      if (error) throw new Error("Création impossible.");
    }
    return { ok: true };
  });

export const deleteCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");
    const { error } = await context.supabase
      .from("commission_rules")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

// ── Partner-facing summary ───────────────────────────────────────────────

export const partnerCommissionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    type Row = {
      id: string;
      vehicle_opportunity_id: string;
      basis: string;
      computed_amount_eur: number;
      status: string;
      approved_at: string | null;
      paid_at: string | null;
      created_at: string;
      vehicle_opportunities:
        | { reference_number: string | null; brand: string | null; model: string | null }
        | null;
    };
    const { data, error } = (await context.supabase
      .from("opportunity_commissions")
      .select(
        `id,vehicle_opportunity_id,basis,computed_amount_eur,status,approved_at,paid_at,created_at,
         vehicle_opportunities!inner(reference_number,brand,model)`,
      )
      .eq("partenaire_id", context.userId)
      .order("created_at", { ascending: false })) as {
      data: Row[] | null;
      error: unknown;
    };
    if (error) {
      console.error("[commissions.mine]", error);
      throw new Error("Impossible de charger vos commissions.");
    }
    const rows = data ?? [];
    const sum = (s: string) =>
      rows
        .filter((r) => r.status === s)
        .reduce((a, r) => a + Number(r.computed_amount_eur), 0);
    return {
      totals: {
        draft: sum("draft"),
        approved: sum("approved"),
        paid: sum("paid"),
      },
      commissions: rows,
    };
  });


// ── Commission for one opportunity ───────────────────────────────────────

export const opportunityCommission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ opportunityId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: comm, error } = await context.supabase
      .from("opportunity_commissions")
      .select(
        `id,partenaire_id,basis,basis_amount_eur,rule_kind,rule_value,computed_amount_eur,status,approved_at,paid_at,notes,
         profiles:partenaire_id(first_name,last_name,company_name,email)`,
      )
      .eq("vehicle_opportunity_id", data.opportunityId)
      .maybeSingle();
    if (error) {
      console.error("[commissions.for-opportunity]", error);
      throw new Error("Impossible de charger la commission.");
    }
    return { commission: comm ?? null };
  });

// ── Beneficiaries (people a commission can be paid to) ───────────────────

export const listCommissionBeneficiaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.hasAccess) throw new Error("forbidden");

    const { data: roles, error: rErr } = await context.supabase
      .from("user_roles")
      .select("user_id,role")
      .in("role", ["partenaire", "apporteur"]);
    if (rErr) {
      console.error("[commissions.beneficiaries.roles]", rErr);
      throw new Error("Impossible de charger les bénéficiaires.");
    }
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return { people: [] };

    const { data: people, error: pErr } = await context.supabase
      .from("profiles")
      .select("id,first_name,last_name,company_name,email")
      .in("id", ids)
      .order("last_name", { ascending: true });
    if (pErr) {
      console.error("[commissions.beneficiaries.profiles]", pErr);
      throw new Error("Impossible de charger les bénéficiaires.");
    }
    return { people: people ?? [] };
  });

// ── Edit a draft commission (beneficiary, basis, rate) ───────────────────

export const updateCommissionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        partenaireId: z.string().uuid(),
        basis: z.enum(["purchase", "sale"]),
        basisAmount: z.number().nonnegative(),
        ruleKind: z.enum(["pct_of_purchase", "pct_of_margin", "flat"]),
        ruleValue: z.number().nonnegative(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const auth = await isAdminOrManager(context);
    if (!auth.isAdmin) throw new Error("forbidden");

    const { data: comm, error: cErr } = await context.supabase
      .from("opportunity_commissions")
      .select("id,status")
      .eq("id", data.id)
      .single();
    if (cErr || !comm) throw new Error("Commission introuvable.");
    if (comm.status === "paid" || comm.status === "cancelled") {
      throw new Error("Cette commission n'est plus modifiable.");
    }

    const computed =
      data.ruleKind === "flat"
        ? data.ruleValue
        : Math.round(((data.basisAmount * data.ruleValue) / 100) * 100) / 100;

    const { error } = await context.supabase
      .from("opportunity_commissions")
      .update({
        partenaire_id: data.partenaireId,
        basis: data.basis,
        basis_amount_eur: data.basisAmount,
        rule_kind: data.ruleKind,
        rule_value: data.ruleValue,
        computed_amount_eur: computed,
        rule_id: null,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) {
      console.error("[commissions.update-draft]", error);
      throw new Error("Enregistrement impossible.");
    }
    return { ok: true, computed };
  });

