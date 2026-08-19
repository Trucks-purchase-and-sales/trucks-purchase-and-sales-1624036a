const HSTS_ONE_YEAR_SECONDS = 31_536_000;

export const CSP_REPORT_ONLY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' data: blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

/**
 * Add conservative response-hardening headers.
 *
 * CSP is intentionally report-only at this stage. The current source inventory
 * covers same-origin application assets, Google Fonts, Supabase browser
 * connections/storage, and the existing R2 social-preview asset. Runtime
 * violations still need to be observed on the Lovable staging deployment before
 * an enforcing policy is introduced.
 *
 * `frame-ancestors` is deliberately omitted until Lovable preview and final
 * production embedding requirements are explicitly verified.
 */
export function withSecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), payment=(), usb=()",
  );
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY_POLICY);

  // HSTS is meaningful only when the user reached Wilmet over HTTPS. No
  // includeSubDomains/preload directive is used until the production-domain
  // ownership and subdomain inventory are explicitly verified.
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", `max-age=${HSTS_ONE_YEAR_SECONDS}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
