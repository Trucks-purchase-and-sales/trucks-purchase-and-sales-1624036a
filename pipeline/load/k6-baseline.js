// Phase 5 baseline: low, steady load to record normal p95 latency and
// error rate before the ramp test (k6-load.js) pushes toward 3x peak.
//
// NOT wired into any CI workflow yet, and not run against anything --
// this only touches real request traffic once actually executed, which
// requires a working, database-backed target. Written ahead of that so
// it's ready the moment Phase 5 is unblocked.
//
// Hits real app routes (SSR, which queries the database server-side)
// rather than Supabase's REST API directly, following the precedent
// already set by performance/public-read-smoke.js -- this exercises the
// full stack a real visitor hits, not just a raw table passthrough, which
// matters for Phase 5's actual goal (finding missing indexes/pagination/
// caching gaps, not just measuring Postgres's own response time).
import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.K6_BASE_URL;
const targetLabel = __ENV.K6_TARGET_LABEL;

if (!baseUrl) {
  throw new Error("K6_BASE_URL is required; never guess the Wilmet load-test target.");
}

if (targetLabel !== "wilmet-staging" && targetLabel !== "local") {
  throw new Error(
    "K6_TARGET_LABEL must be 'wilmet-staging' or 'local'. Production targets are intentionally unsupported.",
  );
}

const root = baseUrl.trim().replace(/\/+$/, "");
const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/;
const stagingOrigin = /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/;

if (targetLabel === "local" && !localOrigin.test(root)) {
  throw new Error(
    "The 'local' k6 target must be an http(s) localhost/127.0.0.1 origin with no path, query, fragment, or credentials.",
  );
}

if (targetLabel === "wilmet-staging" && !stagingOrigin.test(root)) {
  throw new Error(
    "Wilmet staging performance tests require an HTTPS origin with no path, query, fragment, or credentials.",
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
      "User-Agent": "Wilmet-k6-baseline/1.0",
    },
    tags: { endpoint: name },
  });

  check(response, {
    [`${name} returns HTTP 200`]: (res) => res.status === 200,
  });
}

export default function () {
  getPublicPath("/", "public-shell");
  // Database-backed: fetches ref_vehicle_categories/ref_vehicle_types
  // server-side on render -- exactly the kind of query Phase 5 is meant
  // to catch missing indexes or pagination on.
  getPublicPath("/chercher-un-vehicule/", "buyer-request-entry");
  sleep(1);
}
