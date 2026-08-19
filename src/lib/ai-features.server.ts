// Server-side guard for admin-controlled AI assistance features.
import { setResponseStatus } from "@tanstack/react-start/server";
import { AI_FEATURE_DEFAULTS, resolveAiFeatureFlags } from "./app-settings.shared";
import { readAiFeatureSettingsServer } from "./app-settings.server";

export type AiFeature = "ocr" | "voice" | "dossier_audit";
export type AiFeatureFlags = typeof AI_FEATURE_DEFAULTS;
export { AI_FEATURE_DEFAULTS, resolveAiFeatureFlags } from "./app-settings.shared";

/** Throws when the admin did not explicitly enable the feature. */
export async function assertAiFeatureEnabled(feature: AiFeature): Promise<void> {
  const flags = await readAiFeatureSettingsServer();

  if (!flags.enabled || !flags[feature]) {
    setResponseStatus(503);
    throw new Error("Cette fonction IA est momentanément indisponible.");
  }
}
