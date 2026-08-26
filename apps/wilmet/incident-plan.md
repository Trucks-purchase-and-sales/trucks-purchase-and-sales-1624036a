# Incident Response Plan — Wilmet Trucks

_Instantiated from `pipeline/templates/incident-plan.template.md`
(EXECUTION-PLAN.md Appendix M) for Wilmet specifically. Written
2026-08-26._

## Context this plan operates in

Wilmet is a two-sided marketplace app (Lovable + Supabase, no
traditional backend) with a small, non-technical operating team:
**Salma Anhichem** owns the project day-to-day; **Hassan Boussif** and
**Zakaria Bouchaanana** are internship supervisors and the escalation
path for anything beyond Salma's own authority (business-impact calls,
legal/GDPR notification decisions, budget for paid tooling). There is
no dedicated on-call engineer — incident response here means "Salma
follows this runbook, escalates to the supervisors when a decision
exceeds what she can decide alone, and uses this repository's already-
built pipeline tooling to detect, contain, and verify the fix."

Two databases exist and must never be confused mid-incident (the
convention used throughout this project's docs):

- 🟦 **Disposable/staging** — Salma's personal Supabase project
  (`docs/v2p/decisions/ADR-005`). Synthetic data only. Safe to break,
  reset, or rebuild from `apps/wilmet/staging-schema.sql`.
- 🟥 **Lovable/production** (Supabase project ref `srjnljpjwzhtbdnhksux`,
  `supabase/config.toml`) — the real app, real user data. Read-only
  inspection only, per this project's own Rule 4 — never a test or
  probe target, incident or not.

## Detection

- **Automated:** the uptime/health check described in
  `docs/v2p/staging-discipline.md` once wired (currently pending — see
  that doc's open items). CI failures on `main` (`pr-build.yml`) catch
  regressions before they can even reach Lovable's sync.
- **Manual:** Salma noticing the live app misbehave (this is how the
  ADR-006 build-cache incident was actually caught — there is no
  automated monitoring live yet, which is itself the gap Phase 6 is
  closing).
- **Security:** `pipeline/security/rls-probe.mjs`,
  `.github/workflows/supabase-auth-audit.yml`, and gitleaks (wired into
  every PR via `pr-build.yml`).
- Sentry/equivalent client+Edge Function error tracking is **not yet
  integrated** — deferred, tracked below under Open items. Until it
  exists, detection relies on the sources above plus direct user
  reports.

## Severity & first move

| Severity | Example                                                                                               | First action                                                                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEV1     | Data leak / unauthorized write reachable via the anon key; a real user's data exposed to another user | Take the affected route/table offline (tighten or drop the RLS policy via a migration) or revoke the exposed key immediately; investigate after containment, not before                                                                                                             |
| SEV2     | A critical journey is broken in production (login, buyer request submission, opportunity creation)    | Check whether it's also broken on `main`/staging first (this repo's CI would have caught a code regression) — if `main` is green but production isn't, this is a Lovable-sync or build issue (see ADR-001, ADR-006 for precedent); if `main` itself is red, revert the offending PR |
| SEV3     | Degraded but not broken (slow page, one non-critical feature failing)                                 | Log a finding, fix on the normal PR cadence — no emergency action needed                                                                                                                                                                                                            |

## Roles

- **Incident lead & comms:** Salma Anhichem — decides severity, is the
  point of contact for anything user- or business-facing, and is the
  only one with Lovable/Supabase dashboard access.
- **Fixer:** this repository's established split applies during an
  incident too — pipeline/test/CI/infra fixes go directly through
  GitHub (small PR, CI green, merge); application-behavior fixes go
  through a Lovable prompt so they persist past the next regeneration
  (`EXECUTION-PLAN.md` §2, Rule 5).
- **Escalation:** Hassan Boussif / Zakaria Bouchaanana — for
  business-impact decisions (e.g., "do we take the buyer-request form
  offline while we fix this"), GDPR/legal notification calls on a
  confirmed data exposure, or authorizing spend (e.g., Lovable
  credits, a Supabase plan upgrade).

## Runbook

1. **Identify which side is actually broken.** Reproduce against
   `main` locally (`bun install && bun run dev`) before assuming it's
   an app-code bug — this project has twice found the real cause to be
   infrastructure (a stalled Lovable↔GitHub sync, ADR-001; a Lovable
   build-cache dedup bug, ADR-006), not the code itself. `git log`
   compared against Lovable's last synced commit (visible in Lovable's
   own version history) tells you fast whether this is a sync problem.
2. **Contain.** Options in likely order of severity:
   - Disable/hide the affected route or feature (a Lovable prompt, or
     a feature flag if one exists for that surface).
   - Tighten or revoke an RLS policy via a migration (GitHub PR,
     applied through the Supabase SQL editor on 🟥 production by
     Salma — this repo's agent does not hold production credentials).
   - Rotate an exposed key in the Supabase dashboard, then remove it
     from wherever it leaked (client bundle, git history — use
     `pipeline/security/secret-scan.sh` to confirm the removal).
3. **Assess blast radius.** Supabase's dashboard logs (Auth logs,
   Postgres logs, API logs) on 🟥 production — read-only, Salma's
   access only. Identify affected tables/rows/users before deciding
   what, if anything, must be communicated externally.
4. **Notify per obligations.** If real user PII was exposed (see
   `apps/wilmet/threat-model.md` for what counts as PII in this app),
   Salma + supervisors decide GDPR notification obligations together —
   this is a supervisor-escalation decision, not one to make alone.
5. **Remediate and retest.** Any RLS/security fix gets retested with
   `pipeline/security/rls-probe.mjs` before being considered closed —
   per this project's own rule, "a finding is never closed without a
   retest artifact" (`EXECUTION-PLAN.md` §5). Any regression gets a
   Playwright test added so it can't silently recur (the same pattern
   already proven in Phase 4's regression-catch demonstration).
6. **Post-mortem within 48h.** One paragraph: what happened, why,
   what the retest evidence shows, and what regression test/monitor
   now prevents a recurrence. Follows the same ADR format already used
   throughout this project (`docs/v2p/decisions/`) when the root cause
   or fix involved a non-obvious call.

## Known, currently-open items this plan depends on

These are real, unresolved gaps as of this writing — listed here
rather than implied to be handled, per this project's own evidence-
over-assertion doctrine:

- **The live Lovable preview is currently broken** ("Un problème est
  survenu" on public routes). ADR-006's build-cache nudge (PR #46) did
  **not** clear it after publishing, contrary to that ADR's prediction.
  Root cause is not yet re-diagnosed past what ADR-006 already found.
  Parked per Salma's decision (2026-08-26) — revisit before this
  incident plan can be considered dry-run against a healthy production
  app rather than a currently-incident one.
- **No automated uptime/error monitoring exists yet** — the very thing
  Detection above says would normally catch this. Blocked on
  confirming the production URL and, for Sentry/error tracking
  specifically, deferred pending Lovable prompt access (see
  `docs/v2p/staging-discipline.md`).
- **No populated `findings-register.csv` exists** at
  `apps/wilmet/findings-register.csv` despite `EXECUTION-PLAN.md` §5
  specifying every finding be logged there. Findings from this project
  have instead been tracked via `apps/wilmet/evidence/*.txt` narratives
  and ADRs — real evidence exists, just not consolidated into the
  single register the plan and this incident plan's own runbook step 5
  assume. Worth backfilling before this plan is fully load-bearing.
- **Backup/restore has not been verified** — see
  `docs/v2p/staging-discipline.md` for status, pending confirmation of
  🟥 production's Supabase plan tier.
