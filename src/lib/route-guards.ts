import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AllowedRole =
  | "admin"
  | "platform_admin"
  | "sales_manager"
  | "sales_agent"
  | "company_management"
  | "external_agent"
  | "partenaire";

/** Throws redirect if the signed-in user has none of the allowed roles. */
export async function requireAnyRole(userId: string, roles: AllowedRole[], fallback = "/dashboard") {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles as unknown as AllowedRole[]);
  if (!data || data.length === 0) throw redirect({ to: fallback });
}
