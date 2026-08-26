# ADR-009: Consolidate and remove the ChatGPT-era documentation tree

Date: 2026-08-26 · Status: accepted

## Context

While auditing what's left incomplete across all V2P phases, discovered
a second, disconnected body of documentation — `docs/security/`,
`docs/recovery/`, `docs/reliability/`, `docs/engineering/`,
`docs/operations/` (27 files) — committed 2026-08-18 to 2026-08-20,
before `docs/v2p/EXECUTION-PLAN.md` existed. This work was produced by
Salma in an earlier pass using ChatGPT (with a live Lovable-provided
Postgres connector), tracked via its own GitHub issue numbering
(#9, #17, #21–#44) rather than this project's ADR/phase convention.
Neither documentation tree references the other anywhere — they never
knew about each other.

This was not a trivial or low-value body of work. It contains:

- Seven genuine, evidence-backed RLS/authorization findings, verified
  via `BEGIN...ROLLBACK` role-spoofed transactions against the live
  database (not narrative claims) — including one live, proven
  privilege-escalation exploit (a user could recreate their own
  `profiles` row with `commission_rate=99.99`, `staff_scope='both'`)
  and one discovery that sellers could read internal staff CRM notes
  on their own deals. Both were found and fixed.
- A more detailed and more rigorous incident-response runbook
  (`docs/operations/incident-response-runbook.md`, 437 lines) than the
  first draft of this project's own `apps/wilmet/incident-plan.md`.
- Real findings on AI-abuse quota enforcement, dossier-AI data
  minimization, migration-ledger drift, and transactional-integrity
  gaps in several multi-step mutations — several with genuine
  automated test coverage.
- Independent corroboration of this project's own ADR-005/007/008
  finding that Lovable withholds direct Supabase account/Management
  API access (`docs/security/staging-security-e2e.md` reached the same
  conclusion, by a different route, two days before ADR-005 was
  written).

Salma's explicit instruction (2026-08-26): fold anything genuinely
valuable into the V2P tracking this engagement uses, then remove the
original files — she wants the project's documentation to reflect one
coherent process going forward, not two disconnected tools' output
sitting side by side.

## Decision

1. Added 11 new rows (F-012 through F-022) to
   `apps/wilmet/findings-register.csv`, covering every genuine finding
   from the ChatGPT-era pass, credited to its origin (PR number and
   the removed file's git history path) rather than re-attributed to
   this engagement's own work.
2. Rewrote `apps/wilmet/incident-plan.md` to absorb the operations
   runbook's lifecycle/severity/playbook structure, explicitly credited
   in that file's own header note.
3. Cross-referenced the remaining standalone items that didn't warrant
   a full findings-register row (the CSP report-only design rationale
   into F-006's existing evidence trail; the Management-API-access
   corroboration into ADR-008; the CI/build baseline snapshot into
   `docs/v2p/sync-status.md`) before removing their sources.
4. Deleted all 27 files under `docs/security/`, `docs/recovery/`,
   `docs/reliability/`, `docs/engineering/`, `docs/operations/`.
5. Left `docs/formation/` untouched — confirmed via `git log` to be
   Lovable-generated app scaffolding (`gpt-engineer-app[bot]`,
   2026-08-14), a different origin entirely, not part of what this
   decision concerns.

## Rationale

- The security substance survives in a structurally better place (one
  register, one incident plan) rather than being lost or left as a
  disconnected duplicate that the next reader has to reconcile by
  hand, which is exactly what happened here — this V2P pass ran for
  days without knowing this material existed.
- Deletion via a normal commit is not permanent: every removed file
  remains fully readable via `git log`/`git show` on this commit's
  parent, which is why the findings-register rows above cite exact
  file paths and PR numbers rather than paraphrasing from memory —
  the paper trail to the original evidence survives even though the
  file doesn't.
- Matches Salma's explicit, informed decision (she was shown the
  actual content, including the exploit PoC, before choosing removal
  over keeping the files as-is or moving them aside).

## Consequences

- Two items from the removed docs are now tracked as genuinely open
  findings that this V2P engagement had not previously known about:
  **F-018** (B0-001, RLS bypass — DB-layer fix confirmed, app-path/
  real-JWT verification never confirmed) and **F-019**/**F-020**
  (AI-abuse alerting routing and dossier-AI legal basis, both flagged
  open in their source docs and never closed). These belong in the
  final report's residual-risk section alongside this engagement's own
  findings (F-005, F-009, F-011).
- `apps/wilmet/incident-plan.md` is now substantially longer and more
  rigorous than its first draft — this is a genuine improvement, not
  scope creep, since the added structure (severity model, scenario
  playbooks, break-glass rules, return-to-service checklist) came from
  real prior engineering work, not invented for this ADR.
- Going forward, `docs/v2p/` and `apps/wilmet/` are the sole source of
  truth for this project's security/ops documentation — there is no
  longer a second tree to reconcile against.
