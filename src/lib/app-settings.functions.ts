import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AI_FEATURE_DEFAULTS,
  ASSISTANT_DEFAULTS,
  resolveAiFeatureFlags,
  resolveAssistantSettings,
  resolveKnownAppSettings,
} from "./app-settings.shared";
import type {
  AiFeatureSettings,
  AssistantSettings,
  LeadAssignmentSettings,
} from "./app-settings.shared";

export type { AiFeatureSettings, AssistantSettings, LeadAssignmentSettings } from "./app-settings.shared";

const KNOWN_SETTING_KEYS = ["lead_assignment", "assistant", "ai_features"] as const;

async function assertSettingsAdmin(sb: any, userId: string): Promise<void> {
  const { data: roles, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "platform_admin"]);
  if (error || !roles || roles.length === 0) throw new Error("Non autorisé");
}

async function readPrivilegedSetting(key: "assistant" | "ai_features"): Promise<unknown> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value;
}

/** Public projection: only assistant availability fields may cross the anonymous boundary. */
export const getPublicAssistantSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<AssistantSettings> => {
    try {
      return resolveAssistantSettings(await readPrivilegedSetting("assistant"));
    } catch (error) {
      console.error("[app-settings] public assistant read failed", error);
      return { ...ASSISTANT_DEFAULTS };
    }
  },
);

/** Authenticated projection: expose only the explicit AI feature flags, never the raw settings row. */
export const getAiFeatureSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AiFeatureSettings> => {
    try {
      return resolveAiFeatureFlags(await readPrivilegedSetting("ai_features"));
    } catch (error) {
      console.error("[app-settings] AI feature read failed", error);
      return { ...AI_FEATURE_DEFAULTS };
    }
  });

/** Admin-only read of the three currently supported settings groups. */
export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertSettingsAdmin(sb, context.userId);

    const { data, error } = await sb
      .from("app_settings")
      .select("key, value")
      .in("key", [...KNOWN_SETTING_KEYS]);
    if (error) {
      console.error("[app-settings] admin read failed", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }

    return resolveKnownAppSettings(data ?? []);
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
    await assertSettingsAdmin(sb, context.userId);

    const rows = Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      }));
    if (rows.length === 0) return { ok: true };

    const { error } = await sb.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      console.error("[app-settings] update failed", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    return { ok: true };
  });
