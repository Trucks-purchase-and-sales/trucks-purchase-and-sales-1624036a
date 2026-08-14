import { createFileRoute } from "@tanstack/react-router";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
        if (!rl.allowed) {
          return Response.json({ ok: false }, { status: 429, headers: corsHeaders });
        }

        let body: { code?: unknown; path?: unknown; referer?: unknown; locale?: unknown };
        try { body = (await request.json()) as typeof body; }
        catch { return Response.json({ ok: false }, { status: 400, headers: corsHeaders }); }

        const { resolveReferrer, recordClick } = await import("@/lib/affiliate.server");
        const ref = await resolveReferrer(body.code);
        if (!ref) return Response.json({ ok: false }, { status: 200, headers: corsHeaders });

        await recordClick({
          linkId: ref.linkId,
          path: typeof body.path === "string" ? body.path : null,
          referer: typeof body.referer === "string" ? body.referer : null,
          locale: typeof body.locale === "string" ? body.locale : null,
          fingerprintHash: keyHash,
        });
        return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
      },
    },
  },
});
