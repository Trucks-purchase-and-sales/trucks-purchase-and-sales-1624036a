// Server-only affiliate helpers. Resolving a code and recording a click both
// need to read/write tables that are closed to anonymous visitors, so they run
// with the service role behind the public endpoints.

export type ResolvedReferrer = {
  ownerId: string;
  linkId: string;
  code: string;
  /** Internal or external sales staff can own a lead; sellers only get credit. */
  canOwnLeads: boolean;
};

const SALES_ROLES = ["admin", "platform_admin", "sales_manager", "sales_agent", "external_agent"];

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase().slice(0, 40);
  return /^[A-Z0-9-]{3,40}$/.test(code) ? code : null;
}

/** Looks up an active affiliate code and tells whether its owner may own leads. */
export async function resolveReferrer(rawCode: unknown): Promise<ResolvedReferrer | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: link } = await supabaseAdmin
    .from("affiliate_links")
    .select("id, owner_id, code, is_active")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!link) return null;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", link.owner_id);
  const canOwnLeads = (roles ?? []).some((r) => SALES_ROLES.includes(r.role as string));

  return { ownerId: link.owner_id, linkId: link.id, code: link.code, canOwnLeads };
}

export async function recordClick(input: {
  linkId: string;
  path?: string | null;
  referer?: string | null;
  locale?: string | null;
  fingerprintHash?: string | null;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("affiliate_clicks").insert({
    link_id: input.linkId,
    landing_path: input.path?.slice(0, 300) ?? null,
    referer: input.referer?.slice(0, 300) ?? null,
    locale: input.locale?.slice(0, 5) ?? null,
    fingerprint_hash: input.fingerprintHash ?? null,
  });
  if (error) console.error("[affiliate] click insert failed", error);
}

/** True when the referrer is sales staff (internal or external) and may own a record directly. */
export async function referrerCanOwnLeads(ownerId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ownerId);
  return (roles ?? []).some((r) => SALES_ROLES.includes(r.role as string));
}
