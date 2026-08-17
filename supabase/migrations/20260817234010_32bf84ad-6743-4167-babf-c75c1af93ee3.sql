DELETE FROM public.ref_euro_standards
WHERE slug IN ('euro_1','euro_2')
  AND NOT EXISTS (
    SELECT 1 FROM public.vehicle_opportunities
    WHERE euro_standard IN ('euro_1','euro_2')
  );