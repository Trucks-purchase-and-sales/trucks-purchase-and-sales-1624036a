import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve the canonical landing route for the current user based on their
 * roles + partner_kind. Called right after sign-in and by /dashboard when
 * an internal user lands there by accident.
 */
export async function resolveRoleHome(userId: string): Promise<string> {
  const [{ data: rolesRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("partner_kind").eq("id", userId).maybeSingle(),
  ]);
  const roles = new Set((rolesRows ?? []).map((r) => r.role));
  if (roles.has("admin") || roles.has("platform_admin")) return "/admin";
  if (roles.has("company_management")) return "/direction";
  if (roles.has("sales_manager")) return "/manager";
  if (roles.has("sales_agent") || roles.has("external_agent")) return "/sales";
  if (roles.has("partenaire")) {
    return profile?.partner_kind === "client" ? "/espace-acheteur" : "/dashboard";
  }
  return "/dashboard";
}
