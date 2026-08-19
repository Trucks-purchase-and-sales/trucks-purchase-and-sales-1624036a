// Server-side guard for admin-controlled AI assistance features.
import { setResponseStatus } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AI_FEATURE_DEFAULTS,
  resolveAiFeatureFlags,
} from "./app-settings.shared";

export type AiFeature = "ocr" | "voice" | "dossier_audit";
export type AiFeatureFlags = typeof AI_FEATURE_DEFAULTS;
export { AI_FEATURE_DEFAULTS, resolveAiFeatureFlags } from "./app-settings.shared";

/** Throws when the admin did not explicitly enable the feature. */
export async function assertAiFeatureEnabled(feature: AiFeature): Promise<void> {
  let flags = { ...AI_FEATURE_DEFAULTS };
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "ai_features")
      .maybeSingle();
    if (error) {
      console.error("[ai-features] read failed", error);
    } else {
      flags = resolveAiFeatureFlags(data?.value);
    }
  } catch (error) {
    console.error("[ai-features] read failed", error);
  }

  if (!flags.enabled || !flags[feature]) {
    setResponseStatus(503);
    throw new Error("Cette fonction IA est momentanément indisponible.");
  }
}
