import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOVABLE_AI_BASE_URL } from "@/lib/ai-gateway.server";
import { readBoundedJson } from "@/lib/public-api.server";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_ASSISTANT_BODY_BYTES = 64 * 1024;

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `Tu es l'assistant virtuel de Wilmet Trucks, négociant européen de véhicules industriels d'occasion.
Tu réponds en français (ou dans la langue de l'utilisateur), de façon courte, professionnelle et concrète.
Ton objectif : qualifier un besoin d'achat de véhicule et recueillir les informations suivantes, une ou deux questions à la fois :
- type ou catégorie de véhicule recherché (tracteur, porteur, semi-remorque, utilitaire, engin...)
- marque / modèle souhaités si connus
- budget maximum HT en euros
- délai d'achat
- pays d'utilisation
- prénom, nom, e-mail (obligatoires), téléphone et société si possible

Quand tu as au minimum le type de véhicule, le prénom, le nom et l'e-mail, termine par un court message de confirmation
suivi, sur la toute dernière ligne, d'un bloc JSON unique :
<<<LEAD{"vehicle_type":"...","preferred_brand":"...","preferred_model":"...","max_budget_ht":123456,"buy_timeline":"...","usage_country":"...","first_name":"...","last_name":"...","email":"...","phone":"...","company_name":"...","message":"résumé du besoin"}LEAD>>>
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
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
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

        const parsedBody = await readBoundedJson<{ messages?: Msg[] }>(request, MAX_ASSISTANT_BODY_BYTES);
        if (!parsedBody.ok) {
          return Response.json(
            { error: parsedBody.error },
            { status: parsedBody.status, headers: corsHeaders },
          );
        }
        const body = parsedBody.data;

        const history = (body.messages ?? [])
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
        if (history.length === 0) {
          return Response.json({ error: "Message manquant" }, { status: 400, headers: corsHeaders });
        }

        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { data: setting } = await sb.from("app_settings").select("value").eq("key", "assistant").maybeSingle();
        const cfg = (setting?.value ?? {}) as { enabled?: boolean; always_on?: boolean; start_hour?: number; end_hour?: number };
        if (!cfg.enabled || !withinHours(cfg)) {
          return Response.json({ available: false }, { status: 200, headers: corsHeaders });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          console.error("[api/public/assistant] LOVABLE_API_KEY missing");
          return Response.json({ error: "Assistant indisponible." }, { status: 503, headers: corsHeaders });
        }

        let reply = "";
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
          reply = json.choices?.[0]?.message?.content ?? "";
        } catch (e) {
          console.error("[api/public/assistant] gateway call failed", e);
          return Response.json({ error: "Assistant momentanément indisponible." }, { status: 503, headers: corsHeaders });
        }

        // Extract the structured lead block, if the assistant produced one.
        let reference: string | null = null;
        const match = reply.match(/<<<LEAD([\s\S]*?)LEAD>>>/);
        if (match) {
          reply = reply.replace(match[0], "").trim();
          try {
            const raw = JSON.parse(match[1]!) as Record<string, unknown>;
            const str = (k: string, max = 200) => {
              const v = raw[k];
              return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
            };
            const email = str("email");
            const first = str("first_name", 80);
            const last = str("last_name", 80);
            const vType = str("vehicle_type", 80);
            if (email && /.+@.+\..+/.test(email) && first && last) {
              const rawBudget = raw.max_budget_ht;
              const budget =
                typeof rawBudget === "number" &&
                Number.isFinite(rawBudget) &&
                rawBudget >= 0 &&
                rawBudget <= 10_000_000
                  ? rawBudget
                  : null;
              const { data, error } = await sb.from("buyer_leads").insert({
                vehicle_type: vType,
                preferred_brand: str("preferred_brand", 80),
                preferred_model: str("preferred_model", 80),
                usage_country: str("usage_country", 80),
                buy_timeline: str("buy_timeline", 40),
                max_budget_ht: budget,
                currency: "EUR",
                first_name: first,
                last_name: last,
                company_name: str("company_name", 120),
                email,
                phone: str("phone", 40),
                message: str("message", 2000),
                gdpr_consent: true,
                locale: "fr",
                source: "ai_assistant",
                assigned_group: "sales",
              }).select("reference_number").single();
              if (error) console.error("[api/public/assistant] lead insert failed", error);
              else reference = data.reference_number ?? null;
            }
          } catch (e) {
            console.error("[api/public/assistant] lead block parse failed", e);
          }
        }

        return Response.json({ available: true, reply, reference }, { status: 200, headers: corsHeaders });
      },
    },
  },
});
