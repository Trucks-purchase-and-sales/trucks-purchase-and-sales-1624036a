# ADR-012: Commission-rules configuration gap -- diagnosed, deliberately deferred

Date: 2026-08-28 · Status: accepted

## Context

FD-019 (`apps/wilmet/functional-defects.csv`) was the highest-priority
item in the whole functional audit: no code appeared to insert a row into
`opportunity_commissions`, raising the possibility that partners have
never been able to get paid a commission through the app at all.

Investigated live against production via the same read-only
Supabase-SQL-editor path used for the Phase 2 RLS audit (ADR-005's
precedent) -- see `apps/wilmet/evidence/fd019-commission-creation-
investigation.txt` for the full queries and results. Findings:

1. An untracked trigger, `trg_compute_commission` on `vehicle_opportunities`
   (predating this repo's migration history, same category as the ~13
   business-logic triggers ADR-005 already flagged as excluded from
   `staging-schema.sql`), does correctly compute and insert a commission
   row when an opportunity's status reaches `achetee`/`livree`/`closed_won`.
2. It found nothing to apply, every time, because `commission_rules` has
   zero active rows in production.
3. A complete, properly admin-gated CRUD API for `commission_rules`
   already exists (`listCommissionRules`/`upsertCommissionRule`/
   `deleteCommissionRule` in `src/lib/commissions.functions.ts`) -- but no
   route anywhere in the app calls any of them. There is no way to create
   a rule except a direct SQL insert.
4. A secondary, currently-latent issue: a `basis='sale'` (margin) rule
   would be computed from `final_sale_price_eur`, which isn't set yet at
   the `achetee` transition -- combined with the trigger's own guard
   against recomputing, that would permanently lock in a €0 commission.
   Not observable today since no rule of any kind exists yet.

## Decision

Asked Salma directly whether to (a) create a commission rule now via SQL,
and (b) build the missing "manage commission rules" admin page. She chose
to do neither right now -- document the gap and leave both for later.

## Rationale

- This is a real product/business decision (what commission terms Wilmet
  actually charges, and to whom), not something to default or guess at.
  Per this project's own doctrine, that call belongs to Salma, not to be
  assumed.
- Matches the same evidence-over-assertion standard as ADR-007: better to
  honestly record "the mechanism works, nothing configures it yet" than
  to either quietly close FD-019 as fixed (it isn't, functionally -- no
  commission will ever be created until a rule exists) or leave it
  mischaracterized as a code bug (it isn't -- the code is correct).

## Consequences

- `opportunity_commissions` will keep collecting zero rows in production
  until a `commission_rules` row is created, by whatever means, in the
  future.
- If/when a rule is ever added with `basis='sale'`, re-check the
  `achetee`-vs-`livree` timing issue noted above before trusting its
  first computed amount.
- `FD-019` is closed in `functional-defects.csv` as diagnosed rather than
  fixed -- the finding is real and complete, the remediation is a
  deliberate, informed deferral, not an oversight.
