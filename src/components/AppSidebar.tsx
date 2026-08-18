import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ListChecks, Users, Search, Wallet, Coins, Sparkles,
  Settings as SettingsIcon, Building2, Plus, Handshake, User, FileText,
  ShieldCheck, Database, Bell, ScrollText, Cog, Briefcase, Target, Tag, Link2, Share2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";

type Role = "admin" | "platform_admin" | "sales_manager" | "sales_agent" | "external_agent" | "company_management" | "partenaire";
type Kind = "client" | "seller" | null;
type Scope = "purchase" | "sales" | "both";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

function buildNav(roles: Set<Role>, kind: Kind, scope: Scope, isExternalStaff: boolean): NavGroup[] {
  const isAdmin = roles.has("admin") || roles.has("platform_admin");
  const isDirection = roles.has("company_management");
  const isManager = roles.has("sales_manager");
  const isAgent = roles.has("sales_agent");
  // An external contractor is identified by the explicit external_agent role.
  const isExternalAgent = roles.has("external_agent") || (isExternalStaff && roles.has("sales_agent"));
  const isInternal = isAdmin || isDirection || isManager || isAgent || isExternalAgent;

  if (isInternal) {
    const home: NavItem = isAdmin
      ? { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true }
      : isDirection
      ? { to: "/direction", label: "Direction", icon: Target, exact: true }
      : isManager
      ? { to: "/manager", label: "Manager", icon: Briefcase, exact: true }
      : { to: "/sales", label: "Mon espace", icon: Briefcase, exact: true };

    // A sales agent only sees the side(s) of the business in their scope.
    const agentOnly = (isAgent || isExternalAgent) && !isAdmin && !isManager && !isDirection;
    const seePurchase = !agentOnly || scope === "purchase" || scope === "both";
    const seeSales = !agentOnly || scope === "sales" || scope === "both";

    const pipeline: NavItem[] = [];
    if (isAdmin || isManager || isAgent || isExternalAgent) {
      if (seePurchase) {
        // The seller-lead inbox is an internal triage queue: external agents have no access.
        if (!isExternalAgent) pipeline.push({ to: "/admin/leads", label: "Leads vendeurs", icon: ListChecks });
        pipeline.push({ to: "/admin", label: "Opportunités offre", icon: Handshake, exact: true });
      }
      if (seeSales) {
        pipeline.push({ to: "/admin/buyer-leads", label: "Demandes acheteurs", icon: Search });
        pipeline.push({ to: "/admin/demand-opportunities", label: "Opportunités demande", icon: Target });
        pipeline.push({ to: "/admin/sale-listings", label: "Offres de vente", icon: Tag });

      }
      if (agentOnly) {
        pipeline.push({ to: "/mes-demandes-clients", label: "Mes demandes clients", icon: Briefcase });
      }
      pipeline.push({ to: "/admin/matching", label: "Matching IA", icon: Sparkles });
    }



    const finance: NavItem[] = [];
    if (isAdmin || isManager || isDirection) finance.push({ to: "/admin/commissions", label: "Commissions", icon: Coins });

    // Partners live inside Paramètres > Utilisateurs (Partenaires tab); managers keep a direct link.
    const dir: NavItem[] = [];
    if (isManager && !isAdmin) dir.push({ to: "/admin/partenaires", label: "Partenaires", icon: Users });


    const settings: NavItem[] = [];
    if (isAdmin) {
      settings.push({ to: "/admin/users", label: "Utilisateurs", icon: Users });

      settings.push({ to: "/admin/reference", label: "Référentiels", icon: Database });
      settings.push({ to: "/admin/content", label: "Contenu", icon: FileText });
      settings.push({ to: "/admin/notifications", label: "Notifications", icon: Bell });
      settings.push({ to: "/admin/audit", label: "Audit", icon: ScrollText });
      settings.push({ to: "/admin/settings", label: "Général", icon: Cog });
    }

    // Only sales agents carry a personal affiliate link; leaders just see the ranking.
    const affiliation: NavItem[] = [];
    if (isAgent || isExternalAgent) affiliation.push({ to: "/mon-lien", label: "Mon lien d'affiliation", icon: Link2 });
    if (isAdmin || isManager || isDirection) {
      affiliation.push({ to: "/admin/affiliation", label: "Affiliation", icon: Share2 });
    }

    const groups: NavGroup[] = [{ label: "Accueil", items: [home] }];
    if (pipeline.length) groups.push({ label: "Pipeline", items: pipeline });
    if (finance.length) groups.push({ label: "Finance", items: finance });
    if (dir.length) groups.push({ label: "Annuaires", items: dir });
    if (affiliation.length) groups.push({ label: "Affiliation", items: affiliation });
    if (settings.length) groups.push({ label: "Paramètres", items: settings });
    groups.push({ label: "Compte", items: [{ to: "/profile", label: "Mon profil", icon: User }] });
    return groups;
  }


  // Partner surfaces — buyers get their own dashboard route, sellers keep /dashboard.
  const partner: NavItem[] = [
    kind === "client"
      ? { to: "/espace-acheteur", label: "Tableau de bord", icon: LayoutDashboard, exact: true }
      : { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  ];
  if (kind === "seller") {
    partner.push({ to: "/opportunities/new", label: "Proposer un véhicule", icon: Plus });
    partner.push({ to: "/mes-echanges", label: "Mes échanges", icon: Handshake });
    partner.push({ to: "/mes-commissions", label: "Mes commissions", icon: Coins });
  }
  if (kind === "client") {
    partner.push({ to: "/mes-demandes", label: "Mes demandes", icon: Search });
  }
  const partnerGroups: NavGroup[] = [{ label: "Espace partenaire", items: partner }];
  // Only selling partners bring in business, so only they get an affiliate link.
  if (kind === "seller") {
    partnerGroups.push({ label: "Affiliation", items: [{ to: "/mon-lien", label: "Mon lien d'affiliation", icon: Link2 }] });
  }
  partnerGroups.push({ label: "Compte", items: [{ to: "/profile", label: "Mon profil", icon: User }] });
  return partnerGroups;

}

export function AppSidebar({ roles, partnerKind, staffScope, isExternalStaff }: { roles: Role[] | undefined; partnerKind: Kind; staffScope?: Scope; isExternalStaff?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = buildNav(new Set(roles ?? []), partnerKind, staffScope ?? "both", isExternalStaff === true);


  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center px-2 py-1.5">
          <img src={wilmetLogo.url} alt="Wilmet Trucks" className="h-8 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = isActive(it.to, it.exact);
                  const Icon = it.icon;
                  return (
                    <SidebarMenuItem key={it.to + it.label}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                        <Link to={it.to}>
                          <Icon className="h-4 w-4" />
                          <span>{it.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && (
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Building2 className="mr-1 inline h-3 w-3" /> Wilmet · Négoce européen
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
