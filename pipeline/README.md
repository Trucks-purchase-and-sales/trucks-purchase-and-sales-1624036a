# V2P — Vibecoded-to-Production pipeline

A reusable hardening pipeline for a Lovable-generated app backed by
Supabase: independent security verification, regression/E2E testing,
load testing, and production-ops documentation — built once against
Wilmet (see `docs/v2p/EXECUTION-PLAN.md` for the full plan this
pipeline implements), designed from the start to drop into the next
Lovable app with configuration changes only, not a rewrite.

This file is the "apply V2P to a new app" guide. If you're looking for
Wilmet's own results, see `apps/wilmet/` and `docs/v2p/` instead — this
directory (`pipeline/`) is the app-agnostic product itself.

## Prerequisites

- A Lovable project already exported to GitHub (Lovable can only
  **export** to a new repo — it cannot import an existing one; see
  `docs/v2p/EXECUTION-PLAN.md` §3 if the connection looks broken).
- A **disposable** Supabase project you personally control (not the
  Lovable-managed one) for RLS probing, security E2E, and load
  testing. See "A real constraint, not a Wilmet quirk" below for why
  this is almost always necessary, not optional.
- GitHub Actions enabled on the repo, with the ability to add secrets.

## Pipeline in 6 commands

Once `pipeline.config.json` is filled in and secrets are set (steps 1-2
below), the day-to-day loop is:

```bash
# 1. Independent security audit
psql "$STAGING_DB_URL" -f pipeline/security/rls-audit.sql
node pipeline/security/rls-probe.mjs
bash pipeline/security/secret-scan.sh
TARGET_URL="$STAGING_APP_URL" node pipeline/security/headers-check.mjs

# 2. Static wiring check (before clicking anything)
node pipeline/functional/wiring-scan.mjs

# 3. Regression suite (once instantiated from pipeline/testing/)
npx playwright test --config=pipeline/testing/playwright.config.ts

# 4. Load test (config-driven — see step 6 below for required env vars)
k6 run pipeline/load/k6-baseline.js
k6 run pipeline/load/k6-load.js
```

Everything below explains how to get from a fresh Lovable export to
being able to run those six commands for real.

## Step 1 — copy the pipeline into the new repo

Copy three directories from this repo into the new one, unchanged:

```
pipeline/
.github/workflows/     (the ones that call pipeline/ scripts, not Wilmet's own e2e/-specific ones)
docs/v2p/               (EXECUTION-PLAN.md and the ADR template — the ADRs themselves are Wilmet's history, not required)
```

## Step 2 — fill in config and secrets

Copy `pipeline/pipeline.config.example.json` to `pipeline/pipeline.config.json`
and fill in every `<placeholder>`. This file holds **non-secret**
values only (URLs, table names, role names, thresholds) — real
credentials never go here.

Secrets go in `.env.local` (git-ignored) locally and GitHub Actions
secrets in CI. At minimum you'll need, for the disposable project:

- a Supabase URL + anon key (read-only probing, E2E against a live
  dev server)
- a service-role key (test-user provisioning, seeding preconditions,
  cleanup) — **never** committed, never in client code

## Step 3 — intake

Fill in `pipeline/templates/inventory.template.md` and
`pipeline/templates/threat-model.template.md` for the new app (copy
them into your own `apps/<name>/` instance directory first, matching
this repo's own layout — see `apps/wilmet/inventory.md` and
`threat-model.md` for a filled-in example). Run Lovable's own built-in
scan and record the findings as input, not proof (it checks that RLS
policies _exist_, not that they're actually restrictive).

## Step 4 — independent security verification

Run, against the **disposable** project, never the Lovable-managed one:

- `pipeline/security/rls-audit.sql` — every RLS policy, flagged if any
  is `USING (true)` on a non-reference table.
- `pipeline/security/rls-probe.mjs` — active anon/authenticated probing
  from the outside (`PROBE_TABLES` env var or `--tables <file>`).
- `pipeline/security/secret-scan.sh` — greps the built bundle and, if
  `gitleaks` is available, full git history.
- `pipeline/security/headers-check.mjs` — CSP/HSTS/X-Frame-Options/etc.
  against a deployed URL (`TARGET_URL` env var).

Fix any Critical/High finding, retest, and log it in
`findings-register.csv` (`pipeline/templates/findings-register.template.csv`)
before moving on — a finding is never closed without retest evidence.

## Step 5 — regression/E2E

Instantiate `pipeline/testing/journey.template.pw.ts` into a real spec
per critical journey (signup, login, create/edit/delete each core
entity, an authz-denial case) — named `.pw.ts`, not `.spec.ts`, on
purpose; see that file's own header comment if your setup doesn't have
the same constraint and you'd rather use `.spec.ts`.
`pipeline/testing/playwright.config.ts` points at `BASE_URL` (default
`http://localhost:5173`) — in CI, start a real dev server bound to the
disposable project first (see "A real constraint, not a Wilmet quirk"
below for why this matters more than it sounds like it should).

## Step 6 — load testing and production ops

Run `pipeline/load/k6-baseline.js` then `k6-load.js`, both of which now
require explicit config, not defaults:

| Env var           | Required | Meaning                                                                                                |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `K6_BASE_URL`     | yes      | the target origin, no path/query/credentials                                                           |
| `K6_TARGET_LABEL` | yes      | `local` (bare localhost/127.0.0.1) or `staging` (bare HTTPS) — production is intentionally unsupported |
| `K6_ROUTES_JSON`  | yes      | `[{"path":"/","name":"label"}, ...]` — which routes to hit                                             |
| `K6_APP_NAME`     | no       | used in the User-Agent header, defaults to `v2p-app`                                                   |

If load-testing real app routes can't reach the database at all
(client-side-only data fetching is common in SPA-style Lovable apps —
this is exactly what happened on Wilmet, see
`apps/wilmet/evidence/phase5-k6-ramp-run1.txt`), use
`pipeline/load/k6-db-read.js` instead: it hits PostgREST directly,
decoupled from the app server entirely.

| Env var                                    | Required | Meaning                                         |
| ------------------------------------------ | -------- | ----------------------------------------------- |
| `K6_SUPABASE_URL` / `K6_SUPABASE_ANON_KEY` | yes      | the disposable project                          |
| `K6_DB_TARGET_LABEL`                       | yes      | must be exactly `disposable`                    |
| `K6_DB_PROBES_JSON`                        | yes      | `[{"name":"label","path":"/rest/v1/..."}, ...]` |

Then: instantiate `pipeline/templates/incident-plan.template.md`,
`pre-publish-checklist.md`, and `backup-restore-runbook.md` for the
new app, and dry-run the checklist once before the first real publish.

## A real constraint, not a Wilmet quirk

Applying this pipeline to Wilmet surfaced a pattern likely to recur on
any Lovable-managed app, not something specific to this one:

**Lovable typically does not expose direct Supabase account access** —
no Management API token, no database password, no billing/plan-tier
visibility (see `docs/v2p/decisions/ADR-005`, `ADR-007`, `ADR-008`).
Concretely, this means:

- You almost certainly can't run a Management-API-based audit workflow
  against the Lovable-managed project directly. Wilmet's own attempt
  at this (`supabase-auth-audit.yml`) failed immediately for exactly
  this reason. The workaround that worked: check what the Lovable
  dashboard itself exposes (often more than you'd expect — Wilmet's
  Auth settings panel, for instance) and treat that as the real
  verification surface, screenshots and all.
- A real backup-restore test is often not safely possible at all — the
  only mechanism may be an in-place restore against the live database,
  which is too destructive to use as a routine check. Don't force this
  into a green checkmark; document it as a named residual risk
  (`ADR-007` is the worked example).
- **You will likely need a personally-owned, disposable Supabase
  project** to do any of the actually-useful verification (RLS
  probing, security E2E, load testing) — not the Lovable-managed one.
  Reconstructing that project's schema from scratch (rather than a
  direct `pg_dump`, which the same access constraint usually rules
  out) is itself real work; `docs/v2p/decisions/ADR-005` and
  `apps/wilmet/staging-schema.sql` are the worked example of how to do
  this from read-only catalog queries alone.
- For load testing specifically, "a working dev server started fresh
  inside the CI job, pointed at the disposable project" is usually the
  only safe target that actually exercises the database — there is
  typically no separate _hosted_ staging deployment of the frontend to
  point at, only Lovable's own production-backed hosting.

None of this means the pipeline doesn't work on a constrained-access
app — it means budget for these workarounds up front rather than
being surprised by them partway through Phase 2 or Phase 5.

## Dry-run record

Portability hasn't been exercised against a second target yet. Once it
has, the record will live at `apps/wilmet/evidence/phase7-dry-run.txt`
and be linked from here.
