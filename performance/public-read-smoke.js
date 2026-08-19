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
  scenarios: {
    public_read_smoke: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 10,
      maxDuration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

function getPublicPath(path, name) {
  const response = http.get(`${root}${path}`, {
    headers: {
      "User-Agent": "Wilmet-k6-staging-verification/1.0",
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
