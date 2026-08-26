# ADR-008: Verify hosted Auth config via Lovable's dashboard, not the Management API

Date: 2026-08-26 · Status: accepted

## Context

`.github/workflows/supabase-auth-audit.yml` and
`.github/workflows/database-baseline-capture.yml` both require a
`SUPABASE_ACCESS_TOKEN` (Supabase Management API personal access
token) as a GitHub secret. Triggering `supabase-auth-audit.yml` for
real (2026-08-26) failed immediately: `Missing SUPABASE_ACCESS_TOKEN`.

Checked directly with Salma why: generating that token requires a
login at supabase.com itself, not through Lovable. Confirmed — Lovable
is the only access she has to this project (same root constraint
already documented in `ADR-007` for the backup/restore question). Both
of these workflows were apparently written and documented
(`docs/security/hosted-auth-policy.md`) on the assumption that a
Management API token would become available, but that assumption was
never actually validated against what Salma can obtain — it can't be.

However: Lovable's own project dashboard (Cloud → Users → Auth
settings) turns out to expose a real Authentication Settings panel —
sign-in methods, password policy, email confirmation behavior, HIBP
breach-password checking, and more — even though Lovable's dashboard
shows nothing about Supabase billing, plan tier, or infrastructure.
This is close to the plan's own _original_ intended verification
method for this exact item (`EXECUTION-PLAN.md` §10.2: "Auth
configuration (Supabase dashboard, capture screenshots)") — the plan
already anticipated screenshots as valid evidence, before this
project's later automated Management-API workflow was built on top of
that as a stretch goal.

## Decision

Treat `supabase-auth-audit.yml` and `database-baseline-capture.yml` as
**currently non-functional given Salma's access** — not a bug to fix,
a structural limitation to document (same category as ADR-007).
Verify hosted Auth configuration by screenshotting Lovable's
Authentication Settings panel instead, checked by hand against the
exact blocking/advisory criteria already listed in
`docs/security/hosted-auth-policy.md`. First real pass done
2026-08-26 — see `apps/wilmet/evidence/phase6-hosted-auth-manual-review.txt`.

## Rationale

- Matches this project's own precedent (ADR-007): document a real
  access constraint rather than treat a workflow's existence as proof
  the thing it checks has been verified.
- The manual method isn't a downgrade in evidentiary value here — it's
  the plan's own original method, and it already surfaced a real,
  actionable finding (F-010: hosted minimum password length is 8, not
  the required ≥15) that the automated workflow, had it ever run,
  would also have caught. The verification substance is preserved;
  only the mechanism changed.
- Doesn't block the rest of Phase 6 or the pre-publish checklist —
  this row now has a real (if manual, if partial) evidence trail
  instead of "workflow exists, never run."

## Consequences

- `apps/wilmet/pre-publish-checklist.md`'s auth-hardening row points to
  the manual review evidence file, not the automated workflow, going
  forward — re-screenshot before each real publish rather than
  re-running a workflow that cannot succeed.
- `supabase-auth-audit.yml` and `database-baseline-capture.yml` stay in
  the repo (harmless, and would start working immediately if Salma
  ever gets direct supabase.com access) but should not be treated as
  live pipeline steps until then.
- The manual review's first pass is partial — several blocking fields
  (CAPTCHA, anonymous sign-ins, unverified-email sign-in, refresh-token
  rotation, manual linking) weren't visible in the screenshots taken so
  far and need a follow-up pass. Tracked in the evidence file, not
  glossed over.
