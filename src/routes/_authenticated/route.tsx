import { createFileRoute, Outlet, redirect, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18nInit } from "@/i18n/useI18nInit";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // The Supabase client lazily constructs on first access and throws if it
    // can't (e.g. missing env vars in this deployment). Fail closed the same
    // way an actual auth failure does -- redirect to /auth -- instead of
    // letting the whole authenticated app crash to a dead error screen.
    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error) user = data.user;
    } catch (error) {
      console.error("[auth] session check failed; redirecting to sign-in", error);
    }
    if (!user) throw redirect({ to: "/auth" });
    return { userId: user.id, email: user.email ?? "" };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  useI18nInit();
  const { userId } = Route.useRouteContext();

  const { data: roles } = useQuery({
    queryKey: ["user_roles", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r) => r.role as "admin" | "platform_admin" | "sales_manager" | "sales_agent" | "external_agent" | "company_management" | "partenaire");
    },
    staleTime: 60_000,
  });
  const { data: profile, isSuccess: profileLoaded } = useQuery({
    queryKey: ["partner_kind", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("partner_kind, staff_scope, is_active")
        .eq("id", userId)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 60_000,
  });
  const profileMissing = profileLoaded && profile === null;
  const partnerKind = (profile?.partner_kind ?? null) as "client" | "seller" | null;
  const staffScope = (profile?.staff_scope ?? "both") as "purchase" | "sales" | "both";
  const navigate = useNavigate();
  const disabled = profile ? profile.is_active === false : false;

  // A deactivated account must not keep browsing the app.
  useEffect(() => {
    if (!disabled) return;
    void (async () => {
      await supabase.auth.signOut();
      toast.error("Votre compte a été désactivé. Contactez l'administrateur.");
      navigate({ to: "/auth", replace: true });
    })();
  }, [disabled, navigate]);

  if (disabled) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center text-sm text-muted-foreground">
        Votre compte a été désactivé. Contactez l&apos;administrateur.
      </div>
    );
  }

  // Auth user exists but no application profile row: do not treat as a normal account.
  if (profileMissing) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md space-y-3 text-center text-sm">
          <h1 className="text-lg font-semibold">Compte en cours d&apos;initialisation</h1>
          <p className="text-muted-foreground">
            Votre profil applicatif est introuvable. Votre compte n&apos;a pas été initialisé correctement.
            Contactez l&apos;administrateur pour le finaliser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary/40">
        <AppSidebar roles={roles} partnerKind={partnerKind} staffScope={staffScope} />

        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="hidden sm:block"><LanguageSwitcher compact /></div>
            <NotificationBell />
            <ProfileMenu />
          </header>
          <main className="container-page pt-6 pb-10">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function NotificationBell() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: notifs } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,read_at,created_at,vehicle_opportunity_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const unread = (notifs ?? []).filter((n) => !n.read_at).length;

  useEffect(() => {
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { title?: string; body?: string | null };
          if (n?.title) toast(n.title, { description: n.body ?? undefined });
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  async function markAllRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      toast.error("Impossible de marquer les notifications comme lues", { description: error.message });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs font-medium text-accent hover:underline">
              Tout marquer lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {(notifs ?? []).length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune notification</div>
          )}
          {(notifs ?? []).map((n) => (
            <Link
              key={n.id}
              to={n.vehicle_opportunity_id ? "/opportunities/$id" : "/dashboard"}
              params={n.vehicle_opportunity_id ? { id: n.vehicle_opportunity_id } : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "block border-b border-border/50 px-3 py-3 text-sm hover:bg-secondary/70",
                !n.read_at && "bg-accent/5",
              )}
            >
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {new Date(n.created_at as string).toLocaleString("fr-FR")}
              </div>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const { email } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground">
            {(email || "?").charAt(0)}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" /> Mon profil</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Se déconnecter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
