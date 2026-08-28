# Interaction Map — Wilmet (functional traceability matrix)

_Phase 0.5 static audit, 2026-08-21. Method: every route file read in full, plus
child components and server functions (`*.functions.ts`) they call, cross-checked
against `src/integrations/supabase/types.ts`. No browser/staging access was
available for this pass (Lovable credits exhausted — see
`docs/v2p/decisions/ADR-002-no-lovable-credits.md`), so items that genuinely
require a live check are marked `needs-live-verification` rather than guessed at._

_Status values: `wired` (correctly connected in code) · `no-op` (dead/stub) ·
`unknown-intent` (unclear product intent) · `needs-schema-check` · `needs-live-verification`_

---

## Route: /

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| Wilmet logo | link | Navigate home | route `/` | wired | index.tsx:76 |
| "Véhicules à vendre" | nav link | Go to catalog | route `/vehicules` | wired | index.tsx:80 |
| "Comment ça marche" anchor | anchor | Scroll to section | in-page anchor | wired | index.tsx:83, 210 |
| "Types de véhicules" anchor | anchor | Scroll to section | in-page anchor | wired | index.tsx:86, 291 |
| "Contact" anchor | anchor | Scroll to section | in-page anchor | wired | index.tsx:89, 358 |
| Language selector | select | Change UI locale | `i18n.changeLanguage()` (client-only) | wired | LanguageSwitcher.tsx:11 |
| "Mon espace" button (authenticated) | link | Route to user's canonical home | `user_roles.role`, `profiles.partner_kind` via `resolveRoleHome()` | needs-live-verification | Logic correct, all target routes exist; role→route resolution needs a real session to fully confirm |
| "Se connecter" link (anonymous) | link | Go to login | route `/auth` | wired | PublicAccountActions.tsx:66 |
| "Proposer un véhicule" button (anonymous) | link | Go to seller signup | route `/auth?mode=signup&kind=seller` | wired | PublicAccountActions.tsx:72 |
| "Vendeur" card CTA | link | Go to seller signup | route `/auth?mode=signup&kind=seller` | wired | index.tsx:174 |
| "Acheteur" card CTA | link | Go to buyer search wizard | route `/chercher-un-vehicule` | wired | index.tsx:181 |
| Contact block CTAs (Proposer/Chercher) | link | Same as Vendeur/Acheteur cards | routes above | wired | index.tsx:374, 380 |
| Footer legal links (5) | links | Go to legal pages | `/mentions-legales`, `/cgu`, `/cgv`, `/confidentialite`, `/cookies` | wired | index.tsx:430-444 |
| Assistant chat widget (open/close/consent/send) | widget | Floating AI chat | `POST /api/public/assistant`; may write `buyer_leads.*` | wired | AssistantWidget.tsx; see endpoint section |

## Route: /auth

Guard: `beforeLoad` redirects away via `resolveRoleHome()` if a session already exists (auth.tsx:37-43).

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| "Connexion"/"Inscription" tabs | tabs | Switch form, sync `?mode=` | client state + URL | wired | auth.tsx:94-101 |
| Login submit | form | Sign in | `supabase.auth.signInWithPassword()`, then `resolveRoleHome()` | wired | auth.tsx:147-160 |
| "Mot de passe oublié ?" | button | Switch to forgot-password panel | client state | wired | auth.tsx:183-189 |
| Signup submit | form | Register account | `POST /api/public/signup-check` (advisory rate-limit) then `supabase.auth.signUp()` | needs-live-verification | Client password-length check is UX-only by design (password-policy.ts:10-16); whether hosted Supabase Auth enforces its own minimum independently isn't visible statically. `profiles` row creation is a DB trigger not in this codebase. |
| "Renvoyer l'e-mail" (pending/submitted states) | button | Resend confirmation | `supabase.auth.resend()` | wired | auth.tsx:328-347, 429-436 |
| Forgot-password submit | form | Send reset email | `supabase.auth.resetPasswordForEmail(..., redirectTo: origin + "/reset-password")` | wired | auth.tsx:572-587 |

## Route: /vehicules

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| Header/footer nav, language, account actions | — | Same `PublicShell`/`PublicAccountActions` as `/` | — | wired / needs-live-verification | Identical to `/` |
| Search input | text | Client-side filter of already-loaded listings | in-memory filter over `listPublicVehicles` result | wired | **Scalability gap, not broken:** server supports a `q` param (public-catalog.functions.ts:44-46) but this page never sends it — search only covers the first 60 fetched listings, not the full catalog. |
| Empty-state CTA | link | Go to buyer wizard | route `/chercher-un-vehicule` | wired | vehicules.index.tsx:92-94 |
| Vehicle result cards | link | Open vehicle detail | route `/vehicules/$id`; `sale_listings`+`vehicle_opportunities`+signed `vehicle_photos` URL | wired | vehicules.index.tsx:106-147 |

## Route: /vehicules/$id

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| "← Retour" | link | Back to catalog | route `/vehicules` | wired | vehicules.$id.tsx:71 |
| Photo thumbnails | button | Swap main image | client state | wired | vehicules.$id.tsx:111-119 |
| "catalog.interested" CTA | link | Express interest in this specific vehicle | route `/chercher-un-vehicule` | **unknown-intent** | vehicules.$id.tsx:185-187 — routes to the generic buyer-lead wizard with **no vehicle id/reference carried over**, and the wizard has no field to receive one. Product decision needed: pre-fill the wizard, or is manual triage intentional? |
| Vehicle detail data | display | Show specs/price/images | `getPublicVehicle(id)` | wired | vehicules.$id.tsx:62-66, 96-193 |

## Route: /chercher-un-vehicule (BuyerLeadPage wizard)

Parent route is a pathless layout (`<Outlet/>` only); all elements below are the index child.

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| Reference-data comboboxes (category, type, body, brand, model, country, euro standard, fuel, gearbox, equipment) | combobox/multi-select | Populate wizard filters from reference tables | `ref_vehicle_categories`, `ref_vehicle_types`, `ref_body_types`, `ref_vehicle_brands`, `ref_category_brands`, `ref_vehicle_models`, `ref_countries`, `ref_euro_standards`, `ref_fuel_types`, `ref_gearbox_types`, `ref_equipment` | wired | chercher-un-vehicule.index.tsx:325-426 |
| Wizard "Continuer"/"Retour" | button | Step navigation with per-step validation | `form.trigger(stepFields[step])` | wired | chercher-un-vehicule.index.tsx:139-143 |
| GDPR consent checkbox | checkbox | Required (`z.literal(true)`) | n/a | wired | chercher-un-vehicule.index.tsx:543-548 |
| Honeypot "website" hidden field | hidden input | Anti-bot trap | server silently drops submission if filled | wired | chercher-un-vehicule.index.tsx:552-560 |
| Final "Envoyer" submit | button | Submit buyer lead | Authenticated → `submitBuyerLeadAuthenticated` (`buyer_leads.*`, requires `profiles.partner_kind === "client"`); anonymous → `POST /api/public/buyer-leads` | wired | chercher-un-vehicule.index.tsx:149-244. Explicit auth-state machine deliberately avoids ever submitting an authenticated user's request as anonymous — good defensive pattern. |
| Profile auto-fill (authenticated) | effect | Pre-fill contact fields | `profiles.first_name, last_name, company_name, email, phone, country, city, partner_kind` | wired | chercher-un-vehicule.index.tsx:87-114 |

## Route: /chercher-un-vehicule/merci

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| "Voir mes demandes" (tracked) | link | Go to buyer's requests | route `/mes-demandes` | wired | merci.tsx:76 |
| "Nouvelle demande" (tracked) | link | Restart wizard | route `/chercher-un-vehicule` | wired | merci.tsx:79 |
| "Créer un compte" (untracked) | link | Go to buyer signup | route `/auth?mode=signup&kind=client` | wired | merci.tsx:85 |
| "Accueil" (untracked) | link | Go home | route `/` | wired | merci.tsx:87 |

Note: `isTracked` state can be spoofed via a manually-edited `?tracked=1` URL, but this is cosmetic only — the destination route (`/mes-demandes`) independently enforces its own auth/RLS. Not a data-exposure defect.

## Route: /reset-password

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| "Enregistrer" submit | form | Update account password | `supabase.auth.updateUser({password})` → `/dashboard` | needs-live-verification | reset-password.tsx:23-37. No `beforeLoad` guard verifying a valid recovery session before rendering the form (unlike `/auth`). Not a security hole since Auth itself requires the recovery session server-side, but the full magic-link round trip needs a live test. |

## Routes: /cgu, /cgv, /confidentialite, /cookies, /mentions-legales

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| Shared `LegalLayout` nav (logo, "← Accueil", 5-link legal sidebar) | links | Navigate home / between legal pages | routes | wired | Identical across all five |
| Cookies: "Réinitialiser mon consentement" | button | Clear consent, reload | `localStorage.removeItem("wilmet_cookie_consent_v1")` | wired | Confirmed real consumer in `CookieConsent.tsx:5` |
| Confidentialité / Mentions légales mailto links | link | Open mail client | `mailto:dpo@wilmet.example` / `contact@wilmet.example` | wired | Placeholder `.example` addresses — content issue, not a code defect. All 5 pages self-flag as legal-review drafts already. |

## Cross-cutting: referral capture (fires on every public route)

`captureRefFromUrl()` (`src/routes/__root.tsx:153`) reads `?ref=` on every route change, persists it 90 days in `localStorage`, and fires `POST /api/public/affiliate-click` once per new code — feeds `referral_code`/`assigned_sales_agent_id` on buyer-lead and signup writes. No defect found.

## Public API endpoints (`src/routes/api/public/*.ts`)

| Endpoint | Purpose | Input validation | Auth | Notes |
|---|---|---|---|---|
| `POST /api/public/affiliate-click` | Record a click on a personal affiliate link | Partial — 8KB-capped body, ad-hoc type checks; `code` validated via regex downstream, other fields length-truncated not schema-validated | None (public by design); same-origin CORS + rate limit (30/10min/IP) | Returns `{ok:false}` HTTP 200 for unknown codes (avoids leaking validity) — intentional |
| `POST /api/public/assistant` | AI chat widget; may create a `buyer_leads` row from a qualifying conversation | Yes, zod (messages ≤2000 chars, ≤16 msgs, `gdprConsent===true`); 64KB cap | None (public); CORS + rate limit (20/10min/IP); gated by `app_settings` (key `assistant`) | Re-validates any lead fields the LLM claims to have collected before actually inserting — doesn't trust model output as authoritative. No bugs found. |
| `POST /api/public/buyer-leads` | Anonymous buyer-lead submission | Yes, zod via `parseBuyerLead`; 32KB cap; requires `gdpr_consent===true` | None (public), but rejects HTTP 409 if an `Authorization` header is present (forces authenticated users onto the authenticated path instead); two-tier rate limit (5/10min AND 20/hour/IP) | Honeypot field silently no-ops (HTTP 201, no insert) if filled |
| `POST /api/public/signup-check` | Advisory pre-signup throttle | N/A | None (public); CORS + rate limit (3/10min/IP) | Self-documented as bypassable by hitting Supabase Auth directly — accepted limitation, not hidden |

---

---

## Layout: `_authenticated/route.tsx` (global chrome, wraps every authenticated route)

| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Notes |
|---|---|---|---|---|---|
| Sidebar nav (`AppSidebar.tsx`) | nav links | Route to role-appropriate sections | none directly; role-derived from props | wired | Nav set is client-side role-derived; underlying pages still carry their own guards |
| Notification bell | dropdown | Show last 15, unread badge, realtime push | `notifications` filtered `user_id=self`; realtime channel | wired | route.tsx:113-207 |
| "Tout marquer lu" | button | Mark all own notifications read | `notifications.read_at` update where `user_id=self` | wired | route.tsx:146-157 |
| Profile menu "Se déconnecter" | button | Clear query cache, sign out, redirect `/auth` | Supabase auth session | wired | route.tsx:215-221 |

**Fail-closed assessment:** yes. `beforeLoad` treats any non-clean `getUser()` result (error, null, network failure) as unauthenticated → `redirect(/auth)` before anything mounts. A deactivated account (`profiles.is_active===false`) is force-signed-out to a static message, never the app shell. No matching `profiles` row → "initialisation" message, never a default-role fallback. This file only owns authentication, not role authorization — every deeper layout (`sales.tsx`, `manager.tsx`, `direction.tsx`, `mes-demandes.tsx`, `espace-acheteur.tsx`) independently re-checks roles and redirects, and the server functions behind them re-validate a second time server-side. The one soft spot: `/opportunities/new`'s seller-only gate only activates after its own query resolves, so the full wizard can flash briefly before the restriction screen swaps in (see FD-010).

## Route: /dashboard (seller "my opportunities" home)

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| "Proposer un véhicule" | link | Go to wizard | none | wired | dashboard.tsx:116-118 |
| KPI tiles / stage funnel / status+type filters / search | buttons/inputs | Client-side filter of already-fetched opportunities | `vehicle_opportunities` via `listMyOpportunities` (`partenaire_id=self`) | wired | dashboard.tsx:150-190 |
| Opportunity card | link | Open `/opportunities/$id` | `vehicle_opportunities.*` + main photo signed URL | wired | dashboard.tsx:196-247 |
| "Type véhicule" filter | select | Filter by vehicle type | `vehicle_opportunities.vehicle_type` | **filter starved of data** | The wizard that creates opportunities never writes `vehicle_type` (see FD-009) — new opportunities are always `null` here and can never match this filter. |

## Route: /profile

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| Profile form + "Enregistrer" | form | Edit/persist own profile | `profiles.(first_name,last_name,company_name,phone,provider_type,city,country)` `.eq("id",userId)` | wired | profile.tsx:19-57 |

Update-only by design (profile is 1:1 with the auth user); no create/delete gap.

## Route: /opportunities/new (6-step seller wizard)

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| Seller-only gate | conditional render | Block wizard for non-sellers | `user_roles.role`, `profiles.partner_kind` | **degrades** (FD-010) | Gate only flips after its query resolves — full wizard flashes first for a client/buyer account. Writes are still protected server-side/RLS regardless. |
| Step tabs (1-6) | buttons | Jump between steps | none | wired | Final submit re-validates everything regardless of jump order |
| OCR "Scanner mes photos (IA)" | dialog | Extract fields from uploaded docs | `runOcrScan`/`recordOcrApplication`; patches local state | wired | Gated by admin-controlled `app_settings` flag |
| Reference-data comboboxes | combobox | Cascading category/brand/model/etc. selection | `ref_*` tables via `getReferenceData` | wired | **Inconsistency, not a bug:** this one read uses a public anon client with no auth middleware, unlike every other server fn in the app — acceptable since it's public catalog data, but worth a deliberate sign-off |
| Voice dictation | button | Transcribe mic audio into a field | `transcribeAudio` server fn | wired | Gated by `app_settings` flag |
| Photo add/star/delete/reorder | buttons | Upload, set main, delete, reorder photos | `vehicle_photos` insert/delete; RPCs `set_main_vehicle_photo`, `reorder_vehicle_photos` (both RLS/row-ownership checked) | wired | |
| "Enregistrer en brouillon" / "Continuer" | button | Save current state (create or update) | `vehicle_opportunities` insert (`status:brouillon`) or update via `saveOpportunity` | wired | |
| "Envoyer à Wilmet" | button | Submit for review | `vehicle_opportunities.(status="envoyee", owner_side="wilmet", ...)`; client AND server both validate required fields/photos | wired | Good defense-in-depth |

**needs-live-verification:** `getOpportunity` (shared by this route, `/opportunities/$id`, `/opportunities/success/$id`) selects by `id` with **no `partenaire_id` filter in the query itself** — ownership is enforced entirely by the Postgres RLS `SELECT` policy (`opp_select_scoped`). The policy reads correctly scoped, but since it's the only line of defense, it deserves a live confirmation rather than a static "wired" stamp.

## Route: /opportunities/$id (detail — read, respond, withdraw)

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| "Continuer le brouillon" / "Compléter et renvoyer" | link | Reopen in the wizard | none | wired | |
| **"Retirer" (withdraw)** | button | Archive/withdraw a non-draft opportunity | `vehicle_opportunities.(status="archivee", withdrawn_at)` via `withdrawOpportunity` | **CONFIRMED BUG — see FD-008** | Shows a green success toast even when zero rows were actually updated. |
| Info-request reply + "Envoyer" | form | Answer an open Wilmet info request | RPC `answer_information_request` (explicitly checks `partenaire_id=auth.uid()`) | wired | |
| "Ajouter des photos" (within an open request) | button | Upload extra photos | Direct `storage.upload()` + `addPhotoRecord` | wired | Uses a different upload code path than the wizard (direct upload vs. signed-URL) — functionally fine, minor inconsistency worth consolidating later |

**FD-008 detail:** `withdrawOpportunity` runs `.update(...).eq("id",id).eq("partenaire_id",userId)` and only checks for a Postgres *error*, never affected-row-count. The RLS `UPDATE` policy (`opp_partner_update`) only allows a partner update when `status='brouillon' OR owner_side='partenaire'`. The "Retirer" button, however, is shown for `envoyee`/`en_cours_analyse`/`offre_envoyee`/`en_negociation`/`refusee` — states where `owner_side` is normally `"wilmet"`. In that (common) case the RLS clause is false, zero rows match, Supabase returns no error, and the handler reports `{ok:true}` anyway. User sees "Opportunité retirée," the row is untouched.

## Route: /opportunities/success/$id — read-only confirmation screen, no lifecycle gap.

## Route: /mes-demandes (buyer's request list)

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| Route guard | redirect | Staff may view; else only `partner_kind==="client"`, else → `/dashboard` | `user_roles.role`, `profiles.partner_kind` | wired | |
| Request cards | display only (not a link) | Show request summary | `buyer_leads.*` via `myBuyerLeads` `.eq("user_id",userId)` | wired, read-only | **No per-request detail/drill-down route exists for buyers** — unlike sellers (`/opportunities/$id`). Not necessarily a bug; flagged `unknown-intent` (FD-013) — is a buyer ever meant to view/edit/cancel their own request post-submission? |

## Route: /mes-demandes-clients (staff view of assigned demand-opportunities)

**Flag:** unlike every sibling route in this batch, this file has **no `beforeLoad` at all** — any authenticated user can navigate here directly. Net risk is low: `listDemandOpportunities({scope:"mine"})` independently calls `assertInternal()` server-side and throws for non-staff, so a non-staff visitor would just see an empty list, not real data. Still inconsistent with the pattern every sibling route uses (FD-011).

## Route: /mes-echanges — read-only aggregation of a seller's info-request exchanges; answering lives on `/opportunities/$id` (already covered). No gap.

## Route: /mes-commissions — read-only for partners by design (approve/pay/cancel are admin/manager-only, on the out-of-scope `/admin/commissions`). No gap.

## Route: /mon-lien (self-service affiliate link)

| Element | Type | Expected behavior | Reads/Writes | Status | Notes |
|---|---|---|---|---|---|
| "Générer mon lien" | button | Create the caller's affiliate link (idempotent) | `affiliate_links` insert via `createMyAffiliateLink` | wired | |
| Target chips + "Copier" | buttons | Build/copy a shareable URL | client-only | wired | |
| QR code image | display | Render a QR of the affiliate URL | Fetched from third-party `api.qrserver.com` with the live tracking URL as a query param | wired, **privacy note** | Sends the partner's live tracking URL to an external, non-Wilmet image service on every render. Not a functional defect — flag for the Phase 1/3 threat-model and vendor-risk review, not this defects log. |
| Stat tiles | display | Affiliate performance | `getMyAffiliateStats` (aggregated) | wired | |

## Layout+route: /sales, /manager, /direction

All three follow the identical, correct pattern: a pure-guard parent (`beforeLoad` checks `user_roles.role .in([...])`, redirects to `/dashboard` on failure) wrapping an `.index.tsx` of KPI tiles/stage-funnel links that navigate into `/admin` pre-filtered, backed by server functions (`salesAgentKpis`/`managerKpis`/`directionKpis`) that **independently re-check role server-side** — real defense-in-depth. "Coming soon" placeholder cards (`manager.index.tsx`, `direction.index.tsx`) are correctly static/non-interactive, not bugs.

---

## Route: /admin/buyer-leads (list + detail)

Layout is `Outlet`-only. List: toggle active/archived, row → detail. Detail (`/admin/buyer-leads/$id`): "Convertir en opportunité" (creates `demand_opportunities`, marks lead converted — idempotent), "Demander infos" (notifies + sets `a_qualifier`), "Rejeter" (sets `perdu`). **Bug:** the reject dialog lets the admin pick a reason, but `adminRejectBuyerLead` never writes it anywhere — no `buyer_leads` column exists for it (FD-014, silently discarded, contrast with the opportunity close-reason flow which does persist correctly).

## Route: /admin/sale-listings (list + detail)

Full lifecycle: **Create** happens automatically server-side the instant an opportunity is purchased (`ensureDraftListingForPurchase`, draft row with `purchase_price_snapshot` set) — **not** primarily through the manual "Transformer en offre de vente" dialog in `SaleListingPanel`, which is effectively dead code in normal flow since a draft already exists by the time it would render (FD-015, product decision: remove or keep as fallback). **Read/Update**: full field edit + status transitions (`brouillon→publiee→reservee→vendue`/`retiree`), including real server-side buyer-match notifications on publish. **"Marquer vendue"** correctly writes the final price back to both `sale_listings` and `vehicle_opportunities.final_sale_price_eur` server-side. **Delete: none exists** — "Retirer" only soft-closes to `status='retiree'`; there is no way to remove a wrongly-created draft listing (FD-016). Margin is computed client-side only (`marginOf()`), never persisted — no integrity risk today, but no single source of truth if it's ever needed in a report/export.

## Route: /admin/demand-opportunities (list + detail)

Create via buyer-lead conversion; Read/Update (stage, status, vehicle match link) on the detail page; **no delete**, same soft-lifecycle pattern as the rest of the app. **Flag:** `updateDemandStage`, `linkVehicleMatch`, `suggestVehiclesForDemand`, `getDemandOpportunity` call no app-level role check (only `requireSupabaseAuth`) — unlike nearly every other server function in the codebase, which explicitly calls `assertStaff`/`assertAdmin`. Enforcement relies entirely on RLS policies using `private.can_write_pipeline_record`, on a client that does use the caller's own JWT (RLS applies, not service-role) — probably safe, but inconsistent enough to need a live/staging confirmation rather than a static pass (FD-017).

## Route: /admin/opportunities/$id (core opportunity detail — largest surface, 7 tabs)

Fully wired pipeline: qualify → assign → stage transitions (`StageBar`) → purchase (`adminConvertToPurchase`, writes `purchase_price_excl_tax` and auto-creates the draft sale listing) → deliver → close won/lost (reason **is** persisted here, correctly) → reopen. Benchmark, dossier checklist, Go/No-Go decision, and AI dossier audit panels are all real server-backed implementations (client previews are cosmetic; server independently recomputes and persists the authoritative values). Activity composer (`addOpportunityActivity`) has no role check beyond being logged in — flagged for live RLS confirmation (FD-018).

**Highest-priority flag in the whole audit — commission creation appears to be missing (FD-019). RESOLVED 2026-08-28, see below.** the Commission panel's own copy says a commission "will be created automatically" once the opportunity becomes purchased/delivered. No code — not `adminConvertToPurchase`, not `adminMarkDelivered`, not any server function, not any of the 24 tracked migrations — actually inserts a row into `opportunity_commissions`. The only migration touching that table is RLS-policy-only. Every commission UI (`CommissionPanel`, `/admin/commissions`) only edits/approves/pays/cancels an *existing* row — there is no "create" affordance anywhere. **This repo's migration history only starts 2026-08-17, so an untracked DB trigger predating that cannot be ruled out statically — this needs a live check against the actual Supabase project before it's treated as confirmed.** If no such trigger exists, no partner has ever been able to get a commission created through normal use of this app.

**Live-check result:** an untracked trigger, `trg_compute_commission` on `vehicle_opportunities`, does exist and is correctly written — it fires on the right status transitions, is idempotent, and inserts a properly computed row. It has simply never had anything to apply: `commission_rules` has zero active rows in production, and while a complete admin-gated CRUD API for managing rules already exists (`src/lib/commissions.functions.ts`), no route in the app calls it — there is no UI to create one. So the original worry was correct in effect (no partner has ever received a commission through the app) but not in cause (the create step is not missing or broken; its one prerequisite has never been configured, and the page to configure it was never built). Salma decided to defer both creating a rule and building that UI for now — see `apps/wilmet/evidence/fd019-commission-creation-investigation.txt` and `docs/v2p/decisions/ADR-012-commission-rules-gap-deferred.md`.

## Route: /admin/matching

Full engine: global/per-source matching runs a real blended rule+AI score server-side (not client-computed), pin/confirm/exclude/notify/vote on matches, an admin console for managing scoring profiles (weights, hard filters, AI blend). Profile delete (`deleteMatchingProfile`) is **the one clean, confirmed hard-delete** in the entire audited app. Thumbs-up/down feedback is captured (`match_feedback`) but nothing downstream appears to consume it — noted, not a defect.

## Route: /admin/commissions

Approve/pay/cancel on existing rows only — reinforces FD-019: this list has no "create" affordance either, and if nothing creates the underlying rows, this fully-wired page has nothing to operate on in practice. The one page in this batch that correctly trusts a persisted server value (`computed_amount_eur`) with no client recomputation.

## Route: /admin/reference

The cleanest lifecycle in the whole audit: full, correctly-wired create/read/update/**delete** across all eight `ref_*` tables, table name constrained by a zod-validated allowlist (not an arbitrary-table-read vector despite the dynamic `.from(table)` call).

## Cross-cutting: no hard-delete on core money-path entities

`buyer_leads`, `demand_opportunities`, `vehicle_opportunities`, `sale_listings`, and `match_candidates` all rely on status transitions rather than real deletion — likely intentional (audit-trail preservation on financial/pipeline records) but worth an explicit product sign-off rather than an assumption (FD-020).

---

## Deferred / removed (require Salma sign-off)

| Element | Decision (wire later / hide / remove) | Approved by | Date |
|---|---|---|---|
| `/vehicules/$id` "catalog.interested" CTA doesn't carry vehicle context into the wizard | wire: pre-fill the vehicle into the wizard | Salma | 2026-08-28 |
| `/mes-demandes` and `/espace-acheteur` have no per-request detail view for buyers — intentional? | wire: add a buyer request detail view | Salma | 2026-08-28 |
| `SaleListingPanel` manual "Transformer en offre de vente" create dialog — likely dead code, remove or keep as fallback? | keep as fallback | Salma | 2026-08-28 |
| No hard-delete anywhere for buyer_leads / demand_opportunities / vehicle_opportunities / sale_listings / match_candidates — intentional audit-trail design? | keep soft-close only, confirmed intentional | Salma | 2026-08-28 |

## 🛑 Needs live/staging verification before Phase 0.5 can close

These cannot be resolved by reading code alone — they require actual Supabase staging access (blocked on the Phase 0.5/1 human gate: Supabase project refs from Salma):

1. ~~**FD-019 — does anything actually create `opportunity_commissions` rows?**~~ RESOLVED 2026-08-28: yes, an untracked trigger (`trg_compute_commission`) does, correctly. It just has zero active `commission_rules` to apply and no UI to create one — see `apps/wilmet/evidence/fd019-commission-creation-investigation.txt` and ADR-012.
2. `getOpportunity`'s reliance on RLS alone (no app-layer ownership filter) for opportunity read access
3. `updateDemandStage`/`linkVehicleMatch`/`suggestVehiclesForDemand`/`getDemandOpportunity` missing app-level role checks (RLS-only enforcement)
4. `addOpportunityActivity` missing role check beyond "logged in"
5. `admin.tsx`'s client-side `user_roles` gate depends on that table's own RLS policy actually restricting reads
6. `/auth` signup password-length enforcement server-side (client check is explicitly UX-only)
7. `/reset-password` full magic-link → recovery-session round trip
8. `staffDelete`/`groupDelete` — does `staff_group_members` cascade-delete at the DB level?
