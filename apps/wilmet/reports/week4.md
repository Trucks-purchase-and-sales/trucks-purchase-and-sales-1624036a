# Week 4 — Phase 6 progress report

_Status: substantially complete, two items explicitly deferred by
Salma's own decision rather than left silently open. Last updated:
2026-08-26._

## Goal

Know about failures before the client does, and be able to recover
(EXECUTION-PLAN.md §13).

## Shipped and merged to `main`

- **`apps/wilmet/incident-plan.md`** — who does what if something
  breaks or leaks: Salma as incident lead/comms, supervisors Hassan
  Boussif and Zakaria Bouchaanana as the escalation path for
  business/legal/spend decisions, a severity table, and a runbook
  built around this project's own existing tooling (`rls-probe.mjs`,
  `secret-scan.sh`, the regression-catch pattern from Phase 4).
- **`apps/wilmet/pre-publish-checklist.md`** — a real, per-item
  checklist naming the actual script or workflow for each row (not
  generic template text) and its evidence file, so it's checkable
  rather than aspirational.
- **`docs/v2p/staging-discipline.md`** — documents that Wilmet has no
  separate staging deployment (only a disposable database), spells out
  the actual promotion path (PR → CI → merge for pipeline changes;
  Lovable prompt → `main` commit → Publish for app changes), and
  records that this promotion path's Lovable-publish step currently
  can't be trusted end-to-end (see Findings below).
- **`.github/workflows/uptime-check.yml`** — scheduled every 30
  minutes plus on-demand, pings the confirmed production URL
  (`https://wilmet-proposeur-connect.lovable.app`) and checks two
  things: HTTP status, and the absence of the known crash fallback
  text. Checking for the crash text specifically (not just status) was
  deliberate — this app's live incident can return HTTP 200 while
  still being fully crashed for real users, so a status-only check
  would report false-healthy through an actual outage.
- **`docs/v2p/decisions/ADR-007-backup-restore-via-lovable-only.md`** —
  documents why the plan's literal "restore into a scratch project"
  backup verification doesn't apply here (Lovable exposes zero
  Supabase account/billing access to Salma) and why an in-place
  restore test against real production data was deliberately not
  attempted as a routine check.
- **`apps/wilmet/findings-register.csv`** — backfilled from every
  finding actually produced across Phases 2-5 (see below), closing the
  gap flagged in the first pre-publish-checklist dry run.

## Findings backfilled into the register this phase

Rather than write an ADR to excuse not having a findings register,
backfilled it for real from the evidence already on file — 9 findings,
none newly discovered this phase, all previously buried in narrative
evidence files:

- **F-001** (Low, open): a handful of RLS policies check only `admin`
  where siblings check `admin` OR `platform_admin` — more restrictive,
  not a security risk, but worth a product decision on intent.
- **F-002** (Info, closed): a secret-scan pattern hit on
  `SUPABASE_SERVICE_ROLE_KEY` in the built bundle — confirmed false
  positive (the env var _name_, not a leaked value, in a server-only
  edge bundle that never reaches the browser).
- **F-003** (High, accepted-risk): the `xlsx` package has two known
  CVEs with no maintainer fix; browser-only blast radius via the OCR
  upload feature. Salma accepted this risk on 2026-08-24.
- **F-004** (Info, closed): 10 semgrep `unsafe-formatstring` hits, all
  the same false-positive pattern (a hardcoded debug-tag argument, not
  user input).
- **F-005** (Medium, **open**): no `X-Frame-Options` and no CSP
  `frame-ancestors` — zero clickjacking protection. A Lovable prompt is
  drafted but not yet sent (blocked on the same Lovable
  credits/incident situation as everything else app-side right now).
  This is this phase's one real, still-open security gap.
- **F-006** (Low, deferred/intentional): CSP shipped Report-Only,
  staged deliberately pending real traffic observation.
- **F-007** (n/a, closed): the two disposable-staging-project
  reconstruction gaps from Phase 4 (empty reference tables, missing
  `rate_limit_check`) — environment gaps, not production defects,
  already fixed.
- **F-008** (Low, open): no delete UI exists anywhere in the app for
  any core entity, despite RLS permitting it — a real, cross-entity
  app gap, Lovable's domain, not yet prompted.
- **F-009** (Critical for availability, open): the live Lovable preview
  crash itself, tracked here as a finding in its own right, not just an
  ADR footnote — full outage of every public route for real users.

**Zero open Critical findings in the confidentiality/integrity sense**
(the CVSS-style rubric this register otherwise uses). F-009 is flagged
Critical for _availability_ impact specifically, which the plan's
original severity rubric doesn't cleanly cover (it's written for
data-exposure/privilege-escalation findings) — called out explicitly
rather than force-fit or omitted.

## Known gap in the promotion path (carried from `staging-discipline.md`)

The live Lovable preview has been crashing since before this phase
started (ADR-001's original incident, "resolved" once; recurred and
is now tracked as ADR-006 → F-009). The ADR-006 workaround (a forced
source diff to break Lovable's build-cache dedup bug) was merged as
PR #46 but, confirmed with Salma on 2026-08-26, **did not** actually
clear the crash after publishing. Root-causing this further is
explicitly parked per Salma's decision — not forgotten, tracked as
F-009 and in the incident plan's own "known open items" section. The
new uptime check will flip green the moment this is genuinely
resolved, which is a useful objective signal for whenever work on it
resumes.

## Explicitly deferred, not silently skipped

- **Error monitoring (Sentry or equivalent).** Requires an SDK in the
  app's own source — Lovable's domain per Rule 5. Salma's explicit
  choice (2026-08-26): defer rather than have this repo attempt an
  app-code change directly. Tracked alongside the ADR-006/F-009
  follow-up as a future Lovable prompt.
- **A real backup restore test.** See ADR-007 — the only mechanism
  Lovable exposes is an in-place PITR restore against the live
  database, which is too destructive to use as a routine verification
  step. Backup likely exists; restore is genuinely unverified. This is
  a residual risk for the final report, not a task blocked on more
  information.

## Still open before Phase 6 can be called fully closed

- **Run `.github/workflows/supabase-auth-audit.yml` for real.** It
  exists, is documented (`docs/security/hosted-auth-policy.md`), is
  read-only against production with no confirmation gate needed — it
  has simply never been executed in this repo, so there's no D8
  auth-hardening evidence on file yet. This is the one remaining
  mechanical step; everything else this phase needed a decision or a
  document for is done.

## Acceptance against the plan's own criteria (EXECUTION-PLAN.md §13)

- Monitoring live: ✅ uptime check (currently red, correctly, reflecting
  the real open incident). ❌ Sentry — deliberately deferred.
- Restore proven: ❌ — genuinely not possible with the access Lovable
  grants; documented as a residual risk via ADR-007, not silently
  claimed done.
- Incident plan + checklist exist and dry-run once: ✅ — the dry run
  itself is what surfaced the missing findings register (now
  backfilled) and the un-run auth audit (still open, see above).
- `week4.md` written: ✅ — this file.
