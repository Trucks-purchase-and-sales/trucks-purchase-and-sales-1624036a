# Database reproducibility and migration drift

## Status

**Confirmed production-readiness defect.** The live Wilmet Supabase database and the migration history stored in Git are not yet a fully reproducible pair.

This document records the evidence and the safe reconciliation procedure. It is intentionally non-destructive: no live schema object or application data is modified by this document.

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

The Git repository contains only the recent corrective migrations. It does not contain the historical migrations that originally created the complete schema above. Therefore a new environment cannot currently be proven reconstructable from `supabase/migrations` alone.

## Read-only re-verification on 2026-08-19

GitHub `main` and the Lovable staging project are synchronized at:

`5c02ddeec2297a14d5a61cc31d4786505a0038d8`

The Lovable preview is rendering successfully at this revision, and the project database is enabled.

The remote `supabase_migrations.schema_migrations` ledger still records migrations only through:

`20260818132646`

However, Git now contains five later database migrations whose intended effects are present in the connected staging database:

1. `20260818142500_vehicle_photo_bucket_hardening.sql`
   - `vehicle-photos` remains private;
   - object size limit is `10485760` bytes (10 MiB);
   - MIME allowlist is exactly JPEG, PNG, WebP, HEIC and HEIF.

2. `20260818145500_phase1b_authorization_correction.sql`
   - `private.can_read_pipeline_record(...)` contains the reviewed role-gated direct-assignment logic;
   - pipeline helper execution is unavailable to `anon` and available to `authenticated` and `service_role` as intended.

3. `20260818155500_partner_workflow_integrity_guard.sql`
   - legacy permissive seller-owner UPDATE policy is absent;
   - `opp_partner_update` and draft-isolating `opp_select_scoped` match the reviewed rules;
   - `trg_opp_partner_column_guard` is `BEFORE INSERT OR UPDATE`;
   - `public.tg_opp_partner_column_guard()` contains the reviewed seller state machine, protected-field handling, purchase-pool normalization and explicit `service_role` bypass.

4. `20260818160500_profile_self_update_guard.sql`
   - `trg_profile_self_update_guard` exists as a `BEFORE UPDATE` trigger on `public.profiles`;
   - `public.tg_profile_self_update_guard()` protects the reviewed identity, account-state, authorization, commission and referral fields while allowing trusted `service_role` administration.

5. `20260818162000_dossier_parent_scope.sql`
   - broad `opp_docs_internal_all` / `opp_decisions_internal_all` policies are absent;
   - documents and decisions each have explicit scoped SELECT / INSERT / UPDATE / DELETE policies;
   - SELECT derives authorization from the parent opportunity with `can_read_pipeline_record(...)` and permits `company_management` as read-only;
   - writes derive authorization from `can_write_pipeline_record(...)`, exclude `company_management`, and reject draft-parent exposure.

This is therefore **migration-history drift, not five unapplied security fixes**: the reviewed SQL state is present remotely, but Supabase migration history does not record the corresponding timestamps.

## Supported ledger reconciliation

Do not insert rows manually into Supabase's migration tracking table.

After authenticating the Supabase CLI against the correct Wilmet project, reconcile the already-applied migrations with the supported repair command, in timestamp order:

```bash
supabase migration list

supabase migration repair 20260818142500 --status applied
supabase migration repair 20260818145500 --status applied
supabase migration repair 20260818155500 --status applied
supabase migration repair 20260818160500 --status applied
supabase migration repair 20260818162000 --status applied

supabase migration list
```

`migration repair --status applied` changes migration history only. It is appropriate here because the intended database effects have been independently re-verified as already present in staging.

### Safety gate

Before running any repair command:

1. Verify the CLI is linked to the Wilmet staging Supabase project, not another environment.
2. Confirm the remote ledger still ends at `20260818132646`; stop and re-audit if it has changed unexpectedly.
3. Re-run the read-only verification for all five migrations above.
4. Confirm the five Git migration files are unchanged from the reviewed `main` revision.
5. Capture `supabase migration list` before repair as evidence.
6. Run the repairs in timestamp order.
7. Capture `supabase migration list` after repair and verify all five timestamps are now recorded exactly once.
8. Re-run the read-only schema checks after repair to prove that history reconciliation did not alter application schema state.

Do **not** use `supabase db reset --linked` against the live/cloud database.

## Missing historical baseline

Repairing the ledger rows does not solve the larger reproducibility problem: the repository still lacks the schema history that predates the first committed migration.

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

This defect can be closed only when all of the following are true:

- [ ] all five already-applied migrations appear in the remote migration ledger;
- [ ] the before/after migration-list evidence is retained;
- [ ] Git contains a reviewed authoritative baseline for the pre-existing schema;
- [ ] a clean isolated database can be created from the baseline plus migrations;
- [ ] schema/catalog comparison shows no unexplained drift;
- [ ] authenticated RLS/security regression tests pass on the rebuilt environment;
- [ ] storage configuration is reproduced and verified;
- [ ] the restore procedure and evidence are retained in the repository.

## Engineering principle

The live database must not be the only place where the application architecture exists. Git must contain enough versioned infrastructure to rebuild, review, test and recover Wilmet without reverse-engineering production during an incident.
