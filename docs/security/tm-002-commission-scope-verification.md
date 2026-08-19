# TM-002 — commission financial scope verification

**Date:** 2026-08-19  
**Finding:** #22 / TM-002  
**Proposed migration:** `supabase/migrations/20260819002000_opportunity_commission_parent_scope.sql`

## Approved visibility model

The remediation follows the authorization model already used by the parent `vehicle_opportunities` pipeline instead of inventing a separate sales scope:

- `admin` / `platform_admin`: global commission read/write through the existing `op_comm_admin_all` policy;
- `sales_manager`: global read of commissions whose parent opportunity is not a draft; no commission mutation;
- `company_management`: global read of commissions whose parent opportunity is not a draft; no commission mutation;
- internal `sales_agent`: read only when the non-draft parent opportunity is inside the canonical assignment/group/staff-scope boundary; no commission mutation;
- `partenaire` / legacy `apporteur`: read only rows where `partenaire_id = auth.uid()`; no commission mutation;
- `external_agent`, buyer/client roles and unrelated authenticated users: no finance access through these policies.

Commission approval, cancellation, payment marking, rule changes and draft editing remain admin/platform-admin operations at both the server and RLS layers.

## Important inherited defect found during verification

The original `op_comm_partner_read` policy was only:

```sql
partenaire_id = auth.uid()
```

It did **not** require a partner role. During the first rollback-only probe an identity temporarily assigned only `external_agent` could still see a commission because its UUID appeared in `partenaire_id`.

The migration was corrected before review/merge to require both:

1. `partenaire_id = auth.uid()`; and
2. an actual `partenaire` or legacy `apporteur` role.

This prevents an unrelated authenticated role from inheriting financial visibility merely because its UUID is stored as the beneficiary.

## Staff policy

The inherited global `op_comm_staff_read` policy is replaced with a parent-derived policy. An internal staff reader must satisfy the explicit finance role population **and** the parent opportunity must:

- be non-draft; and
- pass `private.can_read_pipeline_record(...)` using the purchase-side assignment/group scope.

The explicit role predicate intentionally excludes `external_agent` even though the generic pipeline helper supports direct external assignments on other resources.

## Rollback-only staging verification

The exact proposed policy DDL was applied to the connected Lovable/Supabase staging database inside `BEGIN ... ROLLBACK`.

Temporary opportunities and commission rows used fixed references/UUIDs to avoid consuming application sequences. A real staging Auth identity was used only as a valid FK/JWT-subject anchor; its role was switched inside the transaction for each scenario and fully restored by rollback.

### Final matrix

| Case | Expected | Result |
| --- | --- | --- |
| Scoped sales agent reads in-scope non-draft commission | allow | PASS |
| Scoped sales agent reads cross-assignment commission | deny | PASS |
| Scoped sales agent reads directly assigned draft-parent commission | deny | PASS |
| Sales agent mutates commission | deny | PASS |
| Sales manager reads non-draft commission globally | allow | PASS |
| Sales manager reads draft-parent commission | deny | PASS |
| Sales manager mutates commission | deny | PASS |
| Company management reads non-draft commission globally | allow | PASS |
| Company management mutates commission | deny | PASS |
| External agent whose UUID is beneficiary reads commission | deny | PASS |
| Buyer whose UUID is beneficiary reads commission | deny | PASS |
| `partenaire` reads own commission | allow | PASS |
| `partenaire` reads another beneficiary's commission | deny | PASS |
| `partenaire` mutates own commission | deny | PASS |
| legacy `apporteur` reads own commission | allow | PASS |
| Admin reads finance rows globally, including draft parent | allow | PASS |
| Admin mutates commission | allow | PASS |

**Result: 17/17 PASS.**

After rollback, a separate read-only check confirmed:

- original `op_comm_staff_read` restored;
- original `op_comm_partner_read` restored;
- proposed policies absent;
- zero temporary opportunity rows remained;
- zero temporary commission rows remained;
- the staging identity's original `partenaire` role was restored.

## Server/UI consumer review

`src/lib/commissions.functions.ts` uses the authenticated user's Supabase client for commission reads; it does not switch read paths to the service-role client. Therefore the new RLS policy remains authoritative for:

- `listCommissions`;
- `opportunityCommission`;
- `partnerCommissionSummary`.

Privileged mutation server functions (`approveCommission`, `markCommissionPaid`, `cancelCommission`, `updateCommissionDraft`, commission-rule mutations) already perform an explicit admin/platform-admin check, and the database mutation policy independently permits only admin/platform-admin.

The partner-facing summary explicitly filters `partenaire_id = context.userId`; after the role-gated partner RLS change, a buyer or external agent cannot obtain finance rows merely by calling that function.

The admin commissions route is limited to admin/platform-admin/sales-manager/company-management. Sales-manager and company-management mutation attempts remain server-rejected and RLS-rejected; hiding those admin-only controls for read-only viewers is a UX-hardening follow-up, not an authorization dependency.

## Remaining release evidence

This transaction-local RLS proof does not replace real Supabase-issued JWT/application-path verification. The merged staging E2E harness and overarching P0 release gate in #9 remain responsible for that final evidence.
