# Authoritative database baseline capture

## Purpose

Wilmet inherited a working Supabase database whose original schema predates the migrations currently stored in Git. Reconciled migration history proves which corrective migrations are now applied, but it does not prove that a new empty environment can reconstruct the pre-existing catalog.

This procedure captures a reviewable, schema-only snapshot from staging without modifying remote schema or migration history. It is the input to the separate restore drill; capture alone is not recoverability proof.

## Safety boundary

Use `.github/workflows/database-baseline-capture.yml`.

The workflow is manual and requires an explicit read-only confirmation. It deliberately uses only:

- `supabase migration list --linked`;
- `supabase db push --linked --dry-run`;
- `supabase db dump --linked --schema public,private`.

It does **not** use:

- `supabase db pull` (which can prompt to repair remote migration history);
- `supabase migration repair`;
- `supabase db push` without `--dry-run`;
- `supabase db reset --linked`;
- seed/data dumps.

Never substitute a linked reset for a restore drill. The restore target must be isolated and disposable.

## Credentials

The workflow requires protected GitHub secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
```

Use the least-privileged practical Supabase access token and the staging database password. Neither value is printed or retained in artifacts. CLI linkage metadata is removed from the runner in an `always()` cleanup step.

## Toolchain reproducibility

The workflow installs Supabase CLI `2.111.0` from the official GitHub release and verifies the Linux AMD64 archive SHA-256 before installation. Do not silently switch the version during a release candidate; upgrade it through a reviewed PR and rerun capture/restore evidence.

## Artifact contents

A successful private workflow artifact contains:

- `wilmet-schema.sql` — schema-only dump of Wilmet-owned `public` and `private` schemas;
- `migration-list.txt` — local-vs-remote migration history comparison;
- `db-push-dry-run.txt` — evidence of what the current Git migration set would attempt to apply;
- `manifest.json` — capture timestamp, commit SHA, project ref, CLI version and schema SHA-256.

The artifact contains schema/function/policy definitions and is therefore confidential engineering material even though it intentionally contains no business row data.

## Storage/Auth scope

Supabase-managed `auth` and `storage` schemas are not treated as part of the ordinary application schema dump. Wilmet must reconstruct the relevant managed-service configuration through separate evidence:

- storage bucket configuration is versioned in `supabase/config.toml`;
- custom Storage RLS policy state must be compared with the reviewed migrations/catalog verification before restore sign-off;
- hosted Auth configuration is verified separately by the sanitized Management API audit in `docs/security/hosted-auth-policy.md`.

A schema dump that omits those provider-managed controls is therefore **not** sufficient on its own for production recovery.

## Review before committing a baseline

Do not automatically commit a freshly captured dump. An engineer must first:

1. confirm `migration-list.txt` has no unexplained history mismatch;
2. confirm the dry-run has no unexpected remote mutation;
3. scan the schema dump for accidentally hard-coded credentials or environment-specific secrets;
4. compare critical RLS/functions/triggers/storage-policy expectations with staging;
5. record the dump digest and the reviewed source commit;
6. only then commit the approved baseline under a versioned recovery/baseline path.

## Restore-drill acceptance criteria

The follow-up restore drill must use an isolated Supabase/local PostgreSQL target and prove at minimum:

- schema loads from zero without manual dashboard intervention;
- all expected application tables, enums, functions, triggers and RLS policies exist;
- critical `private.*` authorization helpers resolve;
- required Storage bucket configuration and custom Storage policies are restored;
- subsequent migrations after the baseline version apply cleanly;
- catalog comparison against the captured source has no unexplained drift;
- representative authorization and application smoke tests pass against the rebuilt environment;
- restore commands, elapsed time, digest and comparison evidence are retained in Git.

Only after that restore evidence exists can the database-reproducibility P0 gate be closed.
