# Pre-Publish Checklist — Wilmet Trucks

_Instantiated from `pipeline/templates/pre-publish-checklist.md`
(EXECUTION-PLAN.md Appendix L). Each row names the actual script/
workflow this repository already has for it — not the generic
template text — plus how to run it and where its evidence lands._

Run this before every Lovable **Publish**, not just once. The "dry run"
performed on 2026-08-26 (status column below) is the first pass, done
against 🟦 the disposable project where the checklist item is a mutating
test, or read-only against 🟥 production where the item is explicitly a
read-only production check (see `docs/v2p/staging-discipline.md` for
why that split is safe).

| Item                                                                                                       | How to run it                                                                                                                                            | Status as of 2026-08-26                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS audit: no table without RLS, no `USING (true)` on sensitive tables                                     | `pipeline/security/rls-audit.sql` in the Supabase SQL editor (🟦 disposable, schema mirrors 🟥's policies verbatim per ADR-005)                          | ✅ done in Phase 2 — `evidence/phase2-rls-audit.txt`                                                                                                                                                                                                                                                                                                                                                       |
| RLS probe: anon read/write + authenticated-scope passes                                                    | `pipeline/security/rls-probe.mjs` against 🟦                                                                                                             | ✅ done in Phase 2 — `evidence/phase2-rls-probe.txt`                                                                                                                                                                                                                                                                                                                                                       |
| Secret scan clean (bundle + git history)                                                                   | `pipeline/security/secret-scan.sh` + gitleaks (also runs automatically on every PR via `pr-build.yml`'s `secret-scan` job)                               | ✅ Phase 2 — `evidence/phase2-secret-scan.txt`; re-verified on every PR since                                                                                                                                                                                                                                                                                                                              |
| Security headers present                                                                                   | `pipeline/security/headers-check.mjs`                                                                                                                    | ✅ Phase 3 — `evidence/phase3-headers.txt`                                                                                                                                                                                                                                                                                                                                                                 |
| Playwright E2E green on this commit                                                                        | Runs automatically in CI (`pr-build.yml`) against 🟦                                                                                                     | ✅ continuous — gates every PR merge                                                                                                                                                                                                                                                                                                                                                                       |
| 5 critical smoke journeys green                                                                            | `.github/workflows/smoke.yml` (`workflow_dispatch`) against 🟦                                                                                           | ✅ Phase 4 — `evidence/phase4-smoke-gate.txt`; re-run on demand before a release                                                                                                                                                                                                                                                                                                                           |
| k6 at 3× peak meets p95<500ms, error<1%                                                                    | `.github/workflows/k6-disposable-load-test.yml` — database layer via `pipeline/load/k6-db-read.js`; see residual risk below for the app-server layer     | ✅ database layer — `evidence/phase5-k6-db-read-run1.txt`. ⚠️ app-server layer under real production-mode load is **not verified** (this repo can't build/serve a production build locally — Nitro/Cloudflare target; see `evidence/phase5-k6-ramp-run1.txt`)                                                                                                                                              |
| Auth hardening (leaked-pw protection, min length, rate limit, redirect allowlist, email verify, admin MFA) | Manual screenshot review of Lovable's Auth settings panel (see `ADR-008` — the automated `supabase-auth-audit.yml` is blocked, no Management API access) | ⚠️ partial: 2 of 7 blocking criteria confirmed passing, 1 confirmed **failing** (F-010, hosted min password length is 8 not >=15 — directly fixable by Salma in Lovable's own dashboard, no Lovable prompt/credits needed), 4 not yet checked. See `evidence/phase6-hosted-auth-manual-review.txt`                                                                                                         |
| Backup taken; restore verified within last N days                                                          | See `docs/v2p/decisions/ADR-007-backup-restore-via-lovable-only.md`                                                                                      | ⚠️ Lovable exposes no Supabase account/billing access at all — the only mechanism is Lovable's own in-place PITR panel (ADR-005), too destructive to routinely restore-test against real data. Backup likely exists; restore is genuinely unverified — a documented residual risk, not a gap closeable by more information                                                                                 |
| Monitoring/alerting active                                                                                 | Uptime: `.github/workflows/uptime-check.yml` (every 30 min + on-demand, checks HTTP status and the known crash signature). Sentry: not yet               | ✅ uptime check wired — currently (and correctly) **red**, reflecting the real open ADR-006 incident, not a check bug. ❌ Sentry deliberately deferred (Lovable-domain, Salma's call 2026-08-26)                                                                                                                                                                                                           |
| Findings register: zero open Critical/High                                                                 | `apps/wilmet/findings-register.csv`                                                                                                                      | ✅ backfilled from Phases 2-5 evidence (9 findings). Zero open Critical/High in the confidentiality/integrity sense; one Medium still open (F-005, missing X-Frame-Options, Lovable prompt not yet sent) and one Critical-for-availability tracked separately (F-009, the live crash itself) — the rubric this register uses doesn't cleanly cover availability findings, called out rather than force-fit |

## What this dry run actually proves, and what it doesn't

Every row above with a real evidence file has genuinely been exercised
at least once this project — this isn't a paper checklist filled in
from memory. What it does **not** prove: that the live Lovable app
currently reflects any of it. As of this writing the live preview is
mid-incident (see `docs/v2p/staging-discipline.md`'s "Known gap"
section) — the ADR-006 fix did not clear it. **Do not treat a green
row above as "production is fine" while that incident is open**; it
means the pipeline that verifies changes before they ship is sound,
which is a precondition for a safe publish, not a substitute for one.

## Before the next real Publish, in order

1. Confirm the live-preview incident is actually resolved (re-diagnose
   past ADR-006 — parked per Salma's decision on 2026-08-26, not
   forgotten). The uptime check will flip green on its own once this
   is true, which is a good objective signal to watch for.
2. Fix F-010: raise Lovable's Auth settings → Email settings →
   Minimum password length from 8 to 15. Directly actionable by Salma,
   no Lovable prompt or credits needed.
3. Finish the manual auth review: screenshot the Advanced section,
   Sessions/Tokens panel, Bot/Abuse Protection panel, and the rest of
   the Sign in methods list to close the 4 still-unchecked blocking
   criteria in `evidence/phase6-hosted-auth-manual-review.txt`.
4. Decide whether to ever attempt a real in-place restore test via
   Lovable's panel (see `ADR-007`) — a deliberate, separately-approved
   action given the risk to real data, not a routine checklist step.
5. Get F-005 (missing X-Frame-Options / clickjacking protection) fixed
   via Lovable once app-code changes are usable again — see
   `apps/wilmet/findings-register.csv`.

- Signed: **\_\_\_** · Date: **\_\_\_**
