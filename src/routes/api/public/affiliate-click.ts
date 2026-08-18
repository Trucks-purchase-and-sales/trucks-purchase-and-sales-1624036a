import { createFileRoute } from "@tanstack/react-router";
import { readBoundedJson } from "@/lib/public-api.server";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_AFFILIATE_CLICK_BODY_BYTES = 8 * 1024;

type AffiliateClickBody = {
  code?: unknown;
  path?: unknown;
  referer?: unknown;
  locale?: unknown;
};

/** Records a click on a personal affiliate link. Returns nothing sensitive. */
export const Route = createFileRoute("/api/public/affiliate-click")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const { checkRateLimit, clientIpFromRequest, hashKey } = await import(
          "@/lib/rate-limit.server"
        );
        const ip = clientIpFromRequest(request);
        const keyHash = hashKey("affiliate-click", ip);
        const rl = await checkRateLimit({
          bucket: "affiliate-click",
          keyHash,
          windowSeconds: 600,
          maxEvents: 30,
        });
        if (!rl.limiterAvailable) {
          return Response.json(
            { ok: false },
            {
              status: 503,
              headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSeconds) },
            },
          );
        }
        if (!rl.allowed) {
          return Response.json(
            { ok: false },
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSeconds) },
            },
          );
        }

        const body = await readBoundedJson<AffiliateClickBody>(request, MAX_AFFILIATE_CLICK_BODY_BYTES);
        if (!body.ok) {
          return Response.json({ ok: false }, { status: body.status, headers: corsHeaders });
        }

        const { resolveReferrer, recordClick } = await import("@/lib/affiliate.server");
        const ref = await resolveReferrer(body.data.code);
        if (!ref) return Response.json({ ok: false }, { status: 200, headers: corsHeaders });

        await recordClick({
          linkId: ref.linkId,
          path: typeof body.data.path === "string" ? body.data.path : null,
          referer: typeof body.data.referer === "string" ? body.data.referer : null,
          locale: typeof body.data.locale === "string" ? body.data.locale : null,
          fingerprintHash: keyHash,
        });
        return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
      },
    },
  },
});
