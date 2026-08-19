export type CorsDecision = {
  allowed: boolean;
  headers: Record<string, string>;
};

export function publicApiCors(
  request: Request,
  options: {
    methods: readonly string[];
    allowedHeaders?: readonly string[];
  },
): CorsDecision {
  const originHeader = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;

  // Non-browser/API clients commonly omit Origin. CORS is not authentication,
  // so keep those clients usable while browser cross-origin calls are narrowed.
  if (!originHeader) {
    return { allowed: true, headers: {} };
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return { allowed: false, headers: { Vary: "Origin" } };
  }

  if (parsedOrigin.origin !== originHeader || parsedOrigin.origin !== ownOrigin) {
    return { allowed: false, headers: { Vary: "Origin" } };
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": ownOrigin,
    "Access-Control-Allow-Methods": options.methods.join(", "),
    Vary: "Origin",
  };
  if (options.allowedHeaders?.length) {
    headers["Access-Control-Allow-Headers"] = options.allowedHeaders.join(", ");
  }

  return { allowed: true, headers };
}

export function rejectForeignBrowserOrigin(decision: CorsDecision): Response | null {
  return decision.allowed
    ? null
    : Response.json(
        { error: "Cross-origin browser access is not allowed." },
        { status: 403, headers: decision.headers },
      );
}
