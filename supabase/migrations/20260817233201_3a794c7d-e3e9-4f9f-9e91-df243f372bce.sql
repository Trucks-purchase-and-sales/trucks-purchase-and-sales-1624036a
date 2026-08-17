-- Legacy Euro standards (older industrial vehicles are legitimate on this marketplace)
INSERT INTO public.ref_euro_standards (slug, label, sort_order, is_active) VALUES
  ('euro_1', 'Euro 1', 10, true),
  ('euro_2', 'Euro 2', 20, true)
ON CONFLICT (slug) DO NOTHING;

-- Road tractors have no body: give them an explicit, non-blocking choice.
INSERT INTO public.ref_body_types (slug, label_fr, label_en, is_active, applies_to) VALUES
  ('tracteur_seul', 'Tracteur seul (sans carrosserie)', 'Tractor unit (no body)', true, ARRAY['tracteur_routier'])
ON CONFLICT (slug) DO NOTHING;

-- Extend applies_to so every category exposes relevant carrosseries (idempotent).
DO $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('benne',           ARRAY['remorque','utilitaire']),
      ('plateau',         ARRAY['remorque','utilitaire']),
      ('fourgon',         ARRAY['remorque']),
      ('frigo',           ARRAY['remorque']),
      ('citerne',         ARRAY['remorque']),
      ('tautliner',       ARRAY['remorque']),
      ('porte_engins',    ARRAY['remorque','semi_remorque','engin_special']),
      ('porte_voitures',  ARRAY['remorque','semi_remorque']),
      ('grumier',         ARRAY['semi_remorque']),
      ('chassis',         ARRAY['utilitaire','remorque']),
      ('nacelle',         ARRAY['engin_special']),
      ('balayeuse',       ARRAY['engin_special']),
      ('aspirateur',      ARRAY['engin_special']),
      ('depannage',       ARRAY['engin_special']),
      ('malaxeur',        ARRAY['engin_special'])
    ) AS t(slug, extra)
  LOOP
    UPDATE public.ref_body_types b
       SET applies_to = ARRAY(SELECT DISTINCT unnest(b.applies_to || m.extra))
     WHERE b.slug = m.slug
       AND NOT (b.applies_to @> m.extra);
  END LOOP;
END;
$$;