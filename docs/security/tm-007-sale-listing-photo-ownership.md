# TM-007 — sale-listing photo ownership invariant

**Threat:** a sale listing could store arbitrary `vehicle_photos.id` values in its `photo_ids` array. The public catalogue later resolves those IDs with a privileged server client and signs private Storage paths, so a cross-opportunity photo reference could bypass the intended parent authorization boundary.

## Source/live pre-state

Verified against the synchronized GitHub source and the actual private/unpublished Lovable-managed Wilmet database before remediation:

- `createSaleListingFromOpportunity` and `updateSaleListing` accepted arrays of UUID photo IDs.
- `listPublicVehicles` / `getPublicVehicle` resolved stored IDs through the privileged server-side catalogue path.
- `sale_listings.photo_ids` was `uuid[] NOT NULL DEFAULT '{}'`.
- no existing sale-listing constraint/trigger related each photo ID to `vehicle_opportunity_id`.
- the live database contained zero sale listings and therefore no existing TM-007 row requiring data repair.
- `private` schema `USAGE` was denied to `anon`, `authenticated`, and `service_role`.

## Required invariant

For every INSERT or UPDATE of `public.sale_listings`:

1. an empty `photo_ids` array is allowed for drafts;
2. every non-empty photo UUID must resolve to an existing `public.vehicle_photos` row;
3. every referenced photo must have `vehicle_opportunity_id = sale_listings.vehicle_opportunity_id`;
4. the rule applies regardless of listing status, including `publiee` and `reservee`.

The database boundary is authoritative. UI/server validation alone would not be sufficient because direct PostgREST/RPC/database callers must not be able to persist an invalid reference.

## Chosen control

Migration `20260819161931_sale_listing_photo_ownership.sql` adds:

- private trigger function `private.tg_sale_listing_photo_ownership_guard()`;
- `SECURITY DEFINER` only so the invariant can inspect `vehicle_photos` independently of the caller's row visibility;
- fixed `search_path = pg_catalog, pg_temp`, with application tables fully schema-qualified;
- explicit revocation of direct function execution from `PUBLIC`, `anon`, `authenticated`, and `service_role`;
- `BEFORE INSERT OR UPDATE` trigger on `public.sale_listings`;
- SQLSTATE `23514` rejection for missing or cross-opportunity photo IDs.

The trigger does not alter valid rows; it only rejects states that violate the parent-photo invariant.

## Rollback-safe staging proof before merge

The exact candidate DDL was executed against the actual Wilmet managed database inside one transaction ending in `ROLLBACK`. Synthetic opportunities/photos/listings were created only inside that transaction.

| Case | Expected | Result |
| --- | --- | --- |
| INSERT with photo from same opportunity | allow | PASS |
| UPDATE to empty draft photo array | allow | PASS |
| UPDATE back to same-opportunity photo | allow | PASS |
| INSERT with other opportunity's photo | reject | PASS |
| UPDATE with other opportunity's photo | reject | PASS |
| UPDATE with nonexistent photo UUID | reject | PASS |
| Publish with same-opportunity photo | allow | PASS |
| Published listing changed to other opportunity's photo | reject | PASS |

Post-rollback checks proved:

- candidate trigger absent;
- candidate function absent;
- live sale-listing count remained at its original value of `0`.

Therefore this evidence is **rollback-tested implementation evidence**, not deployment evidence.

## Deployment acceptance

After the migration is merged and deployed, do not close TM-007 until the actual managed database proves:

- migration `20260819161931` is ledgered;
- `private.tg_sale_listing_photo_ownership_guard()` exists and is `SECURITY DEFINER` with the intended fixed search path;
- direct execute remains unavailable to client roles;
- `trg_sale_listing_photo_ownership_guard` exists on `public.sale_listings`;
- the live violation query returns zero rows;
- the negative/positive matrix is rerun against the deployed trigger inside `BEGIN ... ROLLBACK` without recreating the candidate DDL.

A GitHub merge or Lovable code synchronization alone is not sufficient evidence that the migration is deployed.
