const HSTS_ONE_YEAR_SECONDS = 31_536_000;

/**
 * Add conservative response-hardening headers that do not depend on page-specific
 * CSP knowledge. CSP/frame restrictions are intentionally handled separately so
 * we do not break Lovable preview, authentication flows, or required third-party
 * assets without first inventorying them.
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
