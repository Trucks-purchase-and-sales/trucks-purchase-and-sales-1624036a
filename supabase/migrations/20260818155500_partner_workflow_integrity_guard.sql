-- B0-007: enforce seller workflow integrity at the PostgreSQL boundary.
--
-- Root cause:
--   * the legacy owner UPDATE policy remained permissive and PostgreSQL combines
--     permissive policies with OR;
--   * the partner column guard protected several commercial/system columns but
--     not status / owner_side;
--   * the guard ran only on UPDATE, so a direct authenticated INSERT could seed
--     staff-controlled fields;
--   * draft rows could satisfy the staff pipeline helper before submission.
--
-- This migration is forward-only and intentionally does not weaken staff RLS.

-- ---------------------------------------------------------------------------
-- 1. A seller-partner may edit only their own draft or a row explicitly handed
--    back to the partner. The resulting row may be a draft, remain partner-owned,
--    or be handed back to Wilmet as `envoyee`. The trigger below is the stronger
--    field/state-machine boundary and rejects invalid transitions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Partenaire updates when owner" ON public.vehicle_opportunities;
DROP POLICY IF EXISTS opp_partner_update ON public.vehicle_opportunities;

CREATE POLICY opp_partner_update ON public.vehicle_opportunities
FOR UPDATE TO authenticated
USING (
  partenaire_id = auth.uid()
  AND private.has_role(auth.uid(), 'partenaire'::public.app_role)
  AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
  AND (
    status = 'brouillon'::public.opportunity_status
    OR owner_side = 'partenaire'::public.opportunity_owner_side
  )
)
WITH CHECK (
  partenaire_id = auth.uid()
  AND private.has_role(auth.uid(), 'partenaire'::public.app_role)
  AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
  AND (
    status IN ('brouillon'::public.opportunity_status, 'envoyee'::public.opportunity_status)
    OR owner_side = 'partenaire'::public.opportunity_owner_side
  )
);

-- ---------------------------------------------------------------------------
-- 2. Drafts belong to the seller only. Staff pipeline visibility starts only
--    after submission. This prevents a default/unassigned purchase pool from
--    exposing an in-progress draft through direct PostgREST queries.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opp_select_scoped ON public.vehicle_opportunities;

CREATE POLICY opp_select_scoped ON public.vehicle_opportunities
FOR SELECT TO authenticated
USING (
  partenaire_id = auth.uid()
  OR (
    status <> 'brouillon'::public.opportunity_status
    AND private.can_read_pipeline_record(
      auth.uid(),
      assigned_sales_agent_id,
      assigned_group_id,
      COALESCE(assigned_group, 'purchase'::public.staff_group)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 3. Harden the row mutation guard.
--
-- Internal staff keeps the existing RLS-scoped write semantics. service_role is
-- explicitly recognized because trusted server-only workflows use it after
-- validating user actions (for example affiliate fast-track assignment).
--
-- Plain seller-partners receive a strict state machine:
--   * INSERT => draft only; staff/system fields are cleared;
--   * draft -> envoyee/wilmet is the only submission transition;
--   * partner-owned -> envoyee/wilmet is the only hand-back transition;
--   * ordinary edits cannot change status or owner_side;
--   * staff assignment/financial/system fields remain immutable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_opp_partner_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_internal boolean;
  is_seller_partner boolean;
BEGIN
  -- Trusted backend administration must not be rewritten by the partner guard.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  is_internal := private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'sales_agent'::public.app_role,
    'sales_manager'::public.app_role,
    'company_management'::public.app_role,
    'platform_admin'::public.app_role
  ]);

  IF is_internal THEN
    RETURN NEW;
  END IF;

  is_seller_partner :=
    private.has_role(auth.uid(), 'partenaire'::public.app_role)
    AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind;

  IF TG_OP = 'INSERT' THEN
    IF is_seller_partner THEN
      IF NEW.partenaire_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'vehicle_opportunity: partenaire_id must match authenticated seller';
      END IF;
      IF NEW.status <> 'brouillon'::public.opportunity_status THEN
        RAISE EXCEPTION 'vehicle_opportunity: seller insert must start as draft';
      END IF;

      -- Routing and commercial/system state is assigned only after submission by
      -- trusted database/server workflows. Clearing these values also defeats a
      -- caller that bypasses the application and crafts PostgREST JSON directly.
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

  -- Preserve the pre-existing protection for non-internal callers, including
  -- external agents, while adding missing routing fields.
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
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.owner_side IS DISTINCT FROM OLD.owner_side THEN
      IF OLD.status = 'brouillon'::public.opportunity_status
         AND NEW.status = 'envoyee'::public.opportunity_status
         AND NEW.owner_side = 'wilmet'::public.opportunity_owner_side THEN
        -- Initial seller submission.
        NULL;
      ELSIF OLD.owner_side = 'partenaire'::public.opportunity_owner_side
         AND NEW.status = 'envoyee'::public.opportunity_status THEN
        -- Completing requested information is a database-authoritative hand-back:
        -- the caller cannot keep control after marking the dossier as re-sent.
        NEW.owner_side := 'wilmet'::public.opportunity_owner_side;
      ELSE
        RAISE EXCEPTION 'vehicle_opportunity: seller cannot perform this workflow transition';
      END IF;
    END IF;

    -- Submission/handover always enters the purchase pool. A caller cannot route
    -- their own dossier to a chosen staff member/group.
    IF NEW.status = 'envoyee'::public.opportunity_status
       AND NEW.owner_side = 'wilmet'::public.opportunity_owner_side
       AND (
         OLD.status = 'brouillon'::public.opportunity_status
         OR OLD.owner_side = 'partenaire'::public.opportunity_owner_side
       ) THEN
      NEW.assigned_group := 'purchase'::public.staff_group;
      NEW.assigned_group_id := NULL;
      NEW.assigned_sales_agent_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opp_partner_column_guard ON public.vehicle_opportunities;
CREATE TRIGGER trg_opp_partner_column_guard
BEFORE INSERT OR UPDATE ON public.vehicle_opportunities
FOR EACH ROW EXECUTE FUNCTION public.tg_opp_partner_column_guard();
