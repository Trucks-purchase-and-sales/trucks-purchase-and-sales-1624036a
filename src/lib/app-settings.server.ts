import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AI_FEATURE_DEFAULTS,
  ASSISTANT_DEFAULTS,
  LEAD_ASSIGNMENT_DEFAULTS,
  resolveAiFeatureFlags,
  resolveAssistantSettings,
  resolveLeadAssignmentSettings,
} from "./app-settings.shared";
import type {
  AiFeatureSettings,
  AssistantSettings,
  LeadAssignmentSettings,
} from "./app-settings.shared";

type ServerSettingKey = "assistant" | "ai_features" | "lead_assignment";

async function readRawSetting(key: ServerSettingKey): Promise<unknown> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value;
}

/** Anonymous-facing assistant availability. Missing/read errors fail closed. */
export async function readAssistantSettingsServer(): Promise<AssistantSettings> {
  try {
    return resolveAssistantSettings(await readRawSetting("assistant"));
  } catch (error) {
    console.error("[app-settings] assistant settings read failed", error);
    return { ...ASSISTANT_DEFAULTS };
  }
}

/**
 * Operational routing preserves Wilmet's established default-on behavior while
 * respecting an explicit admin `enabled: false`. Unknown fields are discarded.
 */
export async function readLeadAssignmentSettingsServer(): Promise<LeadAssignmentSettings> {
  try {
    return resolveLeadAssignmentSettings(await readRawSetting("lead_assignment"));
  } catch (error) {
    console.error("[app-settings] lead-assignment settings read failed", error);
    return { ...LEAD_ASSIGNMENT_DEFAULTS };
  }
}

/** Optional external AI features remain fail-closed on missing/read errors. */
export async function readAiFeatureSettingsServer(): Promise<AiFeatureSettings> {
  try {
    return resolveAiFeatureFlags(await readRawSetting("ai_features"));
  } catch (error) {
    console.error("[app-settings] AI feature settings read failed", error);
    return { ...AI_FEATURE_DEFAULTS };
  }
}
