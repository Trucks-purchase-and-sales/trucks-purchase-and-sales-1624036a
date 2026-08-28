# ADR-011: Direct-GitHub exception for FD-008 and FD-014

Date: 2026-08-28 · Status: accepted

## Context

Two confirmed bugs (`apps/wilmet/functional-defects.csv`), not product
decisions -- Salma asked for both fixed directly:

- **FD-008**: `withdrawOpportunity` only checked for a Postgres error,
  never affected-row-count. The RLS policy (`opp_partner_update`) silently
  allows zero rows to match once Wilmet owns the opportunity (the common
  case once it's past `brouillon`), so the handler returned `{ok:true}`
  and the UI showed a false success toast while nothing changed.
- **FD-014**: `adminRejectBuyerLead` accepted a `reason` from the reject
  dialog but had nowhere to persist it -- `buyer_leads` had no matching
  column, unlike `vehicle_opportunities.close_reason`, which the
  equivalent opportunity-close flow already writes correctly.

Same constraint as ADR-010: Lovable has no credits, so these are fixed
directly on GitHub rather than queued as Lovable prompts.

## Decision

- **FD-008**: `withdrawOpportunity` now selects the updated row back
  (`.select("id")`) and throws if zero rows came back, instead of trusting
  the absence of a Postgres error. The calling UI
  (`opportunities.$id.tsx`) already had a correct `try/catch` with
  `toast.error` wired up -- it just never received a failure to show.
- **FD-014**: added `buyer_leads.reject_reason` (migration
  `20260828140000_buyer_lead_reject_reason.sql`, nullable text, mirroring
  `vehicle_opportunities.close_reason`'s exact type). `adminRejectBuyerLead`
  now writes `data.reason` into it. The admin buyer-lead detail page shows
  it in a card once `status = 'perdu'`, mirroring the existing
  `close_reason` display pattern on the opportunity detail page.
  `src/integrations/supabase/types.ts` was hand-updated to add the column
  (same reasoning as ADR-005: no live `supabase gen types` access).

## Rationale

- Both are the minimal fix for the stated defect, reusing an existing
  pattern already proven correct elsewhere in the codebase (the
  opportunity close-reason flow) rather than inventing a new one.
- Verified: `tsc --noEmit` clean, `npm run build` clean, `eslint` clean on
  every changed file.
- **Scope note on lint**: both `opportunities.functions.ts` and
  `demand-opportunities.functions.ts` already carry pre-existing
  `@typescript-eslint/no-explicit-any` violations (`context.supabase as
  any`, raw `any` helper params) that predate this change, and this
  repo's `pr-build.yml` lints whole changed files. A first attempt at
  properly retyping `demand-opportunities.functions.ts` cascaded into
  type errors in two unrelated route files
  (`admin.demand-opportunities.index.tsx`, `mes-demandes-clients.tsx`)
  that loosely destructure its return values -- too invasive for a
  two-bug fix, so it was reverted. Used scoped
  `eslint-disable-next-line` comments on the 3 pre-existing lines in
  `opportunities.functions.ts`, and a file-level disable comment in
  `demand-opportunities.functions.ts` (21 pre-existing occurrences),
  both explicitly labeled as pre-existing debt unrelated to this change.
  Neither disables the rule for the actual code this ADR adds.

## Consequences

- Same Lovable-owned-file risk as ADR-010: if Lovable's next AI-driven
  edit touches `opportunities.functions.ts`,
  `demand-opportunities.functions.ts`, or `admin.buyer-leads.$id.tsx`,
  watch for a silent revert.
- The pre-existing `any`-typing debt in both files is now suppressed by
  lint comments rather than fixed. It's real, but retyping it safely is
  a separate, larger piece of work that touches call sites this change
  didn't -- noted here so it isn't lost, not swept under the rug.
