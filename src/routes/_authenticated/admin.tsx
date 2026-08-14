import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Admin subtree is open to Wilmet internal staff — admin, sales manager,
// sales agents, direction, and platform admin. Partners never enter.
// Sub-pages that must stay admin-only (settings, reference data, content,
// audit, payment-method verification) enforce that in their own beforeLoad.
const INTERNAL_ROLES = [
  "admin",
  "platform_admin",
  "sales_manager",
  "sales_agent",
  "company_management",
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", INTERNAL_ROLES as unknown as ("admin" | "platform_admin" | "sales_manager" | "sales_agent" | "company_management")[]);
    if (error || !data || data.length === 0) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
