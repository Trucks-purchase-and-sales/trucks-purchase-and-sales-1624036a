import { createFileRoute } from "@tanstack/react-router";
import { publicApiCors, rejectForeignBrowserOrigin } from "@/lib/public-cors.server";

const corsOptions = {
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
} as const;

// Advisory pre-check called by the signup form before supabase.auth.signUp.
// A determined attacker can bypass this by hitting Supabase Auth directly,
// but it stops casual scripted abuse from a single IP.
export const Route = createFileRoute("/api/public/signup-check")({
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

        const { checkRateLimit, clientIpFromRequest, hashKey } = await import(
          "@/lib/rate-limit.server"
        );
        const ip = clientIpFromRequest(request);
        const keyHash = hashKey("signup", ip);
        const r = await checkRateLimit({
          bucket: "signup",
          keyHash,
          windowSeconds: 600,
          maxEvents: 3,
        });
        if (!r.limiterAvailable) {
          return Response.json(
            {
              allowed: false,
              retryAfterSeconds: r.retryAfterSeconds,
              error: "Service d'inscription momentanément indisponible. Merci de réessayer.",
            },
            {
              status: 503,
              headers: { ...corsHeaders, "Retry-After": String(r.retryAfterSeconds) },
            },
          );
        }
        if (!r.allowed) {
          return Response.json(
            {
              allowed: false,
              retryAfterSeconds: r.retryAfterSeconds,
              error: "Trop de tentatives d'inscription. Merci de réessayer dans quelques minutes.",
            },
            {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": String(r.retryAfterSeconds) },
            },
          );
        }
        return Response.json({ allowed: true }, { status: 200, headers: corsHeaders });
      },
    },
  },
});
