import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AffiliateStats = {
  clicks: number;
  signups: number;
  buyerLeads: number;
  vehicleOffers: number;
  won: number;
};

export type AffiliateRow = {
  ownerId: string;
  linkId: string;
  code: string;
  isActive: boolean;
  name: string;
  email: string;
  role: string | null;
  stats: AffiliateStats;
};

export type AffiliateCandidate = {
  userId: string;
  name: string;
  email: string;
  role: string | null;
};

const ADMIN_ROLES = ["admin", "platform_admin"];
const VIEW_ALL_ROLES = ["admin", "platform_admin", "sales_manager", "company_management"];

/** Only people who actually bring in business get a link: sellers and sales agents. */
async function eligibleIds(admin: any, userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const [{ data: roles }, { data: profiles }] = await Promise.all([
    admin.from("user_roles").select("user_id, role").in("user_id", userIds),
    admin.from("profiles").select("id, partner_kind").in("id", userIds),
  ]);
  const kindById = new Map<string, string | null>(
    (profiles ?? []).map((p: any) => [p.id as string, (p.partner_kind ?? null) as string | null]),
  );
  const out = new Set<string>();
  for (const r of roles ?? []) {
    const uid = (r as any).user_id as string;
    const role = (r as any).role as string;
    if (role === "sales_agent") out.add(uid);
    if (role === "partenaire" && kindById.get(uid) === "seller") out.add(uid);
  }
  return out;
}

function codeFor(profile: { first_name?: string | null; email?: string | null } | null, seed: string) {
  const base =
    (profile?.first_name || (profile?.email ?? "user").split("@")[0] || "user")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase() || "USER";
  return `${base}-${seed}`;
}

async function createLinkFor(admin: any, ownerId: string) {
  const { data: profile } = await admin
    .from("profiles").select("first_name, email").eq("id", ownerId).maybeSingle();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const { data: created, error } = await admin
    .from("affiliate_links")
    .insert({ owner_id: ownerId, code: codeFor(profile, suffix) })
    .select("id, code, is_active")
    .single();
  if (error) throw new Error(error.message);
  return { id: created.id as string, code: created.code as string, isActive: created.is_active as boolean };
}

/** Own link — null when it has not been generated yet. */
export const getMyAffiliateLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const eligible = (await eligibleIds(supabaseAdmin as any, [context.userId])).has(context.userId);
    const { data: existing } = await sb
      .from("affiliate_links")
      .select("id, code, is_active")
      .eq("owner_id", context.userId)
      .maybeSingle();
    return {
      eligible,
      link: existing
        ? { id: existing.id as string, code: existing.code as string, isActive: existing.is_active as boolean }
        : null,
    };
  });

export const createMyAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    if (!(await eligibleIds(admin, [context.userId])).has(context.userId)) {
      throw new Error("L'affiliation est réservée aux vendeurs et aux commerciaux.");
    }
    const { data: existing } = await admin
      .from("affiliate_links").select("id, code, is_active").eq("owner_id", context.userId).maybeSingle();
    if (existing) {
      return { id: existing.id as string, code: existing.code as string, isActive: existing.is_active as boolean };
    }
    return await createLinkFor(admin, context.userId);
  });

const rangeSchema = z.object({ fromDate: z.string().optional() }).partial();

async function statsFor(ownerIds: string[], fromDate?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const empty = (): AffiliateStats => ({ clicks: 0, signups: 0, buyerLeads: 0, vehicleOffers: 0, won: 0 });
  const map = new Map<string, AffiliateStats>(ownerIds.map((id) => [id, empty()]));
  if (!ownerIds.length) return map;

  const since = fromDate ?? null;
  const withRange = (q: any) => (since ? q.gte("created_at", since) : q);

  const [links, clicks, profiles, leads, opps] = await Promise.all([
    supabaseAdmin.from("affiliate_links").select("id, owner_id").in("owner_id", ownerIds),
    withRange(supabaseAdmin.from("affiliate_clicks").select("link_id, created_at")),
    withRange(supabaseAdmin.from("profiles").select("referred_by, created_at").in("referred_by", ownerIds)),
    withRange(supabaseAdmin.from("buyer_leads").select("referred_by, status, created_at").in("referred_by", ownerIds)),
    withRange(supabaseAdmin.from("vehicle_opportunities").select("referred_by, status, created_at").in("referred_by", ownerIds)),
  ]);

  const ownerByLink = new Map<string, string>((links.data ?? []).map((l: any) => [l.id, l.owner_id]));
  for (const c of clicks.data ?? []) {
    const owner = ownerByLink.get((c as any).link_id);
    const s = owner ? map.get(owner) : undefined;
    if (s) s.clicks += 1;
  }
  for (const p of profiles.data ?? []) {
    const s = map.get((p as any).referred_by); if (s) s.signups += 1;
  }
  for (const l of leads.data ?? []) {
    const s = map.get((l as any).referred_by);
    if (!s) continue;
    s.buyerLeads += 1;
    if ((l as any).status === "gagne") s.won += 1;
  }
  for (const o of opps.data ?? []) {
    const s = map.get((o as any).referred_by);
    if (!s) continue;
    s.vehicleOffers += 1;
    if (["achetee", "livree", "closed_won"].includes((o as any).status)) s.won += 1;
  }
  return map;
}

export const getMyAffiliateStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d ? rangeSchema.parse(d) : {}))
  .handler(async ({ data, context }) => {
    const map = await statsFor([context.userId], data?.fromDate);
    return map.get(context.userId)!;
  });

/** Full leaderboard — admins, managers and direction. */
export const adminListAffiliates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => (d ? rangeSchema.parse(d) : {}))
  .handler(async ({ data, context }): Promise<{ rows: AffiliateRow[] }> => {
    const sb = context.supabase as any;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    const myRoles = (roles ?? []).map((r: { role: string }) => r.role);
    if (!myRoles.some((r: string) => VIEW_ALL_ROLES.includes(r))) throw new Error("Non autorisé");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("affiliate_links")
      .select("id, owner_id, code, is_active")
      .order("created_at", { ascending: true });
    const ownerIds = (links ?? []).map((l) => l.owner_id);
    const [{ data: profiles }, { data: ownerRoles }, stats] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", ownerIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ownerIds),
      statsFor(ownerIds, data?.fromDate),
    ]);
    const pById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rById = new Map((ownerRoles ?? []).map((r) => [r.user_id, r.role as string]));

    const rows: AffiliateRow[] = (links ?? []).map((l) => {
      const p = pById.get(l.owner_id);
      return {
        ownerId: l.owner_id,
        linkId: l.id,
        code: l.code as string,
        isActive: l.is_active as boolean,
        name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || (p?.email ?? "—"),
        email: p?.email ?? "—",
        role: rById.get(l.owner_id) ?? null,
        stats: stats.get(l.owner_id) ?? { clicks: 0, signups: 0, buyerLeads: 0, vehicleOffers: 0, won: 0 },
      };
    });
    rows.sort((a, b) => (b.stats.buyerLeads + b.stats.vehicleOffers) - (a.stats.buyerLeads + a.stats.vehicleOffers));
    return { rows };
  });

async function assertAdmin(sb: any, userId: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: { role: string }) => ADMIN_ROLES.includes(r.role));
  if (!ok) throw new Error("Non autorisé");
}

/** Eligible people who do not have a link yet. */
export const adminListAffiliateCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ candidates: AffiliateCandidate[] }> => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const [{ data: roles }, { data: profiles }, { data: links }] = await Promise.all([
      admin.from("user_roles").select("user_id, role"),
      admin.from("profiles").select("id, first_name, last_name, email, partner_kind, is_active"),
      admin.from("affiliate_links").select("owner_id"),
    ]);
    const withLink = new Set((links ?? []).map((l: any) => l.owner_id as string));
    const roleById = new Map<string, string>((roles ?? []).map((r: any) => [r.user_id, r.role]));

    const candidates: AffiliateCandidate[] = (profiles ?? [])
      .filter((p: any) => {
        if (withLink.has(p.id) || p.is_active === false) return false;
        const role = roleById.get(p.id);
        return role === "sales_agent" || (role === "partenaire" && p.partner_kind === "seller");
      })
      .map((p: any) => ({
        userId: p.id as string,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.email ?? "—"),
        email: (p.email ?? "—") as string,
        role: roleById.get(p.id) ?? null,
      }))
      .sort((a: AffiliateCandidate, b: AffiliateCandidate) => a.name.localeCompare(b.name));

    return { candidates };
  });

export const adminCreateAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    if (!(await eligibleIds(admin, [data.userId])).has(data.userId)) {
      throw new Error("Cette personne n'est pas éligible à l'affiliation.");
    }
    const { data: existing } = await admin
      .from("affiliate_links").select("id, code, is_active").eq("owner_id", data.userId).maybeSingle();
    if (existing) {
      return { id: existing.id as string, code: existing.code as string, isActive: existing.is_active as boolean };
    }
    return await createLinkFor(admin, data.userId);
  });

export const adminDeleteAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ linkId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    // Clicks are removed with the link; credits already stored on leads/offers stay.
    await admin.from("affiliate_clicks").delete().eq("link_id", data.linkId);
    const { error } = await admin.from("affiliate_links").delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetAffiliateActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ linkId: z.string().uuid(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { error } = await (context.supabase as any)
      .from("affiliate_links").update({ is_active: data.isActive }).eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRegenerateAffiliateCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ linkId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("affiliate_links").select("owner_id").eq("id", data.linkId).maybeSingle();
    if (!link) throw new Error("Lien introuvable");
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("first_name, email").eq("id", link.owner_id).maybeSingle();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: updated, error } = await supabaseAdmin
      .from("affiliate_links")
      .update({ code: codeFor(profile, suffix) })
      .eq("id", data.linkId)
      .select("code")
      .single();
    if (error) throw new Error(error.message);
    return { code: updated.code as string };
  });
