// V2P Phase 5 baseline: low, steady load to record normal p95 latency
// and error rate before the ramp test (k6-load.js) pushes toward 3x
// peak. Hits real app routes (not a raw Supabase REST passthrough) so
// SSR/database-backed rendering cost is included, matching what a real
// visitor actually experiences.
//
// App-agnostic and config-driven: which routes to hit come from
// K6_ROUTES_JSON, not a hardcoded list, so this file works unmodified
// for any Lovable app. See pipeline/README.md for how to fill it in.
import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.K6_BASE_URL;
const targetLabel = __ENV.K6_TARGET_LABEL;
const appName = __ENV.K6_APP_NAME || "v2p-app";
const routesJson = __ENV.K6_ROUTES_JSON;

if (!baseUrl) {
  throw new Error("K6_BASE_URL is required; never guess the load-test target.");
}

if (targetLabel !== "staging" && targetLabel !== "local") {
  throw new Error(
    "K6_TARGET_LABEL must be 'staging' or 'local'. Production targets are intentionally unsupported.",
  );
}

if (!routesJson) {
  throw new Error(
    'K6_ROUTES_JSON is required -- a JSON array of {"path":"/","name":"label"} objects. ' +
      "Never guess which routes matter for a given app.",
  );
}

let routes;
try {
  routes = JSON.parse(routesJson);
} catch {
  throw new Error("K6_ROUTES_JSON must be valid JSON.");
}
if (!Array.isArray(routes) || routes.length === 0) {
  throw new Error("K6_ROUTES_JSON must be a non-empty array.");
}
for (const r of routes) {
  if (typeof r?.path !== "string" || typeof r?.name !== "string") {
    throw new Error('Each K6_ROUTES_JSON entry needs a string "path" and "name".');
  }
}

const root = baseUrl.trim().replace(/\/+$/, "");
const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/;
const stagingOrigin = /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/;

if (targetLabel === "local" && !localOrigin.test(root)) {
  throw new Error(
    "The 'local' k6 target must be an http(s) localhost/127.0.0.1 origin with no path, query, fragment, or credentials.",
  );
}

if (targetLabel === "staging" && !stagingOrigin.test(root)) {
  throw new Error(
    "The 'staging' k6 target must be a bare HTTPS origin with no path, query, fragment, or credentials.",
  );
}

export const options = {
  discardResponseBodies: true,
  vus: 5,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

function getPublicPath(path, name) {
  const response = http.get(`${root}${path}`, {
    headers: {
      "User-Agent": `${appName}-k6-baseline/1.0`,
    },
    tags: { endpoint: name },
  });

  check(response, {
    [`${name} returns HTTP 200`]: (res) => res.status === 200,
  });
}

export default function () {
  for (const r of routes) {
    getPublicPath(r.path, r.name);
  }
  sleep(1);
}
