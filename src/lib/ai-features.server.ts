// Server-side guard for admin-controlled AI assistance features.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AiFeature = "ocr" | "voice" | "dossier_audit";

const DEFAULTS = { enabled: true, ocr: false, voice: true, dossier_audit: true };

/** Throws when the admin disabled the feature (master switch or per-feature). */
export async function assertAiFeatureEnabled(feature: AiFeature): Promise<void> {
  let flags = DEFAULTS;
  try {
    const sb = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "ai_features")
      .maybeSingle();
    if (data?.value) flags = { ...DEFAULTS, ...(data.value as Record<string, boolean>) };
  } catch (e) {
    console.error("[ai-features] read failed", e);
  }
  if (!flags.enabled || !flags[feature]) {
    throw new Error("Cette fonction IA est désactivée par l'administrateur.");
  }
}
