-- Phase 1B: canonical pipeline authorization helpers + core RLS rewrite (idempotent)

CREATE OR REPLACE FUNCTION private.can_read_all_pipeline(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','platform_admin','company_management','sales_manager']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION private.can_write_all_pipeline(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','platform_admin','sales_manager']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION private.is_internal_sales_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.has_role(_user_id, 'sales_agent'::public.app_role);
$$;

-- Authorization identity for external contractors is now the explicit role.
CREATE OR REPLACE FUNCTION private.is_external_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.has_role(_user_id, 'external_agent'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION private.staff_scope_allows(_user_id uuid, _side public.staff_group)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(
    (SELECT staff_scope::text = 'both' OR staff_scope::text = _side::text
       FROM public.profiles WHERE id = _user_id),
    false);
$$;

CREATE OR REPLACE FUNCTION private.can_read_pipeline_record(
  _user_id uuid, _assigned uuid, _group_id uuid, _side public.staff_group)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.can_read_all_pipeline(_user_id)
      OR (_assigned IS NOT NULL AND _assigned = _user_id)
      OR (
        private.is_internal_sales_agent(_user_id)
        AND (
          private.is_group_member(_user_id, _group_id)
          OR (_assigned IS NULL AND _group_id IS NULL AND private.staff_scope_allows(_user_id, _side))
        )
      );
$$;

CREATE OR REPLACE FUNCTION private.can_write_pipeline_record(
  _user_id uuid, _assigned uuid, _group_id uuid, _side public.staff_group)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT private.can_write_all_pipeline(_user_id)
      OR (_assigned IS NOT NULL AND _assigned = _user_id
          AND (private.is_internal_sales_agent(_user_id) OR private.is_external_agent(_user_id)))
      OR (
        private.is_internal_sales_agent(_user_id)
        AND (
          private.is_group_member(_user_id, _group_id)
          OR (_assigned IS NULL AND _group_id IS NULL AND private.staff_scope_allows(_user_id, _side))
        )
      );
$$;

REVOKE ALL ON FUNCTION private.can_read_all_pipeline(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_write_all_pipeline(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_internal_sales_agent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_external_agent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) FROM PUBLIC;

-- ============ vehicle_opportunities ============
DROP POLICY IF EXISTS opp_select_scoped ON public.vehicle_opportunities;
DROP POLICY IF EXISTS opp_staff_update ON public.vehicle_opportunities;
DROP POLICY IF EXISTS opp_insert_own ON public.vehicle_opportunities;

CREATE POLICY opp_select_scoped ON public.vehicle_opportunities
FOR SELECT TO authenticated
USING (
  partenaire_id = auth.uid()
  OR private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'purchase'::public.staff_group))
);

CREATE POLICY opp_staff_update ON public.vehicle_opportunities
FOR UPDATE TO authenticated
USING (
  (partenaire_id = auth.uid() AND private.is_external_agent(auth.uid()))
  OR private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'purchase'::public.staff_group))
)
WITH CHECK (
  (partenaire_id = auth.uid() AND private.is_external_agent(auth.uid()))
  OR private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'purchase'::public.staff_group))
);

CREATE POLICY opp_insert_own ON public.vehicle_opportunities
FOR INSERT TO authenticated
WITH CHECK (
  (
    partenaire_id = auth.uid()
    AND status = ANY (ARRAY['brouillon'::opportunity_status, 'envoyee'::opportunity_status])
    AND (private.get_partner_kind(auth.uid()) = 'seller'::partner_kind OR private.is_external_agent(auth.uid()))
  )
  OR private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'purchase'::public.staff_group))
);

-- ============ buyer_leads ============
DROP POLICY IF EXISTS "Sales agent reads assigned buyer leads" ON public.buyer_leads;
DROP POLICY IF EXISTS buyer_leads_staff_read ON public.buyer_leads;
DROP POLICY IF EXISTS buyer_leads_write_scoped ON public.buyer_leads;
DROP POLICY IF EXISTS buyer_leads_insert_scoped ON public.buyer_leads;

CREATE POLICY buyer_leads_staff_read ON public.buyer_leads
FOR SELECT TO authenticated
USING (
  private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY buyer_leads_write_scoped ON public.buyer_leads
FOR UPDATE TO authenticated
USING (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
)
WITH CHECK (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY buyer_leads_insert_scoped ON public.buyer_leads
FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND private.get_partner_kind(auth.uid()) = 'client'::partner_kind)
  OR private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

-- ============ demand_opportunities ============
DROP POLICY IF EXISTS demand_opp_agent_read ON public.demand_opportunities;
DROP POLICY IF EXISTS demand_opp_staff_read ON public.demand_opportunities;
DROP POLICY IF EXISTS demand_opp_agent_update ON public.demand_opportunities;
DROP POLICY IF EXISTS demand_opp_staff_update ON public.demand_opportunities;
DROP POLICY IF EXISTS demand_opp_staff_write ON public.demand_opportunities;

CREATE POLICY demand_opp_staff_read ON public.demand_opportunities
FOR SELECT TO authenticated
USING (
  private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY demand_opp_staff_update ON public.demand_opportunities
FOR UPDATE TO authenticated
USING (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
)
WITH CHECK (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY demand_opp_staff_write ON public.demand_opportunities
FOR INSERT TO authenticated
WITH CHECK (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

-- ============ sale_listings ============
DROP POLICY IF EXISTS sale_listings_staff_read ON public.sale_listings;
DROP POLICY IF EXISTS sale_listings_staff_update ON public.sale_listings;
DROP POLICY IF EXISTS sale_listings_staff_write ON public.sale_listings;

CREATE POLICY sale_listings_staff_read ON public.sale_listings
FOR SELECT TO authenticated
USING (
  private.can_read_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY sale_listings_staff_update ON public.sale_listings
FOR UPDATE TO authenticated
USING (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
)
WITH CHECK (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

CREATE POLICY sale_listings_staff_write ON public.sale_listings
FOR INSERT TO authenticated
WITH CHECK (
  private.can_write_pipeline_record(auth.uid(), assigned_sales_agent_id, assigned_group_id, COALESCE(assigned_group, 'sales'::public.staff_group))
);

-- Keep the legacy metadata flag consistent with the authoritative role.
UPDATE public.profiles p
   SET is_external = EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'external_agent'::public.app_role)
 WHERE p.is_external IS DISTINCT FROM EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'external_agent'::public.app_role)
   AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role <> 'partenaire'::public.app_role);
