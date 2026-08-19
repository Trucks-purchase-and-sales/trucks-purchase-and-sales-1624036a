import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOVABLE_AI_BASE_URL } from "@/lib/ai-gateway.server";
import { persistAnonymousBuyerLead } from "@/lib/anonymous-buyer-lead.server";
import { finalizeAssistantLead } from "@/lib/assistant-lead-finalization.server";
import { parseAssistantRequest } from "@/lib/assistant-request.schema";
import { publicApiCors, rejectForeignBrowserOrigin } from "@/lib/public-cors.server";
import { readBoundedJson } from "@/lib/public-api.server";

const corsOptions = {
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
} as const;

const MAX_ASSISTANT_BODY_BYTES = 64 * 1024;

const SYSTEM = `Tu es l'assistant virtuel de Wilmet Trucks, négociant européen de véhicules industriels d'occasion.
Tu réponds en français (ou dans la langue de l'utilisateur), de façon courte, professionnelle et concrète.
Ton objectif : qualifier un besoin d'achat de véhicule et recueillir les informations suivantes, une ou deux questions à la fois :
- type ou catégorie de véhicule recherché (tracteur, porteur, semi-remorque, utilitaire, engin...)
- marque / modèle souhaités si connus
- budget maximum HT en euros
- délai d'achat
- pays d'utilisation
- prénom, nom, e-mail (obligatoires), téléphone et société si possible

Quand tu as au minimum le type de véhicule, le prénom, le nom et l'e-mail, indique seulement que tu as les informations nécessaires, puis ajoute sur la toute dernière ligne un bloc JSON unique :
<<<LEAD{"vehicle_type":"...","preferred_brand":"...","preferred_model":"...","max_budget_ht":123456,"buy_timeline":"...","usage_country":"...","first_name":"...","last_name":"...","email":"...","phone":"...","company_name":"...","message":"résumé du besoin"}LEAD>>>
N'affirme jamais que la demande est enregistrée, envoyée, transmise ou confirmée : seul le serveur peut confirmer l'enregistrement réel.
Omets les clés inconnues. N'affiche jamais ce bloc autrement qu'en dernière ligne. Ne promets aucun prix ni disponibilité.
Tu n'es pas un conseiller juridique ou financier. Si la question sort du cadre, invite à laisser ses coordonnées.`;

function withinHours(cfg: { always_on?: boolean; start_hour?: number; end_hour?: number }): boolean {
  if (cfg.always_on) return true;
  const start = cfg.start_hour ?? 18;
  const end = cfg.end_hour ?? 8;
  const h = new Date().getUTCHours();
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

export const Route = createFileRoute("/api/public/assistant")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => {
        const cors = publicApiCors(request, corsOptions);
        return new Response(null, { status: cors.allowed ? 204 : 403, headers: cors.headers });
      },
      POST: async ({ request }) => {
        const cors = publicApiCors(request, corsOptions);
        const rejected = rejectForeignBrowserOrigin(cors);
        if (rejected) return rejected;
        const corsHeaders = cors.headers;

        // Rate limit: 20 messages / IP / 10 min.
        const { checkRateLimit, clientIpFromRequest, hashKey } = await import("@/lib/rate-limit.server");
        const ip = clientIpFromRequest(request);
        const rl = await checkRateLimit({
          bucket: "assistant",
          keyHash: hashKey("assistant", ip),
          windowSeconds: 600,
          maxEvents: 20,
        });
        if (!rl.limiterAvailable) {
          return Response.json(
            { error: "Assistant momentanément indisponible." },
            { status: 503, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSeconds) } },
          );
        }
        if (!rl.allowed) {
          return Response.json(
            { error: "Trop de messages. Merci de réessayer dans quelques minutes." },
            { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSeconds) } },
          );
        }

        const parsedBody = await readBoundedJson<unknown>(request, MAX_ASSISTANT_BODY_BYTES);
        if (!parsedBody.ok) {
          return Response.json(
            { error: parsedBody.error },
            { status: parsedBody.status, headers: corsHeaders },
          );
        }

        const assistantRequest = parseAssistantRequest(parsedBody.data);
        if (!assistantRequest.ok) {
          return Response.json(
            { error: assistantRequest.error, consentRequired: assistantRequest.consentRequired },
            { status: assistantRequest.status, headers: corsHeaders },
          );
        }
        const history = assistantRequest.messages;

        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { readAssistantSettingsServer } = await import("@/lib/app-settings.server");
        const cfg = await readAssistantSettingsServer();
        if (!cfg.enabled || !withinHours(cfg)) {
          return Response.json({ available: false }, { status: 200, headers: corsHeaders });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          console.error("[api/public/assistant] LOVABLE_API_KEY missing");
          return Response.json({ error: "Assistant indisponible." }, { status: 503, headers: corsHeaders });
        }

        let modelReply = "";
        try {
          const res = await fetch(`${LOVABLE_AI_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "system", content: SYSTEM }, ...history],
              temperature: 0.3,
            }),
          });
          if (!res.ok) {
            console.error("[api/public/assistant] gateway error", res.status, await res.text());
            return Response.json({ error: "Assistant momentanément indisponible." }, { status: 503, headers: corsHeaders });
          }
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          modelReply = json.choices?.[0]?.message?.content ?? "";
        } catch (e) {
          console.error("[api/public/assistant] gateway call failed", e);
          return Response.json({ error: "Assistant momentanément indisponible." }, { status: 503, headers: corsHeaders });
        }

        const finalized = await finalizeAssistantLead(modelReply, (row) =>
          persistAnonymousBuyerLead(row, {
            insert: (leadRow) => sb.from("buyer_leads").insert(leadRow as never),
            lookupReference: async (id) => {
              const { data, error } = await sb.rpc(
                "buyer_lead_reference" as never,
                { p_id: id } as never,
              );
              return { data, error };
            },
          }),
        );

        if (finalized.persistenceError) console.error("[api/public/assistant] lead insert failed", finalized.persistenceError);
        if (finalized.referenceError) console.error("[api/public/assistant] reference lookup failed", finalized.referenceError);

        return Response.json(
          { available: true, reply: finalized.reply, reference: finalized.reference },
          { status: finalized.status, headers: corsHeaders },
        );
      },
    },
  },
});
