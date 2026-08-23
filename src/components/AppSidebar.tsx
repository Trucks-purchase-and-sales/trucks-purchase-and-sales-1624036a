import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Search,
  Wallet,
  Coins,
  Sparkles,
  Settings as SettingsIcon,
  Building2,
  Plus,
  Handshake,
  User,
  FileText,
  ShieldCheck,
  Database,
  Bell,
  ScrollText,
  Cog,
  Briefcase,
  Target,
  Tag,
  Link2,
  Share2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import wilmetLogo from "@/assets/wilmet-logo.png.asset.json";

type Role =
  | "admin"
  | "platform_admin"
  | "sales_manager"
  | "sales_agent"
  | "external_agent"
  | "company_management"
  | "partenaire";
type Kind = "client" | "seller" | null;
type Scope = "purchase" | "sales" | "both";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

function buildNav(
  roles: Set<Role>,
  kind: Kind,
  scope: Scope,
  t: (key: string, opts?: Record<string, unknown>) => string,
): NavGroup[] {
  const isAdmin = roles.has("admin") || roles.has("platform_admin");
  const isDirection = roles.has("company_management");
  const isManager = roles.has("sales_manager");
  const isAgent = roles.has("sales_agent");
  const isExternalAgent = roles.has("external_agent");
  const isInternal = isAdmin || isDirection || isManager || isAgent || isExternalAgent;

  if (isInternal) {
    const home: NavItem = isAdmin
      ? { to: "/admin", label: t("appShell.nav.dashboard"), icon: LayoutDashboard, exact: true }
      : isDirection
        ? { to: "/direction", label: t("direction.title"), icon: Target, exact: true }
        : isManager
          ? { to: "/manager", label: t("appShell.nav.manager"), icon: Briefcase, exact: true }
          : { to: "/sales", label: t("appShell.nav.myArea"), icon: Briefcase, exact: true };

    // A sales agent only sees the side(s) of the business in their scope.
    const agentOnly = (isAgent || isExternalAgent) && !isAdmin && !isManager && !isDirection;
    const seePurchase = !agentOnly || scope === "purchase" || scope === "both";
    const seeSales = !agentOnly || scope === "sales" || scope === "both";

    const pipeline: NavItem[] = [];
    if (isAdmin || isManager || isAgent || isExternalAgent) {
      if (seePurchase) {
        // The seller-lead inbox is an internal triage queue: external agents have no access.
        if (!isExternalAgent)
          pipeline.push({
            to: "/admin/leads",
            label: t("appShell.nav.sellerLeads"),
            icon: ListChecks,
          });
        pipeline.push({
          to: "/admin",
          label: t("appShell.nav.offerOpportunities"),
          icon: Handshake,
          exact: true,
        });
      }
      if (seeSales) {
        pipeline.push({ to: "/admin/buyer-leads", label: t("kpi.buyerLeads"), icon: Search });
        pipeline.push({
          to: "/admin/demand-opportunities",
          label: t("appShell.nav.demandOpportunities"),
          icon: Target,
        });
        pipeline.push({
          to: "/admin/sale-listings",
          label: t("appShell.nav.saleListings"),
          icon: Tag,
        });
      }
      if (agentOnly) {
        pipeline.push({
          to: "/mes-demandes-clients",
          label: t("mesDemandesClients.title"),
          icon: Briefcase,
        });
      }
      pipeline.push({ to: "/admin/matching", label: t("appShell.nav.matching"), icon: Sparkles });
    }

    const finance: NavItem[] = [];
    if (isAdmin || isManager || isDirection)
      finance.push({ to: "/admin/commissions", label: t("appShell.nav.commissions"), icon: Coins });

    // Partners live inside Paramètres > Utilisateurs (Partenaires tab); managers keep a direct link.
    const dir: NavItem[] = [];
    if (isManager && !isAdmin)
      dir.push({ to: "/admin/partenaires", label: t("appShell.nav.partners"), icon: Users });

    const settings: NavItem[] = [];
    if (isAdmin) {
      settings.push({ to: "/admin/users", label: t("appShell.nav.users"), icon: Users });
      settings.push({ to: "/admin/reference", label: t("appShell.nav.reference"), icon: Database });
      settings.push({ to: "/admin/content", label: t("appShell.nav.content"), icon: FileText });
      settings.push({
        to: "/admin/notifications",
        label: t("appShell.notifications.title"),
        icon: Bell,
      });
      settings.push({ to: "/admin/audit", label: t("appShell.nav.audit"), icon: ScrollText });
      settings.push({ to: "/admin/settings", label: t("appShell.nav.general"), icon: Cog });
    }

    // Only sales agents carry a personal affiliate link; leaders just see the ranking.
    const affiliation: NavItem[] = [];
    if (isAgent || isExternalAgent)
      affiliation.push({ to: "/mon-lien", label: t("monLien.title"), icon: Link2 });
    if (isAdmin || isManager || isDirection) {
      affiliation.push({
        to: "/admin/affiliation",
        label: t("appShell.nav.affiliation"),
        icon: Share2,
      });
    }

    const groups: NavGroup[] = [{ label: t("monLien.targets.home"), items: [home] }];
    if (pipeline.length) groups.push({ label: t("appShell.nav.groupPipeline"), items: pipeline });
    if (finance.length) groups.push({ label: t("appShell.nav.groupFinance"), items: finance });
    if (dir.length) groups.push({ label: t("appShell.nav.groupDirectories"), items: dir });
    if (affiliation.length)
      groups.push({ label: t("appShell.nav.affiliation"), items: affiliation });
    if (settings.length) groups.push({ label: t("appShell.nav.groupSettings"), items: settings });
    groups.push({
      label: t("appShell.nav.groupAccount"),
      items: [{ to: "/profile", label: t("appShell.profileMenu.myProfile"), icon: User }],
    });
    return groups;
  }

  // Partner surfaces — buyers get their own dashboard route, sellers keep /dashboard.
  const partner: NavItem[] = [
    kind === "client"
      ? {
          to: "/espace-acheteur",
          label: t("appShell.nav.dashboard"),
          icon: LayoutDashboard,
          exact: true,
        }
      : {
          to: "/dashboard",
          label: t("appShell.nav.dashboard"),
          icon: LayoutDashboard,
          exact: true,
        },
  ];
  if (kind === "seller") {
    partner.push({ to: "/opportunities/new", label: t("dashboard.proposeVehicle"), icon: Plus });
    partner.push({ to: "/mes-echanges", label: t("mesEchanges.title"), icon: Handshake });
    partner.push({ to: "/mes-commissions", label: t("mesCommissions.title"), icon: Coins });
  }
  if (kind === "client") {
    partner.push({ to: "/mes-demandes", label: t("mesDemandes.title"), icon: Search });
  }
  const partnerGroups: NavGroup[] = [{ label: t("appShell.nav.partnerSpace"), items: partner }];
  // Only selling partners bring in business, so only they get an affiliate link.
  if (kind === "seller") {
    partnerGroups.push({
      label: t("appShell.nav.affiliation"),
      items: [{ to: "/mon-lien", label: t("monLien.title"), icon: Link2 }],
    });
  }
  partnerGroups.push({
    label: t("appShell.nav.groupAccount"),
    items: [{ to: "/profile", label: t("appShell.profileMenu.myProfile"), icon: User }],
  });
  return partnerGroups;
}

export function AppSidebar({
  roles,
  partnerKind,
  staffScope,
}: {
  roles: Role[] | undefined;
  partnerKind: Kind;
  staffScope?: Scope;
}) {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = buildNav(new Set(roles ?? []), partnerKind, staffScope ?? "both", t);

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
            <Building2 className="mr-1 inline h-3 w-3" /> {t("appShell.footer.tagline")}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
