# Threat Model — Wilmet Trucks

_Date: 2026-08-23 · Author: V2P pipeline (Claude) · Environment audited: repo/code,
cross-checked against a live read-only `pg_tables`/`pg_policies` query run by Salma
against production on 2026-08-23 (see [ADR-004](decisions/ADR-004-phase1-starts-before-phase0.5-signoff.md)
for why this started ahead of the Phase 0.5 functional sign-off)._

## Assets & sensitivity

| Asset (table/bucket/function) | Data type | Sensitivity (PII/cred/payment/none) | Who SHOULD access |
|---|---|---|---|
| `profiles` | name, email, phone, company, city, country, commission_rate | PII + financial | Self (own row, restricted fields), staff, service_role |
| `user_roles` | role assignments | authorization root — treat as credential-equivalent | Self (read own), staff/service_role (write) |
| `vehicle_opportunities` | purchase/sale prices, margins, contact PII, VIN, registration | financial + PII | Assigned staff, owning partner, admins |
| `buyer_leads`, `demand_opportunities` | name, email, phone, company, budget, payment method | PII + financial | Assigned staff, admins |
| `opportunity_commissions`, `commission_rules` | commission amounts/formulas | financial, competitively sensitive | Admins, company_management (read), the earning partner (own rows) |
| `audit_logs` | action, actor, entity, metadata | tamper-evidence trail — integrity-critical, not just confidential | Admins (read-only ideally); nothing should be able to delete/alter it |
| `sale_listings` | purchase/sale price, buyer reference | financial + PII-adjacent | Assigned staff, admins |
| `opportunity_documents`, `ocr_scans`, `vehicle-photos` bucket | uploaded ID/registration documents, photos | PII-adjacent / documents | Assigned staff, owning partner |
| `internal_notes`, `opportunity_activities` | free-text CRM notes | may contain PII pasted by staff | Internal staff only |
| `client_quotes`, `cost_estimates`, `purchase_evaluations`, `resale_listings`, `marketplace_inquiries` | opaque `data` Json, schema not typed | likely PII/financial — unverified | Unknown — needs typing/verification |
| `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | credentials | credential | Server runtime only, never the browser bundle |
| `ref_*` tables (11) | vehicle taxonomy lookups | none | Anyone (public reference data) |

## Roles

| Role | Description | Intended access |
|---|---|---|
| anon | unauthenticated visitor | public routes, legal pages, vehicle browse/search, rate-limited public lead-capture forms |
| authenticated (no role row) | logged-in user with no `user_roles` entry | own `profiles` row, own `dashboard`/`profile`; blocked from every role-gated route |
| `partenaire` (client) | external buyer partner | own leads/demands/opportunities as `partenaire_id = auth.uid()`; `/espace-acheteur`, `/mes-demandes` |
| `partenaire` (seller) | external seller partner | own vehicle-sale opportunities as owner; restricted column set enforced by `tg_opp_partner_column_guard` |
| `apporteur` | referral/commission beneficiary | own commission rows only |
| `sales_agent` / `external_agent` | internal/external sales staff | assigned pipeline records; `/sales` |
| `sales_manager` | pipeline manager | broader pipeline read/write; `/manager`, several `/admin/*` sub-pages |
| `company_management` | "Direction" | mostly read-only across commissions/dossiers; `/direction` |
| `admin` / `platform_admin` | privileged | near-full access; only roles allowed on `/admin/audit`, `/admin/settings`, `/admin/users` |

`admin` and `platform_admin` were not observed to differ in any check found in this
pass — worth confirming in Phase 2 whether that's intentional or `platform_admin` was
meant to be strictly broader/narrower.

## Threats & current control

| Asset | Threat | Realistic? | Current control | Status (verify/ok/gap) |
|---|---|---|---|---|
| `user_roles` | self-privilege-escalation (authenticated user inserts own `admin` row) | was plausible pending verification | **verified live:** RLS enabled, only a self-or-admin SELECT policy exists — no INSERT/UPDATE/DELETE policy at all, so this is not reachable through the normal client connection | ✅ **ok — verified 2026-08-23** |
| `commission_rules` | anon/authenticated read of commission formulas | was possible pending verification | **verified live:** RLS enabled, ALL for admin + SELECT for staff, no anon policy anywhere | ✅ **ok — verified 2026-08-23** |
| `audit_logs` | authenticated user alters/deletes their own trail after an abuse | was plausible pending verification | **verified live:** RLS enabled, admin-only SELECT, no INSERT/UPDATE/DELETE policy at all — the trail cannot be written or altered through the normal client connection | ✅ **ok — verified 2026-08-23** |
| `profiles` | cross-user read of other users' PII/commission_rate | was plausible pending verification | **verified live:** `profiles_select_self_or_admin` SELECT policy, `profiles_update_self` UPDATE, no INSERT policy; self-update fields additionally guarded by `tg_profile_self_update_guard` | ✅ ok — verified 2026-08-23 |
| `profiles` | self-escalation via direct UPDATE (e.g. setting own `commission_rate`, `is_active`, `partner_kind`) | mitigated | `tg_profile_self_update_guard` trigger blocks these fields unless `auth.role() = 'service_role'` | ok (verify trigger can't be bypassed via RPC) |
| `vehicle_opportunities` | partner sets staff-only/financial columns via INSERT/UPDATE | mitigated | `tg_opp_partner_column_guard` state-machine trigger | ok (verify edge cases in Phase 2) |
| `opportunity_commissions` | partner reads another partner's commission | mitigated | `op_comm_partner_read_scoped` requires `partenaire_id = auth.uid()` | ok |
| `vehicle_photos` / `vehicle-photos` bucket | cross-opportunity read of private vehicle photos | mitigated | parent-scoped RLS + private (non-public) bucket, keyed on folder name | ok (spot-check folder-naming assumption holds) |
| `information_requests` | partner answers a request more than once or edits admin's message | mitigated | `tg_info_req_owner_guard` restricts to one `status='answered'` transition | ok |
| `ocr_scans`, `match_candidates`, `internal_notes`, `notifications`, `staff_groups`, and the rest of the 52 tables | anon or cross-user read/write | **fully verified live**, including exact `USING`/`WITH CHECK` text (`evidence/phase2-rls-audit.txt`) | real, correctly-scoped policies on every table; every `USING (true)`/`WITH CHECK (true)` found is on intentionally-public reference data (`ref_*`, `site_content`) only | ✅ **ok — logic independently re-derived, 2026-08-23** |
| `demand_opportunity_status_history` | forged status-history entry via direct client INSERT | unlike its sibling history tables, this one has a client-reachable INSERT policy | **verified:** `WITH CHECK` restricts insert to admin/platform_admin/company_management/sales_manager, or the specific demand's assigned sales agent — not open to end users | ✅ ok — verified 2026-08-23 |
| 6 tables with only a `future_admin_read` policy (`client_quotes`, `cost_estimates`, `marketplace_inquiries`, `options_prioritaires`, `purchase_evaluations`, `resale_listings`) | none currently — no INSERT policy exists on any of them | none — this looks like unused schema staged for unbuilt features | n/a (functional question, not a security gap) | to confirm with Salma whether these are in use |
| `rate_limit_events` | anon/authenticated read or write of rate-limit tracking data | RLS enabled, zero policies — fully deny-all through the client | intentional: the only write path is `rate_limit_check()`, an RPC hard-gated to `service_role` only | ✅ ok — verified 2026-08-23 |
| `LOVABLE_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | secret exfiltration into the client bundle | low — both confirmed read only in server-only files/server-fn bodies in this pass | server-side only (verified by grep, not yet verified in the built bundle) | to verify — run `pipeline/security/secret-scan.sh` (Appendix C) against the actual production bundle once the build/publish issue is resolved |
| RPC functions (`admin_request_information`, `admin_handover_to_partner`) | unauth call / privilege escalation | low | `INVOKER` security + explicit in-body role check | ok |
| `rate_limit_check` | bypass via direct RPC call as non-service_role | mitigated | hard `RAISE EXCEPTION` unless caller is `service_role` | ok |
| Public lead-capture endpoints (`/api/public/buyer-leads`, `/assistant`, `/affiliate-click`, `/signup-check`) | spam/abuse, credential stuffing via a public endpoint | low-medium | per-IP rate limits (3–30 requests per 10 min/hour depending on endpoint); `buyer-leads` explicitly rejects Bearer-authenticated requests | ok (verify rate limits survive behind any CDN/proxy that changes the observed IP) |

## Open questions to resolve in Phase 2

- ~~Confirm the actual RLS state of `user_roles`, `commission_rules`, and
  `audit_logs`~~ — **resolved 2026-08-23**, see the Threats table above.
- ~~Pull the exact `USING`/`WITH CHECK` clause text for each policy~~ — **resolved
  2026-08-23**: section 9.1 (audit RLS by hand) is complete, zero Critical/High
  findings, full text in `evidence/phase2-rls-audit.txt`.
- ~~Confirm `demand_opportunity_status_history`'s client-reachable INSERT policy is
  scoped correctly~~ — **resolved 2026-08-23**: it is, see the Threats table above.
- **New from the full policy read:** a handful of policies check only `admin` where
  most others check `admin` OR `platform_admin` via `has_any_role` — specifically
  `profiles_select_self_or_admin`, `user_roles_select_self_or_admin`, and the six
  `future_admin_read` policies. This makes `platform_admin` *more* restricted than
  `admin` in exactly these spots, which cuts against the assumption everywhere else in
  the app that the two roles are equivalent. Likely a functional gap (a `platform_admin`
  can't view another user's profile or role), not a security risk — worth confirming
  intent in Phase 3.
- Reconstruct and commit a baseline migration reflecting the live RLS/schema state, so
  the documentation gap (RLS setup existing only in the live project, not in version
  control) doesn't recur and future changes can be diffed and reviewed.
- ~~9.2 (active probing): a staging Supabase project and test-user accounts per
  role~~ — **resolved 2026-08-23**: staging rebuilt from `apps/wilmet/staging-schema.sql`
  (see ADR-005), 3 test users created, and `pipeline/security/rls-probe.mjs` run against
  it live. Zero leaks: anonymous users get 0 rows from all 52 tables and a realistic
  write attempt is rejected with Postgres's own RLS-violation error (not just a script
  artifact — verified by hand); an authenticated non-staff test user saw exactly their
  own 1 seeded row and nothing belonging to anyone else. Full output in
  `evidence/phase2-rls-probe.txt`. This closes out every section of Phase 2 (9.1, 9.2, 9.3).
- Confirm with Salma whether `client_quotes`, `cost_estimates`, `marketplace_inquiries`,
  `options_prioritaires`, `purchase_evaluations`, `resale_listings` are in active use —
  they currently have no write path at all.
- Type the opaque `data: Json` columns on `client_quotes`, `cost_estimates`,
  `purchase_evaluations`, `resale_listings`, `marketplace_inquiries`, `options_prioritaires`
  — can't assess their actual sensitivity or exposure without knowing their real shape.
- Verify `admin` vs `platform_admin` is an intentional distinction or accidental
  duplication throughout the codebase.
- Locate the storage bucket (if any) actually used for `opportunity_documents.storage_path`
  and `ocr_scan_sources.storage_path` — not found in this pass.
- Add `LOVABLE_API_KEY` to `.env.example` for onboarding completeness (minor, not a
  security gap since the running app already has it via Lovable Cloud).
- Once the Phase 0.5 database/env-var issue is resolved and the app is confirmed
  functional, re-run `pipeline/security/secret-scan.sh` against the actual built/published
  bundle to independently confirm no service-role key or API key leaked into client code —
  the grep-based check in this pass covers source only, not the compiled output.
