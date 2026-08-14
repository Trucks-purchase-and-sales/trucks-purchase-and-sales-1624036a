import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeadAssignmentSettings = { enabled: boolean };
export type AiFeatureSettings = {
  enabled: boolean;
  ocr: boolean;
  voice: boolean;
  dossier_audit: boolean;
};
export type AssistantSettings = {
  enabled: boolean;
  always_on: boolean;
  start_hour: number;
  end_hour: number;
};

const DEFAULTS = {
  lead_assignment: { enabled: true } as LeadAssignmentSettings,
  assistant: { enabled: false, always_on: false, start_hour: 18, end_hour: 8 } as AssistantSettings,
  ai_features: { enabled: true, ocr: false, voice: true, dossier_audit: true } as AiFeatureSettings,
};

/** Public read: the site assistant needs it before any sign-in. */
export const getAppSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb.from("app_settings").select("key, value");
  if (error) {
    console.error("[app-settings] read failed", error);
    return DEFAULTS;
  }
  const byKey = new Map((data ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
  return {
    lead_assignment: { ...DEFAULTS.lead_assignment, ...(byKey.get("lead_assignment") ?? {}) } as LeadAssignmentSettings,
    assistant: { ...DEFAULTS.assistant, ...(byKey.get("assistant") ?? {}) } as AssistantSettings,
    ai_features: { ...DEFAULTS.ai_features, ...(byKey.get("ai_features") ?? {}) } as AiFeatureSettings,
  };
});

const updateSchema = z.object({
  lead_assignment: z.object({ enabled: z.boolean() }).optional(),
  assistant: z.object({
    enabled: z.boolean(),
    always_on: z.boolean(),
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(0).max(23),
  }).optional(),
  ai_features: z.object({
    enabled: z.boolean(),
    ocr: z.boolean(),
    voice: z.boolean(),
    dossier_audit: z.boolean(),
  }).optional(),
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", context.userId)
      .in("role", ["admin", "platform_admin"]);
    if (!roles || roles.length === 0) throw new Error("Non autorisé");

    const rows = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString(), updated_by: context.userId }));
    if (rows.length === 0) return { ok: true };

    const { error } = await sb.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      console.error("[app-settings] update failed", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    return { ok: true };
  });
