# Week 1 — Phase 1 progress report

_Status: complete, written retroactively 2026-08-26 from evidence
already on file (the report itself was never written at the time,
though the underlying work was done 2026-08-23/24) — flagged as a real
process gap when auditing what was left across all phases, and closed
here rather than left unfixed._

## Goal

Know the whole attack surface on one page before attacking it
(EXECUTION-PLAN.md §8).

## Shipped

- **`apps/wilmet/inventory.md`** — every table, its columns and
  sensitivity, every role (`anon` through `admin`/`platform_admin`),
  every route, every Edge Function equivalent (this app's
  `src/lib/*.functions.ts` server functions — see Phase 2's later D7
  review), every Storage bucket, every third-party integration.
- **`apps/wilmet/threat-model.md`** — assets & sensitivity, roles, and
  a live threats-and-controls table, most rows already marked
  "verified" at write time via direct, hand-run `pg_policies` queries
  against production (read-only inspection, not a probe — sanctioned
  by the plan's own Rule 4 exception).
- **Staging provisioned** — `docs/v2p/decisions/ADR-005` documents
  why the disposable Supabase project's schema had to be hand-
  reconstructed from catalog queries rather than `pg_dump`, and why
  that was the safer choice over requesting production credentials.

## Deviation from the plan's stated order, documented

`ADR-004` records that Phase 1 started before Phase 0.5's functional
sign-off gate closed — a deliberate, logged exception, not an
oversight. Worth restating here since Phase 1's own report is the
natural place a reader would look for why inventory/threat-modeling
happened before the plan's own gate said it should.

## Findings from this phase, since folded into `findings-register.csv`

- **F-020** — no documented data-minimization contract for what
  opportunity/document/OCR fields may be sent to the external Lovable
  AI Gateway for dossier analysis. Found during an earlier, separate
  ChatGPT-assisted pass (2026-08-19, predating this V2P engagement),
  folded into the register per `ADR-009`. Still **open**: a real code
  contract exists and is tested, but the underlying legal basis for
  external AI processing (retention, DPA terms, subprocessor chain)
  was never established — a legal/privacy question, not a technical
  one.

## Not done, named honestly rather than assumed

- **Lovable's built-in scan / Deep Scan was never run.** The plan's
  §8 step 4 calls for it explicitly ("run Lovable's built-in scan...
  treat results as input, not proof"). No evidence of this anywhere in
  `apps/wilmet/evidence/` or the (now-removed) earlier documentation
  pass. Independent verification (Phase 2's RLS audit/probe, this
  report's own Phase 1 work) covers the same ground more rigorously,
  so this isn't a live security gap — but it's a literal, un-met line
  item from the plan, worth naming rather than quietly dropping.

## Acceptance against the plan's own criteria (EXECUTION-PLAN.md §8)

- One-page threat model complete: ✅.
- Every table/role/function/integration listed: ✅ (`inventory.md`).
- Staging identified: ✅ (`ADR-005`).
- Lovable scan/Deep Scan run and recorded: ❌ — see above.
