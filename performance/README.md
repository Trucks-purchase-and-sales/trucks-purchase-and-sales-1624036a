# Wilmet k6 performance verification

This directory contains Wilmet's protocol-level performance-test harness.

The goal is to produce repeatable performance evidence without allowing a test script to become an accidental production load generator.

## Evidence boundary

Keep these states separate:

- **implemented** — the k6 script/workflow exists in Git;
- **CI-validated** — the pinned k6 version can inspect the script and calculate its execution requirements without sending traffic;
- **staging-verified** — the test actually ran against the private/unpublished Wilmet staging deployment and retained its results;
- **performance accepted** — an agreed workload/SLO has been exercised and the results have been reviewed.

A successful script inspection is not a performance result.

## Target safety

`public-read-smoke.js` requires both:

- `K6_BASE_URL`;
- `K6_TARGET_LABEL` set to either `local` or `wilmet-staging`.

The script intentionally has no production target mode.

- `local` is restricted to `localhost` / `127.0.0.1`;
- `wilmet-staging` requires HTTPS.

The GitHub staging workflow also requires explicit confirmation before it can run.

## Current workload

The initial slice is deliberately small and read-only:

- 1 virtual user;
- 10 iterations;
- `GET /`;
- `GET /chercher-un-vehicule/`;
- a one-second pause per iteration.

It is a baseline/smoke workload, not Wilmet's expected production peak.

Do not increase concurrency or introduce mutating requests until CCSG/Wilmet usage expectations and safe staging fixtures are defined.

## Initial thresholds

The internship methodology proposed these initial engineering targets:

- HTTP error rate `< 1%`;
- p95 HTTP request duration `< 500 ms`.

The script also requires more than 99% of functional checks to pass.

These are **provisional baseline thresholds**, not a final Wilmet production SLO. They must be reviewed against realistic traffic, deployment characteristics, and business expectations after staging measurements exist.

## CI validation

PR CI performs a k6 inspection only. It provides local-only target values so the script's target guard can initialize, but it does not start Wilmet and does not run the workload:

```bash
K6_BASE_URL=http://127.0.0.1:4173 \
K6_TARGET_LABEL=local \
k6 inspect --include-system-env-vars --execution-requirements performance/public-read-smoke.js
```

## Real staging run

Use the manual `k6 Staging Performance` workflow and supply the private staging base URL only after confirming the target is staging.

The workflow retains:

- raw k6 JSON metric output;
- the console/threshold summary.

Do not commit URLs containing credentials, session tokens, customer data, or any runtime secret.

## Future workload phases

Once staging credentials/fixtures and expected traffic are known, add separate reviewed profiles rather than silently increasing this smoke test:

1. baseline / low traffic;
2. agreed expected peak;
3. stress profile, initially up to the methodology's proposed 3× expected peak only after the expected peak is defined;
4. authenticated seller/buyer/internal reads;
5. carefully guarded mutating business operations;
6. AI endpoints with cost/quota protections explicitly respected.

Each profile should state its workload assumptions and acceptance thresholds before execution.
