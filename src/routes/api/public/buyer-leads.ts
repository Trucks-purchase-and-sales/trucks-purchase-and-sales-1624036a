import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseBuyerLead } from "@/lib/buyer-leads.schema";
import { buildBuyerLeadRow } from "@/lib/buyer-leads.shared";
import { readBoundedJson } from "@/lib/public-api.server";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const MAX_BUYER_LEAD_BODY_BYTES = 32 * 1024;

function makeClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
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
        if (!short.limiterAvailable) {
          return Response.json(
            { error: "Service momentanément indisponible. Merci de réessayer." },
            {
              status: 503,
              headers: { ...corsHeaders, "Retry-After": String(short.retryAfterSeconds) },
            },
          );
        }
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
        if (!long.limiterAvailable) {
          return Response.json(
            { error: "Service momentanément indisponible. Merci de réessayer." },
            {
              status: 503,
              headers: { ...corsHeaders, "Retry-After": String(long.retryAfterSeconds) },
            },
          );
        }
        if (!long.allowed) {
          return Response.json(
            { error: "Limite horaire atteinte. Merci de réessayer plus tard." },
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(long.retryAfterSeconds) },
            },
          );
        }

        const body = await readBoundedJson<unknown>(request, MAX_BUYER_LEAD_BODY_BYTES);
        if (!body.ok) {
          return Response.json(
            { error: body.error },
            { status: body.status, headers: corsHeaders },
          );
        }

        const parsed = parseBuyerLead(body.data);
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

        // This endpoint is the ANONYMOUS path only. Signed-in buyers submit
        // through `submitBuyerLeadAuthenticated`; a bearer token here is
        // rejected rather than silently downgraded to an anonymous lead.
        const authHeader = request.headers.get("authorization") ?? "";
        if (authHeader.toLowerCase().startsWith("bearer ")) {
          return Response.json(
            {
              error:
                "Session détectée : cette demande doit être envoyée depuis votre espace connecté. Rechargez la page puis réessayez.",
            },
            { status: 409, headers: corsHeaders },
          );
        }

        const sb = makeClient();

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

        const { error } = await sb
          .from("buyer_leads")
          .insert(
            buildBuyerLeadRow({ id, data: d, ownerUserId: null, referrer: ref, assignedGroup }) as never,
          );

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
