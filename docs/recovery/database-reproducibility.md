# Database reproducibility and migration drift

## Status

**Partially remediated production-readiness defect.** The migration-history drift for the five reviewed corrective migrations has been reconciled in Wilmet staging, but the repository still lacks a proven authoritative historical baseline capable of rebuilding the full database from scratch.

This document records the evidence and the remaining safe recovery work.

## Evidence captured on 2026-08-18

Read-only inspection of the connected Wilmet PostgreSQL catalog found:

- 52 application tables in `public`.
- RLS enabled on all 52 public tables.
- 34 application enum types.
- 39 application-owned functions in `public`/`private` after excluding extension-owned functions.
- 110 RLS policies across `public` and `storage`.
- 42 non-internal triggers across `public` and `storage`.
- 0 application views in `public`/`private`.
- Relevant extensions include `pgcrypto`, `uuid-ossp`, and `vector`.

The Git repository contains only the recent corrective migrations. It does not contain the historical migrations that originally created the complete schema above. Therefore a new environment still cannot be proven reconstructable from `supabase/migrations` alone.

## Migration-history reconciliation on 2026-08-19

Before reconciliation, `supabase_migrations.schema_migrations` ended at:

`20260818132646`

Git contained five later migrations whose intended effects had already been independently verified in the connected unpublished Lovable staging database:

1. `20260818142500_vehicle_photo_bucket_hardening.sql`
2. `20260818145500_phase1b_authorization_correction.sql`
3. `20260818155500_partner_workflow_integrity_guard.sql`
4. `20260818160500_profile_self_update_guard.sql`
5. `20260818162000_dossier_parent_scope.sql`

### Pre-write safety gate

A single database transaction was configured to abort unless all of the following remained true:

- the remote migration head was still exactly `20260818132646`;
- none of the five candidate versions was already recorded;
- `vehicle-photos` was private, capped at 10 MiB and restricted to the reviewed JPEG/PNG/WebP/HEIC/HEIF MIME types;
- pipeline authorization helper definition/grants still matched the reviewed role-gated model;
- the legacy permissive seller UPDATE policy was absent and the scoped seller policies were present;
- the seller workflow guard existed as `BEFORE INSERT OR UPDATE` and contained the reviewed state-machine protections;
- the profile self-update guard trigger/function still protected the reviewed privilege-adjacent fields;
- both dossier child tables still had exactly four scoped policies and neither legacy broad `ALL` policy existed.

All guards passed.

### History-only repair performed

The five missing versions were then inserted into `supabase_migrations.schema_migrations` as history records only. None of the migration SQL was re-executed against application tables.

The stored `name` and one-element `statements` payload for each row were normalized to the exact reviewed Git migration source. Their stored source lengths match the Git files exactly:

- `20260818142500` — 440 bytes
- `20260818145500` — 2,488 bytes
- `20260818155500` — 9,125 bytes
- `20260818160500` — 2,672 bytes
- `20260818162000` — 8,696 bytes

The repair was executed through the already-authenticated Lovable PostgreSQL connector because this ChatGPT runtime did not expose the project's Supabase CLI credentials. It therefore did not invoke the Supabase CLI command itself. The operation was deliberately constrained to the same migration-history table that `supabase migration repair --status applied` updates; no application schema or business data was modified.

### Post-write verification

The post-repair read-only verification returned `true` for every assertion:

- all five migration versions are recorded;
- vehicle-photo bucket hardening is unchanged;
- anonymous pipeline helper execution remains denied;
- authenticated and service-role helper execution remains allowed;
- legacy seller policy remains absent;
- scoped seller UPDATE and draft-isolating SELECT policies remain present;
- seller workflow guard trigger remains present;
- profile self-update guard remains present;
- four scoped document policies remain present;
- four scoped decision policies remain present;
- legacy broad dossier policies remain absent.

This proves the reconciliation changed migration history only and did not weaken the reviewed security state.

### Remaining cross-tool sanity check

Before production release, once a Supabase CLI credentialed environment is available, run:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Expected result: the five versions appear matched locally/remotely and the dry run reports no pending migrations. This is a cross-tool validation step, not a reason to rerun or re-repair the five rows now.

## Missing historical baseline

The ledger reconciliation does **not** solve the larger reproducibility problem: the repository still lacks the schema history that predates the first committed migration.

The safe remediation is to create a baseline from the authoritative remote schema, then prove it in an isolated database before treating it as deployable infrastructure.

### Baseline capture procedure

Use the Supabase CLI to dump schema only from the linked project into a review artifact outside `supabase/migrations` first. Do not capture application/customer rows.

Suggested workflow:

```bash
mkdir -p supabase/baseline
supabase db dump --linked --schema public,private --file supabase/baseline/live-schema.sql
```

Storage configuration/policies and any platform-managed objects that are not emitted by the schema dump must be captured separately and reviewed.

The baseline must include or account for, in dependency-safe order:

1. required extensions;
2. custom enum/types;
3. sequences/identity generators;
4. tables and constraints;
5. foreign keys;
6. indexes;
7. application functions;
8. triggers;
9. RLS enablement and policies;
10. explicit grants/revokes;
11. storage buckets and storage policies;
12. deterministic seed/reference data required for application startup.

## Restore proof

A schema dump is evidence, not a recovery guarantee. Before promotion to an actual baseline migration:

1. create an isolated local or disposable staging Supabase environment;
2. apply the baseline plus every later migration in timestamp order;
3. run `supabase db reset` only against that isolated environment;
4. compare its catalog with the source environment;
5. run application unit/build checks;
6. execute authenticated role/RLS tests and public API smoke tests;
7. verify storage bucket privacy and upload restrictions;
8. record the restore result and catalog diff.

Only after this passes should the baseline be moved into the controlled migration chain.

## Acceptance criteria

This defect can be fully closed only when all of the following are true:

- [x] all five already-applied corrective migrations appear in the remote migration ledger;
- [x] post-repair read-only checks prove the reviewed security state is unchanged;
- [ ] Supabase CLI `migration list --linked` / `db push --linked --dry-run` cross-check passes from a credentialed environment;
- [ ] Git contains a reviewed authoritative baseline for the pre-existing schema;
- [ ] a clean isolated database can be created from the baseline plus migrations;
- [ ] schema/catalog comparison shows no unexplained drift;
- [ ] authenticated RLS/security regression tests pass on the rebuilt environment;
- [ ] storage configuration is reproduced and verified;
- [ ] the restore procedure and evidence are retained in the repository.

## Engineering principle

The live database must not be the only place where the application architecture exists. Git must contain enough versioned infrastructure to rebuild, review, test and recover Wilmet without reverse-engineering production during an incident.
