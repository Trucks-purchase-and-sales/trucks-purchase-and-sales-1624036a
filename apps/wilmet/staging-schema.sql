-- =====================================================================
-- Wilmet Trucks — STAGING schema for Phase 2 (9.2 active RLS probing)
-- =====================================================================
-- Rebuilt from live PRODUCTION catalog queries run 2026-08-23 (pg_proc,
-- information_schema.columns, table_constraints, pg_enum) — NOT a
-- pg_dump, since production's DB password was never shared (see
-- ADR-005). Run this once, top to bottom, against a brand-new, EMPTY
-- Supabase project's SQL editor (Project Settings > SQL Editor > New
-- query). It needs a real Supabase project, not a bare Postgres
-- database, because RLS policies here call auth.uid()/auth.role(),
-- which only exist inside Supabase's auth stack.
--
-- Deliberate scope decision: this reproduces every table, every RLS
-- policy verbatim, every helper function policies depend on, and the
-- 4 security-relevant guard triggers (block self-escalation, enforce
-- partner column restrictions, etc). It OMITS ~13 business-logic
-- triggers (reference-number generation, notification sends, computed
-- commissions, status-history logging, quality scoring) because none
-- of them affect access control — only the RLS probe's actual target
-- — and every column they touch is nullable, so omitting them doesn't
-- break inserts. If a future phase needs full business-logic parity
-- (e.g. testing notifications), those 13 function bodies are already
-- captured in apps/wilmet/evidence/phase2-rls-audit-functions.txt and
-- can be added.
-- =====================================================================

-- =====================================================================
-- 0) Reset — makes this script safe to re-run from scratch at any time
--    (e.g. after a mid-script error) on a fresh/disposable STAGING
--    project. This is the standard Supabase "reset the public schema"
--    snippet. NEVER run this against a project holding real data.
-- =====================================================================
drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;
drop schema if exists private cascade;
create schema private;

-- RLS policies only ever RESTRICT access on top of a baseline table-level
-- grant — they don't grant access themselves. A brand-new Supabase project
-- gets these grants automatically as part of its own hidden bootstrap
-- (outside any exported schema); rebuilding the schema by hand skips that
-- step entirely, so it has to be done explicitly here. Without this, every
-- single table — even ones with a genuinely public "using (true)" policy —
-- returns "permission denied for table X" (Postgres error 42501) for
-- every role, RLS policy content notwithstanding.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- =====================================================================
-- 1) Extensions
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists vector;

-- =====================================================================
-- 2) Enum types
-- =====================================================================
create type public.app_role as enum ('apporteur','admin','commercial_future','client_future','buyer','sales_agent','sales_manager','company_management','platform_admin','partenaire','external_agent');
create type public.availability_type as enum ('immediate','sous_7_jours','sous_30_jours','a_confirmer');
create type public.buyer_lead_status as enum ('nouveau','a_qualifier','match_possible','en_recherche','offre_envoyee','option_posee','gagne','perdu','archive','converted');
create type public.cabin_type as enum ('courte','approfondie','double_cabine','cabine_couchette','autre');
create type public.commission_basis as enum ('purchase','sale');
create type public.commission_rule_kind as enum ('pct_of_purchase','pct_of_margin','flat');
create type public.commission_scope as enum ('all','partner','country','vehicle_type');
create type public.commission_status as enum ('draft','approved','paid','cancelled');
create type public.demand_opportunity_status as enum ('nouvelle','qualifiee','en_recherche','proposition_envoyee','negociation','gagnee','perdue','archivee');
create type public.demand_stage as enum ('qualification','sourcing','proposition','negociation','cloture');
create type public.fuel_type as enum ('diesel','essence','electrique','hybride','gnv','autre');
create type public.gearbox as enum ('manuelle','automatique','robotisee');
create type public.general_condition as enum ('tres_bon','bon','moyen','a_reparer','accidente');
create type public.info_request_status as enum ('open','answered','closed');
create type public.match_score as enum ('tres_fort','interessant','partiel','faible');
create type public.match_source_kind as enum ('buyer_lead','opportunity','resale_listing');
create type public.match_status as enum ('suggested','pinned','excluded','confirmed','dismissed');
create type public.negotiable_state as enum ('oui','non','a_discuter');
create type public.ocr_field_action as enum ('pending','confirmed','edited','rejected');
create type public.ocr_source_type as enum ('vehicle_exterior','dashboard','registration','vin_plate','manufacturer_plate','technical_doc','other');
create type public.ocr_status as enum ('non_commence','en_cours','termine','a_verifier','confirme','rejete','echec');
create type public.opportunity_owner_side as enum ('apporteur','wilmet','partenaire');
create type public.opportunity_quality as enum ('incomplet','correct','bon','excellent');
create type public.opportunity_status as enum ('brouillon','envoyee','en_cours_analyse','informations_demandees','acceptee','refusee','archivee','achetee','offre_envoyee','en_negociation','paiement_en_attente','paiement_recu','livraison_planifiee','livree','closed_won','closed_lost','qualifiee');
create type public.partner_kind as enum ('client','seller');
create type public.payment_method as enum ('virement','cheque','paycifi','autre');
create type public.photo_category as enum ('vue_avant','vue_arriere','cote_gauche','cote_droit','interieur_cabine','tableau_de_bord','pneus','moteur','coffre','plaque_vin','defauts','documents','tableau_de_bord_moteur');
create type public.provider_type as enum ('garage','transporteur','loueur','concessionnaire','courtier','particulier_professionnel','autre');
create type public.sale_listing_status as enum ('brouillon','publiee','reservee','vendue','retiree');
create type public.staff_group as enum ('purchase','sales');
create type public.staff_scope as enum ('purchase','sales','both');
create type public.tri_state as enum ('oui','non','a_verifier','non_applicable','partiellement');
create type public.vehicle_type as enum ('utilitaire','camion_porteur','tracteur_routier','semi_remorque','remorque','benne','frigorifique','plateau','fourgon','autre');
create type public.visibility_state as enum ('oui','non','sur_rendez_vous');

-- =====================================================================
-- 3) Tables (columns + inline single-column PKs; FKs and composite
--    PKs added afterward in section 4)
-- =====================================================================

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliate_clicks (
  id bigint generated by default as identity primary key,
  link_id uuid not null,
  landing_path text,
  referer text,
  locale text,
  fingerprint_hash text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text,
  company_name text,
  provider_type public.provider_type,
  city text,
  country text default 'France',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  preferred_locale text,
  partner_kind public.partner_kind,
  staff_scope public.staff_scope,
  commission_rate numeric(5,2),
  is_external boolean not null default false,
  referred_by uuid,
  referral_code text
);

create table public.staff_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  side public.staff_scope not null default 'both',
  is_active boolean not null default true,
  is_default boolean not null default false,
  is_external boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_group_members (
  group_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key,
  locale text not null default 'fr',
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create table public.vehicle_opportunities (
  id uuid primary key default gen_random_uuid(),
  reference_number text,
  partenaire_id uuid not null,
  status public.opportunity_status not null default 'brouillon',
  vehicle_type public.vehicle_type,
  brand text,
  model text,
  version text,
  year integer,
  first_registration_date date,
  mileage integer,
  registration_number text,
  vin text,
  city text,
  postal_code text,
  country text default 'France',
  visible_on_site public.visibility_state,
  fuel_type public.fuel_type,
  gearbox public.gearbox,
  power text,
  euro_standard text,
  gross_vehicle_weight text,
  payload text,
  axle_configuration text,
  cabin_type public.cabin_type,
  equipment text[] default '{}',
  general_condition public.general_condition,
  vehicle_runs public.tri_state,
  technical_inspection_status public.tri_state,
  maintenance_status public.tri_state,
  known_defects text,
  expected_repairs text,
  additional_comments text,
  desired_price_excl_tax numeric(12,2),
  price_negotiable public.negotiable_state,
  availability public.availability_type,
  free_of_commitment public.tri_state,
  special_conditions text,
  onsite_contact_name text,
  onsite_contact_phone text,
  onsite_contact_email text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quality_score public.opportunity_quality,
  assigned_sales_agent_id uuid,
  vat_recoverable text,
  has_accident text,
  has_breakdown text,
  maintenance_history text,
  owner_side public.opportunity_owner_side not null default 'wilmet',
  handover_message text,
  withdrawn_at timestamptz,
  purchase_price_excl_tax numeric,
  purchased_at timestamptz,
  purchase_reference text,
  payment_method public.payment_method,
  expected_close_date date,
  total_contract_value_eur numeric,
  close_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  payment_received_at timestamptz,
  delivered_at timestamptz,
  delivery_notes text,
  qualified_at timestamptz,
  embedding vector,
  embedding_source_hash text,
  embedded_at timestamptz,
  final_sale_price_eur numeric(12,2),
  body_type text,
  body_type_other text,
  wheelbase_mm integer,
  suspension_type text,
  tyre_size text,
  box_height_mm integer,
  box_width_mm integer,
  box_depth_mm integer,
  not_running_reason text,
  inspection_valid_until date,
  has_service_book text,
  key_code text,
  has_air_conditioning text,
  has_heating text,
  has_hydraulic_hook text,
  has_crane text,
  crane_details text,
  other_equipment_details text,
  location_url text,
  tail_lift_present text,
  tail_lift_homologated text,
  tail_lift_homologation_book text,
  tail_lift_maintenance_book text,
  tail_lift_condition text,
  tail_lift_comment text,
  market_price_estimate_eur numeric,
  market_price_gap_pct numeric,
  price_attractive text,
  benchmark_comment text,
  vehicle_category text,
  keys_count integer,
  defects_and_comments text,
  free_of_pledge text,
  assigned_group public.staff_group default 'purchase',
  assigned_group_id uuid,
  referred_by uuid,
  referral_code text
);

create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  storage_path text not null,
  category public.photo_category,
  is_main_photo boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.buyer_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  reference_number text,
  status public.buyer_lead_status not null default 'nouveau',
  assigned_sales_agent_id uuid,
  first_name text not null,
  last_name text not null,
  company_name text,
  email text not null,
  phone text,
  country text,
  city text,
  message text,
  gdpr_consent boolean not null default false,
  vehicle_type text,
  body_type text,
  preferred_brand text,
  preferred_model text,
  intended_use text,
  usage_country text,
  min_year integer,
  max_mileage integer,
  min_euro_norm text,
  fuel_type text,
  gearbox text,
  ptac_kg integer,
  payload_kg integer,
  required_equipment text[],
  wanted_equipment text[],
  max_budget_ht numeric(12,2),
  currency text not null default 'EUR',
  budget_flexible text,
  buy_timeline text,
  financing_needed text,
  extra jsonb not null default '{}'::jsonb,
  source text not null default 'public_form',
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_method public.payment_method,
  embedding vector,
  embedding_source_hash text,
  embedded_at timestamptz,
  assigned_group public.staff_group default 'sales',
  vehicle_category text,
  assigned_group_id uuid,
  referred_by uuid,
  referral_code text
);

create table public.buyer_lead_matches (
  id uuid primary key default gen_random_uuid(),
  buyer_lead_id uuid not null,
  vehicle_opportunity_id uuid not null,
  score public.match_score,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.buyer_lead_status_history (
  id uuid primary key default gen_random_uuid(),
  buyer_lead_id uuid not null,
  old_status public.buyer_lead_status,
  new_status public.buyer_lead_status not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create table public.demand_opportunities (
  id uuid primary key default gen_random_uuid(),
  reference_number text,
  buyer_lead_id uuid not null,
  client_id uuid,
  assigned_sales_agent_id uuid,
  status public.demand_opportunity_status not null default 'nouvelle',
  stage public.demand_stage not null default 'qualification',
  lost_reason text,
  brand text,
  model text,
  body_type text,
  vehicle_type text,
  year_min integer,
  year_max integer,
  max_budget_ht numeric(12,2),
  max_mileage integer,
  min_euro_norm text,
  fuel_type text,
  gearbox text,
  city text,
  country text,
  notes text,
  matched_vehicle_opportunity_id uuid,
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_group public.staff_group default 'sales',
  vehicle_category text,
  assigned_group_id uuid
);

create table public.demand_opportunity_status_history (
  id uuid primary key default gen_random_uuid(),
  demand_opportunity_id uuid not null,
  old_status public.demand_opportunity_status,
  new_status public.demand_opportunity_status not null,
  changed_by uuid,
  message text,
  created_at timestamptz not null default now()
);

create table public.information_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  admin_id uuid,
  message text not null,
  status public.info_request_status not null default 'open',
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  response text,
  response_at timestamptz
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  admin_id uuid not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.opportunity_activities (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  kind text not null,
  body text not null,
  due_at timestamptz,
  done_at timestamptz,
  author_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_commissions (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  partenaire_id uuid,
  rule_id uuid,
  basis public.commission_basis not null,
  basis_amount_eur numeric(12,2) not null,
  rule_kind public.commission_rule_kind not null,
  rule_value numeric(10,4) not null,
  computed_amount_eur numeric(12,2) not null,
  status public.commission_status not null default 'draft',
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_decisions (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  scores jsonb not null default '{}'::jsonb,
  total_score integer,
  verdict text,
  notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  doc_type text not null,
  status text not null default 'manquant',
  storage_path text,
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunity_status_history (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  old_status public.opportunity_status,
  new_status public.opportunity_status not null,
  changed_by_user_id uuid,
  message text,
  created_at timestamptz not null default now()
);

create table public.sale_listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid not null,
  reference_number text,
  title text not null,
  description text,
  sale_price_excl_tax numeric,
  vat_regime text,
  availability public.availability_type,
  city text,
  country text,
  photo_ids uuid[] not null default '{}',
  status public.sale_listing_status not null default 'brouillon',
  assigned_sales_agent_id uuid,
  assigned_group public.staff_group default 'sales',
  purchase_price_snapshot numeric,
  sold_price_excl_tax numeric,
  sold_to text,
  sold_at timestamptz,
  published_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_group_id uuid
);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  applies_to public.commission_scope not null default 'all',
  match_value text,
  basis public.commission_basis not null default 'purchase',
  rule_kind public.commission_rule_kind not null default 'pct_of_purchase',
  rule_value numeric(10,4) not null,
  priority integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  vehicle_opportunity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ocr_scans (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null,
  vehicle_opportunity_id uuid,
  status public.ocr_status not null default 'non_commence',
  raw_result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ocr_scan_sources (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  source_type public.ocr_source_type not null default 'other',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.ocr_field_detections (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  field_name text not null,
  detected_value text,
  final_value text,
  confidence numeric(4,3),
  source_image_path text,
  action public.ocr_field_action not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matching_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_default boolean not null default false,
  weights jsonb not null default '{"price": 20, "freeform": 15, "geography": 15, "attributes": 30, "commercial": 20}'::jsonb,
  hard_filters jsonb not null default '{"require_brand": false, "year_tolerance": 2, "price_tolerance_pct": 20, "require_vehicle_type": true}'::jsonb,
  ai_blend numeric(3,2) not null default 0.60,
  min_score integer not null default 60,
  max_results integer not null default 10,
  auto_notify boolean not null default false,
  model_id text not null default 'google/gemini-2.5-flash',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  source_kind public.match_source_kind not null,
  source_id uuid not null,
  target_kinds public.match_source_kind[] not null default array['opportunity','resale_listing']::public.match_source_kind[],
  candidates_scored integer not null default 0,
  candidates_returned integer not null default 0,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  model_id text,
  error text,
  ran_by uuid,
  created_at timestamptz not null default now()
);

create table public.match_candidates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid,
  run_id uuid,
  source_kind public.match_source_kind not null,
  source_id uuid not null,
  target_kind public.match_source_kind not null,
  target_id uuid not null,
  score numeric(5,2) not null,
  ai_score numeric(5,2),
  rule_score numeric(5,2),
  verdict text,
  ai_rationale text,
  criteria_breakdown jsonb not null default '{}'::jsonb,
  status public.match_status not null default 'suggested',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_candidate_id uuid not null,
  admin_id uuid not null,
  vote smallint not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated by default as identity primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create table public.site_content (
  key text not null,
  locale text not null default 'fr',
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Unused/scaffolding tables (see inventory.md — no write path exists for
-- any of these in production either; kept for schema parity only).
create table public.client_quotes (
  id uuid primary key default gen_random_uuid(),
  data jsonb,
  created_at timestamptz not null default now()
);
create table public.cost_estimates (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);
create table public.marketplace_inquiries (
  id uuid primary key default gen_random_uuid(),
  data jsonb,
  created_at timestamptz not null default now()
);
create table public.options_prioritaires (
  id uuid primary key default gen_random_uuid(),
  data jsonb,
  created_at timestamptz not null default now()
);
create table public.purchase_evaluations (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);
create table public.resale_listings (
  id uuid primary key default gen_random_uuid(),
  vehicle_opportunity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);

-- Reference / lookup tables (public, non-sensitive)
create table public.ref_body_types (
  slug text primary key,
  label_fr text not null,
  label_en text,
  is_active boolean not null default true,
  applies_to text[] not null default array['porteur','semi_remorque']
);
create table public.ref_countries (
  code text primary key,
  name_fr text not null,
  name_en text not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.ref_equipment (
  slug text primary key,
  label_fr text not null,
  label_en text,
  is_active boolean not null default true
);
create table public.ref_euro_standards (
  slug text primary key,
  label text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true
);
create table public.ref_fuel_types (
  slug text primary key,
  label_fr text not null,
  label_en text,
  is_active boolean not null default true
);
create table public.ref_gearbox_types (
  slug text primary key,
  label_fr text not null,
  label_en text,
  is_active boolean not null default true
);
create table public.ref_vehicle_brands (
  slug text primary key,
  label text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true
);
create table public.ref_vehicle_categories (
  slug text primary key,
  label_fr text not null,
  label_en text,
  sort_order integer not null default 100,
  is_active boolean not null default true
);
create table public.ref_vehicle_models (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  label text not null,
  is_active boolean not null default true
);
create table public.ref_vehicle_types (
  slug text primary key,
  label_fr text not null,
  label_en text,
  sort_order integer not null default 100,
  is_active boolean not null default true
);
create table public.ref_category_brands (
  category_slug text not null,
  brand_slug text not null
);

-- =====================================================================
-- 4) Composite primary keys + all foreign keys
--    (every "who did this" uuid column references auth.users(id), per
--    production's catalog — these all showed a FK with no visible
--    target table in the public schema, consistent with Supabase's
--    standard "references auth.users" pattern used throughout.)
-- =====================================================================
alter table public.site_content add primary key (key, locale);
alter table public.staff_group_members add primary key (group_id, user_id);
alter table public.ref_category_brands add primary key (category_slug, brand_slug);

alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id);
alter table public.profiles add constraint profiles_referred_by_fkey foreign key (referred_by) references auth.users(id);

alter table public.affiliate_links add constraint affiliate_links_owner_id_fkey foreign key (owner_id) references auth.users(id);
alter table public.affiliate_clicks add constraint affiliate_clicks_link_id_fkey foreign key (link_id) references public.affiliate_links(id);

alter table public.app_settings add constraint app_settings_updated_by_fkey foreign key (updated_by) references auth.users(id);
alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key (actor_id) references auth.users(id);

alter table public.staff_group_members add constraint staff_group_members_group_id_fkey foreign key (group_id) references public.staff_groups(id);
alter table public.staff_group_members add constraint staff_group_members_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.user_preferences add constraint user_preferences_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id);
-- Required by handle_new_user's "ON CONFLICT (user_id) DO NOTHING" — without
-- this, every new signup fails with "Database error creating new user"
-- because that ON CONFLICT clause has no matching constraint to target.
alter table public.user_roles add constraint user_roles_user_id_key unique (user_id);

alter table public.vehicle_opportunities add constraint vehicle_opportunities_partenaire_id_fkey foreign key (partenaire_id) references auth.users(id);
alter table public.vehicle_opportunities add constraint vehicle_opportunities_assigned_sales_agent_id_fkey foreign key (assigned_sales_agent_id) references auth.users(id);
alter table public.vehicle_opportunities add constraint vehicle_opportunities_referred_by_fkey foreign key (referred_by) references auth.users(id);
alter table public.vehicle_opportunities add constraint vehicle_opportunities_assigned_group_id_fkey foreign key (assigned_group_id) references public.staff_groups(id);

alter table public.vehicle_photos add constraint vehicle_photos_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);

alter table public.buyer_leads add constraint buyer_leads_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.buyer_leads add constraint buyer_leads_assigned_sales_agent_id_fkey foreign key (assigned_sales_agent_id) references auth.users(id);
alter table public.buyer_leads add constraint buyer_leads_referred_by_fkey foreign key (referred_by) references auth.users(id);
alter table public.buyer_leads add constraint buyer_leads_assigned_group_id_fkey foreign key (assigned_group_id) references public.staff_groups(id);

alter table public.buyer_lead_matches add constraint buyer_lead_matches_buyer_lead_id_fkey foreign key (buyer_lead_id) references public.buyer_leads(id);
alter table public.buyer_lead_matches add constraint buyer_lead_matches_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.buyer_lead_matches add constraint buyer_lead_matches_created_by_fkey foreign key (created_by) references auth.users(id);

alter table public.buyer_lead_status_history add constraint blsh_buyer_lead_id_fkey foreign key (buyer_lead_id) references public.buyer_leads(id);
alter table public.buyer_lead_status_history add constraint blsh_changed_by_fkey foreign key (changed_by) references auth.users(id);

alter table public.demand_opportunities add constraint demand_opp_buyer_lead_id_fkey foreign key (buyer_lead_id) references public.buyer_leads(id);
alter table public.demand_opportunities add constraint demand_opp_client_id_fkey foreign key (client_id) references auth.users(id);
alter table public.demand_opportunities add constraint demand_opp_assigned_sales_agent_id_fkey foreign key (assigned_sales_agent_id) references auth.users(id);
alter table public.demand_opportunities add constraint demand_opp_matched_vehicle_opportunity_id_fkey foreign key (matched_vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.demand_opportunities add constraint demand_opp_assigned_group_id_fkey foreign key (assigned_group_id) references public.staff_groups(id);

alter table public.demand_opportunity_status_history add constraint dosh_demand_opportunity_id_fkey foreign key (demand_opportunity_id) references public.demand_opportunities(id);
alter table public.demand_opportunity_status_history add constraint dosh_changed_by_fkey foreign key (changed_by) references auth.users(id);

alter table public.information_requests add constraint info_req_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.information_requests add constraint info_req_admin_id_fkey foreign key (admin_id) references auth.users(id);

alter table public.internal_notes add constraint internal_notes_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.internal_notes add constraint internal_notes_admin_id_fkey foreign key (admin_id) references auth.users(id);

alter table public.opportunity_activities add constraint opp_act_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.opportunity_activities add constraint opp_act_author_id_fkey foreign key (author_id) references auth.users(id);

alter table public.opportunity_commissions add constraint opp_comm_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.opportunity_commissions add constraint opp_comm_rule_id_fkey foreign key (rule_id) references public.commission_rules(id);
alter table public.opportunity_commissions add constraint opp_comm_approved_by_fkey foreign key (approved_by) references auth.users(id);
alter table public.opportunity_commissions add constraint opp_comm_partenaire_id_fkey foreign key (partenaire_id) references auth.users(id);

alter table public.opportunity_decisions add constraint opp_dec_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.opportunity_decisions add constraint opp_dec_decided_by_fkey foreign key (decided_by) references auth.users(id);

alter table public.opportunity_documents add constraint opp_docs_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.opportunity_documents add constraint opp_docs_verified_by_fkey foreign key (verified_by) references auth.users(id);

alter table public.opportunity_status_history add constraint osh_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.opportunity_status_history add constraint osh_changed_by_user_id_fkey foreign key (changed_by_user_id) references auth.users(id);

alter table public.sale_listings add constraint sale_listings_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.sale_listings add constraint sale_listings_created_by_fkey foreign key (created_by) references auth.users(id);
alter table public.sale_listings add constraint sale_listings_assigned_sales_agent_id_fkey foreign key (assigned_sales_agent_id) references auth.users(id);
alter table public.sale_listings add constraint sale_listings_assigned_group_id_fkey foreign key (assigned_group_id) references public.staff_groups(id);

alter table public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references auth.users(id);
alter table public.notifications add constraint notifications_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);

alter table public.ocr_scans add constraint ocr_scans_uploader_id_fkey foreign key (uploader_id) references auth.users(id);
alter table public.ocr_scans add constraint ocr_scans_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.ocr_scan_sources add constraint ocr_scan_sources_scan_id_fkey foreign key (scan_id) references public.ocr_scans(id);
alter table public.ocr_field_detections add constraint ocr_field_detections_scan_id_fkey foreign key (scan_id) references public.ocr_scans(id);

alter table public.matching_profiles add constraint matching_profiles_created_by_fkey foreign key (created_by) references auth.users(id);
alter table public.match_runs add constraint match_runs_profile_id_fkey foreign key (profile_id) references public.matching_profiles(id);
alter table public.match_runs add constraint match_runs_ran_by_fkey foreign key (ran_by) references auth.users(id);
alter table public.match_candidates add constraint match_candidates_profile_id_fkey foreign key (profile_id) references public.matching_profiles(id);
alter table public.match_candidates add constraint match_candidates_run_id_fkey foreign key (run_id) references public.match_runs(id);
alter table public.match_feedback add constraint match_feedback_match_candidate_id_fkey foreign key (match_candidate_id) references public.match_candidates(id);
alter table public.match_feedback add constraint match_feedback_admin_id_fkey foreign key (admin_id) references auth.users(id);

alter table public.cost_estimates add constraint cost_estimates_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.purchase_evaluations add constraint purchase_evaluations_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);
alter table public.resale_listings add constraint resale_listings_vehicle_opportunity_id_fkey foreign key (vehicle_opportunity_id) references public.vehicle_opportunities(id);

alter table public.site_content add constraint site_content_updated_by_fkey foreign key (updated_by) references auth.users(id);

alter table public.ref_category_brands add constraint rcb_category_slug_fkey foreign key (category_slug) references public.ref_vehicle_categories(slug);
alter table public.ref_category_brands add constraint rcb_brand_slug_fkey foreign key (brand_slug) references public.ref_vehicle_brands(slug);
alter table public.ref_vehicle_models add constraint ref_vehicle_models_brand_slug_fkey foreign key (brand_slug) references public.ref_vehicle_brands(slug);

-- =====================================================================
-- 5) Helper functions (exact bodies pulled from production)
-- =====================================================================
create or replace function private.has_role(_user_id uuid, _role app_role)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$function$;

create or replace function private.has_any_role(_user_id uuid, _roles app_role[])
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = any(_roles)
  );
$function$;

create or replace function private.get_partner_kind(_user uuid)
 returns partner_kind
 language sql
 stable security definer
 set search_path to 'public'
as $function$ select partner_kind from public.profiles where id = _user $function$;

create or replace function private.is_group_member(_user_id uuid, _group_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select _group_id is not null and exists (
    select 1 from public.staff_group_members
    where user_id = _user_id and group_id = _group_id
  );
$function$;

create or replace function private.can_read_all_pipeline(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.has_any_role(_user_id, ARRAY['admin','platform_admin','company_management','sales_manager']::public.app_role[]);
$function$;

create or replace function private.can_write_all_pipeline(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.has_any_role(_user_id, ARRAY['admin','platform_admin','sales_manager']::public.app_role[]);
$function$;

create or replace function private.is_internal_sales_agent(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.has_role(_user_id, 'sales_agent'::public.app_role);
$function$;

create or replace function private.is_external_agent(_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.has_role(_user_id, 'external_agent'::public.app_role);
$function$;

-- NOTE: the 4th parameter is staff_group (2 values: purchase/sales), NOT
-- staff_scope (3 values: purchase/sales/both) — these are two different
-- enum types. profiles.staff_scope is compared to it via ::text since
-- Postgres won't implicitly compare two different enum types.
create or replace function private.staff_scope_allows(_user_id uuid, _side public.staff_group)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select staff_scope::text = 'both' or staff_scope::text = _side::text
       from public.profiles where id = _user_id),
    false);
$function$;

create or replace function private.can_read_pipeline_record(_user_id uuid, _assigned uuid, _group_id uuid, _side public.staff_group)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.can_read_all_pipeline(_user_id)
      or (_assigned is not null and _assigned = _user_id and (private.is_internal_sales_agent(_user_id) or private.is_external_agent(_user_id)))
      or (
        private.is_internal_sales_agent(_user_id)
        and (
          private.is_group_member(_user_id, _group_id)
          or (_assigned is null and _group_id is null and private.staff_scope_allows(_user_id, _side))
        )
      );
$function$;

create or replace function private.can_write_pipeline_record(_user_id uuid, _assigned uuid, _group_id uuid, _side public.staff_group)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select private.can_write_all_pipeline(_user_id)
      or (_assigned is not null and _assigned = _user_id
          and (private.is_internal_sales_agent(_user_id) or private.is_external_agent(_user_id)))
      or (
        private.is_internal_sales_agent(_user_id)
        and (
          private.is_group_member(_user_id, _group_id)
          or (_assigned is null and _group_id is null and private.staff_scope_allows(_user_id, _side))
        )
      );
$function$;

revoke all on function private.can_read_all_pipeline(uuid) from public;
revoke all on function private.can_write_all_pipeline(uuid) from public;
revoke all on function private.is_internal_sales_agent(uuid) from public;
revoke all on function private.is_external_agent(uuid) from public;
revoke all on function private.staff_scope_allows(uuid, public.staff_group) from public;
revoke all on function private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) from public;
revoke all on function private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) from public;
grant execute on function private.can_read_all_pipeline(uuid) to authenticated, service_role;
grant execute on function private.can_write_all_pipeline(uuid) to authenticated, service_role;
grant execute on function private.is_internal_sales_agent(uuid) to authenticated, service_role;
grant execute on function private.is_external_agent(uuid) to authenticated, service_role;
grant execute on function private.staff_scope_allows(uuid, public.staff_group) to authenticated, service_role;
grant execute on function private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) to authenticated, service_role;
grant execute on function private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) to authenticated, service_role;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  meta_kind text;
  resolved_kind public.partner_kind;
  ref_code text;
  ref_owner uuid;
BEGIN
  meta_kind := NEW.raw_user_meta_data->>'partner_kind';
  resolved_kind := CASE WHEN meta_kind IN ('client','seller') THEN meta_kind::public.partner_kind
                        ELSE 'client'::public.partner_kind END;

  ref_code := upper(NULLIF(trim(NEW.raw_user_meta_data->>'referral_code'), ''));
  IF ref_code IS NOT NULL THEN
    SELECT owner_id INTO ref_owner
      FROM public.affiliate_links
      WHERE upper(code) = ref_code AND is_active
      LIMIT 1;
    IF ref_owner = NEW.id THEN ref_owner := NULL; END IF;
    IF ref_owner IS NULL THEN ref_code := NULL; END IF;
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, phone, company_name, provider_type, city, country, partner_kind, referred_by, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company_name',
    NULLIF(NEW.raw_user_meta_data->>'provider_type','')::public.provider_type,
    NEW.raw_user_meta_data->>'city',
    COALESCE(NEW.raw_user_meta_data->>'country','France'),
    resolved_kind,
    ref_owner,
    ref_code
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'partenaire'::public.app_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 6) Security-relevant guard triggers (exact bodies from production).
--    Business-logic-only triggers (ref numbers, notifications, computed
--    commission, status-history logging, quality score) intentionally
--    omitted — see header note.
-- =====================================================================
create or replace function public.tg_opp_partner_column_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  is_internal boolean;
  is_seller_partner boolean;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  is_internal := private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'sales_agent'::public.app_role,
    'sales_manager'::public.app_role,
    'company_management'::public.app_role,
    'platform_admin'::public.app_role
  ]);
  IF is_internal THEN RETURN NEW; END IF;
  is_seller_partner := private.has_role(auth.uid(), 'partenaire'::public.app_role)
    AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind;
  IF TG_OP = 'INSERT' THEN
    IF is_seller_partner THEN
      IF NEW.partenaire_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'vehicle_opportunity: partenaire_id must match authenticated seller'; END IF;
      IF NEW.status <> 'brouillon'::public.opportunity_status THEN RAISE EXCEPTION 'vehicle_opportunity: seller insert must start as draft'; END IF;
      NEW.assigned_sales_agent_id := NULL;
      NEW.assigned_group_id := NULL;
      NEW.assigned_group := NULL;
      NEW.owner_side := 'wilmet'::public.opportunity_owner_side;
      NEW.handover_message := NULL;
      NEW.quality_score := NULL;
      NEW.purchase_price_excl_tax := NULL;
      NEW.purchased_at := NULL;
      NEW.purchase_reference := NULL;
      NEW.payment_method := NULL;
      NEW.expected_close_date := NULL;
      NEW.total_contract_value_eur := NULL;
      NEW.close_reason := NULL;
      NEW.won_at := NULL;
      NEW.lost_at := NULL;
      NEW.payment_received_at := NULL;
      NEW.delivered_at := NULL;
      NEW.delivery_notes := NULL;
      NEW.qualified_at := NULL;
      NEW.final_sale_price_eur := NULL;
      NEW.reference_number := NULL;
      NEW.submitted_at := NULL;
      NEW.embedding := NULL;
      NEW.embedding_source_hash := NULL;
      NEW.embedded_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  NEW.assigned_sales_agent_id := OLD.assigned_sales_agent_id;
  NEW.assigned_group_id := OLD.assigned_group_id;
  NEW.assigned_group := OLD.assigned_group;
  NEW.quality_score := OLD.quality_score;
  NEW.purchase_price_excl_tax := OLD.purchase_price_excl_tax;
  NEW.purchased_at := OLD.purchased_at;
  NEW.purchase_reference := OLD.purchase_reference;
  NEW.payment_method := OLD.payment_method;
  NEW.expected_close_date := OLD.expected_close_date;
  NEW.total_contract_value_eur := OLD.total_contract_value_eur;
  NEW.close_reason := OLD.close_reason;
  NEW.won_at := OLD.won_at;
  NEW.lost_at := OLD.lost_at;
  NEW.payment_received_at := OLD.payment_received_at;
  NEW.delivered_at := OLD.delivered_at;
  NEW.delivery_notes := OLD.delivery_notes;
  NEW.qualified_at := OLD.qualified_at;
  NEW.final_sale_price_eur := OLD.final_sale_price_eur;
  NEW.reference_number := OLD.reference_number;
  NEW.submitted_at := OLD.submitted_at;
  NEW.partenaire_id := OLD.partenaire_id;
  NEW.embedding := OLD.embedding;
  NEW.embedding_source_hash := OLD.embedding_source_hash;
  NEW.embedded_at := OLD.embedded_at;
  NEW.referred_by := OLD.referred_by;
  NEW.referral_code := OLD.referral_code;
  IF is_seller_partner THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.owner_side IS DISTINCT FROM OLD.owner_side THEN
      IF OLD.status = 'brouillon'::public.opportunity_status AND NEW.status = 'envoyee'::public.opportunity_status AND NEW.owner_side = 'wilmet'::public.opportunity_owner_side THEN
        NULL;
      ELSIF OLD.owner_side = 'partenaire'::public.opportunity_owner_side AND NEW.status = 'envoyee'::public.opportunity_status THEN
        NEW.owner_side := 'wilmet'::public.opportunity_owner_side;
      ELSE
        RAISE EXCEPTION 'vehicle_opportunity: seller cannot perform this workflow transition';
      END IF;
    END IF;
    IF NEW.status = 'envoyee'::public.opportunity_status AND NEW.owner_side = 'wilmet'::public.opportunity_owner_side
       AND (OLD.status = 'brouillon'::public.opportunity_status OR OLD.owner_side = 'partenaire'::public.opportunity_owner_side) THEN
      NEW.assigned_group := 'purchase'::public.staff_group;
      NEW.assigned_group_id := NULL;
      NEW.assigned_sales_agent_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

create trigger trg_opp_partner_column_guard
  before insert or update on public.vehicle_opportunities
  for each row execute function public.tg_opp_partner_column_guard();

create or replace function public.tg_profile_self_update_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile: id is immutable';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profile: email is managed by authentication workflows';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'profile: account state is admin-managed';
  END IF;
  IF NEW.partner_kind IS DISTINCT FROM OLD.partner_kind THEN
    RAISE EXCEPTION 'profile: partner kind is fixed outside self-service editing';
  END IF;
  IF NEW.staff_scope IS DISTINCT FROM OLD.staff_scope THEN
    RAISE EXCEPTION 'profile: staff scope is admin-managed';
  END IF;
  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    RAISE EXCEPTION 'profile: commission rate is admin-managed';
  END IF;
  IF NEW.is_external IS DISTINCT FROM OLD.is_external THEN
    RAISE EXCEPTION 'profile: external staff metadata is admin-managed';
  END IF;
  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'profile: referral attribution is immutable in self-service editing';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'profile: created_at is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

create trigger trg_profile_self_update_guard
  before update on public.profiles
  for each row execute function public.tg_profile_self_update_guard();

create or replace function public.tg_info_req_owner_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
BEGIN
  IF auth.role() = 'service_role' OR private.has_any_role(auth.uid(),ARRAY['admin'::public.app_role,'platform_admin'::public.app_role]) THEN RETURN NEW; END IF;
  IF NEW.message IS DISTINCT FROM OLD.message OR NEW.admin_id IS DISTINCT FROM OLD.admin_id OR NEW.vehicle_opportunity_id IS DISTINCT FROM OLD.vehicle_opportunity_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'information_request: partenaire cannot modify these fields'; END IF;
  IF OLD.status = 'answered'::public.info_request_status THEN RAISE EXCEPTION 'information_request: answered response is immutable to partenaire'; END IF;
  IF NEW.status <> 'answered'::public.info_request_status THEN RAISE EXCEPTION 'information_request: partenaire can only set status to answered'; END IF;
  NEW.answered_at := now();
  IF NEW.response IS DISTINCT FROM OLD.response AND NEW.response IS NOT NULL THEN NEW.response_at := now(); ELSIF NEW.response IS NULL THEN NEW.response_at := NULL; END IF;
  RETURN NEW;
END;
$function$;

create trigger trg_info_req_owner_guard
  before update on public.information_requests
  for each row execute function public.tg_info_req_owner_guard();

create or replace function private.tg_sale_listing_photo_ownership_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'pg_temp'
as $function$
BEGIN
  IF COALESCE(pg_catalog.cardinality(NEW.photo_ids), 0) = 0 THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(NEW.photo_ids) AS requested(photo_id)
    LEFT JOIN public.vehicle_photos AS vp
      ON vp.id = requested.photo_id
    WHERE vp.id IS NULL
       OR vp.vehicle_opportunity_id IS DISTINCT FROM NEW.vehicle_opportunity_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'sale_listing photo_ids must belong to the source opportunity';
  END IF;
  RETURN NEW;
END;
$function$;

create trigger trg_sale_listing_photo_ownership_guard
  before insert or update on public.sale_listings
  for each row execute function private.tg_sale_listing_photo_ownership_guard();

-- =====================================================================
-- 7) Enable RLS on every table
-- =====================================================================
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.buyer_lead_matches enable row level security;
alter table public.buyer_lead_status_history enable row level security;
alter table public.buyer_leads enable row level security;
alter table public.client_quotes enable row level security;
alter table public.commission_rules enable row level security;
alter table public.cost_estimates enable row level security;
alter table public.demand_opportunities enable row level security;
alter table public.demand_opportunity_status_history enable row level security;
alter table public.information_requests enable row level security;
alter table public.internal_notes enable row level security;
alter table public.marketplace_inquiries enable row level security;
alter table public.match_candidates enable row level security;
alter table public.match_feedback enable row level security;
alter table public.match_runs enable row level security;
alter table public.matching_profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.ocr_field_detections enable row level security;
alter table public.ocr_scan_sources enable row level security;
alter table public.ocr_scans enable row level security;
alter table public.opportunity_activities enable row level security;
alter table public.opportunity_commissions enable row level security;
alter table public.opportunity_decisions enable row level security;
alter table public.opportunity_documents enable row level security;
alter table public.opportunity_status_history enable row level security;
alter table public.options_prioritaires enable row level security;
alter table public.profiles enable row level security;
alter table public.purchase_evaluations enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.ref_body_types enable row level security;
alter table public.ref_category_brands enable row level security;
alter table public.ref_countries enable row level security;
alter table public.ref_equipment enable row level security;
alter table public.ref_euro_standards enable row level security;
alter table public.ref_fuel_types enable row level security;
alter table public.ref_gearbox_types enable row level security;
alter table public.ref_vehicle_brands enable row level security;
alter table public.ref_vehicle_categories enable row level security;
alter table public.ref_vehicle_models enable row level security;
alter table public.ref_vehicle_types enable row level security;
alter table public.resale_listings enable row level security;
alter table public.sale_listings enable row level security;
alter table public.site_content enable row level security;
alter table public.staff_group_members enable row level security;
alter table public.staff_groups enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_roles enable row level security;
alter table public.vehicle_opportunities enable row level security;
alter table public.vehicle_photos enable row level security;
-- rate_limit_events intentionally gets NO policies below (deny-all by
-- design — see threat-model.md).

-- =====================================================================
-- 8) RLS policies — verbatim from production (evidence/phase2-rls-audit.txt)
-- =====================================================================
create policy affiliate_clicks_read_own_or_staff on public.affiliate_clicks for select to authenticated using (
  (exists (select 1 from public.affiliate_links l where l.id = affiliate_clicks.link_id and l.owner_id = auth.uid()))
  or private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','company_management']::app_role[])
);

create policy affiliate_links_admin_delete on public.affiliate_links for delete to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy affiliate_links_admin_insert on public.affiliate_links for insert to authenticated with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy affiliate_links_admin_update on public.affiliate_links for update to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy affiliate_links_read_own_or_staff on public.affiliate_links for select to authenticated using (owner_id = auth.uid() or private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','company_management']::app_role[]));

create policy "app_settings admin insert" on public.app_settings for insert to authenticated with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin'));
create policy "app_settings admin update" on public.app_settings for update to authenticated using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin')) with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin'));
create policy app_settings_admin_read on public.app_settings for select to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));

create policy "admin reads audit logs" on public.audit_logs for select to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));

create policy buyer_lead_matches_delete_scoped on public.buyer_lead_matches for delete to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_matches.buyer_lead_id and private.can_write_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
);
create policy buyer_lead_matches_insert_scoped on public.buyer_lead_matches for insert to authenticated with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_matches.buyer_lead_id and private.can_write_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
);
create policy buyer_lead_matches_select_scoped on public.buyer_lead_matches for select to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_matches.buyer_lead_id and private.can_read_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
);
create policy buyer_lead_matches_update_scoped on public.buyer_lead_matches for update to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_matches.buyer_lead_id and private.can_write_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
) with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_matches.buyer_lead_id and private.can_write_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
);

create policy buyer_lead_status_history_select_scoped on public.buyer_lead_status_history for select to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.buyer_leads lead where lead.id = buyer_lead_status_history.buyer_lead_id and private.can_read_pipeline_record(auth.uid(), lead.assigned_sales_agent_id, lead.assigned_group_id, coalesce(lead.assigned_group,'sales')))
);

create policy "Anonymous can submit public buyer lead" on public.buyer_leads for insert to anon with check (user_id is null);
create policy "Owner reads own buyer lead" on public.buyer_leads for select to authenticated using (user_id = auth.uid());
create policy buyer_leads_insert_scoped on public.buyer_leads for insert to authenticated with check (
  (user_id = auth.uid() and private.get_partner_kind(auth.uid()) = 'client')
  or private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales'))
);
create policy buyer_leads_staff_read on public.buyer_leads for select to authenticated using (private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));
create policy buyer_leads_write_scoped on public.buyer_leads for update to authenticated using (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales'))) with check (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));

create policy future_admin_read on public.client_quotes for select to authenticated using (private.has_role(auth.uid(),'admin'));
create policy future_admin_read on public.cost_estimates for select to authenticated using (private.has_role(auth.uid(),'admin'));
create policy future_admin_read on public.marketplace_inquiries for select to authenticated using (private.has_role(auth.uid(),'admin'));
create policy future_admin_read on public.options_prioritaires for select to authenticated using (private.has_role(auth.uid(),'admin'));
create policy future_admin_read on public.purchase_evaluations for select to authenticated using (private.has_role(auth.uid(),'admin'));
create policy future_admin_read on public.resale_listings for select to authenticated using (private.has_role(auth.uid(),'admin'));

create policy commission_rules_admin_all on public.commission_rules for all to authenticated using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin')) with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin'));
create policy commission_rules_staff_read on public.commission_rules for select to authenticated using (private.has_role(auth.uid(),'sales_manager') or private.has_role(auth.uid(),'company_management') or private.has_role(auth.uid(),'sales_agent'));

create policy demand_opp_admin_delete on public.demand_opportunities for delete to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy demand_opp_client_read on public.demand_opportunities for select to authenticated using (client_id = auth.uid());
create policy demand_opp_staff_read on public.demand_opportunities for select to authenticated using (private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));
create policy demand_opp_staff_update on public.demand_opportunities for update to authenticated using (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales'))) with check (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));
create policy demand_opp_staff_write on public.demand_opportunities for insert to authenticated with check (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));

create policy demand_hist_insert on public.demand_opportunity_status_history for insert to authenticated with check (
  private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin') or private.has_role(auth.uid(),'company_management') or private.has_role(auth.uid(),'sales_manager')
  or exists (select 1 from public.demand_opportunities d where d.id = demand_opportunity_status_history.demand_opportunity_id and d.assigned_sales_agent_id = auth.uid())
);
create policy demand_hist_read on public.demand_opportunity_status_history for select to authenticated using (
  private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin') or private.has_role(auth.uid(),'company_management') or private.has_role(auth.uid(),'sales_manager')
  or exists (select 1 from public.demand_opportunities d where d.id = demand_opportunity_status_history.demand_opportunity_id and (d.assigned_sales_agent_id = auth.uid() or d.client_id = auth.uid()))
);

create policy info_req_insert_trusted_admin on public.information_requests for insert to authenticated with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy info_req_select_parent_scoped on public.information_requests for select to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = information_requests.vehicle_opportunity_id and (opp.partenaire_id = auth.uid() or (opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))))
);
create policy info_req_update_owner_answer on public.information_requests for update to authenticated using (
  exists (select 1 from public.vehicle_opportunities o where o.id = information_requests.vehicle_opportunity_id and o.partenaire_id = auth.uid())
) with check (
  exists (select 1 from public.vehicle_opportunities o where o.id = information_requests.vehicle_opportunity_id and o.partenaire_id = auth.uid())
);
create policy info_req_update_trusted_admin on public.information_requests for update to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));

create policy internal_notes_admin_all on public.internal_notes for all to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));

create policy "match_candidates admin all" on public.match_candidates for all to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "match_feedback admin all" on public.match_feedback for all to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "match_runs admin all" on public.match_runs for all to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "matching_profiles admin all" on public.matching_profiles for all to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));

create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid());

create policy "Scan owner reads detections" on public.ocr_field_detections for select to authenticated using (
  exists (select 1 from public.ocr_scans s where s.id = ocr_field_detections.scan_id and (s.uploader_id = auth.uid() or private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])))
);
create policy "Scan owner writes detections" on public.ocr_field_detections for all to authenticated using (
  exists (select 1 from public.ocr_scans s where s.id = ocr_field_detections.scan_id and s.uploader_id = auth.uid())
) with check (
  exists (select 1 from public.ocr_scans s where s.id = ocr_field_detections.scan_id and s.uploader_id = auth.uid())
);
create policy "Scan owner manages sources" on public.ocr_scan_sources for all to authenticated using (
  exists (select 1 from public.ocr_scans s where s.id = ocr_scan_sources.scan_id and (s.uploader_id = auth.uid() or private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])))
) with check (
  exists (select 1 from public.ocr_scans s where s.id = ocr_scan_sources.scan_id and s.uploader_id = auth.uid())
);
create policy "Uploader inserts own scans" on public.ocr_scans for insert to authenticated with check (uploader_id = auth.uid());
create policy "Uploader reads own scans" on public.ocr_scans for select to authenticated using (uploader_id = auth.uid() or private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "Uploader updates own scans" on public.ocr_scans for update to authenticated using (uploader_id = auth.uid() or private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (uploader_id = auth.uid() or private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));

create policy activities_delete_trusted_admin on public.opportunity_activities for delete to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy activities_insert_partner_note_editable on public.opportunity_activities for insert to authenticated with check (
  kind = 'note' and author_id = auth.uid() and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_activities.vehicle_opportunity_id and opp.partenaire_id = auth.uid() and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid())) and (opp.status = 'brouillon' or opp.owner_side = 'partenaire'))
);
create policy activities_insert_staff_scoped on public.opportunity_activities for insert to authenticated with check (
  author_id = auth.uid() and private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent','external_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_activities.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy activities_select_parent_scoped on public.opportunity_activities for select to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_activities.vehicle_opportunity_id and ((opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase'))) or (opp.partenaire_id = auth.uid() and opportunity_activities.kind = 'note' and opportunity_activities.author_id = auth.uid())))
);
create policy activities_update_trusted_admin on public.opportunity_activities for update to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));

create policy op_comm_admin_all on public.opportunity_commissions for all to authenticated using (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin')) with check (private.has_role(auth.uid(),'admin') or private.has_role(auth.uid(),'platform_admin'));
create policy op_comm_partner_read_scoped on public.opportunity_commissions for select to authenticated using (partenaire_id = auth.uid() and private.has_any_role(auth.uid(), array['partenaire','apporteur']::app_role[]));
create policy op_comm_staff_read_scoped on public.opportunity_commissions for select to authenticated using (
  private.has_any_role(auth.uid(), array['sales_manager','company_management','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opportunity where opportunity.id = opportunity_commissions.vehicle_opportunity_id and opportunity.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opportunity.assigned_sales_agent_id, opportunity.assigned_group_id, coalesce(opportunity.assigned_group,'purchase')))
);

create policy opp_decisions_delete_scoped on public.opportunity_decisions for delete to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_decisions.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_decisions_insert_scoped on public.opportunity_decisions for insert to authenticated with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_decisions.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_decisions_select_scoped on public.opportunity_decisions for select to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_decisions.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_decisions_update_scoped on public.opportunity_decisions for update to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_decisions.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
) with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_decisions.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);

create policy opp_docs_delete_scoped on public.opportunity_documents for delete to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_documents.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_docs_insert_scoped on public.opportunity_documents for insert to authenticated with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_documents.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_docs_select_scoped on public.opportunity_documents for select to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_documents.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);
create policy opp_docs_update_scoped on public.opportunity_documents for update to authenticated using (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_documents.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
) with check (
  private.has_any_role(auth.uid(), array['admin','platform_admin','sales_manager','sales_agent']::app_role[]) and
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_documents.vehicle_opportunity_id and opp.status <> 'brouillon' and private.can_write_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
);

create policy opp_status_history_select_parent_scoped on public.opportunity_status_history for select to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = opportunity_status_history.vehicle_opportunity_id and (opp.partenaire_id = auth.uid() or (opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))))
);

create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = auth.uid() or private.has_role(auth.uid(),'admin'));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "admin manages ref_body_types" on public.ref_body_types for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read ref_body_types" on public.ref_body_types for select to public using (true);
create policy ref_cat_brands_admin_write on public.ref_category_brands for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy ref_cat_brands_read on public.ref_category_brands for select to public using (true);
create policy "admin manages countries" on public.ref_countries for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read countries" on public.ref_countries for select to public using (true);
create policy "admin manages ref_equipment" on public.ref_equipment for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read ref_equipment" on public.ref_equipment for select to public using (true);
create policy "admin manages ref_euro_standards" on public.ref_euro_standards for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read ref_euro_standards" on public.ref_euro_standards for select to public using (true);
create policy "admin manages ref_fuel_types" on public.ref_fuel_types for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read ref_fuel_types" on public.ref_fuel_types for select to public using (true);
create policy "admin manages ref_gearbox_types" on public.ref_gearbox_types for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read ref_gearbox_types" on public.ref_gearbox_types for select to public using (true);
create policy "admin manages brands" on public.ref_vehicle_brands for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read brands" on public.ref_vehicle_brands for select to public using (true);
create policy ref_categories_admin_write on public.ref_vehicle_categories for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy ref_categories_read on public.ref_vehicle_categories for select to public using (true);
create policy "admin manages models" on public.ref_vehicle_models for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read models" on public.ref_vehicle_models for select to public using (true);
create policy "admin manages vtypes" on public.ref_vehicle_types for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read vtypes" on public.ref_vehicle_types for select to public using (true);

create policy sale_listings_admin_delete on public.sale_listings for delete to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy sale_listings_staff_read on public.sale_listings for select to authenticated using (private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));
create policy sale_listings_staff_update on public.sale_listings for update to authenticated using (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales'))) with check (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));
create policy sale_listings_staff_write on public.sale_listings for insert to authenticated with check (private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'sales')));

create policy "admin manages site content" on public.site_content for all to authenticated using (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['platform_admin','admin']::app_role[]));
create policy "public read site content" on public.site_content for select to public using (true);

create policy staff_group_members_admin_write on public.staff_group_members for all to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy staff_group_members_read on public.staff_group_members for select to authenticated using (user_id = auth.uid() or private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]));
create policy staff_groups_admin_write on public.staff_groups for all to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[])) with check (private.has_any_role(auth.uid(), array['admin','platform_admin']::app_role[]));
create policy staff_groups_staff_read on public.staff_groups for select to authenticated using (private.has_any_role(auth.uid(), array['admin','platform_admin','company_management','sales_manager','sales_agent']::app_role[]) or private.is_group_member(auth.uid(), id));

create policy "self manage preferences" on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_roles_select_self_or_admin on public.user_roles for select to authenticated using (user_id = auth.uid() or private.has_role(auth.uid(),'admin'));

create policy opp_delete_own_drafts on public.vehicle_opportunities for delete to authenticated using (partenaire_id = auth.uid() and status = 'brouillon');
create policy opp_insert_own on public.vehicle_opportunities for insert to authenticated with check (
  (partenaire_id = auth.uid() and status = any(array['brouillon','envoyee']::opportunity_status[]) and (private.get_partner_kind(auth.uid()) = 'seller' or private.is_external_agent(auth.uid())))
  or private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'purchase'))
);
create policy opp_partner_update on public.vehicle_opportunities for update to authenticated using (
  partenaire_id = auth.uid() and private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller' and (status = 'brouillon' or owner_side = 'partenaire')
) with check (
  partenaire_id = auth.uid() and private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller' and (status = any(array['brouillon','envoyee']::opportunity_status[]) or owner_side = 'partenaire')
);
create policy opp_select_scoped on public.vehicle_opportunities for select to authenticated using (
  partenaire_id = auth.uid() or (status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'purchase')))
);
create policy opp_staff_update on public.vehicle_opportunities for update to authenticated using (
  (partenaire_id = auth.uid() and private.is_external_agent(auth.uid())) or private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'purchase'))
) with check (
  (partenaire_id = auth.uid() and private.is_external_agent(auth.uid())) or private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, coalesce(assigned_group,'purchase'))
);

create policy vehicle_photos_delete_parent_editable on public.vehicle_photos for delete to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = vehicle_photos.vehicle_opportunity_id and opp.partenaire_id = auth.uid() and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid())) and (opp.status = 'brouillon' or opp.owner_side = 'partenaire'))
);
create policy vehicle_photos_insert_parent_editable on public.vehicle_photos for insert to authenticated with check (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = vehicle_photos.vehicle_opportunity_id and opp.partenaire_id = auth.uid() and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid())) and (opp.status = 'brouillon' or opp.owner_side = 'partenaire'))
);
create policy vehicle_photos_select_parent_scoped on public.vehicle_photos for select to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = vehicle_photos.vehicle_opportunity_id and (opp.partenaire_id = auth.uid() or (opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))))
);
create policy vehicle_photos_update_parent_editable on public.vehicle_photos for update to authenticated using (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = vehicle_photos.vehicle_opportunity_id and opp.partenaire_id = auth.uid() and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid())) and (opp.status = 'brouillon' or opp.owner_side = 'partenaire'))
) with check (
  exists (select 1 from public.vehicle_opportunities opp where opp.id = vehicle_photos.vehicle_opportunity_id and opp.partenaire_id = auth.uid() and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid())) and (opp.status = 'brouillon' or opp.owner_side = 'partenaire'))
);

-- =====================================================================
-- 8b) storage.objects policies for the vehicle-photos bucket. MISSED in the
--     original 9.1 audit because that pass only queried pg_policies where
--     schemaname = 'public' — these live in the storage schema instead, so
--     they were never independently checked until this staging run caught
--     it directly (real-JWT upload test failed with "new row violates RLS").
--     Verbatim from supabase/migrations/20260819004000_vehicle_photo_parent_scope.sql.
--     Requires the vehicle-photos bucket to already exist (created via the
--     Storage API/dashboard — not something a SQL script can do).
-- =====================================================================
drop policy if exists vehicle_photo_objects_select_parent_scoped on storage.objects;
drop policy if exists vehicle_photo_objects_insert_parent_editable on storage.objects;
drop policy if exists vehicle_photo_objects_update_parent_editable on storage.objects;
drop policy if exists vehicle_photo_objects_delete_parent_editable on storage.objects;

create policy vehicle_photo_objects_select_parent_scoped on storage.objects for select to authenticated using (
  bucket_id = 'vehicle-photos' and exists (
    select 1 from public.vehicle_opportunities opp
    where opp.id::text = (storage.foldername(objects.name))[1]
      and (
        opp.partenaire_id = auth.uid()
        or (opp.status <> 'brouillon' and private.can_read_pipeline_record(auth.uid(), opp.assigned_sales_agent_id, opp.assigned_group_id, coalesce(opp.assigned_group,'purchase')))
      )
  )
);

create policy vehicle_photo_objects_insert_parent_editable on storage.objects for insert to authenticated with check (
  bucket_id = 'vehicle-photos' and exists (
    select 1 from public.vehicle_opportunities opp
    where opp.id::text = (storage.foldername(objects.name))[1]
      and opp.partenaire_id = auth.uid()
      and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid()))
      and (opp.status = 'brouillon' or opp.owner_side = 'partenaire')
  )
);

create policy vehicle_photo_objects_update_parent_editable on storage.objects for update to authenticated using (
  bucket_id = 'vehicle-photos' and exists (
    select 1 from public.vehicle_opportunities opp
    where opp.id::text = (storage.foldername(objects.name))[1]
      and opp.partenaire_id = auth.uid()
      and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid()))
      and (opp.status = 'brouillon' or opp.owner_side = 'partenaire')
  )
) with check (
  bucket_id = 'vehicle-photos' and exists (
    select 1 from public.vehicle_opportunities opp
    where opp.id::text = (storage.foldername(objects.name))[1]
      and opp.partenaire_id = auth.uid()
      and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid()))
      and (opp.status = 'brouillon' or opp.owner_side = 'partenaire')
  )
);

create policy vehicle_photo_objects_delete_parent_editable on storage.objects for delete to authenticated using (
  bucket_id = 'vehicle-photos' and exists (
    select 1 from public.vehicle_opportunities opp
    where opp.id::text = (storage.foldername(objects.name))[1]
      and opp.partenaire_id = auth.uid()
      and ((private.has_role(auth.uid(),'partenaire') and private.get_partner_kind(auth.uid()) = 'seller') or private.is_external_agent(auth.uid()))
      and (opp.status = 'brouillon' or opp.owner_side = 'partenaire')
  )
);

-- =====================================================================
-- 9) Safety-net grants for tables already created above (belt-and-braces
--    alongside the ALTER DEFAULT PRIVILEGES in section 0 — see its comment).
-- =====================================================================
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- =====================================================================
-- 10) Minimal reference data seed. Discovered empty in Phase 4 when a
--     Playwright test tried to actually open the buyer request wizard's
--     vehicle-category/type comboboxes: both were served real (correct)
--     but empty option lists, since nothing before this ever completed
--     this file's own "seed a little synthetic reference data" TODO.
--     Earlier phases never hit this because they saved opportunities with
--     every field left blank, never actually opening a combobox with
--     required, list-only (no free-text fallback) options. Minimal on
--     purpose -- just enough for the two fields buyerLeadSchema actually
--     requires; extend with the other ref_* tables (ref_vehicle_brands,
--     ref_body_types, etc.) if a future test needs them.
-- =====================================================================
insert into public.ref_vehicle_categories (slug, label_fr, label_en, sort_order, is_active) values
  ('camion', 'Camion', 'Truck', 10, true),
  ('utilitaire', 'Utilitaire', 'Van', 20, true)
on conflict (slug) do nothing;

insert into public.ref_vehicle_types (slug, label_fr, label_en, sort_order, is_active) values
  ('porteur', 'Porteur', 'Rigid truck', 10, true),
  ('tracteur', 'Tracteur', 'Tractor unit', 20, true)
on conflict (slug) do nothing;

-- =====================================================================
-- 11) Rate-limit RPC — public.rate_limit_events (section 3) existed in
--     this reconstruction from the start, but the function that actually
--     reads/writes it was missed. Discovered 2026-08-25 via
--     tests/smoke/buyer-request.pw.ts: PGRST202 "could not find the
--     function public.rate_limit_check" once SUPABASE_SERVICE_ROLE_KEY
--     was wired into CI and the app's admin client could finally reach
--     it. src/lib/rate-limit.server.ts fails CLOSED on any RPC error by
--     design ("public endpoints must not become unlimited when the
--     abuse-control dependency is degraded"), so the missing function
--     was silently turning every public submission into a 503 rather
--     than throwing loudly -- see phase4-smoke-gate.txt for the trace.
--
--     public.rate_limit_check's body below is copied verbatim from
--     supabase/migrations/20260818010648_62312ff2-bc99-4b2a-9669-
--     58d9454039eb.sql (the hardened, final version -- the earlier
--     20260818005540 migration's thin wrapper was superseded by it).
--     private.rate_limit_check is NOT in this repo's migration history
--     at all -- Lovable must have applied it directly without a
--     corresponding checked-in migration -- so this is a reconstruction
--     from the documented contract (apps/wilmet/inventory.md: "sliding-
--     window rate limiter") and the already-reconstructed
--     rate_limit_events table shape, not a verbatim copy like the
--     public wrapper above it.
-- =====================================================================
create or replace function private.rate_limit_check(
  _bucket text, _key_hash text, _window_seconds integer, _max_events integer
)
returns table(allowed boolean, current_count integer, retry_after_seconds integer)
language plpgsql
volatile
as $$
declare
  v_count integer;
  v_oldest timestamptz;
begin
  delete from public.rate_limit_events
    where bucket = _bucket and key_hash = _key_hash
      and created_at < now() - make_interval(secs => _window_seconds);

  select count(*), min(created_at) into v_count, v_oldest
    from public.rate_limit_events
    where bucket = _bucket and key_hash = _key_hash;

  if v_count >= _max_events then
    return query select
      false,
      v_count,
      greatest(
        0,
        ceil(extract(epoch from (v_oldest + make_interval(secs => _window_seconds) - now())))::integer
      );
    return;
  end if;

  insert into public.rate_limit_events (bucket, key_hash) values (_bucket, _key_hash);

  return query select true, v_count + 1, 0;
end;
$$;

create or replace function public.rate_limit_check(
  _bucket text, _key_hash text, _window_seconds integer, _max_events integer
)
returns table(allowed boolean, current_count integer, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true),
              (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
              current_user) <> 'service_role' then
    raise exception 'rate_limit_check is restricted to server-side callers'
      using errcode = '42501';
  end if;

  return query select * from private.rate_limit_check(_bucket, _key_hash, _window_seconds, _max_events);
end;
$$;

revoke all on function public.rate_limit_check(text, text, integer, integer) from public;
grant execute on function public.rate_limit_check(text, text, integer, integer) to service_role;

-- 12) Workflow-transaction RPCs — verbatim from supabase/migrations/
--     20260819006000_workflow_mutation_transactions.sql,
--     20260819006100_main_photo_transaction.sql (grants below already
--     reflect the final state after 20260819006200_transaction_rpc_
--     authenticated_execute_only.sql, not the incremental history).
--     Discovered missing 2026-08-27 when preparing to run
--     tests/staging/workflow-transactions.staging.ts against this
--     project — same class of reconstruction gap as section 10/11.
create or replace function public.answer_information_request(
  p_request_id uuid,
  p_response text default null
)
returns void
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_opportunity_id uuid;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update public.information_requests
     set status = 'answered'::public.info_request_status,
         response = nullif(btrim(p_response), '')
   where id = p_request_id
   returning vehicle_opportunity_id into v_opportunity_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 or v_opportunity_id is null then
    raise exception 'information request not found or not writable';
  end if;

  update public.vehicle_opportunities
     set status = 'envoyee'::public.opportunity_status
   where id = v_opportunity_id
     and partenaire_id = auth.uid();

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'parent opportunity not writable';
  end if;
end;
$$;

create or replace function public.admin_request_information(
  p_opportunity_id uuid,
  p_message text
)
returns uuid
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id uuid;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if nullif(btrim(p_message), '') is null then
    raise exception 'message required';
  end if;
  if not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'platform_admin'::public.app_role)
  ) then
    raise exception 'admin role required';
  end if;

  insert into public.information_requests (
    vehicle_opportunity_id,
    admin_id,
    message
  ) values (
    p_opportunity_id,
    auth.uid(),
    btrim(p_message)
  )
  returning id into v_request_id;

  update public.vehicle_opportunities
     set status = 'en_cours_analyse'::public.opportunity_status
   where id = p_opportunity_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'parent opportunity not writable';
  end if;

  return v_request_id;
end;
$$;

create or replace function public.admin_handover_to_partner(
  p_opportunity_id uuid,
  p_message text
)
returns uuid
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_request_id uuid;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if nullif(btrim(p_message), '') is null then
    raise exception 'message required';
  end if;
  if not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin'::public.app_role, 'platform_admin'::public.app_role)
  ) then
    raise exception 'admin role required';
  end if;

  update public.vehicle_opportunities
     set owner_side = 'partenaire'::public.opportunity_owner_side,
         status = 'en_cours_analyse'::public.opportunity_status,
         handover_message = btrim(p_message)
   where id = p_opportunity_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'parent opportunity not writable';
  end if;

  insert into public.information_requests (
    vehicle_opportunity_id,
    admin_id,
    message
  ) values (
    p_opportunity_id,
    auth.uid(),
    btrim(p_message)
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.reorder_vehicle_photos(p_orders jsonb)
returns void
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order record;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_orders is null or jsonb_typeof(p_orders) <> 'array' then
    raise exception 'orders must be a JSON array';
  end if;
  if jsonb_array_length(p_orders) = 0 then
    return;
  end if;
  if jsonb_array_length(p_orders) > 50 then
    raise exception 'too many photo orders';
  end if;
  if exists (
    select parsed.id
    from jsonb_to_recordset(p_orders) as parsed(id uuid, sort_order integer)
    group by parsed.id
    having count(*) > 1
  ) then
    raise exception 'duplicate photo id';
  end if;

  for v_order in
    select parsed.id, parsed.sort_order
    from jsonb_to_recordset(p_orders) as parsed(id uuid, sort_order integer)
  loop
    if v_order.id is null or v_order.sort_order is null or v_order.sort_order < 0 then
      raise exception 'invalid photo order';
    end if;

    update public.vehicle_photos
       set sort_order = v_order.sort_order
     where id = v_order.id;

    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'photo not found or not writable: %', v_order.id;
    end if;
  end loop;
end;
$$;

create or replace function public.set_main_vehicle_photo(
  p_opportunity_id uuid,
  p_photo_id uuid
)
returns void
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  perform 1
  from public.vehicle_photos
  where id = p_photo_id
    and vehicle_opportunity_id = p_opportunity_id
  for update;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'photo not found or not writable';
  end if;

  update public.vehicle_photos
     set is_main_photo = false
   where vehicle_opportunity_id = p_opportunity_id
     and is_main_photo = true;

  update public.vehicle_photos
     set is_main_photo = true
   where id = p_photo_id
     and vehicle_opportunity_id = p_opportunity_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'main photo update failed';
  end if;
end;
$$;

revoke all on function public.answer_information_request(uuid, text) from public;
revoke all on function public.answer_information_request(uuid, text) from anon;
grant execute on function public.answer_information_request(uuid, text) to authenticated;

revoke all on function public.admin_request_information(uuid, text) from public;
revoke all on function public.admin_request_information(uuid, text) from anon;
grant execute on function public.admin_request_information(uuid, text) to authenticated;

revoke all on function public.admin_handover_to_partner(uuid, text) from public;
revoke all on function public.admin_handover_to_partner(uuid, text) from anon;
grant execute on function public.admin_handover_to_partner(uuid, text) to authenticated;

revoke all on function public.reorder_vehicle_photos(jsonb) from public;
revoke all on function public.reorder_vehicle_photos(jsonb) from anon;
grant execute on function public.reorder_vehicle_photos(jsonb) to authenticated;

revoke all on function public.set_main_vehicle_photo(uuid, uuid) from public;
revoke all on function public.set_main_vehicle_photo(uuid, uuid) from anon;
grant execute on function public.set_main_vehicle_photo(uuid, uuid) to authenticated;

-- =====================================================================
-- END — after running this, create a few auth test users per role
-- before running pipeline/security/rls-probe.mjs.
-- =====================================================================
