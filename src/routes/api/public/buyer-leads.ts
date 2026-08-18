import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseBuyerLead } from "@/lib/buyer-leads.schema";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function makeClient(accessToken?: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
    },
  );
}

export const Route = createFileRoute("/api/public/buyer-leads")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        // Rate limit: 5/IP/10min AND 20/IP/hour. Short window rejects first.
        const { checkRateLimit, clientIpFromRequest, hashKey } = await import(
          "@/lib/rate-limit.server"
        );
        const ip = clientIpFromRequest(request);
        const keyHash = hashKey("buyer-leads", ip);
        const short = await checkRateLimit({
          bucket: "buyer-leads:short",
          keyHash,
          windowSeconds: 600,
          maxEvents: 5,
        });
        if (!short.allowed) {
          return Response.json(
            { error: "Trop de demandes. Merci de réessayer dans quelques minutes." },
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(short.retryAfterSeconds) },
            },
          );
        }
        const long = await checkRateLimit({
          bucket: "buyer-leads:long",
          keyHash,
          windowSeconds: 3600,
          maxEvents: 20,
        });
        if (!long.allowed) {
          return Response.json(
            { error: "Limite horaire atteinte. Merci de réessayer plus tard." },
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(long.retryAfterSeconds) },
            },
          );
        }

        let payload: unknown;
        try { payload = await request.json(); }
        catch { return Response.json({ error: "Corps JSON invalide" }, { status: 400, headers: corsHeaders }); }

        const parsed = parseBuyerLead(payload);
        if (!parsed.ok) {
          // Detailed issues stay server-side; the client only gets a readable sentence.
          console.error("[api/public/buyer-leads] validation failed", parsed.issues);
          return Response.json(
            { error: parsed.message, fields: parsed.fields },
            { status: 400, headers: corsHeaders },
          );
        }
        const d = parsed.data;

        // Honeypot: if a bot filled the hidden `website` field, silently accept and drop.
        if (d.website && d.website.length > 0) {
          return Response.json({ id: "ok", reference: null }, { status: 201, headers: corsHeaders });
        }

        // Authenticated buyers submit as themselves so the lead shows up in "Mes demandes".
        // The owner id always comes from the verified token, never from the request body.
        const authHeader = request.headers.get("authorization") ?? "";
        const accessToken = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        let ownerUserId: string | null = null;

        if (accessToken && accessToken.split(".").length === 3) {
          const authed = makeClient(accessToken);
          const { data: userRes, error: userErr } = await authed.auth.getUser(accessToken);
          if (userErr || !userRes?.user) {
            return Response.json(
              { error: "Session expirée. Merci de vous reconnecter puis de réessayer." },
              { status: 401, headers: corsHeaders },
            );
          }
          const { data: profile } = await authed
            .from("profiles")
            .select("partner_kind")
            .eq("id", userRes.user.id)
            .maybeSingle();
          if (profile?.partner_kind !== "client") {
            return Response.json(
              {
                error:
                  "Votre compte n'est pas un compte acheteur. Déconnectez-vous pour envoyer une demande, ou contactez Wilmet.",
              },
              { status: 403, headers: corsHeaders },
            );
          }
          ownerUserId = userRes.user.id;
        }

        // Anonymous visitors keep the publishable-key (anon) path with user_id NULL.
        const sb = ownerUserId ? makeClient(accessToken) : makeClient();

        const cleanText = (v?: string | null) => (v && v.length ? v : null);

        // Affiliate attribution. A sales referrer (internal or external) becomes the
        // lead owner directly and the shared sales queue is skipped; a partner
        // referrer only gets the credit, the sales group keeps the lead.
        const { resolveReferrer } = await import("@/lib/affiliate.server");
        const ref = await resolveReferrer(d.referral_code);

        // Automatic group routing: buyer demands belong to the sales group.
        // Configurable in Settings (app_settings.lead_assignment.enabled).
        let assignedGroup: "sales" | null = null;
        try {
          const { data: setting } = await sb
            .from("app_settings")
            .select("value")
            .eq("key", "lead_assignment")
            .maybeSingle();
          const cfg = (setting?.value ?? {}) as { enabled?: boolean };
          if (cfg.enabled !== false && !ref?.canOwnLeads) assignedGroup = "sales";
        } catch (e) {
          console.error("[api/public/buyer-leads] lead_assignment settings read failed", e);
        }

        // The row id is generated here: anonymous visitors have no SELECT policy on
        // buyer_leads, so an INSERT ... RETURNING would be rejected by RLS.
        const id = crypto.randomUUID();

        const { error } = await sb.from("buyer_leads").insert({
          id,
          user_id: ownerUserId,
          vehicle_category: cleanText(d.vehicle_category),
          assigned_group: assignedGroup,
          vehicle_type: cleanText(d.vehicle_type),
          body_type: cleanText(d.body_type),
          preferred_brand: cleanText(d.preferred_brand),
          preferred_model: cleanText(d.preferred_model),
          intended_use: cleanText(d.intended_use),
          usage_country: cleanText(d.usage_country),
          min_year: d.min_year ?? null,
          max_mileage: d.max_mileage ?? null,
          min_euro_norm: cleanText(d.min_euro_norm),
          fuel_type: cleanText(d.fuel_type),
          gearbox: cleanText(d.gearbox),
          ptac_kg: d.ptac_kg ?? null,
          payload_kg: d.payload_kg ?? null,
          required_equipment: d.required_equipment ?? [],
          wanted_equipment: d.wanted_equipment ?? [],
          max_budget_ht: d.max_budget_ht ?? null,
          currency: d.currency ?? "EUR",
          budget_flexible: cleanText(d.budget_flexible ?? null),
          buy_timeline: cleanText(d.buy_timeline ?? null),
          financing_needed: cleanText(d.financing_needed ?? null),
          first_name: d.first_name,
          last_name: d.last_name,
          company_name: cleanText(d.company_name),
          email: d.email,
          phone: cleanText(d.phone),
          country: cleanText(d.country),
          city: cleanText(d.city),
          message: cleanText(d.message),
          gdpr_consent: d.gdpr_consent,
          locale: d.locale ?? "fr",
          source: ref ? `affiliate:${ref.code}` : "public_form",
          referred_by: ref?.ownerId ?? null,
          referral_code: ref?.code ?? null,
          assigned_sales_agent_id: ref?.canOwnLeads ? ref.ownerId : null,

        });

        if (error) {
          console.error("[api/public/buyer-leads] insert failed", error);
          return Response.json(
            { error: "Une erreur est survenue, veuillez réessayer." },
            { status: 500, headers: corsHeaders },
          );
        }

        // Reference number is produced by a database trigger; read it back through a
        // narrow security-definer helper that only returns that one column.
        let reference: string | null = null;
        try {
          const { data: refNum } = await sb.rpc("buyer_lead_reference" as never, { p_id: id } as never);
          reference = (refNum as unknown as string | null) ?? null;
        } catch (e) {
          console.error("[api/public/buyer-leads] reference lookup failed", e);
        }

        return Response.json({ id, reference }, { status: 201, headers: corsHeaders });
      },
    },
  },
});
