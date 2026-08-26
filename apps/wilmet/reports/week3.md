# Week 3 — Phase 4 progress report

_Status: started (per Phase 4's acceptance criteria — this report is
completed at the end of Phase 5, per the plan's cadence). Last
updated: 2026-08-25._

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

## In flight / parked

- **Buyer request journey** (anonymous visitor → qualified lead, the
  money path) — written, debugged through several real environment
  gaps, but its PR is deliberately parked per Salma's request rather
  than merged. Not abandoned — resuming once priorities allow.
- **Smoke gate** (`e2e/tests/smoke/` + `smoke.yml`, the 5 critical
  journeys: login, dashboard loads, create the primary record, the
  buyer-request money path, logout) — code written, pushed, and
  passing everywhere except the money-path journey. Blocked on a
  missing `rate_limit_check` database function in the disposable
  testing project (see Findings below) — paused per Salma's decision
  to hold all database-touching work until a separate, concurrent
  production incident (Lovable Cloud credits) resolves.

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
*source* change, so two "fresh build" attempts silently republished
the same stale JS bundle rather than actually recompiling with the
corrected build-time environment variables. Unresolved as of this
report — paused pending more Lovable credits. Tracked separately from
Phase 4's own acceptance criteria since it's a production-environment
incident, not a testing-pipeline gap.

## Left for Phase 4 / carried into Phase 5

- CRUD coverage for the remaining core entities (sale listings, demand
  opportunities, staff-side buyer-lead management) — currently zero
  coverage.
- Resolve and merge the parked buyer-request-journey PR.
- Resolve and merge the smoke-gate PR once the disposable project's
  `rate_limit_check` function is confirmed live (blocked on the
  concurrent incident above, per Salma's call to pause database work
  until then).
- A Lovable prompt to add delete for draft opportunities (app-code
  gap, out of scope for direct GitHub fixes per doctrine).
