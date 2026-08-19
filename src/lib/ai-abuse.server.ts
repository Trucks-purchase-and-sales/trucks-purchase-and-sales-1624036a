import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";
import {
  checkRateLimit,
  clientIpFromRequest,
  hashKey,
  type RateLimitResult,
} from "@/lib/rate-limit.server";

export type MeteredAiFeature = "voice" | "ocr";

type LimitPolicy = {
  bucket: string;
  windowSeconds: number;
  maxEvents: number;
  scope: "user" | "ip";
};

const POLICIES: Record<MeteredAiFeature, readonly LimitPolicy[]> = {
  voice: [
    { bucket: "ai_voice_user_10m", scope: "user", windowSeconds: 10 * 60, maxEvents: 15 },
    { bucket: "ai_voice_user_24h", scope: "user", windowSeconds: 24 * 60 * 60, maxEvents: 200 },
    { bucket: "ai_voice_ip_10m", scope: "ip", windowSeconds: 10 * 60, maxEvents: 60 },
  ],
  ocr: [
    { bucket: "ai_ocr_user_10m", scope: "user", windowSeconds: 10 * 60, maxEvents: 6 },
    { bucket: "ai_ocr_user_24h", scope: "user", windowSeconds: 24 * 60 * 60, maxEvents: 50 },
    { bucket: "ai_ocr_ip_10m", scope: "ip", windowSeconds: 10 * 60, maxEvents: 24 },
  ],
};

export type AiLimitFailure = {
  status: 429 | 503;
  retryAfterSeconds: number;
  message: string;
};

export function classifyAiLimitResult(result: RateLimitResult): AiLimitFailure | null {
  if (!result.limiterAvailable) {
    return {
      status: 503,
      retryAfterSeconds: Math.max(1, result.retryAfterSeconds || 60),
      message: "Fonction IA momentanément indisponible.",
    };
  }
  if (!result.allowed) {
    return {
      status: 429,
      retryAfterSeconds: Math.max(1, result.retryAfterSeconds || 60),
      message: "Trop de requêtes IA. Veuillez réessayer plus tard.",
    };
  }
  return null;
}

export function throwAiHttpError(
  status: 400 | 413 | 415 | 429 | 503,
  message: string,
  retryAfterSeconds?: number,
): never {
  setResponseStatus(status);
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    setResponseHeader("Retry-After", String(Math.ceil(retryAfterSeconds)));
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  throw error;
}

function logQuotaPressure(feature: MeteredAiFeature, policy: LimitPolicy, result: RateLimitResult) {
  if (result.currentCount < Math.ceil(policy.maxEvents * 0.8)) return;
  console.warn("[ai-abuse] quota pressure", {
    feature,
    bucket: policy.bucket,
    scope: policy.scope,
    currentCount: result.currentCount,
    maxEvents: policy.maxEvents,
    windowSeconds: policy.windowSeconds,
  });
}

/**
 * Enforces both per-account quotas and a wider per-IP abuse boundary.
 * The existing database-backed limiter is fail-closed: if it cannot make a
 * trustworthy decision, AI processing returns 503 rather than becoming free/unlimited.
 */
export async function enforceAiAbuseLimits(feature: MeteredAiFeature, userId: string): Promise<void> {
  const request = getRequest();
  const ip = request ? clientIpFromRequest(request) : "unknown";

  for (const policy of POLICIES[feature]) {
    if (policy.scope === "ip" && ip === "unknown") {
      console.warn("[ai-abuse] client IP unavailable; relying on authenticated-user quotas", { feature });
      continue;
    }

    const identity = policy.scope === "user" ? userId : ip;
    const result = await checkRateLimit({
      bucket: policy.bucket,
      keyHash: hashKey(policy.bucket, identity),
      windowSeconds: policy.windowSeconds,
      maxEvents: policy.maxEvents,
    });

    const failure = classifyAiLimitResult(result);
    if (failure) {
      throwAiHttpError(failure.status, failure.message, failure.retryAfterSeconds);
    }
    logQuotaPressure(feature, policy, result);
  }
}
