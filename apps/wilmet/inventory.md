# Inventory — Wilmet Trucks (one-page attack surface)

_Date: 2026-08-23 · Author: V2P pipeline (Claude) · Source: static repo analysis only
(code + `src/integrations/supabase/types.ts` + `supabase/migrations/*.sql`), no live
database access yet. See [ADR-004](decisions/ADR-004-phase1-starts-before-phase0.5-signoff.md)
for why this was compiled ahead of the Phase 0.5 functional sign-off._

## Tables

52 tables in `public`. RLS column reflects only what is provable from the 24 tracked
migrations — a checkmark means a `CREATE POLICY` was found; "**unknown**" means no
`ENABLE/DISABLE ROW LEVEL SECURITY` or `CREATE POLICY` statement exists in version
control for that table at all (see "RLS blind spot" below).

| Table | Columns (sensitive?) | RLS provable in repo? | Policies found |
|---|---|---|---|
| `profiles` | email, first/last name, phone, company, city, country, commission_rate — **PII + financial** | partial | INSERT revoked from `authenticated`/`anon` (only `handle_new_user` trigger / service_role can insert); self-update guarded by trigger; SELECT/base UPDATE policy not in tracked migrations (pre-existing, untracked) |
| `user_roles` | user_id, role — **authorization root** | **unknown** | none found in any of 24 migrations |
| `vehicle_opportunities` | purchase/sale/margin prices, contact name/email/phone, VIN, registration — **financial + PII** | yes | scoped SELECT/UPDATE/INSERT via `can_read/write_pipeline_record`; partner-update policy; column-guard trigger |
| `buyer_leads` | name, email, phone, company, budget, payment method — **PII + financial** | yes | scoped SELECT/UPDATE/INSERT |
| `buyer_lead_matches` | AI match scores/notes | yes | scoped SELECT/INSERT/UPDATE/DELETE via parent `buyer_leads` |
| `buyer_lead_status_history` | status transitions | yes | SELECT only (system/trigger-written) |
| `demand_opportunities` | budget, assigned staff, vehicle prefs | yes | scoped SELECT/UPDATE/INSERT |
| `demand_opportunity_status_history` | status transitions | **unknown** | none found |
| `opportunity_commissions` | basis/computed amount EUR, status, partner — **financial** | yes | partner-scoped SELECT, staff-scoped SELECT (admin-all policy referenced but not in tracked files) |
| `opportunity_documents` | storage_path (ID/registration docs) | yes | SELECT/INSERT/UPDATE/DELETE, internal roles + parent scope |
| `opportunity_decisions` | AI verdict/score | yes | SELECT/INSERT/UPDATE/DELETE, internal roles + parent scope |
| `opportunity_status_history` | status transitions | yes | SELECT only |
| `opportunity_activities` | free-text CRM notes | yes | SELECT/INSERT/UPDATE/DELETE, staff + partner-note-own scoping |
| `information_requests` | admin↔partner messages | yes | SELECT parent-scoped; INSERT/UPDATE admin-only; owner-guard trigger |
| `vehicle_photos` | storage_path | yes | SELECT/INSERT/UPDATE/DELETE parent-scoped |
| `sale_listings` | purchase/sale price EUR, sold_to — **financial + PII-adjacent** | yes | scoped SELECT/UPDATE/INSERT; photo-ownership trigger |
| `app_settings` | key/value config | partial | SELECT admin-only; no INSERT/UPDATE policy found despite a table GRANT to `authenticated` |
| `commission_rules` | commission % / formulas — **financial, competitively sensitive** | **unknown** | none found |
| `audit_logs` | action, actor, metadata — **tamper-evidence trail** | **unknown** | none found |
| `internal_notes` | free-text CRM notes | **unknown** | none found |
| `notifications` | user_id, title, body | **unknown** | none found |
| `match_candidates` / `match_feedback` / `match_runs` / `matching_profiles` | AI matching internals, prompt/token telemetry | **unknown** | none found |
| `ocr_scans` / `ocr_scan_sources` / `ocr_field_detections` | uploaded document OCR results | **unknown** | none found |
| `client_quotes` / `cost_estimates` / `purchase_evaluations` / `resale_listings` / `options_prioritaires` / `marketplace_inquiries` | opaque `data` Json — **contents untyped, likely PII/financial** | **unknown** | none found |
| `affiliate_links` / `affiliate_clicks` | referral codes, click fingerprint hash | **unknown** | none found |
| `staff_groups` / `staff_group_members` | internal team structure | **unknown** | none found |
| `user_preferences` | locale only | **unknown** (low sensitivity) | none found |
| `rate_limit_events` | hashed key, bucket | **unknown** (low sensitivity) | none found |
| `site_content` | CMS-style key/locale/value | **unknown** (low sensitivity) | none found |
| `ref_*` (11 tables: body_types, category_brands, countries, equipment, euro_standards, fuel_types, gearbox_types, vehicle_brands, vehicle_categories, vehicle_models, vehicle_types) | static lookup data | **unknown** (low sensitivity — public reference data) | none found |

**RLS blind spot:** none of the 24 tracked migrations contain the original `CREATE TABLE`
or baseline `ENABLE ROW LEVEL SECURITY` statements for any table — they are all
incremental hardening/correction migrations dated 2026-08-17 through 2026-08-19. The
baseline schema and RLS setup exist only in the live Supabase project, not in this repo.
**Top priority for Phase 2 (§9.1):** confirm the actual RLS state of `user_roles`,
`commission_rules`, and `audit_logs` first — these three carry the highest impact if
open (privilege escalation, competitive/financial exposure, and audit-trail tampering
respectively).

## Roles

Stored in `public.user_roles` (`user_id`, `role app_role`) — not a column on `profiles`.
`profiles.partner_kind` (`client`/`seller`) and `profiles.staff_scope`
(`purchase`/`sales`/`both`) are separate attributes used alongside roles for scoping.

| Role | Source | Notes |
|---|---|---|
| `admin` | `app_role` enum | Full/near-full internal access across most gated routes and RLS policies |
| `platform_admin` | `app_role` enum | Paired with `admin` everywhere observed — functionally equivalent in every check found |
| `sales_manager` | `app_role` enum | Sales pipeline manager; gates `/manager`, several admin sub-pages |
| `sales_agent` | `app_role` enum | Internal sales staff; gates `/sales` |
| `external_agent` | `app_role` enum | External/contractor sales-side agent; gates `/sales`, distinct RLS treatment (`is_external_agent`) |
| `company_management` | `app_role` enum | "Direction" role; mostly read-only on commissions/dossiers |
| `partenaire` | `app_role` enum | External partner; further split by `profiles.partner_kind` into buyer (`client`) vs seller |
| `apporteur` | `app_role` enum | Referral/commission beneficiary role |
| `buyer` | `app_role` enum | Present in enum and an admin role-picker UI; not observed gating any route |
| `commercial_future`, `client_future` | `app_role` enum | Reserved/unused — no code reference found anywhere |

Role checks happen **client-side**: `src/lib/route-guards.ts`'s `requireAnyRole()` queries
`user_roles` via the browser Supabase client inside each route's `beforeLoad` and redirects
if no matching row exists. This makes the (currently unverified) RLS state of `user_roles`
itself load-bearing for every route guard in the app.

## Routes / pages

59 route files. Every route under `_authenticated/` inherits a base "must have a session"
check from `src/routes/_authenticated/route.tsx`; role-restricted routes add their own
`beforeLoad`.

| Path | Auth required? | Role |
|---|---|---|
| `/`, `/cgu`, `/cgv`, `/confidentialite`, `/cookies`, `/mentions-legales`, `/chercher-un-vehicule*`, `/vehicules*`, `/reset-password` | no | — |
| `/auth` | no (redirects away if already logged in) | — |
| `/api/public/affiliate-click`, `/api/public/assistant`, `/api/public/signup-check` | no | IP rate-limited, no role |
| `/api/public/buyer-leads` | no | IP rate-limited; explicitly rejects requests carrying a Bearer auth header |
| `/dashboard`, `/profile`, `/opportunities/*`, `/mes-commissions`, `/mes-demandes-clients`, `/mes-echanges`, `/mon-lien` | yes | any authenticated user |
| `/espace-acheteur`, `/mes-demandes` | yes | internal staff (view-only) OR `partner_kind = client` |
| `/admin/*` (parent gate) | yes | `admin, platform_admin, sales_manager, sales_agent, external_agent, company_management` |
| `/admin/audit`, `/admin/content`, `/admin/notifications`, `/admin/reference`, `/admin/settings`, `/admin/users` | yes | `admin, platform_admin` only |
| `/admin/partenaires` | yes | `admin, platform_admin, sales_manager` |
| `/admin/commissions`, `/admin/affiliation` | yes | `admin, platform_admin, sales_manager, company_management` |
| `/direction` | yes | `company_management, platform_admin, admin` |
| `/manager` | yes | `sales_manager, platform_admin, admin` |
| `/sales` | yes | `sales_agent, external_agent, sales_manager, platform_admin, admin` |

## Edge Functions

None. Wilmet uses TanStack Start server functions (`*.functions.ts`, `.server.ts`) instead
of Supabase Edge Functions for all server-side logic.

## RPC (Postgres) functions

| Function | Security | Purpose |
|---|---|---|
| `buyer_lead_reference` | DEFINER | Public: returns only a lead's reference number by id |
| `rate_limit_check` | DEFINER | Sliding-window rate limiter; hard-fails unless called as `service_role` |
| `answer_information_request` | INVOKER (RLS-backed) | Partner answers an admin information request atomically |
| `admin_request_information` | INVOKER + in-body role check | Admin requests info from a partner atomically |
| `admin_handover_to_partner` | INVOKER + in-body role check | Admin hands an opportunity back to partner atomically |
| `reorder_vehicle_photos` | INVOKER | Bulk photo sort-order update, all-or-nothing |
| `set_main_vehicle_photo` | INVOKER | Atomically swaps the main-photo flag, row-locked |
| `private.can_read/write_pipeline_record`, `can_read/write_all_pipeline`, `is_internal_sales_agent`, `is_external_agent`, `staff_scope_allows` | DEFINER | Authorization predicates used inside nearly every pipeline RLS policy |
| `private.has_role`, `has_any_role`, `get_partner_kind`, `is_group_member`, `public.handle_new_user` | unknown | Referenced throughout but **not defined in any tracked migration** — exist only in the untracked baseline |

Trigger guards worth noting as compensating controls: `tg_opp_partner_column_guard`
(blocks non-staff from setting financial/status columns on opportunities),
`tg_profile_self_update_guard` (blocks self-escalation via profile fields),
`tg_info_req_owner_guard`, `tg_sale_listing_photo_ownership_guard`.

## Storage buckets

| Bucket | Public? | Policy |
|---|---|---|
| `vehicle-photos` | No (private, 10 MiB cap, image MIME types only) | RLS-scoped to the parent `vehicle_opportunities` row via folder-name matching |

`opportunity_documents.storage_path` and `ocr_scan_sources.storage_path` reference file
paths but no dedicated bucket usage was found in `src/` for either — needs verification
in Phase 2 (may reuse `vehicle-photos` or point at an as-yet-unidentified bucket).

## Integrations & secrets

| Integration | Key type | Where stored |
|---|---|---|
| Supabase (browser) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (public by design) | `src/integrations/supabase/client.ts` — intentionally client-bundled |
| Supabase (server) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server-only files/server-fn bodies |
| Supabase (admin) | `SUPABASE_SERVICE_ROLE_KEY` | Only `src/integrations/supabase/client.server.ts` — never elsewhere (verified) |
| Lovable AI Gateway (Google Gemini, via OpenAI-compatible proxy) | `LOVABLE_API_KEY` | Server-fn bodies only (assistant chat, dossier AI, OCR, voice transcription, matching) — **not documented in `.env.example`**, should be added |

No Stripe, email (Resend/SendGrid/SMTP), SMS, or analytics/error-tracking vendor
integration exists in the codebase. Client-side error reporting is a
`window.__lovableEvents` hook injected by the Lovable hosting platform itself, not a
third-party SDK.
