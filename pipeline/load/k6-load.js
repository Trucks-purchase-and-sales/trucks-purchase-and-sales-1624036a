// Phase 5 ramp test: baseline -> peak -> 3x peak -> ramp down, per
// EXECUTION-PLAN.md section 12. Same routes and safety guards as
// k6-baseline.js -- see that file for why real app routes are used
// instead of a raw Supabase REST passthrough.
//
// NOT wired into any CI workflow yet, and not run against anything --
// written ahead of Phase 5 actually starting so it's ready once a
// working, database-backed target exists to point it at.
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
  stages: [
    { duration: "1m", target: 10 }, // baseline
    { duration: "2m", target: 50 }, // peak
    { duration: "2m", target: 150 }, // 3x peak
    { duration: "1m", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

function getPublicPath(path, name) {
  const response = http.get(`${root}${path}`, {
    headers: {
      "User-Agent": "Wilmet-k6-load/1.0",
    },
    tags: { endpoint: name },
  });

  check(response, {
    [`${name} returns HTTP 200`]: (res) => res.status === 200,
  });
}

export default function () {
  getPublicPath("/", "public-shell");
  getPublicPath("/chercher-un-vehicule/", "buyer-request-entry");
  sleep(1);
}
