# Database reproducibility and migration drift

## Status

**Confirmed production-readiness defect.** The live Wilmet Supabase database and the migration history stored in Git are not yet a fully reproducible pair.

This document records the evidence and the safe reconciliation procedure. It is intentionally non-destructive: no live schema object or production data is modified by this document.

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

## Migration-ledger drift

The remote `supabase_migrations.schema_migrations` ledger currently records migrations through:

`20260818132646`

Git also contains these later migration files:

- `20260818142500_vehicle_photo_bucket_hardening.sql`
- `20260818145500_phase1b_authorization_correction.sql`

Read-only inspection confirms the effects of both files are already present remotely:

- `vehicle-photos` is private, limited to 10 MiB and the intended image MIME types.
- the corrected scoped pipeline authorization policies are active.

This is therefore **history drift, not an unapplied security fix**: the SQL state is present, but the Supabase migration ledger does not record those two timestamps.

## Supported ledger reconciliation

Do not insert rows manually into Supabase's migration tracking table.

After authenticating the Supabase CLI against the correct Wilmet project, reconcile the two already-applied migrations using the supported repair command:

```bash
supabase migration repair 20260818142500 --status applied
supabase migration repair 20260818145500 --status applied
supabase migration list
```

`migration repair --status applied` updates migration history only. It must be used here **because the migration SQL has already been independently verified as present in the remote state**.

### Safety gate

Before running either repair command:

1. Verify the CLI is linked to the Wilmet Supabase project, not another environment.
2. Re-run the read-only checks for the bucket configuration and authorization policies.
3. Confirm both Git migration files are unchanged from the reviewed commits.
4. Capture `supabase migration list` before and after repair as evidence.

Do **not** use `supabase db reset --linked` against the live/cloud database.

## Missing historical baseline

Repairing the two ledger rows does not solve the larger reproducibility problem: the repository still lacks the schema history that predates the first committed migration.

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

- [ ] the two already-applied security migrations appear in the remote migration ledger;
- [ ] Git contains a reviewed authoritative baseline for the pre-existing schema;
- [ ] a clean isolated database can be created from the baseline plus migrations;
- [ ] schema/catalog comparison shows no unexplained drift;
- [ ] authenticated RLS/security regression tests pass on the rebuilt environment;
- [ ] storage configuration is reproduced and verified;
- [ ] the restore procedure and evidence are retained in the repository.

## Engineering principle

The live database must not be the only place where the application architecture exists. Git must contain enough versioned infrastructure to rebuild, review, test, and recover Wilmet without reverse-engineering production during an incident.
