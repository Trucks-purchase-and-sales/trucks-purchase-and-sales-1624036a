# Inventory — Wilmet Trucks (one-page attack surface)

_Date: 2026-08-23 · Author: V2P pipeline (Claude) · Source: static repo analysis
(code + `src/integrations/supabase/types.ts` + `supabase/migrations/*.sql`), cross-checked
against a live read-only query of `pg_tables`/`pg_policies` run by Salma against
production on 2026-08-23 (see "RLS — verified live" below). See
[ADR-004](decisions/ADR-004-phase1-starts-before-phase0.5-signoff.md) for why this was
compiled ahead of the Phase 0.5 functional sign-off._

## Tables

52 tables in `public`. **RLS is enabled on all 52 tables, confirmed live** — no table is
open by default. "Policies (live)" below lists every policy actually found via
`pg_policies`, replacing the repo-only guesses from the first pass of this document.

| Table | Columns (sensitive?) | Policies (live) |
|---|---|---|
| `profiles` | email, first/last name, phone, company, city, country, commission_rate — **PII + financial** | SELECT self-or-admin, UPDATE self; no INSERT policy (insert only via `handle_new_user` trigger/service_role); self-update guarded by `tg_profile_self_update_guard` |
| `user_roles` | user_id, role — **authorization root** | SELECT self-or-admin only; **no INSERT/UPDATE/DELETE policy exists at all** — role assignment is not reachable through the normal client connection, only via a trusted server-side path |
| `vehicle_opportunities` | purchase/sale/margin prices, contact name/email/phone, VIN, registration — **financial + PII** | SELECT scoped, UPDATE (staff + partner), INSERT own, DELETE own-drafts; column-guard trigger |
| `buyer_leads` | name, email, phone, company, budget, payment method — **PII + financial** | INSERT by anon (public lead capture), SELECT own + staff, UPDATE scoped |
| `buyer_lead_matches` | AI match scores/notes | SELECT/INSERT/UPDATE/DELETE, scoped via parent `buyer_leads` |
| `buyer_lead_status_history` | status transitions | SELECT only (system/trigger-written, no client insert) |
| `demand_opportunities` | budget, assigned staff, vehicle prefs | SELECT (client + staff), UPDATE, INSERT, DELETE (admin) |
| `demand_opportunity_status_history` | status transitions | SELECT **and INSERT** for `authenticated` — unlike its sibling history tables, this one allows a direct client insert; worth confirming the INSERT is properly scoped (Phase 2) |
| `opportunity_commissions` | basis/computed amount EUR, status, partner — **financial** | ALL for admin, SELECT scoped for partner and staff |
| `opportunity_documents` | storage_path (ID/registration docs) | SELECT/INSERT/UPDATE/DELETE, internal roles + parent scope |
| `opportunity_decisions` | AI verdict/score | SELECT/INSERT/UPDATE/DELETE, internal roles + parent scope |
| `opportunity_status_history` | status transitions | SELECT only (no client insert) |
| `opportunity_activities` | free-text CRM notes | SELECT/INSERT (staff + own-note partner)/UPDATE/DELETE, admin-trusted for mutation |
| `information_requests` | admin↔partner messages | SELECT parent-scoped; INSERT admin-only; UPDATE by owner (answer) and by admin; owner-guard trigger |
| `vehicle_photos` | storage_path | SELECT/INSERT/UPDATE/DELETE, parent-scoped |
| `sale_listings` | purchase/sale price EUR, sold_to — **financial + PII-adjacent** | SELECT/UPDATE/INSERT staff-scoped, DELETE admin; photo-ownership trigger |
| `app_settings` | key/value config | SELECT/INSERT/UPDATE, admin only |
| `commission_rules` | commission % / formulas — **financial, competitively sensitive** | ALL for admin, SELECT for staff — no anon access anywhere |
| `audit_logs` | action, actor, metadata — **tamper-evidence trail** | SELECT admin-only; **no INSERT/UPDATE/DELETE policy at all** — the trail cannot be written or altered through the normal client connection |
| `internal_notes` | free-text CRM notes | ALL for admin only (worth confirming other internal staff don't also need write access — functional question, not a security gap) |
| `notifications` | user_id, title, body | SELECT/UPDATE own only; no client INSERT/DELETE (system-generated) |
| `match_candidates` / `match_feedback` / `match_runs` / `matching_profiles` | AI matching internals, prompt/token telemetry | ALL for admin only on each |
| `ocr_scans` / `ocr_scan_sources` / `ocr_field_detections` | uploaded document OCR results | Owner/uploader-scoped SELECT/INSERT/UPDATE/ALL |
| `client_quotes` / `cost_estimates` / `purchase_evaluations` / `resale_listings` / `options_prioritaires` / `marketplace_inquiries` | opaque `data` Json — contents still untyped | SELECT only, named `future_admin_read` — no INSERT policy on any of the six; these look like schema staged ahead of unbuilt features (matches the unused `commercial_future`/`client_future` roles), worth confirming with Salma whether any are actually in use |
| `affiliate_links` | referral codes | ALL admin, SELECT own-or-staff |
| `affiliate_clicks` | click fingerprint hash | SELECT own-or-staff only; no client INSERT policy (writes happen server-side in the public affiliate-click endpoint) |
| `staff_groups` / `staff_group_members` | internal team structure | ALL admin-write, SELECT staff-read |
| `user_preferences` | locale only | ALL self-manage (low sensitivity) |
| `rate_limit_events` | hashed key, bucket | no policy found in either pass (low sensitivity, not user-facing) |
| `site_content` | CMS-style key/locale/value | ALL admin, SELECT public (low sensitivity, by design) |
| `ref_*` (11 tables) | static lookup data | ALL admin-write, SELECT public/anon read — correct for public reference data |

**Resolved:** the first pass of this document flagged that none of the 24 tracked
migrations contain the baseline `CREATE TABLE`/`ENABLE ROW LEVEL SECURITY` statements,
so RLS state couldn't be confirmed from the repo alone. A live read-only query against
production (2026-08-23) confirms RLS is enabled everywhere, and that the three
highest-impact tables (`user_roles`, `commission_rules`, `audit_logs`) are all correctly
locked down. The underlying documentation gap remains, though: the baseline schema/RLS
setup still exists only in the live Supabase project, not in version control. Phase 2
should still reconstruct and commit a baseline migration reflecting the live state, so
this can be diffed and reviewed like any other change going forward, and so a future
migration can't silently drop a policy nobody notices is missing from the repo.

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
if no matching row exists. This makes `user_roles`'s RLS state load-bearing for every route
guard in the app — now confirmed live: RLS enabled, self-or-admin SELECT only, no client
write path at all, so this dependency is sound.

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
