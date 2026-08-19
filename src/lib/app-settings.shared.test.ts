import { describe, expect, test } from "bun:test";
import {
  AI_FEATURE_DEFAULTS,
  ASSISTANT_DEFAULTS,
  resolveAiFeatureFlags,
  resolveAssistantSettings,
  resolveKnownAppSettings,
} from "./app-settings.shared";

describe("app settings projection boundaries", () => {
  test("public assistant projection returns only approved fields", () => {
    expect(
      resolveAssistantSettings({
        enabled: true,
        always_on: true,
        start_hour: 21,
        end_hour: 7,
        internal_webhook: "https://sensitive.example/internal",
        service_role_key: "sentinel-secret",
      }),
    ).toEqual({
      enabled: true,
      always_on: true,
      start_hour: 21,
      end_hour: 7,
    });
  });

  test("assistant projection defaults invalid values safely", () => {
    expect(
      resolveAssistantSettings({
        enabled: "true",
        always_on: 1,
        start_hour: 24,
        end_hour: -1,
      }),
    ).toEqual(ASSISTANT_DEFAULTS);
  });

  test("AI projection fails closed and accepts only explicit booleans", () => {
    expect(resolveAiFeatureFlags(undefined)).toEqual(AI_FEATURE_DEFAULTS);
    expect(
      resolveAiFeatureFlags({
        enabled: true,
        voice: true,
        ocr: "true",
        dossier_audit: 1,
        provider_api_key: "sentinel-secret",
      }),
    ).toEqual({
      enabled: true,
      ocr: false,
      voice: true,
      dossier_audit: false,
    });
  });

  test("known settings projection ignores future keys and unknown JSON fields", () => {
    const projected = resolveKnownAppSettings([
      { key: "lead_assignment", value: { enabled: false, routing_secret: "sentinel" } },
      { key: "assistant", value: { enabled: true, always_on: false, start_hour: 18, end_hour: 8, hidden: "sentinel" } },
      { key: "ai_features", value: { enabled: true, ocr: false, voice: true, dossier_audit: false, budget: 999 } },
      { key: "future_operational_secret", value: { token: "sentinel-secret" } },
    ]);

    expect(projected).toEqual({
      lead_assignment: { enabled: false },
      assistant: { enabled: true, always_on: false, start_hour: 18, end_hour: 8 },
      ai_features: { enabled: true, ocr: false, voice: true, dossier_audit: false },
    });
    expect(JSON.stringify(projected)).not.toContain("sentinel");
    expect(Object.keys(projected)).toEqual(["lead_assignment", "assistant", "ai_features"]);
  });
});
