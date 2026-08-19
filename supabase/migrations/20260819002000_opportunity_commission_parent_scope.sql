-- TM-002 / #22: commission financial data must not escape the authorized finance scope.
--
-- Finance visibility after this migration:
-- - admin/platform_admin retain global ALL through op_comm_admin_all;
-- - partner/apporteur beneficiaries read only their own rows;
-- - sales_manager/company_management retain global read through the canonical parent helper;
-- - internal sales_agent reads only commissions whose non-draft parent opportunity is in scope;
-- - external_agent and other authenticated roles are not granted finance access merely because
--   their UUID happens to be present in partenaire_id.

-- The inherited beneficiary policy checked identity only. Bind it to the actual partner roles
-- used by listCommissionBeneficiaries so unrelated authenticated roles cannot inherit finance
-- visibility from a partenaire_id assignment.
DROP POLICY IF EXISTS op_comm_partner_read ON public.opportunity_commissions;
DROP POLICY IF EXISTS op_comm_partner_read_scoped ON public.opportunity_commissions;

CREATE POLICY op_comm_partner_read_scoped ON public.opportunity_commissions
FOR SELECT TO authenticated
USING (
  partenaire_id = auth.uid()
  AND private.has_any_role(auth.uid(), ARRAY[
    'partenaire'::public.app_role,
    'apporteur'::public.app_role
  ])
);

DROP POLICY IF EXISTS op_comm_staff_read ON public.opportunity_commissions;
DROP POLICY IF EXISTS op_comm_staff_read_scoped ON public.opportunity_commissions;

CREATE POLICY op_comm_staff_read_scoped ON public.opportunity_commissions
FOR SELECT TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'sales_manager'::public.app_role,
    'company_management'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opportunity
    WHERE opportunity.id = opportunity_commissions.vehicle_opportunity_id
      AND opportunity.status <> 'brouillon'::public.opportunity_status
      AND private.can_read_pipeline_record(
        auth.uid(),
        opportunity.assigned_sales_agent_id,
        opportunity.assigned_group_id,
        COALESCE(opportunity.assigned_group, 'purchase'::public.staff_group)
      )
  )
);
