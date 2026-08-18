// Server-only rate limiting helper. Backed by public.rate_limit_events + private.rate_limit_check.
// Uses the service role client because the helper table is service-role-only.
import { createHash } from "node:crypto";

export type RateLimitResult = {
  allowed: boolean;
  currentCount: number;
  retryAfterSeconds: number;
};

export function clientIpFromRequest(request: Request): string {
  const h = request.headers;
  const candidate =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  return candidate || "unknown";
}

export function hashKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function checkRateLimit(opts: {
  bucket: string;
  keyHash: string;
  windowSeconds: number;
  maxEvents: number;
}): Promise<RateLimitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Exposed via a service-role-only wrapper in the public schema: PostgREST does
  // not expose the private schema, so calling it there always failed (fail-open).
  const { data, error } = await supabaseAdmin.rpc(
    "rate_limit_check" as never,
    {
      _bucket: opts.bucket,
      _key_hash: opts.keyHash,
      _window_seconds: opts.windowSeconds,
      _max_events: opts.maxEvents,
    } as never,
  );
  if (error) {
    // Fail open — never block legit traffic on infra failure. Log server-side.
    console.error("[rate-limit] rpc failed", error);
    return { allowed: true, currentCount: 0, retryAfterSeconds: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as { allowed: boolean; current_count: number; retry_after_seconds: number } | null;
  if (!r) return { allowed: true, currentCount: 0, retryAfterSeconds: 0 };
  return {
    allowed: r.allowed,
    currentCount: r.current_count,
    retryAfterSeconds: r.retry_after_seconds,
  };
}
