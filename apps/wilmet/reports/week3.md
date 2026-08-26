# Week 3 — Phase 4 and Phase 5 progress report

_Status: complete (per the plan's cadence — this report closes out at
the end of Phase 5). Last updated: 2026-08-26._

## Goal

Make it impossible to silently break a working feature — the thing
Lovable's own regeneration cycle doesn't protect against.

## Shipped and merged to `main`

- **E2E harness activated.** `e2e/` (isolated Playwright install, own
  `package.json`/lockfile) wired to run for real in CI against a live
  dev server, not just a syntax/import check. Locale pinned to
  `fr-FR` (the app renders French by default; Playwright's `en-US`
  default was failing every French-text assertion against a working
  app).
- **Partner auth journey** — login, role-restriction (a partner denied
  `/admin`, redirected to their own dashboard), logout.
- **Opportunity CRUD** — a seller can create a vehicle opportunity
  draft and see it on their dashboard; can edit an existing draft and
  see the change reflected.
- **Partner self-service signup** — the real `SignupForm`, not an
  admin-API-provisioned identity; reaches the dashboard on success.
- **CI wiring** — `.github/workflows/pr-build.yml` runs the Playwright
  suite automatically on every PR against Salma's disposable Supabase
  project (ADR-005), plus typecheck (blocking), semgrep, and a
  dependency audit (both warning-only pending a triaged baseline).
  Gitleaks and the build step were already in place.
- **Regression-catch proven** — an intentional regression was
  introduced on a throwaway branch, confirmed CI/E2E caught it (red
  run), then reverted (green run). Both run links saved in
  `evidence/phase4-regression-catch-evidence.txt`.
- **Buyer request journey** (anonymous visitor → qualified lead, the
  money path) — resumed and merged once the disposable project's
  `rate_limit_check` gap (see Findings below) was fixed.
- **Smoke gate** (`e2e/tests/smoke/` + `smoke.yml`, the 5 critical
  journeys: login, dashboard loads, create the primary record, the
  buyer-request money path, logout) — merged, all 5 journeys green.
- **Full CRUD coverage for all four core entities** — vehicle
  opportunities and buyer leads (seller/public-facing) plus demand
  opportunities and sale listings (staff-facing, no "create new" form
  in the UI for either — both are only created via a specific staff
  action: converting a buyer lead, or transforming a purchased
  opportunity into a listing). Edit coverage for the two staff-facing
  entities closed the last gap: sale listings via its free-text edit
  form, demand opportunities via its won/lost status transition (its
  only edit surface — it has no free-text fields). Delete remains
  untested for every entity because no delete UI exists anywhere in
  the app despite RLS permitting it — a real, cross-entity app gap,
  out of scope for a direct GitHub fix per doctrine (needs a Lovable
  prompt).

## Findings from this phase (beyond the tests themselves)

Writing real, end-to-end tests against a real environment surfaced
several genuine gaps that unit tests or code review alone would not
have caught:

- Two reconstruction gaps in the disposable Supabase project
  (`apps/wilmet/staging-schema.sql`, built in Phase 2 without
  production credentials): the `ref_vehicle_categories`/
  `ref_vehicle_types` tables were empty, and the `rate_limit_check`
  database function was missing entirely even though the table it
  reads/writes existed. Both are the same root cause — an incomplete
  reconstruction, not a real app bug — and both are now fixed or in
  the process of being fixed in that file.
- A real app gap: `checkRateLimit()` needs `SUPABASE_SERVICE_ROLE_KEY`
  to reach the database at all; without it, public endpoints
  (`/api/public/buyer-leads`, `/api/public/signup-check`) throw and
  surface as opaque HTML 500s instead of the app's normal JSON error
  responses. Added to CI; the same variable would need to be set in
  any real deployment.
- A real app gap, documented but not fixed (Lovable's domain per
  doctrine): there is no delete UI anywhere for a draft
  `vehicle_opportunity`, despite RLS permitting it.
- A CI/pipeline bug, not an app bug: killing a backgrounded `bun run
dev` process for cleanup was clobbering the step's real exit code
  even when every test passed, masking genuine results as false
  failures. Fixed with explicit exit-code capture.
- A test-code bug, not an app bug: a bare-string label match
  (`"Nom"`) silently absorbed a fill meant for a different field
  because it substring-matched `"Prénom"` too. Fixed by anchoring the
  regex; documented so it isn't rediscovered a third time.
- An environment-only finding, not an app bug: Supabase's own
  built-in email sender enforces a low, project-wide send quota,
  which the signup journey was hitting on repeated CI runs. Resolved
  by disabling "Confirm email" on the disposable project (a config
  change on Salma's own testing project, not a code fix) and
  rewriting the test's assertion to match the resulting immediate-
  session behavior.

Full detail for each of these is in the corresponding
`apps/wilmet/evidence/phase4-*.txt` file.

## Concurrent, unrelated incident

A separate, higher-priority issue surfaced during this phase: the
**live** Wilmet app (Lovable-managed production, not the disposable
testing project used above) started reporting missing Supabase
environment variables in the browser console, with most buttons
failing. Diagnosis ruled out a stalled Lovable↔GitHub sync (the
pattern from ADR-001) — Lovable is fully caught up on `main`. Lovable's
own investigation (three prompts) found the real cause: its build
pipeline deduplicates against the existing artifact when it sees no
_source_ change, so two "fresh build" attempts silently republished
the same stale JS bundle rather than actually recompiling with the
corrected build-time environment variables. Fix landed as a deliberate
exception (ADR-006): a trivial, non-functional source diff to
`src/routes/__root.tsx` to force a genuine rebuild, merged via PR #46.
Whether the live preview actually cleared after Salma published it in
Lovable is still unconfirmed as of this report — tracked separately
from Phase 4/5's own acceptance criteria since it's a
production-environment incident, not a testing-pipeline gap, and
neither phase was ever actually blocked by it in the end (see Phase 5
below for why the load tests didn't need it resolved either).

## Phase 5 — Load and performance testing

**Goal:** confirm the app scales, not just works (EXECUTION-PLAN.md
section 12).

The prior assumption that Phase 5 was blocked on the concurrent
Lovable incident above didn't hold up once examined: Phase 4's own
Playwright CI step already proved a safe execution pattern — start the
app's dev server inside the CI job itself, pointed at the disposable
Supabase project, hit `127.0.0.1` only. That never touches Lovable or
production and isn't affected by the build-cache incident at all. New
workflow `k6-disposable-load-test.yml` (`workflow_dispatch`) reuses
that pattern.

- **Baseline** (`pipeline/load/k6-baseline.js`, 5 VUs / 2 min against
  `/` and `/chercher-un-vehicule/`): **PASS**, p95 ≈ 78–109ms across
  two runs, 0% errors.
- **3×-peak ramp** (`pipeline/load/k6-load.js`, ramping to 150 VUs
  against the same two routes): **RED**, p95 = 957ms, but zero request
  failures. Root-caused before treating it as an app defect: neither
  route actually queries the database under a plain HTTP client (the
  reference-data fetch is client-side-only, firing after hydration in
  a real browser — confirmed by reading the route/root code, no SSR
  loader or query-dehydration exists anywhere in this app). The
  measured latency is Vite dev-mode SSR render cost under a shared
  2-core CI runner, not evidence of a database or query problem. This
  corrected an unverified assumption from the Phase 5 prep evidence
  that the route was "database-backed."
- **Direct database-read check** (`pipeline/load/k6-db-read.js`, new —
  added specifically because the ramp test above couldn't reach the
  database at all): hits PostgREST directly with the exact
  select/filter/order clauses the app's own `getReferenceData` uses,
  ramping to 60 concurrent connections. **PASS**: p95 = 168ms, 0%
  errors across 12,236 requests. This is the layer Phase 5 actually
  exists to verify, and it meets the plan's bar with no fix needed.

**Verdict:** the database layer meets the acceptance bar (p95 < 500ms,
error rate < 1% under load). No missing indexes, full-table scans, or
query-level hotspots were found in the reference-data reads exercised.

**Residual risk, carried forward rather than resolved:** whether the
deployed application itself (server-side rendering under real
concurrent users, not just the database) meets this bar. This repo has
no way to build or serve a production build locally — `vite.config.ts`
targets Cloudflare Workers via Nitro by default, and there is no plain
Node server this project can run outside of Vite's dev mode. That
question can only be answered against a real deployed environment,
which doesn't exist for Wilmet outside of Lovable's production-backed
hosting. Documented here for the final report rather than silently
dropped — belongs in the residual-risk section, not treated as a
Phase 5 blocker since Phase 5's own database-focused acceptance
criterion is met.

Full detail: `evidence/phase5-k6-execution-wiring.txt`,
`phase5-k6-baseline-run1.txt`, `phase5-k6-ramp-run1.txt`,
`phase5-k6-db-read-run1.txt`.

## Left from this report

- A Lovable prompt to add delete for every core entity (app-code gap,
  no delete UI exists anywhere despite RLS permitting it on several
  tables) — out of scope for direct GitHub fixes per doctrine.
- Confirm whether the ADR-006 nudge actually cleared the live Lovable
  preview once published (see "Concurrent, unrelated incident" above).
