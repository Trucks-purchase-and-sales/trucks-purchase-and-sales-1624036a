import { describe, expect, test } from "bun:test";
import {
  CSP_REPORT_ONLY_POLICY,
  withSecurityHeaders,
} from "./security-headers.server";

describe("withSecurityHeaders", () => {
  test("preserves application headers and adds conservative hardening", async () => {
    const response = new Response("ok", {
      status: 200,
      headers: { "Content-Type": "text/plain", "X-App-Header": "kept" },
    });
    const request = new Request("https://wilmet.example/page");

    const hardened = withSecurityHeaders(response, request);

    expect(hardened.status).toBe(200);
    expect(await hardened.text()).toBe("ok");
    expect(hardened.headers.get("content-type")).toBe("text/plain");
    expect(hardened.headers.get("x-app-header")).toBe("kept");
    expect(hardened.headers.get("x-content-type-options")).toBe("nosniff");
    expect(hardened.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(hardened.headers.get("x-dns-prefetch-control")).toBe("off");
    expect(hardened.headers.get("permissions-policy")).toBe(
      "geolocation=(), microphone=(), payment=(), usb=()",
    );
    expect(hardened.headers.get("strict-transport-security")).toBe("max-age=31536000");
  });

  test("emits CSP in report-only mode without making a framing decision", () => {
    const response = new Response("ok");
    const request = new Request("https://wilmet.example/");

    const hardened = withSecurityHeaders(response, request);
    const policy = hardened.headers.get("content-security-policy-report-only");

    expect(policy).toBe(CSP_REPORT_ONLY_POLICY);
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("https://fonts.googleapis.com");
    expect(policy).toContain("https://fonts.gstatic.com");
    expect(policy).toContain("https://*.supabase.co");
    expect(policy).toContain("wss://*.supabase.co");
    expect(policy).toContain("https://*.r2.dev");
    expect(policy).not.toContain("frame-ancestors");
    expect(hardened.headers.has("content-security-policy")).toBe(false);
  });

  test("does not emit HSTS for a plain HTTP request", () => {
    const response = new Response("dev");
    const request = new Request("http://localhost:3000/");

    const hardened = withSecurityHeaders(response, request);
    expect(hardened.headers.has("strict-transport-security")).toBe(false);
    expect(hardened.headers.get("content-security-policy-report-only")).toBe(
      CSP_REPORT_ONLY_POLICY,
    );
  });

  test("preserves status and status text", () => {
    const response = new Response("missing", { status: 404, statusText: "Not Found" });
    const request = new Request("https://wilmet.example/missing");

    const hardened = withSecurityHeaders(response, request);
    expect(hardened.status).toBe(404);
    expect(hardened.statusText).toBe("Not Found");
  });
});
