# ADR-010: Direct-GitHub exception for FD-001 and FD-013

Date: 2026-08-28 · Status: accepted

## Context

Two functional-defects items (`apps/wilmet/functional-defects.csv`) needed
a product decision before any fix, per Phase 0.5's own gate:

- **FD-001**: the "interested" button on a vehicle's detail page
  (`vehicules.$id.tsx`) routed to the generic buyer-request wizard with no
  reference to which vehicle was clicked.
- **FD-013**: buyers had no way to view a request they'd already submitted
  — sellers get a detail page for their own listings, buyers didn't.

Salma decided both should be built (pre-fill the vehicle; add a buyer
detail view — see `apps/wilmet/interaction-map.md`'s deferred-decisions
table, updated 2026-08-28). Per doctrine (§2 Rule 2), app-behavior fixes
normally go back through Lovable. Lovable currently has no credits
available (the same constraint as ADR-002, still in effect), so Salma
explicitly asked for these to be implemented directly on GitHub instead of
waiting or drafting Lovable prompts she can't send.

## Decision

Implemented both directly, as small, independently reviewable changes:

- **FD-001**: `chercher-un-vehicule/` now accepts an optional
  `vehicleRef` search param (`validateSearch`, matching the existing
  pattern used by sibling routes). `vehicules.$id.tsx`'s "interested" link
  passes the vehicle's title/reference through it. The wizard pre-fills
  the *existing* `message` field with it — no new database column, no
  schema change, the field stays editable.
- **FD-013**: added `getMyBuyerLead` (in `buyer-leads.functions.ts`,
  scoped by both an explicit `.eq("user_id", ...)` filter and RLS,
  mirroring `myBuyerLeads`' existing safety pattern) and a new read-only
  route `_authenticated/mes-demandes.$id.tsx`, mirroring the seller
  equivalent (`opportunities.$id.tsx`). Request cards in `mes-demandes.tsx`
  are now links to it. View-only, matching what was actually decided — no
  edit/cancel action was asked for or added.

Both changes reuse existing i18n keys (`buyer.fields.*`, `buyer.steps.*`)
for field labels; the only new translation keys added (in all four
locales: fr/en/de/nl) are the wizard's pre-fill sentence and the detail
page's back-link/not-found strings — everything else already existed.

## Rationale

- Matches the ADR-002 precedent exactly: Lovable-credit-blocked app-code
  fixes get a documented direct-GitHub exception once Salma explicitly
  authorizes it, rather than sitting queued indefinitely.
- Small, reversible, single-purpose changes (Rule 6) — FD-001 touches two
  files and adds no schema; FD-013 adds one new server function and one
  new route, reusing the existing seller-detail-page pattern rather than
  inventing a new one.
- Verified before committing: `tsc --noEmit` clean, `npm run build` clean,
  `eslint` clean on every changed file (0 errors after `--fix` normalized
  pre-existing CRLF line endings on the files touched — cosmetic only,
  same category as ADR-006's own reformat), and a dev-server smoke test
  confirmed both routes render without server errors (read-only checks
  only — no test submission was made through the wizard, to avoid writing
  a real row to production).
- `getMyBuyerLead` was written into `buyer-leads.functions.ts`, not
  `dashboards.functions.ts` where `myBuyerLeads` already lives, because
  that file already carries ~30 pre-existing `@typescript-eslint/
  no-explicit-any` errors that predate this change. This repo's own
  `pr-build.yml` lints whole changed files, not just changed lines, so
  touching that file at all would have failed the PR on debt this change
  didn't create. `buyer-leads.functions.ts` was already cleanly typed and
  is the more natural home for a buyer-lead-specific function regardless.

## Consequences

- Both files Lovable generates/owns (`vehicules.$id.tsx`,
  `chercher-un-vehicule.index.tsx`, `mes-demandes.tsx`) were edited
  directly. Per the same risk already named in ADR-002/ADR-006: if
  Lovable's next AI-driven edit touches any of these files, watch for a
  conflict or silent revert of this change.
- `functional-defects.csv` (FD-001, FD-013) and
  `apps/wilmet/interaction-map.md`'s deferred-decisions table are updated
  to reflect Salma's decision and that the fix is live, not just decided.
- The pre-existing `any`-typing debt in `dashboards.functions.ts` was
  identified but not fixed — it's unrelated to this change and out of
  scope; noted here so it isn't lost.
