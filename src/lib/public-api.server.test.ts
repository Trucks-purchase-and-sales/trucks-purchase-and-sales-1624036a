import { describe, expect, test } from "bun:test";
import { readBoundedJson } from "./public-api.server";

describe("readBoundedJson", () => {
  test("parses JSON when the body is within the byte limit", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, message: "bonjour" }),
    });

    const result = await readBoundedJson<{ ok: boolean; message: string }>(request, 1024);
    expect(result).toEqual({ ok: true, data: { ok: true, message: "bonjour" } });
  });

  test("rejects a declared Content-Length above the limit", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "5000",
      },
      body: JSON.stringify({ ok: true }),
    });

    const result = await readBoundedJson(request, 1024);
    expect(result).toEqual({ ok: false, status: 413, error: "Requête trop volumineuse" });
  });

  test("counts the real stream even when Content-Length is absent", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(2048) }),
    });

    const result = await readBoundedJson(request, 512);
    expect(result).toEqual({ ok: false, status: 413, error: "Requête trop volumineuse" });
  });

  test("returns a stable 400 result for malformed JSON", async () => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const result = await readBoundedJson(request, 1024);
    expect(result).toEqual({ ok: false, status: 400, error: "Corps JSON invalide" });
  });

  test("allows a body exactly at the configured byte limit", async () => {
    const body = JSON.stringify({ value: "ok" });
    const size = new TextEncoder().encode(body).byteLength;
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const result = await readBoundedJson(request, size);
    expect(result).toEqual({ ok: true, data: { value: "ok" } });
  });
});
