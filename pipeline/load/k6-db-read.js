// Phase 5 -- direct database-read check, decoupled from the app server.
//
// Added after the first real ramp-test run (k6-load.js) revealed that
// neither route it hits (/, /chercher-un-vehicule/) actually touches the
// database under a plain HTTP client: getReferenceData() is only invoked
// client-side via React Query after hydration (no SSR loader, no query
// dehydration in __root.tsx), and k6 never executes JavaScript. So the
// app-route ramp test measures React SSR render cost under Vite dev mode,
// not database performance -- exactly the opposite of what Phase 5 exists
// to catch. This script hits PostgREST directly with the same filter/
// order clauses reference-data.functions.ts actually uses, so an index
// gap would show up here even though it can't show up in the app-route
// test.
//
// Deliberately smaller load shape than k6-load.js's 150-VU peak: this
// goes straight at Postgres/PostgREST on someone's personal disposable
// Supabase project, not through the app's own connection handling, so a
// production-peak-sized ramp here would be a needlessly reckless way to
// treat a real (if disposable) database. 60 VUs is still a meaningful
// concurrency multiplier over the 5-VU baseline.
import http from "k6/http";
import { check, sleep } from "k6";

const url = __ENV.K6_SUPABASE_URL;
const anonKey = __ENV.K6_SUPABASE_ANON_KEY;
const targetLabel = __ENV.K6_DB_TARGET_LABEL;

if (!url || !anonKey) {
  throw new Error("K6_SUPABASE_URL and K6_SUPABASE_ANON_KEY are required; never guess the target.");
}

if (targetLabel !== "disposable") {
  throw new Error(
    "K6_DB_TARGET_LABEL must be 'disposable'. Production Supabase projects are intentionally unsupported.",
  );
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

// Same select/filter/order as reference-data.functions.ts's getReferenceData
// (a representative subset, not all 11 tables -- these are its two largest
// and most index-sensitive queries: a filtered+sorted lookup table and the
// one table most likely to grow large, models across all brands).
const queries = [
  {
    name: "ref-vehicle-categories",
    path: "/rest/v1/ref_vehicle_categories?select=slug,label_fr,label_en,sort_order&is_active=eq.true&order=sort_order",
  },
  {
    name: "ref-vehicle-types",
    path: "/rest/v1/ref_vehicle_types?select=slug,label_fr,label_en,sort_order&is_active=eq.true&order=sort_order",
  },
  {
    name: "ref-vehicle-brands",
    path: "/rest/v1/ref_vehicle_brands?select=slug,label,sort_order&is_active=eq.true&order=sort_order",
  },
  {
    name: "ref-vehicle-models",
    path: "/rest/v1/ref_vehicle_models?select=id,brand_slug,label&is_active=eq.true&order=label",
  },
];

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
