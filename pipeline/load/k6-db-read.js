// V2P Phase 5 -- direct database-read check, decoupled from the app
// server. Useful whenever a load test against real app routes can't
// prove anything about database performance (e.g. because the query
// in question only ever fires client-side after hydration, so a
// JS-less HTTP client like k6 never triggers it -- see
// pipeline/README.md's troubleshooting notes for how this was
// discovered). Hits PostgREST directly with the exact select/filter/
// order clauses the app's own code uses for a given query, so a
// missing index would show up here even when it can't show up in an
// app-route test.
//
// App-agnostic and config-driven: which queries to run come from
// K6_DB_PROBES_JSON, not a hardcoded list, so this file works
// unmodified for any Supabase-backed app.
import http from "k6/http";
import { check, sleep } from "k6";

const url = __ENV.K6_SUPABASE_URL;
const anonKey = __ENV.K6_SUPABASE_ANON_KEY;
const targetLabel = __ENV.K6_DB_TARGET_LABEL;
const probesJson = __ENV.K6_DB_PROBES_JSON;

if (!url || !anonKey) {
  throw new Error("K6_SUPABASE_URL and K6_SUPABASE_ANON_KEY are required; never guess the target.");
}

if (targetLabel !== "disposable") {
  throw new Error(
    "K6_DB_TARGET_LABEL must be 'disposable'. Production Supabase projects are intentionally unsupported.",
  );
}

if (!probesJson) {
  throw new Error(
    'K6_DB_PROBES_JSON is required -- a JSON array of {"name":"label","path":"/rest/v1/..."} ' +
      "objects, one per query to check. Never guess which queries matter for a given app.",
  );
}

let queries;
try {
  queries = JSON.parse(probesJson);
} catch {
  throw new Error("K6_DB_PROBES_JSON must be valid JSON.");
}
if (!Array.isArray(queries) || queries.length === 0) {
  throw new Error("K6_DB_PROBES_JSON must be a non-empty array.");
}
for (const q of queries) {
  if (typeof q?.path !== "string" || typeof q?.name !== "string") {
    throw new Error('Each K6_DB_PROBES_JSON entry needs a string "path" and "name".');
  }
}

const root = url.trim().replace(/\/+$/, "");
if (!/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(root)) {
  throw new Error(
    "K6_SUPABASE_URL must be a bare HTTPS origin with no path, query, or credentials.",
  );
}

export const options = {
  discardResponseBodies: true,
  stages: [
    { duration: "30s", target: 5 }, // baseline
    { duration: "1m", target: 30 }, // peak
    { duration: "1m", target: 60 }, // 3x peak (of this check's own baseline)
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  for (const q of queries) {
    const response = http.get(`${root}${q.path}`, {
      headers: { apikey: anonKey },
      tags: { endpoint: q.name },
    });
    check(response, {
      [`${q.name} returns HTTP 200`]: (res) => res.status === 200,
    });
  }
  sleep(1);
}
