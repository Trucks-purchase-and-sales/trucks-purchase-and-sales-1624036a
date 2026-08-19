import { describe, expect, test } from "bun:test";
import { publicApiCors, rejectForeignBrowserOrigin } from "./public-cors.server";

const opts = { methods: ["POST", "OPTIONS"], allowedHeaders: ["Content-Type"] } as const;

function req(origin?: string) {
  return new Request("https://staging.wilmet.example/api/public/test", {
    method: "POST",
    headers: origin ? { Origin: origin } : undefined,
  });
}

describe("public API CORS guard", () => {
  test("allows exact same-origin browser calls and never uses wildcard CORS", () => {
    const decision = publicApiCors(req("https://staging.wilmet.example"), opts);
    expect(decision.allowed).toBe(true);
    expect(decision.headers["Access-Control-Allow-Origin"]).toBe("https://staging.wilmet.example");
    expect(decision.headers["Access-Control-Allow-Origin"]).not.toBe("*");
    expect(decision.headers.Vary).toBe("Origin");
    expect(decision.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(decision.headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });

  test("allows machine-to-machine callers without an Origin header without granting browser CORS", () => {
    const decision = publicApiCors(req(), opts);
    expect(decision).toEqual({ allowed: true, headers: {} });
  });

  test("rejects a foreign browser origin", async () => {
    const decision = publicApiCors(req("https://evil.example"), opts);
    expect(decision.allowed).toBe(false);
    expect(decision.headers).toEqual({ Vary: "Origin" });
    const response = rejectForeignBrowserOrigin(decision);
    expect(response?.status).toBe(403);
    expect(response?.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("rejects malformed or path-bearing Origin values", () => {
    expect(publicApiCors(req("not a url"), opts).allowed).toBe(false);
    expect(publicApiCors(req("https://staging.wilmet.example/path"), opts).allowed).toBe(false);
  });

  test("rejects scheme or port mismatches", () => {
    expect(publicApiCors(req("http://staging.wilmet.example"), opts).allowed).toBe(false);
    expect(publicApiCors(req("https://staging.wilmet.example:444"), opts).allowed).toBe(false);
  });
});
