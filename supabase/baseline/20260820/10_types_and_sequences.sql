-- Captured read-only from authoritative Lovable-managed Wilmet DB on 2026-08-20.
-- Source migration head: 20260819163158.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TYPE public.app_role AS ENUM ('apporteur', 'admin', 'commercial_future', 'client_future', 'buyer', 'sales_agent', 'sales_manager', 'company_management', 'platform_admin', 'partenaire', 'external_agent');

CREATE TYPE public.availability_type AS ENUM ('immediate', 'sous_7_jours', 'sous_30_jours', 'a_confirmer');

CREATE TYPE public.buyer_lead_status AS ENUM ('nouveau', 'a_qualifier', 'match_possible', 'en_recherche', 'offre_envoyee', 'option_posee', 'gagne', 'perdu', 'archive', 'converted');

CREATE TYPE public.cabin_type AS ENUM ('courte', 'approfondie', 'double_cabine', 'cabine_couchette', 'autre');

CREATE TYPE public.commission_basis AS ENUM ('purchase', 'sale');

CREATE TYPE public.commission_rule_kind AS ENUM ('pct_of_purchase', 'pct_of_margin', 'flat');

CREATE TYPE public.commission_scope AS ENUM ('all', 'partner', 'country', 'vehicle_type');

CREATE TYPE public.commission_status AS ENUM ('draft', 'approved', 'paid', 'cancelled');

CREATE TYPE public.demand_opportunity_status AS ENUM ('nouvelle', 'qualifiee', 'en_recherche', 'proposition_envoyee', 'negociation', 'gagnee', 'perdue', 'archivee');

CREATE TYPE public.demand_stage AS ENUM ('qualification', 'sourcing', 'proposition', 'negociation', 'cloture');

CREATE TYPE public.fuel_type AS ENUM ('diesel', 'essence', 'electrique', 'hybride', 'gnv', 'autre');

CREATE TYPE public.gearbox AS ENUM ('manuelle', 'automatique', 'robotisee');

CREATE TYPE public.general_condition AS ENUM ('tres_bon', 'bon', 'moyen', 'a_reparer', 'accidente');

CREATE TYPE public.info_request_status AS ENUM ('open', 'answered', 'closed');

CREATE TYPE public.match_score AS ENUM ('tres_fort', 'interessant', 'partiel', 'faible');

CREATE TYPE public.match_source_kind AS ENUM ('buyer_lead', 'opportunity', 'resale_listing');

CREATE TYPE public.match_status AS ENUM ('suggested', 'pinned', 'excluded', 'confirmed', 'dismissed');

CREATE TYPE public.negotiable_state AS ENUM ('oui', 'non', 'a_discuter');

CREATE TYPE public.ocr_field_action AS ENUM ('pending', 'confirmed', 'edited', 'rejected');

CREATE TYPE public.ocr_source_type AS ENUM ('vehicle_exterior', 'dashboard', 'registration', 'vin_plate', 'manufacturer_plate', 'technical_doc', 'other');

CREATE TYPE public.ocr_status AS ENUM ('non_commence', 'en_cours', 'termine', 'a_verifier', 'confirme', 'rejete', 'echec');

CREATE TYPE public.opportunity_owner_side AS ENUM ('apporteur', 'wilmet', 'partenaire');

CREATE TYPE public.opportunity_quality AS ENUM ('incomplet', 'correct', 'bon', 'excellent');

CREATE TYPE public.opportunity_status AS ENUM ('brouillon', 'envoyee', 'en_cours_analyse', 'informations_demandees', 'acceptee', 'refusee', 'archivee', 'achetee', 'offre_envoyee', 'en_negociation', 'paiement_en_attente', 'paiement_recu', 'livraison_planifiee', 'livree', 'closed_won', 'closed_lost', 'qualifiee');

CREATE TYPE public.partner_kind AS ENUM ('client', 'seller');

CREATE TYPE public.payment_method AS ENUM ('virement', 'cheque', 'paycifi', 'autre');

CREATE TYPE public.photo_category AS ENUM ('vue_avant', 'vue_arriere', 'cote_gauche', 'cote_droit', 'interieur_cabine', 'tableau_de_bord', 'pneus', 'moteur', 'coffre', 'plaque_vin', 'defauts', 'documents', 'tableau_de_bord_moteur');

CREATE TYPE public.provider_type AS ENUM ('garage', 'transporteur', 'loueur', 'concessionnaire', 'courtier', 'particulier_professionnel', 'autre');

CREATE TYPE public.sale_listing_status AS ENUM ('brouillon', 'publiee', 'reservee', 'vendue', 'retiree');

CREATE TYPE public.staff_group AS ENUM ('purchase', 'sales');

CREATE TYPE public.staff_scope AS ENUM ('purchase', 'sales', 'both');

CREATE TYPE public.tri_state AS ENUM ('oui', 'non', 'a_verifier', 'non_applicable', 'partiellement');

CREATE TYPE public.vehicle_type AS ENUM ('utilitaire', 'camion_porteur', 'tracteur_routier', 'semi_remorque', 'remorque', 'benne', 'frigorifique', 'plateau', 'fourgon', 'autre');

CREATE TYPE public.visibility_state AS ENUM ('oui', 'non', 'sur_rendez_vous');

CREATE SEQUENCE public.affiliate_clicks_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public.buyer_lead_ref_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public.demand_opportunity_ref_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public.rate_limit_events_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public.vehicle_opportunity_ref_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
