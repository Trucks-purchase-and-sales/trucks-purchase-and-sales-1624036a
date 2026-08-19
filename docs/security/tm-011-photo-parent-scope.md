# TM-011 — vehicle photo parent-scope verification

**Assessment date:** 2026-08-19  
**Environment:** existing Lovable-managed Wilmet staging database  
**Database cloning/branching:** none

## Finding

`vehicle_photos` and the `vehicle-photos` Storage bucket used seller ownership alone for mutation authorization. A seller therefore retained a database path to mutate photo metadata after the opportunity had been submitted and `owner_side` had moved to `wilmet`.

The same legacy metadata SELECT policy also allowed only the seller or an admin. It did not inherit the canonical parent pipeline scope, so a legitimate scoped internal employee could be authorized to the opportunity while receiving no photo metadata.

This is a child-resource authorization inconsistency under TM-011.

## Live evidence before remediation

Existing staging opportunity used for the non-destructive probe:

- reference: `WIL-OPP-2026-0001`;
- status: `envoyee`;
- `owner_side = wilmet`;
- six existing photo metadata records.

A rollback-only authenticated-seller probe executed:

```sql
UPDATE public.vehicle_photos
SET sort_order = sort_order + 1000
WHERE id = '<existing-own-photo>';
```

The RLS-visible row count was `1`, proving the seller could mutate submitted Wilmet-owned photo metadata. The transaction was deliberately aborted and a follow-up read confirmed the original `sort_order = 0` remained unchanged.

Direct SQL mutation of `storage.objects` was not used as Storage API evidence: Supabase's own storage table protection trigger rejects direct object-table deletion. Storage mutation behavior is therefore covered by the real-JWT Storage API suite added with this remediation.

## Intended invariant

Photo access follows the parent opportunity:

### Read

- seller/bringing user may read photos attached to their own opportunity;
- non-draft internal/external staff may read only when `private.can_read_pipeline_record(...)` authorizes the parent.

### Seller/external-agent mutation

Photo metadata and objects are mutable only when all of these are true:

1. the caller owns/brought the parent opportunity;
2. the caller is a seller partner or external agent;
3. the opportunity is still `brouillon`, **or** Wilmet explicitly handed control back with `owner_side = 'partenaire'`.

A submitted opportunity with `owner_side = 'wilmet'` is immutable to the seller until an explicit hand-back.

This matches the existing application workflow: `adminHandoverToPartenaire` sets `owner_side = 'partenaire'` and tells the user the partner may modify the opportunity, while seller re-submission returns control to Wilmet.

## Rollback-only migration verification

The proposed metadata policies were installed inside `BEGIN ...` and the test deliberately raised an exception after the matrix, restoring the original schema/data.

Observed matrix:

| Check | Expected | Result |
| --- | --- | --- |
| seller reads own submitted photos | 6 rows | PASS — 6 |
| seller updates own photo while Wilmet owns submitted parent | 0 rows | PASS — 0 |
| seller updates own photo after explicit hand-back | 1 row | PASS — 1 |
| unrelated partner reads photo metadata | 0 rows | PASS — 0 |
| scoped purchase `sales_agent` reads parent photos | 6 rows | PASS — 6 |

Rollback integrity after the probe:

- four legacy `vehicle_photos` policies restored;
- zero temporary policies remained;
- synthetic staff identity absent;
- parent `owner_side` remained `wilmet`;
- existing main photo `sort_order` remained `0`.

## Migration

`20260819004000_vehicle_photo_parent_scope.sql`

The migration replaces the legacy owner/admin policies on:

- `public.vehicle_photos`;
- `storage.objects` for bucket `vehicle-photos`.

It does not create or copy any database. It targets the existing Lovable-managed staging database when promoted.

## Real-JWT regression suite

`tests/staging/photo-handoff.staging.ts` adds a disposable, guarded staging test covering the real Supabase Auth/Storage boundary:

- seller draft upload + metadata insert succeeds;
- unrelated seller upload into that opportunity fails;
- after submission/Wilmet ownership, seller upload fails;
- after submission/Wilmet ownership, photo metadata update affects no row;
- scoped purchase staff can read photo metadata through parent scope;
- explicit partner hand-back re-enables upload + metadata mutation;
- after Wilmet reclaims the opportunity, seller Storage API deletion fails and the object remains.

The suite uses unique disposable identities/rows/objects and removes them in `afterAll`. It requires the explicit `wilmet-staging` mutation guard and protected staging credentials.

## Remaining TM-011 work

This closes the photo child-resource slice only. `information_requests`, `opportunity_status_history`, `opportunity_activities`, and other older child policies still require their own parent-scope review before TM-011 is closed globally.
