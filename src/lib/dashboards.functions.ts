import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";

function fail(where: string, error: unknown): never {
  console.error(`[dashboards.functions:${where}]`, error);
  throw new Error(GENERIC);
}

async function hasAnyRoleServer(sb: any, userId: string, roles: string[]): Promise<boolean> {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).in("role", roles);
  if (error) return false;
  return !!(data && data.length > 0);
}

/** One pass over statuses instead of a count query per stage. */
async function statusCounts(sb: any, filter: (q: any) => any, where: string): Promise<Record<string, number>> {
  const { data, error } = await filter(sb.from("vehicle_opportunities").select("status"));
  if (error) fail(where, error);
  const acc: Record<string, number> = {};
  for (const row of (data ?? []) as { status: string }[]) acc[row.status] = (acc[row.status] ?? 0) + 1;
  return acc;
}

/** KPI counts for a sales agent — scoped to opportunities assigned to them. */
export const salesAgentKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const userId = context.userId;
    const ok = await hasAnyRoleServer(sb, userId, ["sales_agent", "external_agent", "sales_manager", "platform_admin", "admin"]);
    if (!ok) throw new Error("Non autorisé");

    const countBy = async (filter: (q: any) => any) => {
      const q = sb.from("vehicle_opportunities").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", userId);
      const { count, error } = await filter(q);
      if (error) fail("salesAgentKpis.count", error);
      return count ?? 0;
    };
    const [assigned, analysis, accepted, refused] = await Promise.all([
      countBy((q: any) => q),
      countBy((q: any) => q.eq("status", "en_cours_analyse")),
      countBy((q: any) => q.eq("status", "achetee")),
      countBy((q: any) => q.eq("status", "refusee")),
    ]);

    const { count: leads } = await sb.from("buyer_leads").select("id", { count: "exact", head: true }).eq("assigned_sales_agent_id", userId);
    const byStatus = await statusCounts(sb, (q: any) => q.eq("assigned_sales_agent_id", userId), "salesAgentKpis.byStatus");
    return { assigned, analysis, accepted, refused, leads: leads ?? 0, byStatus };
  });

/** KPI counts for a sales manager — spans all opportunities/leads. */
export const managerKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const ok = await hasAnyRoleServer(sb, context.userId, ["sales_manager", "platform_admin", "admin"]);
    if (!ok) throw new Error("Non autorisé");

    const countOpp = async (filter: (q: any) => any) => {
      const q = sb.from("vehicle_opportunities").select("id", { count: "exact", head: true });
      const { count } = await filter(q);
      return count ?? 0;
    };
    const [total, analysis, accepted, refused, unassigned] = await Promise.all([
      countOpp((q: any) => q.neq("status", "brouillon")),
      countOpp((q: any) => q.eq("status", "en_cours_analyse")),
      countOpp((q: any) => q.eq("status", "achetee")),
      countOpp((q: any) => q.eq("status", "refusee")),
      countOpp((q: any) => q.is("assigned_sales_agent_id", null).neq("status", "brouillon")),
    ]);
    const { count: leads } = await sb.from("buyer_leads").select("id", { count: "exact", head: true });
    const byStatus = await statusCounts(sb, (q: any) => q, "managerKpis.byStatus");
    return { total, analysis, accepted, refused, unassigned, leads: leads ?? 0, byStatus };
  });

/** KPI counts for company management — high-level. */
export const directionKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const ok = await hasAnyRoleServer(sb, context.userId, ["company_management", "platform_admin", "admin"]);
    if (!ok) throw new Error("Non autorisé");

    const countOpp = async (filter: (q: any) => any) => {
      const q = sb.from("vehicle_opportunities").select("id", { count: "exact", head: true });
      const { count } = await filter(q);
      return count ?? 0;
    };
    const [total, accepted, refused, analysis] = await Promise.all([
      countOpp((q: any) => q.neq("status", "brouillon")),
      countOpp((q: any) => q.eq("status", "achetee")),
      countOpp((q: any) => q.eq("status", "refusee")),
      countOpp((q: any) => q.eq("status", "en_cours_analyse")),
    ]);
    const { count: partenaires } = await sb.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "partenaire");
    const { count: leads } = await sb.from("buyer_leads").select("id", { count: "exact", head: true });
    const { count: leadsWon } = await sb.from("buyer_leads").select("id", { count: "exact", head: true }).eq("status", "gagne");
    const byStatus = await statusCounts(sb, (q: any) => q, "directionKpis.byStatus");
    return { byStatus, total, accepted, refused, analysis, partenaires: partenaires ?? 0, leads: leads ?? 0, leadsWon: leadsWon ?? 0 };
  });

/** Buyer "Mes demandes" list — leads owned by the current user. */
export const myBuyerLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("buyer_leads")
      .select("id, reference_number, status, preferred_brand, preferred_model, min_year, max_mileage, max_budget_ht, currency, created_at, updated_at, source")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) fail("myBuyerLeads", error);
    return { rows: data ?? [] };
  });
