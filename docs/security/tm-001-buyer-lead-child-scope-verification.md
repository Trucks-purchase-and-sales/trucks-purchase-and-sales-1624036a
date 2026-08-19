# TM-001 — buyer-lead child scope verification

**Date:** 2026-08-19  
**Finding:** #21 / TM-001  
**Proposed migration:** `supabase/migrations/20260819001000_buyer_lead_child_parent_scope.sql`

## Security invariant

`buyer_lead_matches` and `buyer_lead_status_history` must never grant a caller more access than the parent `buyer_leads` record, and the child-table role contract must not become broader than it was before the remediation.

The intended role population is:

- admin / platform admin: global read/write through the canonical helpers;
- company management: global read-only;
- sales manager: global read/write through the canonical helpers;
- internal sales agent: only direct assignment, group membership, or the allowed unassigned sales pool according to the parent `buyer_leads` scope;
- external agent: no match/history access under the pre-existing child-table role contract, even though the generic pipeline helper can authorize direct assignments on other pipeline resources;
- normal partner/client: no internal match/history access.

The explicit role predicate around the canonical helper is therefore intentional: it prevents this fix from accidentally broadening these internal child tables to `external_agent` merely because the generic pipeline helper supports that actor elsewhere.

## Verification method

The exact proposed policy definitions were executed against the Lovable/Supabase staging PostgreSQL database inside a single explicit transaction and followed by `ROLLBACK`.

Two existing staging Auth identities were used only as valid UUID/FK anchors. Inside the rollback-only transaction:

- one identity's `user_roles` row was temporarily switched through the roles under test;
- three temporary buyer leads and corresponding match/history fixtures were created with explicit reference numbers so the reference sequence was not advanced;
- the test switched to the PostgreSQL `authenticated` role;
- `request.jwt.claim.sub` and `request.jwt.claim.role` were set to model the relevant signed-in identity;
- reads and writes were performed directly against the RLS-protected child tables;
- all temporary role changes, policies, and fixture data were rolled back.

No production/customer row was permanently changed and no sequence value was consumed by the test fixtures.

## Full role-matrix results

A second-engineer verification pass expanded the original scoped-agent cases to the complete role contract required by #21.

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Internal sales agent reads match whose parent is directly assigned to caller | allowed | visible | PASS |
| Internal sales agent reads match whose parent is assigned to another identity | denied | hidden | PASS |
| Internal sales agent reads status history for assigned parent | allowed | visible | PASS |
| Internal sales agent reads status history for another assignment | denied | hidden | PASS |
| Internal sales agent updates match under assigned parent | allowed | 1 row | PASS |
| Internal sales agent updates match under another assignment | denied | 0 rows | PASS |
| Admin reads an otherwise out-of-scope match | allowed globally | visible | PASS |
| Admin updates an otherwise out-of-scope match | allowed globally | 1 row | PASS |
| Sales manager reads an otherwise out-of-scope match | allowed globally | visible | PASS |
| Sales manager updates an otherwise out-of-scope match | allowed globally | 1 row | PASS |
| Company management reads an otherwise out-of-scope match | allowed globally | visible | PASS |
| Company management updates a match | denied/read-only | 0 rows | PASS |
| External agent reads directly assigned parent match | denied by existing child-table role contract | hidden | PASS |
| External agent reads directly assigned parent status history | denied by existing child-table role contract | hidden | PASS |
| Client owner reads their own parent lead's internal match row | denied | hidden | PASS |
| Client owner reads their own parent lead's internal status-history row | denied | hidden | PASS |
| Unrelated partner reads another client's internal match row | denied | hidden | PASS |

The earlier verification also exercised INSERT behavior:

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Insert match under in-scope parent | allowed | inserted inside transaction | PASS |
| Insert match under out-of-scope parent | denied | RLS rejection | PASS |

## Rollback integrity proof

After the expanded matrix completed and `ROLLBACK` executed, a separate read-only query verified:

- both original broad `buyer_lead_matches` policies were present again;
- the original broad `buyer_lead_status_history` policy was present again;
- zero temporary buyer-lead fixtures remained;
- zero temporary match fixtures remained;
- the temporarily changed identity had its original `partenaire` role again.

This confirms that the verification changed no retained staging authorization state or business data.

## Assessment

The proposed migration correctly makes the two child resources inherit their parent lead's canonical read/write scope while preserving the existing child-table role population and company-management read-only semantics.

The PostgreSQL/RLS acceptance evidence for #21 is satisfied for the tested role matrix. The issue must still retain the release-gate requirement for a real Supabase-issued JWT E2E pass after the migration is permanently applied to staging.

## Important limitation

This verification exercises PostgreSQL RLS with an existing Auth identity and transaction-local JWT claims. It is stronger than static policy inspection, but it does **not** replace the separate real-JWT staging harness or browser/application-path E2E verification required before production release.

## Deployment status

At the time this evidence was recorded, the migration existed only on the remediation branch and staging had been rolled back to its original policies. Permanent staging application must happen only after the migration is reviewed and merged through the controlled database deployment process.
