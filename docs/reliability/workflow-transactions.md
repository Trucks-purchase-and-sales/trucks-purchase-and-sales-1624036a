# Workflow mutation atomicity

**Assessment date:** 2026-08-19  
**Target:** existing Lovable-managed Wilmet staging database  
**Database cloning/branching:** none

## Problem

Several inherited server functions performed one logical user action as multiple independent Supabase mutations and either ignored one of the errors or looped through writes without checking failures.

Confirmed source patterns included:

- seller answers an information request, then separately returns the opportunity to `envoyee`, with both database errors ignored;
- admin creates an information request, then separately changes the opportunity status, with the second error ignored;
- admin hands the opportunity back to the seller, then separately inserts the information-request audit trail, with the insert error ignored;
- photo reordering updates one row at a time without checking errors;
- main-photo selection first clears the old main flag and then separately sets the target, while the first error is ignored;
- photo deletion attempted Storage deletion without checking the Storage error.

A successful UI response must mean the logical mutation actually reached a consistent state. Logging or returning success after a partial mutation is not production-safe.

## Design

Multi-row PostgreSQL changes are moved to small `SECURITY INVOKER` RPCs. They preserve the existing RLS boundary and add only transaction semantics, validation, and row-count assertions.

### `answer_information_request`

Atomically:

1. transitions the writable request to `answered`;
2. stores the response (timestamps remain database-controlled by the existing guard trigger);
3. returns the seller-owned parent opportunity to `envoyee`.

If the parent cannot be updated, the information-request change rolls back.

### `admin_request_information`

Atomically:

1. verifies `admin` / `platform_admin` from the caller's own role row;
2. creates the information request;
3. moves the parent to `en_cours_analyse`.

A parent-update failure rolls the request insert back.

### `admin_handover_to_partner`

Atomically:

1. verifies trusted admin role;
2. sets `owner_side='partenaire'`, the handover message, and analysis status;
3. creates the corresponding information-request audit row.

A request-insert failure rolls the parent handover back.

### `reorder_vehicle_photos`

Accepts a bounded JSON array of unique photo IDs/order values. Every row must be writable through existing RLS. A missing, inaccessible, duplicate, malformed, or failing row aborts the entire reorder batch.

### `set_main_vehicle_photo`

Verifies the requested target, clears the current main flag, and selects the requested photo in one PostgreSQL transaction. If the target is missing or unwritable, the prior main photo is retained.

All RPCs revoke `PUBLIC` execution and explicitly grant only `authenticated`.

## Storage deletion

PostgreSQL and Supabase Storage cannot participate in one shared database transaction.

`deletePhoto` therefore uses the safer failure order:

1. delete and return the authorized metadata row first, proving mutation authority;
2. delete the corresponding private Storage object;
3. if the user-scoped Storage call fails, retry object cleanup with the trusted server client;
4. surface failure if cleanup still cannot be completed.

This favors a possible orphaned object over a database row pointing to a missing object, and it never reports success while a known cleanup error remains.

## Rollback-only database evidence

The transaction RPCs were created temporarily inside the existing Lovable database and exercised against `WIL-OPP-2026-0001` plus a disposable platform-admin identity.

Observed results before deliberate rollback:

- admin handover changed the parent and created the request together;
- seller answer marked the request `answered`, returned the parent to `envoyee`, and the existing parent guard returned ownership to Wilmet;
- admin request-info created its request and status transition together;
- a reorder batch containing one valid row followed by a missing UUID failed and left the first photo's original order unchanged;
- a valid two-photo reorder changed both values together.

The final probe exception rolled back the temporary RPC definitions, disposable identity/requests, parent state, and photo order values. Follow-up verification found:

- no disposable user;
- no disposable information request;
- original parent `owner_side='wilmet'`;
- photo order values restored to `0, 1`;
- no temporary RPC remained.

The main-photo RPC was tested separately in rollback-only mode:

- seller could not switch main photo while Wilmet owned the submitted dossier;
- after explicit hand-back, a valid switch succeeded;
- a later invalid target was rejected without clearing the valid selected main photo;
- deliberate rollback restored the original main-photo state and removed the temporary function.

## Application integration

Existing public server-function names stay stable for the UI:

- `answerInfoRequest` → `answer_information_request` RPC;
- `adminRequestInfo` → `admin_request_information` RPC;
- `adminHandoverToPartenaire` → `admin_handover_to_partner` RPC;
- `reorderPhotos` → `reorder_vehicle_photos` RPC;
- `setMainPhoto` → `set_main_vehicle_photo` RPC.

`deletePhoto` now checks both database and Storage outcomes and uses a trusted cleanup retry only after the caller's database mutation authorization has succeeded.

## Regression evidence

`tests/staging/workflow-transactions.staging.ts` uses disposable real Supabase Auth sessions on the same Lovable-backed staging environment and verifies:

- atomic handover + request creation;
- atomic seller answer + parent return;
- atomic admin request + parent status;
- failed reorder batch rolls back preceding row changes;
- valid reorder commits as one unit;
- invalid main-photo selection preserves the current main photo.

The normal PR gate compiles every `tests/staging/*.staging.ts` suite, and the guarded manual staging workflow runs them with real JWTs when staging credentials are configured.

## Remaining reliability follow-ups

This slice addresses the confirmed partial-write paths above. Other multi-system workflows—especially affiliate fast-track submission/notification and purchase-to-sale-listing orchestration—must receive the same failure/compensation review before final production sign-off.
