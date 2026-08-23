# ADR-004: Start Phase 1 inventory before Phase 0.5 sign-off closes

Date: 2026-08-23 · Status: accepted

## Context

The plan (§7A, acceptance) requires Salma to personally preview the app and
sign off that it is fully functional before Phase 1 (engineering) begins —
a deliberate gate to avoid building a week of security work on a foundation
with undiscovered functional wiring defects.

That gate is currently blocked: the vehicle-search page fails to load
reference data and sign-up crashes to a generic error, both traced (via
browser console) to `[Supabase] Missing Supabase environment variable(s)`.
This is a Lovable Cloud build/publish configuration issue — the app's own
Supabase secrets exist in Lovable Cloud, but weren't available at the moment
the standalone preview and production builds were last compiled, and
Vite's `VITE_*` variables are baked into the bundle at build time, not read
live afterward. Two Lovable-side fix attempts so far have not resolved it;
credits are exhausted until ~2026-08-24 (9-hour wait from 2026-08-23).

Salma asked whether it's safe to start Phase 1 now rather than wait idle for
credits, given the blocker is infra/config, not app code.

## Decision

Start the parts of Phase 1 that are pure static analysis — reading the
application code, the Supabase schema (`src/integrations/supabase/types.ts`),
and the migration history directly — before the Phase 0.5 sign-off gate
formally closes. Produced now: `apps/wilmet/inventory.md`,
`apps/wilmet/threat-model.md`.

Explicitly **not** closed yet: the Phase 0.5 acceptance checklist item
"Salma personally previews the app and signs off that it is fully
functional." That checkbox stays open until the Supabase env-var fix is
confirmed working on the actual published site. The final functional
walkthrough (§7A.4) and smoke-test seeding (§7A.6) — which require a working
live app to click through — are deferred, not skipped.

## Rationale

- The blocking bug throws before any Supabase query executes (a client-init
  guard on missing env vars), so it has no relationship to table schema,
  RLS policies, roles, or routes — the exact material Phase 1's inventory
  and threat model are built from. None of that analysis will need to be
  redone once the env-var fix lands.
- Per plan doctrine (Rule 8, decisions are logged), this sequencing
  deviation is being recorded rather than silently reordering the phases.
- The gate itself is not being waived: no Phase 1 *engineering* work (RLS
  audit, active probing, hardening) starts, since the plan explicitly
  reserves probing/auditing for Phase 2 against a properly isolated staging
  environment (Rule 4) — only the documentation/inventory groundwork moves
  earlier.

## Consequences

- `apps/wilmet/inventory.md` and `apps/wilmet/threat-model.md` exist ahead
  of the formal Phase 0.5 close-out; both should be spot-checked once the
  live app works, in case anything in the interaction map or defect log
  from the eventual full walkthrough (§7A.4) surfaces a route, table, or
  role not captured here.
- Phase 1's own acceptance line ("staging identified") and step 8.4
  (provisioning staging) still require Salma's Supabase account access —
  not started by this ADR.
- The threat model surfaced a real blind spot independent of the database
  bug: roughly 38 of 52 tables (including `user_roles`, `commission_rules`,
  `audit_logs`) have no `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`
  statement anywhere in the 24 tracked migrations, meaning their RLS state
  cannot be confirmed from the repo alone. This is flagged as the top
  priority for Phase 2 (§9.1, "Audit RLS by hand"), not resolved by this
  ADR.
