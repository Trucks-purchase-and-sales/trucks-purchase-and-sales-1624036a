// Server-side guard for admin-controlled AI assistance features.
import { createClient } from "@supabase/supabase-js";
import { setResponseStatus } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";

export type AiFeature = "ocr" | "voice" | "dossier_audit";
export type AiFeatureFlags = Record<"enabled" | AiFeature, boolean>;

// Optional external processing must be explicitly enabled in controlled settings.
// A missing row, malformed value or settings read failure therefore fails closed.
export const AI_FEATURE_DEFAULTS: AiFeatureFlags = {
  enabled: false,
  ocr: false,
  voice: false,
  dossier_audit: false,
};

export function resolveAiFeatureFlags(value: unknown): AiFeatureFlags {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...AI_FEATURE_DEFAULTS };
  }

  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : AI_FEATURE_DEFAULTS.enabled,
    ocr: typeof raw.ocr === "boolean" ? raw.ocr : AI_FEATURE_DEFAULTS.ocr,
    voice: typeof raw.voice === "boolean" ? raw.voice : AI_FEATURE_DEFAULTS.voice,
    dossier_audit:
      typeof raw.dossier_audit === "boolean" ? raw.dossier_audit : AI_FEATURE_DEFAULTS.dossier_audit,
  };
}

/** Throws when the admin did not explicitly enable the feature. */
export async function assertAiFeatureEnabled(feature: AiFeature): Promise<void> {
  let flags = { ...AI_FEATURE_DEFAULTS };
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) {
      console.error("[ai-features] Supabase configuration missing");
    } else {
      const sb = createClient<Database>(url, key, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "ai_features")
        .maybeSingle();
      if (error) {
        console.error("[ai-features] read failed", error);
      } else {
        flags = resolveAiFeatureFlags(data?.value);
      }
    }
  } catch (e) {
    console.error("[ai-features] read failed", e);
  }

  if (!flags.enabled || !flags[feature]) {
    setResponseStatus(503);
    throw new Error("Cette fonction IA est momentanément indisponible.");
  }
}
