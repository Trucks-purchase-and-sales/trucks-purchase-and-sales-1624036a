# ADR-005: Rebuild the staging schema from catalog queries, not pg_dump

Date: 2026-08-23 · Status: accepted

## Context

Phase 2's active-probing step (9.2) needs a staging Supabase project so
RLS behavior can be tested by actually hitting the REST API — the plan
explicitly forbids running these tests against production (§2, Rule 4:
staging isolation). Setting this up turned out to have two additional
complications not anticipated by the original plan:

1. Wilmet's database lives entirely inside Lovable Cloud — Salma has no
   separate Supabase.com account/project she can log into and use a
   "Duplicate project" or "Branch" feature on. Lovable's own project
   settings and Cloud panel (checked directly) have no equivalent
   feature either. The only self-service database tool exposed is a
   "Backups" panel for in-place point-in-time restore, not a portable
   schema export.
2. This repo's migration history is incomplete — the 24 tracked
   migration files are all incremental hardening/correction patches
   (see ADR-004 and inventory.md); the original baseline `CREATE TABLE`
   statements, several helper functions, and most trigger functions
   only ever existed in the live, untracked database.

The straightforward fix — running `pg_dump --schema-only` directly
against production — was initially agreed to with Salma (including a
plan to rotate the database password afterward as a precaution). Before
acting on that, two things changed the approach:

- Neither `pg_dump`/`psql` nor a Postgres client library were available
  locally, and installing them (e.g. via Chocolatey) would mean a real,
  system-level change to Salma's machine just for a one-time export.
- On reflection, everything actually missing (a handful of helper/
  trigger function bodies, exact column definitions, keys, enum values)
  is retrievable through the same read-only SQL-editor queries already
  used for the 9.1 RLS audit — meaning the production database password
  never needs to be requested, seen, or handled at all.

## Decision

Pulled four additional read-only catalog queries (function bodies via
`pg_get_functiondef`, `information_schema.columns`, primary/foreign
keys, and enum values — see
`apps/wilmet/evidence/phase2-rls-audit-functions.txt`) and used them,
together with the already-completed 9.1 audit's verbatim policy text,
to hand-write `apps/wilmet/staging-schema.sql`: a single SQL script
that recreates every table, every RLS policy (verbatim), every helper
function policies call, and the 4 security-relevant guard triggers.

Deliberately excluded: ~13 business-logic-only trigger functions
(reference-number generation, notification sends, computed commission,
status-history logging, quality scoring). None of them affect access
control — the actual target of 9.2's probing — and every column they
touch is nullable, so omitting them doesn't block any insert the probe
script needs to run.

## Rationale

- Matches Rule 1 (independent verification) and Rule 4 (staging
  isolation) without introducing a new risk (handling a live production
  credential) that a safer, equally-effective alternative could avoid
  entirely.
- Avoids installing new software on Salma's machine for a one-time task.
- The exclusion of non-security triggers is scoped narrowly to what
  9.2 actually tests (RLS-driven read/write outcomes via the REST API),
  not a general claim that staging is functionally complete — if a
  later phase needs full business-logic parity (e.g. testing that
  notifications fire correctly), the excluded function bodies are
  already captured in the evidence file and can be added then.

## Consequences

- `apps/wilmet/staging-schema.sql` is a hand-assembled reconstruction,
  not a `pg_dump` output — it has not been executed yet as of this
  writing. Salma still needs to create a blank Supabase project (a
  personal account, unrelated to Lovable) and run this script in its
  SQL editor before 9.2 can proceed.
- If production's schema changes before staging is created and used,
  this file will drift and need a fresh set of catalog queries re-run.
- Once staging exists, test users per role and a little synthetic seed
  data still need to be created before `pipeline/security/rls-probe.mjs`
  can run meaningfully.
