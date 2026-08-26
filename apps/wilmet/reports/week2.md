# Week 2 — Phase 2 and Phase 3 progress report

_Status: complete, written retroactively 2026-08-26 from evidence
already on file (Phase 2's work was done 2026-08-23, Phase 3's
2026-08-24) — same process gap as `week1.md`, closed here. One item
that genuinely couldn't be finished until today (D7, server-function
caller/input verification) is included below since it belongs to this
phase by the plan's own numbering, not artificially held for a later
report._

## Goal

Phase 2: re-prove security from the outside — the heart of the
defensibility story, directly addressing CVE-2025-48757. Phase 3:
apply defense-in-depth on top of what Phase 2 verified.

## Phase 2 — shipped

- **9.1 RLS audit by hand** — `evidence/phase2-rls-audit.txt`. Zero
  Critical/High findings. Every "true" policy found is on
  intentionally-public reference data; every sensitive table has a
  real, scoped policy. Two non-security notes recorded (a few policies
  check only `admin` where siblings check `admin` OR `platform_admin`
  — more restrictive, not less; `demand_opportunity_status_history`'s
  unusual client-reachable INSERT confirmed correctly scoped).
- **9.2 active probing** — `evidence/phase2-rls-probe.txt`, run against
  🟦 the disposable staging project (never production), all 52 tables.
  Zero leaks: anonymous read returns 0 rows everywhere (confirmed via
  raw response inspection, not just status codes); anonymous write
  rejected with Postgres's own RLS-violation error against a
  realistic payload (not just the generic probe script's placeholder,
  which could false-positive on a schema error instead of a real
  block); an authenticated non-staff test user saw exactly their own
  1 seeded row and nothing else.
- **9.3 secrets** — `evidence/phase2-secret-scan.txt`. One pattern hit
  (`SUPABASE_SERVICE_ROLE_KEY`) investigated and confirmed a false
  positive — the env var _name_, not a leaked value, inside a
  server-only edge bundle that never reaches the browser (F-002,
  closed).
- **9.3 caller verification / input validation (D7)** — completed
  2026-08-26 (see "Closed today" below), the one item from this phase
  that had genuinely never been audited by either this engagement or
  the earlier ChatGPT-assisted pass.

## Phase 3 — shipped

- **Security headers** — `evidence/phase3-headers.txt`. HSTS,
  X-Content-Type-Options, and Referrer-Policy confirmed present.
  X-Frame-Options confirmed **missing** — the one real, still-open gap
  from this phase (**F-005**). CSP confirmed present but deliberately
  Report-Only, a staged rollout choice, not an oversight (**F-006**,
  deferred/intentional — design origin was
  `docs/security/csp-report-only.md`, a ChatGPT-era doc now
  consolidated and removed per `ADR-009`).
- **Dependency/static analysis** — `evidence/phase3-dependency-static-
checks.txt`. One accepted-risk finding (`xlsx`, two known CVEs, no
  maintainer fix, browser-only blast radius via the OCR upload feature
  — **F-003**, accepted by Salma 2026-08-24). Ten semgrep hits, all the
  same dismissed false positive (**F-004**, closed).
- **Auth hardening (toggles + screenshots)** — this phase's own
  acceptance criterion literally calls for "Supabase dashboard,
  capture screenshots," which ended up happening later, during Phase 6
  (2026-08-26), once the automated Management-API audit workflow
  turned out to be structurally unusable (`ADR-008`). Result: min
  password length raised 8→15 same-day (**F-010**, closed), 5 of 8
  blocking criteria confirmed passing, 4 confirmed not exposed
  anywhere in Lovable's dashboard (**F-011**). Cross-referenced here
  rather than re-described — see `week4.md` for the full account.

## Closed today (2026-08-26): D7, server-function caller verification and input validation

Genuinely the last unaudited item in the plan's Definition of Done
table. Wilmet's real architecture is TanStack Start server functions,
not classic Supabase Edge Functions, so re-mapped D7 onto the
equivalent surface: all 19 `src/lib/*.functions.ts` modules.

**Result: real, not a stub.** 17 of 19 use `requireSupabaseAuth`
(`src/integrations/supabase/auth-middleware.ts`, framework-generated,
not hand-rolled) — genuine JWT verification against Supabase Auth
(`supabase.auth.getClaims()`), not a decode-and-trust. Role checks
(`assertAdmin`, `hasAnyRoleServer`) correctly query `user_roles` using
the _verified_ `userId` from that middleware, never a client-supplied
one. The 2 exceptions (`reference-data.functions.ts`,
`public-catalog.functions.ts`) are both deliberately public, with the
latter carrying its own explicit safe-column-projection comment.

16 of 19 validate input with zod directly; the other 3 are genuinely
input-less GET operations or (buyer-leads) route through a named zod
wrapper (`parseBuyerLead`) shared identically by both the authenticated
and anonymous submission paths — confirmed by reading both call sites,
not assumed from the function name. No file was found using a
service-role client without `requireSupabaseAuth` (or the public
route's own rate-limit gate) applied first.

Full detail: `evidence/phase2-server-function-caller-verification.txt`.
No findings-register row was needed — this is a clean result, same
convention already used for Phase 2's RLS audit.

**Scope note, stated honestly:** confirmed zod validation exists and
is correctly wired into every path that needs it; did not separately
audit whether each individual validator has _dedicated_ unit test
coverage beyond the E2E/security suites that already exercise them
indirectly (Phase 4's Playwright suite, the `tests/staging/*.staging.ts`
harnesses). That narrower question was out of scope for closing D7
itself.

## Findings folded in from the earlier ChatGPT-assisted pass (`ADR-009`)

Seven Phase 2 findings (**F-012 through F-018**) and one Phase 3
finding (**F-019**), all found and mostly fixed in a separate pass
predating this engagement, credited to their origin PRs:

- **F-012** (High, closed) — a live-proven privilege-escalation exploit
  via `profiles` self-INSERT (a user could grant themselves
  `commission_rate=99.99`, `staff_scope='both'`).
- **F-013** (High, closed) — sellers could read internal staff CRM
  notes on their own opportunity.
- **F-014** (Medium, closed) — a commission-visibility scope bug found
  _during_ its own verification pass.
- **F-015** (Medium, closed) — buyer-lead child-table parent-scope gap.
- **F-016** (Medium, mostly closed) — sale-listing photo ownership
  invariant; one sibling table (`opportunity_activities`) covered
  separately as F-013.
- **F-017** (High, closed) — `app_settings` allowed public/anon SELECT.
- **F-018** (High, **open**) — B0-001: RLS direct-assignment bypass via
  `PUBLIC` execute grants on authorization helpers, fixed at the
  database layer but explicitly still pending real-JWT/application-
  path verification, self-flagged as open in its own source doc.
- **F-019** (Medium, **open**) — AI-abuse quota enforcement is real and
  unit-tested, but whether production alerting actually routes the
  resulting quota-pressure warnings anywhere was never confirmed.

## Acceptance against the plan's own criteria

**Phase 2** (EXECUTION-PLAN.md §9): every Critical/High RLS and secret
finding fixed and retested ✅ (zero found in this pass; F-012–F-018 from
the folded-in pass mostly closed, F-018 explicitly still open). Edge
Functions verify callers ✅ (D7, closed today). Register updated ✅.
`week2.md` written ✅ (this file).

**Phase 3** (§10): validation added and tested ✅ (confirmed present;
dedicated-unit-test-coverage question explicitly out of scope, see
above). Auth toggles set, screenshots ✅ (via Phase 6, cross-
referenced). Headers present ⚠️ (F-005 still open). Dependency/static
findings triaged ✅. `week2.md` updated ✅ (this file).
