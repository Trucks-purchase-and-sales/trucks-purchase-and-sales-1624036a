import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PartnerKind = Database["public"]["Enums"]["partner_kind"];

/** Fetches the (single) role for the given user. Cached for a minute. */
export function useCurrentRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_roles", userId ?? "none"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole[]> => {
      if (!userId) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function usePartnerKind(userId: string | undefined) {
  return useQuery({
    queryKey: ["partner_kind", userId ?? "none"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<PartnerKind | null> => {
      if (!userId) return null;
      const { data } = await supabase.from("profiles").select("partner_kind").eq("id", userId).maybeSingle();
      return (data?.partner_kind ?? null) as PartnerKind | null;
    },
  });
}

export function isAdminRole(roles: AppRole[] | undefined): boolean {
  if (!roles) return false;
  return roles.some((r) => r === "admin" || r === "platform_admin");
}

export const ADMIN_ROLES: AppRole[] = ["admin", "platform_admin"];
