# Wilmet threat model and attack-surface inventory

**Baseline:** `a9bb95cd12e2360bf1fdce75b075b33aa5cc52c2`  
**Assessment date:** 2026-08-19  
**System:** Wilmet Trucks / `SalmaAnhm/trucks-purchase-and-sales`  
**Environment inspected:** synchronized GitHub source + Lovable/Supabase staging

## 1. Purpose

This document is the security design baseline for the inherited Lovable application. It does not claim Wilmet is production-ready. It answers four questions before deeper testing and remediation:

1. What must be protected?
2. Where are the trust boundaries?
3. Which callers can reach which surfaces?
4. Which residual threats must be proved or fixed before release?

The PostgreSQL Row Level Security (RLS) model remains the canonical authorization boundary. UI visibility and server-function filtering are defense in depth only.

## 2. System and trust boundaries

```text
Anonymous / authenticated browser
        |
        | HTTPS
        v
TanStack Start / Nitro application
  |             |              |
  | user JWT    | service role | server-side API key
  v             v              v
Supabase       Supabase       Lovable AI Gateway
Auth/RLS       admin client   (external processing)
/PostgREST     (bypasses RLS)
/Realtime
  |
  +--> PostgreSQL + RLS + triggers
  +--> private Storage bucket + signed URLs

GitHub reviewed source <----sync----> Lovable implementation/preview
           |
           +--> CI / secret scan / build
```

### Trust-boundary rules

- A browser is untrusted even when authenticated.
- A user JWT establishes identity, not authorization; RLS determines row access.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is therefore a privileged server boundary.
- Signed Storage URLs temporarily transfer read capability to whoever possesses the URL.
- Data sent to the Lovable AI Gateway leaves the Wilmet database trust boundary and must be explicitly minimized and contractually covered.
- Git history does not contain runtime secrets, hosted Auth state, customer data, Storage objects, DNS/deployment state, or the complete historical database baseline.

## 3. Actors

| Actor | Intended authority |
| --- | --- |
| Anonymous visitor | Public catalogue, buyer-lead submission, affiliate click, signup, assistant when enabled |
| Seller partner | Own vehicle proposals, own photos, requested-information workflow, own commissions |
| Buyer/client partner | Own buyer requests/demand tracking |
| `sales_agent` | Assigned records, group records, and unassigned records inside `staff_scope` |
| `external_agent` | Directly assigned records and own-brought vehicle records only |
| `sales_manager` | Global pipeline read/write and assignment |
| `company_management` | Global pipeline read-only |
| `admin` / `platform_admin` | Full trusted administration |
| Server runtime | Trusted orchestration; may use service role for narrowly justified operations |
| Lovable AI Gateway | External processor receiving selected text/images/audio for AI features |
| Repository/deployment operator | Can change code, configuration and release state; must be governed by reviewed PRs and protected `main` |

## 4. High-value assets and data classes

### Identity and authorization

- Supabase Auth users and sessions
- `user_roles`, staff groups, scopes, assignments and account state
- privileged server secrets and API keys

### Personal and customer data

- names, email addresses, telephone numbers, companies and locations
- buyer requirements and free-form messages
- on-site vehicle contacts
- referral attribution

### Vehicle/confidential business data

- VIN, registration number, location and vehicle documents/photos
- desired price, purchase price, final sale price, purchase references and commercial notes
- decisions, internal notes, matching data and pipeline state

### Financial data

- commission rules, bases, rates, calculated amounts, approvals and payment status

### Operational evidence

- audit logs, status histories, database migrations, CI evidence and recovery artifacts

## 5. Attack surface

### Public HTTP/API surface

- `/api/public/buyer-leads`
- `/api/public/assistant`
- `/api/public/signup-check`
- `/api/public/affiliate-click`
- public catalogue server functions and signed vehicle-photo delivery
- Supabase Auth signup/login/password-reset endpoints reached directly from the browser

Existing controls include bounded public JSON bodies, rate limiting on the custom public APIs, honeypot handling, explicit assistant consent, safe public catalogue projections and baseline HTTP hardening.

### Authenticated application surface

- seller vehicle wizard and Storage uploads
- buyer workspace
- internal pipeline dashboards
- assignments, status changes and dossier decisions
- staff/account administration
- commissions and sale-listing publication
- OCR, voice transcription, dossier AI and AI matching

### Database and Storage surface

Live inspection confirmed RLS is enabled on the public application tables and Storage object table. The core pipeline authorization helpers enforce role + assignment/group/scope semantics. The seller workflow and profile self-update guards are implemented as database triggers. The `vehicle-photos` bucket is private, limited to 10 MiB and restricted to JPEG/PNG/WebP/HEIC/HEIF.

### Privileged server surface

The server-side Supabase admin client uses the service-role key and bypasses RLS. It is currently used for narrow operations including staff/Auth administration, rate limiting, affiliate fast-track assignment, public catalogue reads/signing and some notification flows. Every service-role path must maintain its own explicit authorization and safe-column/output contract.

### AI/data-egress surface

The Lovable AI Gateway processes:

- public assistant conversation content;
- authenticated audio transcription;
- OCR images/document text when OCR is enabled;
- dossier-analysis fields/document notes/OCR results;
- matching/embedding text.

This boundary introduces confidentiality, privacy, prompt-injection, availability and cost-abuse threats in addition to normal application threats.

## 6. Existing controls already verified in source/live state

- Core PostgreSQL pipeline RLS is role/scoping based; UI filters are not treated as authorization.
- Core authorization helpers are not executable by `anon`/`PUBLIC`.
- Seller-owned vehicle workflow has a database trigger protecting privileged columns and handoff transitions.
- Self-service profile updates cannot modify role-adjacent/account-state/referral/commission fields.
- `vehicle-photos` is private with MIME and size restrictions plus ownership policies.
- Public JSON APIs use bounded-body parsing.
- Public abuse limiter fails closed when its database decision cannot be trusted.
- Assistant persistence/confirmation is server-authoritative and explicit consent is required before AI processing/persistence.
- `.env` is not tracked; the repository has a value-free template and PR secret scanning.
- Global responses currently receive `nosniff`, Referrer Policy, Permissions Policy and HTTPS HSTS.
- CI baseline passes 40 tests and the production build.

These controls reduce risk; they are not substitutes for deployed end-to-end verification.

## 7. Threat register

Severity reflects expected production impact, not proof of active exploitation.

| ID | Status | Severity | Threat / evidence | Required action |
| --- | --- | --- | --- | --- |
| TM-001 | Confirmed by live policy inspection | **High / P0** | `buyer_lead_matches` grants `sales_agent` global `ALL`, and `buyer_lead_status_history` grants global staff read. Child records can therefore escape the parent buyer-lead assignment/group/scope boundary. | Parent-scope both tables through the canonical pipeline helper; retain role-matrix tests and real-JWT E2E evidence. |
| TM-002 | Confirmed by live policy inspection | **High / P0** | `opportunity_commissions` lets every `sales_agent` read all commission rows globally. `listCommissions` and `opportunityCommission` rely on RLS. This exposes financial amounts outside the caller's pipeline scope. | Define intended financial visibility, then enforce parent-opportunity scope (or a stricter finance role) in RLS and server outputs; E2E test scoped agents. |
| TM-003 | Confirmed in source | **High / P0** | Dossier AI builds its prompt from almost every scalar `vehicle_opportunities` field. The exclusion list does not match actual columns such as `partenaire_id`/`assigned_sales_agent_id`, so VIN, registration/contact/location and financial/workflow metadata may be sent to the external AI gateway. | Replace broad object serialization with an explicit AI-safe allowlist/redaction contract; verify legal/subprocessor basis; add tests that prohibited fields never enter prompts. |
| TM-004 | Confirmed in source | **Medium-High / P1** | Voice transcription is enabled by default when no `ai_features` row exists and has no application rate limit/quota. Any authenticated account can consume external AI capacity/credits. | Default optional AI features closed unless configured; add per-user/IP limits and operational quota/alerting. |
| TM-005 | Latent; feature currently disabled in staging | **High when enabled / P1** | OCR accepts up to six `data:` URLs but has no per-image byte cap or MIME allowlist at the server schema and no AI rate limit. Enabling OCR creates memory/cost-amplification risk. | Enforce total/per-file bytes, approved MIME formats and rate/quota controls before OCR may be enabled. |
| TM-006 | Confirmed design gap; hosted Auth controls pending inspection | **Medium-High / P0 before release** | `/api/public/signup-check` is advisory and bypassable through Supabase Auth directly. The UI permits six-character passwords. Real anti-abuse/password/MFA/email controls therefore depend on hosted Auth configuration not represented in Git. | Audit Supabase Auth production configuration, password policy, email confirmation, Auth rate limits/CAPTCHA and admin MFA; retain configuration evidence. |
| TM-007 | Confirmed invariant missing in source | **Medium / P1** | Sale listing `photoIds` are accepted as arbitrary UUIDs; the public service-role catalogue signs the stored photo IDs. There is no explicit invariant proving every published photo belongs to that listing's source opportunity. | Validate ownership at write/publish time and preferably enforce it at DB boundary; add regression test. |
| TM-008 | Confirmed by live RLS | **Medium / P1** | `app_settings` is readable by `anon`. It is empty in inspected staging, but any future value stored there becomes public by contract. | Split public feature flags from private operational settings or narrow RLS; prohibit secrets/sensitive business configuration in public-readable rows. |
| TM-009 | Needs active verification | **Medium / P1** | Privileged profile fields are protected on UPDATE, but `profiles_insert_self` permits self INSERT based only on `id = auth.uid()`. If a profile is missing, a signed-in user may be able to choose role-adjacent metadata (`partner_kind`, scope, commission/referral/account fields), although `user_roles` remains separate. | Probe with a rollback-only/isolated fixture, then constrain self INSERT/defaults or move profile creation entirely behind trusted provisioning. |
| TM-010 | Existing release blocker | **High / P0** | Database history is not yet independently rebuildable from Git and `main` is not protected by enforced repository rules. Either gap can invalidate otherwise correct security fixes. | Complete issue #9 recovery/rebuild evidence and repository protection before release. |
| TM-011 | Needs design review | **Medium / P1** | Several secondary history/information tables use older bespoke policies rather than the canonical parent pipeline helper. This can create either over-access or under-access as roles/groups evolve. | Complete a table-by-table child-resource authorization matrix and normalize policies to parent-scope semantics. |
| TM-012 | Existing hardening gap | **Medium / P1** | CSP/frame policy and public API CORS restrictions are not yet deployed. Current wildcard CORS is intentional on public APIs but has not been justified per endpoint. | Inventory required origins, deploy CSP report-only, review framing, and restrict CORS where cross-origin use is unnecessary. |

## 8. Important observations that are NOT vulnerabilities by themselves

- Some older `SECURITY DEFINER` helpers in the `private` schema still have broad EXECUTE grants, but live inspection shows `anon`, `authenticated` and `PUBLIC` do not have schema `USAGE`; they are not currently exposed through the normal API boundary. Cleanup is still worthwhile as defense in depth.
- `public.rate_limit_check` is executable but explicitly rejects non-`service_role` callers before delegating to the private implementation.
- `buyer_lead_reference(uuid)` is intentionally narrow and returns only a reference number; UUID knowledge is currently the capability. It should remain under review but is not classified as a confirmed cross-record disclosure in this phase.

## 9. Verification limitations

The staging database currently contains only two accounts with the `partenaire` role and no live staff/admin identities. Therefore the newly identified staff-scoping findings were confirmed from live RLS definitions and source paths, not yet by real-JWT role execution. Phase 2 must create controlled test identities/fixtures and prove the boundaries through the deployed staging application.

No destructive database operation was used during this threat-model pass.

## 10. Phase 1 exit / Phase 2 entry

Phase 1 is complete when:

- this threat model is reviewed and merged;
- confirmed high-risk findings have dedicated remediation issues;
- issue #9 references the new release blockers;
- no finding is treated as fixed merely because a UI path hides it.

Phase 2 will remediate and actively verify the highest-risk authorization/data-egress findings first, one focused PR at a time, while keeping CI green and retaining evidence.