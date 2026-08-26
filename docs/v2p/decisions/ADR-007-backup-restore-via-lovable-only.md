# ADR-007: Backup/restore verification is constrained to Lovable's own panel

Date: 2026-08-26 · Status: accepted

## Context

Phase 6 (`EXECUTION-PLAN.md` §13, item 3) calls for an actual restore
test: "create a scratch Supabase project, restore the latest backup
into it, confirm data integrity" (Appendix N). This assumes account-
level access to the Supabase project — enough to create a second
project and restore a backup into it.

Checked directly with Salma: Lovable exposes **no** Supabase account
details at all for the 🟥 production project — no billing page, no plan
tier, nothing. This confirms and sharpens what ADR-005 already found
("Wilmet's database lives entirely inside Lovable Cloud — Salma has no
separate Supabase.com account/project she can log into"). The only
self-service database recovery tool that actually exists is Lovable's
own **"Backups" panel**, which ADR-005 already characterized as
**in-place point-in-time restore** — not a portable export, and not a
way to spin up a second project to restore into.

Actually exercising that in-place restore to "prove it works" would
mean rolling back the **live, real** production database to an earlier
point in time. That is a genuinely destructive action against real
user data, not a safe dry run — closer to `git reset --hard` on
production than to any of this project's other read-only or
disposable-project verification steps. It also would not fix the
current unrelated incident (the live-preview crash is a stale-JS-
bundle build-cache bug per ADR-006, not a database problem), so there
is no piggyback justification for doing it right now either.

## Decision

Do not attempt a real in-place restore against 🟥 production as part of
this internship's Phase 6 verification. Document the actual, narrower
capability that exists (Lovable's in-place PITR panel) as the backup
mechanism, and record it as **unverified by an actual restore** rather
than silently marking the plan's "restore-tested backups" acceptance
criterion as met.

If an actual restore test is ever wanted, it needs to be a deliberate,
separately-approved action by Salma (and likely her supervisors, given
the blast radius) — not something bundled into routine pipeline
verification.

## Rationale

- Matches this project's own risk posture: destructive, hard-to-reverse
  actions against real production data get a deliberate human decision,
  not an automated or routine check (`EXECUTION-PLAN.md` §2 Rule 4,
  and this session's own operating guidance on irreversible actions).
- Evidence-over-assertion: better to honestly record "backup exists,
  restore unverified" than to claim Phase 6's acceptance criterion is
  met when it structurally cannot be, given the access Lovable grants.
- Doesn't block the rest of Phase 6 — monitoring, incident plan, and
  the pre-publish checklist all stand on their own regardless of this
  one item's status.

## Consequences

- `apps/wilmet/pre-publish-checklist.md`'s backup row stays honestly
  ⚠️ rather than ✅ until Salma explicitly decides to run and observe an
  in-place restore, or until Lovable/Supabase exposes a less
  destructive verification path.
- The plan's Appendix N (`backup-restore-runbook.md`) as written
  (scratch project + portable restore) does not apply to this project
  as-is — if instantiated, it needs a note pointing to this ADR instead
  of the literal template steps.
- This is a residual risk for the final report: backups likely exist
  in some form (Lovable's panel implies it), but neither their
  retention window nor their restore fidelity has ever been verified.
