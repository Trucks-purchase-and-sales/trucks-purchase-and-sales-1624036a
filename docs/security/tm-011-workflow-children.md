# TM-011 — workflow child authorization verification

**Assessment date:** 2026-08-19  
**Environment:** existing Lovable-managed Wilmet staging database  
**Database cloning/branching:** none

## Scope

This slice reviews child records consumed by the internal opportunity detail workflow:

- `opportunity_status_history`;
- `information_requests`;
- `opportunity_activities`.

The parent `vehicle_opportunities` record already uses the canonical pipeline helpers. These child tables still used older bespoke policies and therefore did not consistently inherit the parent authorization contract.

## Findings before remediation

### Status history under-read

`status_history_select_owner_or_admin` allowed only the seller or `admin`. A correctly scoped sales employee could read the parent opportunity but not its workflow history.

### Information-request under-read and admin mismatch

`info_req_select_owner_or_admin` had the same under-read for scoped staff.

The application server's `assertAdmin(...)` contract accepts both `admin` and `platform_admin`, while the legacy information-request INSERT/UPDATE policies and owner-guard trigger trusted only `admin`. This created a server/database authorization mismatch for platform administrators.

The partner answer path also accepted caller-provided `answered_at` / `response_at` timestamps and did not make an already-answered response immutable.

### Internal activity confidentiality leak

`activities_select_admin_or_owner` allowed the seller to read **every** activity attached to their own opportunity, including internal CRM `call`, `email`, `meeting`, and `task` rows.

A rollback-only synthetic internal call activity on existing opportunity `WIL-OPP-2026-0001` proved the mismatch:

- seller internal-activity rows visible: **1**;
- correctly scoped purchase `sales_agent` rows visible: **0**.

The deliberate final exception rolled back the synthetic user/activity. Follow-up verification found zero residue.

## Intended contract

### `opportunity_status_history`

- seller can read history for their own opportunity;
- non-draft staff inherits `private.can_read_pipeline_record(...)` from the parent;
- unrelated partners cannot read it.

### `information_requests`

- seller can read requests for their own opportunity;
- non-draft staff inherits parent read scope;
- trusted administration is `admin` **or** `platform_admin`, matching server authorization;
- partner answer timestamps are database-controlled;
- once answered, partner response content is immutable.

### `opportunity_activities`

- internal CRM activity is readable only through parent pipeline authorization;
- seller does **not** see staff-authored call/email/meeting/task rows;
- seller may see only their own authored `note` rows;
- staff activity insertion requires a writable, non-draft parent in caller scope;
- seller note insertion requires own opportunity plus draft or explicit `owner_side='partenaire'` hand-back;
- administrative update/delete accepts `admin` and `platform_admin`.

## Rollback-only migration matrix

The proposed migration was installed inside a transaction against the existing Lovable staging database. Disposable staff/platform-admin identities and workflow rows were created, tested, and then removed by a deliberate final exception.

Observed results:

| Check | Result |
| --- | --- |
| seller sees own status history | PASS — 1+ row |
| scoped purchase agent sees parent status history | PASS — 1+ row |
| unrelated partner sees status history | PASS — 0 |
| seller sees own information request | PASS — 1 |
| scoped purchase agent sees information request | PASS — 1 |
| unrelated partner sees information request | PASS — 0 |
| seller sees synthetic internal call activity | PASS — 0 |
| scoped purchase agent sees internal call activity | PASS — 1 |
| scoped purchase agent inserts internal task | PASS — 1 |
| platform admin inserts information request | PASS — 1 |
| platform admin updates information request | PASS — 1 |
| partner rewrites an already-answered request | PASS — blocked |
| forged year-2000 answer timestamps | PASS — replaced by current database timestamps |

Rollback integrity after the probe:

- disposable Auth users absent;
- disposable information requests absent;
- disposable activities absent;
- original legacy policies restored before permanent deployment.

## Migration

`20260819005000_workflow_children_parent_scope.sql`

The migration:

1. parent-scopes status-history SELECT;
2. parent-scopes information-request SELECT;
3. aligns information-request trusted administration with `admin` + `platform_admin`;
4. canonicalizes partner answer timestamps and prevents answer rewriting;
5. hides internal CRM activities from the seller;
6. gives legitimate staff read/write access through the canonical parent pipeline helpers;
7. allows seller-authored notes only while the seller legitimately controls the parent workflow.

## Real-JWT regression suite

`tests/staging/workflow-children.staging.ts` uses disposable real Supabase Auth sessions and the same Lovable-backed staging database to verify:

- status-history parent scope;
- information-request read scope;
- platform-admin insert/update behavior;
- database-controlled answer timestamps;
- answered-response immutability;
- internal-activity confidentiality;
- scoped staff activity insertion;
- seller note denial while Wilmet owns the dossier;
- seller note allowance during explicit hand-back.

Every staging security harness is now compiled by normal PR CI and executed by the guarded manual staging workflow via `tests/staging/*.staging.ts`.

## Remaining TM-011 work

After this slice, continue the child-resource matrix for any remaining parent-linked tables that still use bespoke authorization. Do not close TM-011 globally until the inventory is complete and any application-layer false-success paths are corrected.
