-- FD-014: adminRejectBuyerLead accepts a reason from the reject dialog but has
-- nowhere to persist it -- no matching column exists on buyer_leads, unlike
-- vehicle_opportunities.close_reason, which the equivalent flow for
-- opportunities (adminCloseOpportunity) already writes to correctly.
alter table public.buyer_leads
  add column if not exists reject_reason text null;
