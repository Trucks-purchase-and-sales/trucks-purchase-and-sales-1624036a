# Incident Response Plan — Wilmet Trucks

_Instantiated from `pipeline/templates/incident-plan.template.md`
(EXECUTION-PLAN.md Appendix M). First written 2026-08-26; revised the
same day to absorb the lifecycle/severity/playbook structure from a
more detailed runbook written during an earlier ChatGPT-assisted pass
(`docs/operations/incident-response-runbook.md`, 2026-08-19), which is
being consolidated here and removed as a separate file rather than
left as a disconnected duplicate — see `docs/v2p/decisions/ADR-009-
consolidate-chatgpt-era-docs.md`. That source material was materially
more rigorous than this document's first draft; credit is due where
the structure below comes from it._

## Context this plan operates in

Wilmet is a two-sided marketplace app (Lovable + Supabase, no
traditional backend) with a small, non-technical operating team:
**Salma Anhichem** owns the project day-to-day; **Hassan Boussif** and
**Zakaria Bouchaanana** are internship supervisors and the escalation
path for anything beyond Salma's own authority (business-impact calls,
legal/GDPR notification decisions, budget for paid tooling). There is
no dedicated on-call engineer, no named security/privacy/client
contact roster, and no confirmed monitoring/alert-routing destination
— this plan does not invent any of that; it uses role _descriptions_,
not fabricated names, wherever no one has actually been assigned.

Two databases exist and must never be confused mid-incident (the
convention used throughout this project's docs):

- 🟦 **Disposable/staging** — Salma's personal Supabase project
  (`docs/v2p/decisions/ADR-005`). Synthetic data only. Safe to break,
  reset, or rebuild from `apps/wilmet/staging-schema.sql`.
- 🟥 **Lovable/production** (Supabase project ref `srjnljpjwzhtbdnhksux`,
  `supabase/config.toml`) — the real app, real user data. Read-only
  inspection only, per this project's own Rule 4 — never a test or
  probe target, incident or not.

PostgreSQL RLS is the canonical row-authorization boundary in this
app. `SUPABASE_SERVICE_ROLE_KEY` is a privileged server secret because
it bypasses RLS entirely — its exposure is always at least SEV-2.

## Non-negotiable safety rules during an incident

1. **Preserve evidence before making broad changes, when safety
   permits.** Timestamps, affected environment, Git SHA, observed
   errors, sanitized screenshots.
2. **Never copy secrets, tokens, or real customer/PII data into
   GitHub issues, PRs, chat, or the evidence pack.** Redact.
3. **Never run a destructive linked database reset** (e.g. `supabase
db reset --linked`) against 🟥 production. Recovery uses reviewed,
   forward-only migrations, not resets.
4. **Never weaken RLS, auth, rate limiting, or input validation to
   restore availability.** Prefer disabling the affected feature
   entirely over loosening its authorization.
5. **Never rewrite already-applied migration history.** Use a
   forward-only corrective migration when schema/security state must
   change.
6. **Never trust the browser/UI as proof of authorization.** Verify at
   the database/server boundary.
7. **Never declare recovery because the page loads.** Re-test the
   original failure and the relevant security/functional invariant.
8. **Never make an undocumented change in the Lovable or Supabase
   console.** Record what changed and the verification evidence.

## Detection

- **Automated:** `.github/workflows/uptime-check.yml` (every 30
  minutes + on-demand) — checks both HTTP status and the specific
  known crash signature, since this app can return 200 while fully
  crashed for real users (see ADR-006). CI on `main` (`pr-build.yml`)
  catches code regressions before they can even reach Lovable's sync.
- **Manual:** direct observation (this is how the ADR-006 build-cache
  incident was actually caught, before the uptime check existed).
- **Security:** `pipeline/security/rls-probe.mjs`, gitleaks (every PR
  via `pr-build.yml`), the manual Lovable Auth-settings review
  (`evidence/phase6-hosted-auth-manual-review.txt`, ADR-008).
- **Not yet available:** Sentry/equivalent client+server error
  tracking — deliberately deferred (Salma's decision, 2026-08-26; app-
  code change, Lovable's domain). Until it exists, detection relies on
  the sources above plus direct user reports.

## Severity model

**SEV-1 — Critical.** Credible evidence of: active unauthorized access
to sensitive/customer data; an exposed or compromised
`SUPABASE_SERVICE_ROLE_KEY` or equivalent privileged credential; broad
RLS/authorization bypass; destructive data loss; active account
takeover of a privileged/admin user. **Default action: contain first,
even at the cost of availability.**

**SEV-2 — High.** Serious but bounded: a broken deployment blocking a
critical buyer/seller/staff journey (e.g. the current live-preview
crash, F-009); a scoped authorization defect with no evidence of
exploitation; a sustained third-party outage affecting a critical
function; AI cost abuse without confirmed data exposure.

**SEV-3 — Moderate.** Limited degradation with a safe workaround, no
credible sensitive-data exposure. Log as a finding, fix on the normal
PR cadence — no emergency action needed.

Severity may be raised at any time as evidence changes.

## Roles

- **Incident lead & comms:** Salma Anhichem — owns severity, decisions,
  and is the only one with Lovable/Supabase dashboard access.
- **Technical responder / fixer:** this repository's existing split
  applies during an incident too — pipeline/test/CI/infra fixes go
  directly through GitHub (small PR, CI green, merge); application-
  behavior fixes go through a Lovable prompt so they persist past the
  next regeneration (`EXECUTION-PLAN.md` §2, Rule 5).
- **Security reviewer:** whoever did not write the fix re-verifies it
  independently before it's considered closed (Rule 1: the tool that
  wrote the code doesn't get to be the only one that audits it).
- **Data/privacy escalation, client/business escalation, provider
  access owner:** Hassan Boussif / Zakaria Bouchaanana — for
  GDPR/legal notification decisions on confirmed data exposure,
  business-impact calls (e.g. "take the buyer-request form offline
  while we fix this"), and authorizing spend (Lovable credits, a
  Supabase plan upgrade).

A single person holding multiple roles is expected in this small
context — but the security reviewer role should not be the same
person/tool that generated the fix being reviewed, where avoidable.

## Incident lifecycle

**A — Detect and declare.** Record: an incident ID, UTC timestamp
first observed, detection source, affected environment/URL, current
`main` Git SHA vs. Lovable's last-synced SHA, affected feature/role,
initial severity.

**B — Contain.** Smallest action that stops harm without destroying
evidence: disable the affected route/feature (Lovable prompt or
existing feature flag); tighten/revoke an RLS policy via a reviewed
migration, applied to 🟥 production by Salma through the Supabase SQL
editor (this repo's automation holds no production write credential);
rotate an exposed key at the provider, then confirm removal from the
client bundle/git history with `pipeline/security/secret-scan.sh`.
Record every containment action and its timestamp.

**C — Investigate.** Reproduce against `main` locally
(`bun install && bun run dev`) before assuming an app-code bug — this
project has twice found the real cause to be infrastructure, not code
(a stalled Lovable↔GitHub sync, ADR-001; a Lovable build-cache dedup
bug, ADR-006). Check Git/PR history, CI run results, Supabase logs
available to Salma, and whether the behavior reproduces at each
privilege level (anonymous, authenticated, scoped, privileged). Prefer
read-only inspection; use `BEGIN...ROLLBACK` for any live-database
experiment, never a direct uncommitted change.

**D — Remediate.** App-owned: one focused branch → smallest coherent
fix → regression evidence that would have failed before the fix → PR →
CI green → merge → verify actual runtime/database state (a merge is
not deployment evidence — Lovable must still Publish, and per the
ADR-006 finding, publishing does not always mean what it should).
Provider-owned config: record the exact setting changed, avoid
recording secret values, retest the provider behavior after the
change.

**E — Recover.** Before declaring normal service resumed: the original
failure no longer reproduces; the relevant security/authorization
invariant passes (retested with `rls-probe.mjs` or the appropriate
Playwright suite, not assumed); the affected critical journey passes
(`e2e/tests/smoke/`); any rotated secrets are updated in the approved
store and the stale ones are confirmed revoked; evidence is retained.

**F — Post-incident review.** One write-up: impact, root cause,
detection gap, containment/remediation timeline, evidence that proves
recovery, what control was missing, and whether the threat model,
tests, monitoring, or this plan itself needs to change as a result.
Use this project's existing ADR format
(`docs/v2p/decisions/ADR-000-template.md`) when the root cause or fix
involved a non-obvious call — which, empirically, most of them have.
**Do not close an incident while a real unresolved condition is being
silently treated as accepted risk** — accepted risk must be explicit
and owned (see `findings-register.csv`'s `accepted-risk` status for
the pattern this already uses, e.g. F-003).

## Scenario playbooks

**Suspected RLS/authorization bypass** (this project has real
precedent: F-012 through F-018 in `findings-register.csv` are all
exactly this scenario, found and fixed in an earlier pass). Contain by
disabling the affected route, not by broadening access to make a
legitimate flow work. Investigate by inspecting the _actual deployed_
RLS policy text (`pipeline/security/rls-audit.sql`), not just the
migration source, and reproducing with the least-privileged identity
that can trigger it. Recover by enforcing the invariant at the
database boundary and adding a real-JWT or rollback-transaction
regression test for the exact exploit path before closing.

**Compromised credential** (`SUPABASE_SERVICE_ROLE_KEY`, a provider API
token, a GitHub token). Revoke/rotate at the provider first — this is
the actual security boundary, not removing a file from the repo (a
historically-committed secret needs rotation, not just deletion; see
`pipeline/security/secret-scan.sh` and gitleaks). Confirm the old
credential is provably dead and the app works with the new one before
declaring recovery.

**Broken deployment or unsafe release** (the current live-example:
F-009, the ADR-006 build-cache crash). Stop further publishing.
Compare the deployed SHA against `main` and against Lovable's last
synced commit — a mismatch in either direction points at a sync or
build-cache problem, not necessarily new code. Revert/redeploy the
last known-good revision through the normal path rather than a
break-glass change unless delay would materially increase harm.

**Database corruption or migration-ledger drift** (this project has
precedent for the _ledger drift_ variant too: F-021). Never
destructively reset. Capture the migration ledger and catalog state
before touching anything. **This project's restore capability is
explicitly unproven** (`ADR-007`) — recovery here is currently limited
to forward-only corrective migrations, not a tested restore.

**Supabase/Lovable/external-service outage.** Fail closed for any
security decision that can't be made reliably while the boundary is
down. Never bypass Auth/RLS because the normal path is unavailable,
and never return a fake success for a persistence operation that
didn't actually persist.

**AI/OCR cost abuse or quota pressure** (this project has a real,
still-open finding here: F-019 — quotas exist and are unit-tested, but
whether production alerting actually routes quota-pressure warnings
anywhere has never been confirmed). Keep optional AI features
closed-by-default under abuse; don't weaken size/rate/MIME limits to
restore service.

## Break-glass changes

Allowed only when delay would materially increase harm and the normal
reviewed path can't respond fast enough. Minimum bar: record why the
normal process was insufficient; scope the change to the smallest
reversible containment action; never perform a destructive database
reset or history rewrite; record the exact change and who made it; as
soon as containment is stable, reconcile the change back into reviewed
Git/configuration and run the normal regression/security checks.

## Return-to-service checklist

- [ ] Active harm is contained.
- [ ] Root cause is understood well enough that recovery won't reopen it.
- [ ] Remediation is reviewed, merged, and actually published/deployed
      (not just merged — see the ADR-006 lesson).
- [ ] The original failure no longer reproduces.
- [ ] The relevant security/authorization invariant is retested, not assumed.
- [ ] The affected critical user journey passes (`e2e/tests/smoke/`).
- [ ] Compromised credentials/sessions are confirmed revoked, if applicable.
- [ ] The uptime check is green.
- [ ] Evidence is retained.
- [ ] Privacy/client escalation decision is recorded, if applicable.
- [ ] Follow-up actions have an owner.

## Known, currently-open items this plan depends on

Real, unresolved gaps as of this writing — listed rather than implied
handled, per this project's evidence-over-assertion doctrine:

- **The live Lovable preview is currently broken** ("Un problème est
  survenu" on public routes, F-009). ADR-006's build-cache nudge
  (PR #46) did **not** clear it after publishing, contrary to that
  ADR's prediction. Parked per Salma's decision (2026-08-26) — revisit
  before this plan can be considered dry-run against a healthy
  production app rather than a currently-incident one.
- **No automated error monitoring (Sentry or equivalent)** —
  deliberately deferred, Lovable's domain.
- **Backup/restore is unproven**, not merely unconfirmed — see
  `ADR-007`. The only mechanism Lovable exposes is an in-place PITR
  restore against the live database, too destructive to routinely
  test.
- **No named security/privacy/client contact roster exists beyond
  Salma and the two supervisors** — this plan does not invent names
  for roles no one has actually been assigned.
- **This plan has not been drilled.** A tabletop exercise against a
  safe staging scenario (e.g. a simulated compromised credential, a
  broken deployment) has not yet been run — worth doing once the live
  incident above is actually resolved.
