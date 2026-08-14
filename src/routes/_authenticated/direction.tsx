import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/direction")({
  beforeLoad: async ({ context }) => {
    const userId = (context as { userId: string }).userId;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["company_management", "platform_admin", "admin"]);
    if (!data || data.length === 0) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
