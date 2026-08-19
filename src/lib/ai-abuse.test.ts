import { describe, expect, test } from "bun:test";
import { classifyAiLimitResult } from "./ai-abuse.server";
import { resolveAiFeatureFlags } from "./ai-features.server";
import {
  AiInputError,
  OCR_ALLOWED_MIME,
  validateBase64DataUrl,
  validateOcrImageBudgets,
  validateVoiceDataUrl,
} from "./ai-input-budgets.server";

function dataUrl(mime: string, bytes: number[]): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function expectInputStatus(fn: () => unknown, status: number) {
  try {
    fn();
    throw new Error("expected input guard to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(AiInputError);
    expect((error as AiInputError).status).toBe(status);
  }
}

describe("AI feature configuration", () => {
  test("fails closed when settings are missing or malformed", () => {
    expect(resolveAiFeatureFlags(undefined)).toEqual({
      enabled: false,
      ocr: false,
      voice: false,
      dossier_audit: false,
    });
    expect(resolveAiFeatureFlags("enabled")).toEqual({
      enabled: false,
      ocr: false,
      voice: false,
      dossier_audit: false,
    });
  });

  test("only accepts explicit boolean opt-ins", () => {
    expect(resolveAiFeatureFlags({ enabled: true, voice: true, ocr: "true" })).toEqual({
      enabled: true,
      ocr: false,
      voice: true,
      dossier_audit: false,
    });
  });
});

describe("AI decoded input budgets", () => {
  test("accepts an approved voice MIME and reports decoded bytes", () => {
    const parsed = validateVoiceDataUrl(dataUrl("audio/webm", [1, 2, 3, 4]));
    expect(parsed.mime).toBe("audio/webm");
    expect(parsed.decodedBytes).toBe(4);
  });

  test("rejects disallowed OCR MIME before gateway processing", () => {
    expectInputStatus(
      () => validateBase64DataUrl(dataUrl("text/html", [1, 2, 3]), {
        allowedMime: OCR_ALLOWED_MIME,
        maxDecodedBytes: 10,
      }),
      415,
    );
  });

  test("rejects a per-file decoded byte overflow with 413", () => {
    expectInputStatus(
      () => validateBase64DataUrl(dataUrl("image/jpeg", [1, 2, 3, 4]), {
        allowedMime: OCR_ALLOWED_MIME,
        maxDecodedBytes: 3,
      }),
      413,
    );
  });

  test("rejects aggregate OCR decoded bytes with 413", () => {
    const images = [
      { data_url: dataUrl("image/png", [1, 2, 3]) },
      { data_url: dataUrl("image/png", [4, 5, 6]) },
    ];
    expectInputStatus(
      () => validateOcrImageBudgets(images, { perFileBytes: 4, aggregateBytes: 5 }),
      413,
    );
  });

  test("rejects malformed base64", () => {
    expectInputStatus(
      () => validateBase64DataUrl("data:image/jpeg;base64,AAAAA", {
        allowedMime: OCR_ALLOWED_MIME,
        maxDecodedBytes: 10,
      }),
      400,
    );
  });
});

describe("AI limiter failure semantics", () => {
  test("fails closed with 503 when the limiter cannot decide", () => {
    expect(classifyAiLimitResult({
      allowed: false,
      limiterAvailable: false,
      currentCount: 0,
      retryAfterSeconds: 60,
    })).toEqual({
      status: 503,
      retryAfterSeconds: 60,
      message: "Fonction IA momentanément indisponible.",
    });
  });

  test("returns deterministic 429 semantics when quota is exhausted", () => {
    expect(classifyAiLimitResult({
      allowed: false,
      limiterAvailable: true,
      currentCount: 16,
      retryAfterSeconds: 42,
    })).toEqual({
      status: 429,
      retryAfterSeconds: 42,
      message: "Trop de requêtes IA. Veuillez réessayer plus tard.",
    });
  });

  test("allows a trustworthy under-limit decision", () => {
    expect(classifyAiLimitResult({
      allowed: true,
      limiterAvailable: true,
      currentCount: 1,
      retryAfterSeconds: 0,
    })).toBeNull();
  });
});
