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

export type KnownAppSettings = {
  lead_assignment: LeadAssignmentSettings;
  assistant: AssistantSettings;
  ai_features: AiFeatureSettings;
};

export const LEAD_ASSIGNMENT_DEFAULTS: LeadAssignmentSettings = { enabled: true };
export const ASSISTANT_DEFAULTS: AssistantSettings = {
  enabled: false,
  always_on: false,
  start_hour: 18,
  end_hour: 8,
};
export const AI_FEATURE_DEFAULTS: AiFeatureSettings = {
  enabled: false,
  ocr: false,
  voice: false,
  dossier_audit: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function explicitBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function validHour(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : fallback;
}

export function resolveLeadAssignmentSettings(value: unknown): LeadAssignmentSettings {
  const raw = asRecord(value);
  return {
    enabled: explicitBoolean(raw?.enabled, LEAD_ASSIGNMENT_DEFAULTS.enabled),
  };
}

export function resolveAssistantSettings(value: unknown): AssistantSettings {
  const raw = asRecord(value);
  return {
    enabled: explicitBoolean(raw?.enabled, ASSISTANT_DEFAULTS.enabled),
    always_on: explicitBoolean(raw?.always_on, ASSISTANT_DEFAULTS.always_on),
    start_hour: validHour(raw?.start_hour, ASSISTANT_DEFAULTS.start_hour),
    end_hour: validHour(raw?.end_hour, ASSISTANT_DEFAULTS.end_hour),
  };
}

export function resolveAiFeatureFlags(value: unknown): AiFeatureSettings {
  const raw = asRecord(value);
  return {
    enabled: explicitBoolean(raw?.enabled, AI_FEATURE_DEFAULTS.enabled),
    ocr: explicitBoolean(raw?.ocr, AI_FEATURE_DEFAULTS.ocr),
    voice: explicitBoolean(raw?.voice, AI_FEATURE_DEFAULTS.voice),
    dossier_audit: explicitBoolean(raw?.dossier_audit, AI_FEATURE_DEFAULTS.dossier_audit),
  };
}

export function resolveKnownAppSettings(
  rows: ReadonlyArray<{ key: string; value: unknown }>,
): KnownAppSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    lead_assignment: resolveLeadAssignmentSettings(byKey.get("lead_assignment")),
    assistant: resolveAssistantSettings(byKey.get("assistant")),
    ai_features: resolveAiFeatureFlags(byKey.get("ai_features")),
  };
}
