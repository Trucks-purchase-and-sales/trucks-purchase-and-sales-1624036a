import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBuyerLead } from "./buyer-leads.schema";
import { buildBuyerLeadRow } from "./buyer-leads.shared";

/**
 * Authenticated buyer submission. Used ONLY when the browser has a confirmed
 * session: the row is inserted through the user's own RLS context and owned by
 * `context.userId`. Anonymous visitors keep /api/public/buyer-leads.
 */
export const submitBuyerLeadAuthenticated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const parsed = parseBuyerLead(data);
    if (!parsed.ok) {
      console.error("[submitBuyerLeadAuthenticated] validation failed", parsed.issues);
      throw new Error(parsed.message);
    }
    const d = parsed.data;

    if (d.website && d.website.length > 0) {
      return { id: "ok", reference: null as string | null, tracked: true };
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("partner_kind")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error("[submitBuyerLeadAuthenticated] profile read failed", profileErr);
      throw new Error("Impossible de vérifier votre compte. Merci de réessayer.");
    }
    if (profile?.partner_kind !== "client") {
      throw new Error(
        "Votre compte n'est pas un compte acheteur. Déconnectez-vous pour envoyer une demande, ou contactez Wilmet.",
      );
    }

    const { resolveReferrer } = await import("./affiliate.server");
    const ref = await resolveReferrer(d.referral_code);
    const { readLeadAssignmentSettingsServer } = await import("./app-settings.server");
    const routing = await readLeadAssignmentSettingsServer();
    const assignedGroup: "sales" | null = routing.enabled && !ref?.canOwnLeads ? "sales" : null;

    const id = crypto.randomUUID();
    const row = buildBuyerLeadRow({ id, data: d, ownerUserId: userId, referrer: ref, assignedGroup });

    const { error } = await supabase.from("buyer_leads").insert(row as never);
    if (error) {
      console.error("[submitBuyerLeadAuthenticated] insert failed", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }

    const { data: created } = await supabase
      .from("buyer_leads")
      .select("reference_number")
      .eq("id", id)
      .maybeSingle();

    return { id, reference: created?.reference_number ?? null, tracked: true };
  });
