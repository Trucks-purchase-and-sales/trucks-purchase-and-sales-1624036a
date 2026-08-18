import { describe, expect, test } from "bun:test";
import { parseAssistantRequest } from "./assistant-request.schema";

const messages = [{ role: "user" as const, content: "Je cherche un tracteur routier." }];

describe("parseAssistantRequest", () => {
  test("accepts a valid conversation only with literal explicit consent", () => {
    expect(parseAssistantRequest({ messages, gdprConsent: true })).toEqual({
      ok: true,
      messages,
    });
  });

  test("rejects missing consent", () => {
    const result = parseAssistantRequest({ messages });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Votre consentement est requis pour utiliser l’assistant.",
      consentRequired: true,
    });
  });

  test("rejects false consent", () => {
    const result = parseAssistantRequest({ messages, gdprConsent: false });
    expect(result).toMatchObject({ ok: false, status: 400, consentRequired: true });
  });

  test("rejects stringified consent instead of coercing it", () => {
    const result = parseAssistantRequest({ messages, gdprConsent: "true" });
    expect(result).toMatchObject({ ok: false, status: 400, consentRequired: true });
  });

  test("rejects an empty conversation even when consent is true", () => {
    const result = parseAssistantRequest({ messages: [], gdprConsent: true });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Message manquant",
      consentRequired: false,
    });
  });

  test("bounds message count and message size at the server schema", () => {
    const tooMany = Array.from({ length: 17 }, () => ({ role: "user" as const, content: "x" }));
    expect(parseAssistantRequest({ messages: tooMany, gdprConsent: true })).toMatchObject({
      ok: false,
      status: 400,
    });

    expect(
      parseAssistantRequest({
        messages: [{ role: "user", content: "x".repeat(2001) }],
        gdprConsent: true,
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });
});
