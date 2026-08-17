-- FIND-002: idempotent seeding of all vehicle reference tables.

INSERT INTO public.ref_vehicle_categories (slug, label_fr, label_en, sort_order, is_active) VALUES
  ('utilitaire','Utilitaire léger','Light commercial vehicle',10,true),
  ('camion_porteur','Camion porteur','Rigid truck',20,true),
  ('tracteur_routier','Tracteur routier','Tractor unit',30,true),
  ('semi_remorque','Semi-remorque','Semi-trailer',40,true),
  ('remorque','Remorque','Trailer',50,true),
  ('engin_special','Engin / matériel spécifique','Special equipment',60,true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO public.ref_vehicle_types (slug, label_fr, label_en, sort_order, is_active) VALUES
  ('utilitaire','Utilitaire','Light commercial',10,true),
  ('camion_porteur','Camion porteur','Rigid truck',20,true),
  ('tracteur_routier','Tracteur routier','Tractor unit',30,true),
  ('semi_remorque','Semi-remorque','Semi-trailer',40,true),
  ('remorque','Remorque','Trailer',50,true),
  ('benne','Benne','Tipper',60,true),
  ('frigorifique','Frigorifique','Refrigerated',70,true),
  ('plateau','Plateau','Flatbed',80,true),
  ('fourgon','Fourgon','Box van',90,true),
  ('autre','Autre','Other',999,true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO public.ref_vehicle_brands (slug, label, sort_order, is_active) VALUES
  ('mercedes-benz','Mercedes-Benz',10,true),
  ('man','MAN',20,true),
  ('scania','Scania',30,true),
  ('volvo','Volvo',40,true),
  ('daf','DAF',50,true),
  ('iveco','Iveco',60,true),
  ('renault','Renault',70,true),
  ('ford','Ford',80,true),
  ('fiat','Fiat',90,true),
  ('peugeot','Peugeot',100,true),
  ('citroen','Citroën',110,true),
  ('opel','Opel',120,true),
  ('nissan','Nissan',130,true),
  ('toyota','Toyota',140,true),
  ('volkswagen','Volkswagen',150,true),
  ('isuzu','Isuzu',160,true),
  ('fuso','Mitsubishi Fuso',170,true),
  ('schmitz-cargobull','Schmitz Cargobull',200,true),
  ('krone','Krone',210,true),
  ('kogel','Kögel',220,true),
  ('lecitrailer','Lecitrailer',230,true),
  ('fruehauf','Fruehauf',240,true),
  ('chereau','Chereau',250,true),
  ('benalu','Benalu',260,true),
  ('samro','Samro',270,true),
  ('wielton','Wielton',280,true),
  ('berger','Berger',290,true),
  ('legras','Legras',300,true),
  ('autre','Autre',999,true)
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO public.ref_category_brands (category_slug, brand_slug)
SELECT c, b FROM (VALUES
  ('utilitaire','mercedes-benz'),('utilitaire','renault'),('utilitaire','ford'),('utilitaire','fiat'),
  ('utilitaire','peugeot'),('utilitaire','citroen'),('utilitaire','opel'),('utilitaire','nissan'),
  ('utilitaire','toyota'),('utilitaire','volkswagen'),('utilitaire','iveco'),('utilitaire','man'),
  ('camion_porteur','mercedes-benz'),('camion_porteur','man'),('camion_porteur','scania'),('camion_porteur','volvo'),
  ('camion_porteur','daf'),('camion_porteur','iveco'),('camion_porteur','renault'),('camion_porteur','ford'),
  ('camion_porteur','isuzu'),('camion_porteur','fuso'),
  ('tracteur_routier','mercedes-benz'),('tracteur_routier','man'),('tracteur_routier','scania'),('tracteur_routier','volvo'),
  ('tracteur_routier','daf'),('tracteur_routier','iveco'),('tracteur_routier','renault'),('tracteur_routier','ford'),
  ('semi_remorque','schmitz-cargobull'),('semi_remorque','krone'),('semi_remorque','kogel'),('semi_remorque','lecitrailer'),
  ('semi_remorque','fruehauf'),('semi_remorque','chereau'),('semi_remorque','benalu'),('semi_remorque','samro'),
  ('semi_remorque','wielton'),('semi_remorque','berger'),('semi_remorque','legras'),
  ('remorque','schmitz-cargobull'),('remorque','krone'),('remorque','kogel'),('remorque','fruehauf'),
  ('remorque','samro'),('remorque','wielton'),('remorque','legras'),
  ('engin_special','mercedes-benz'),('engin_special','man'),('engin_special','iveco'),('engin_special','renault'),
  ('utilitaire','autre'),('camion_porteur','autre'),('tracteur_routier','autre'),
  ('semi_remorque','autre'),('remorque','autre'),('engin_special','autre')
) AS v(c,b)
ON CONFLICT (category_slug, brand_slug) DO NOTHING;

INSERT INTO public.ref_vehicle_models (brand_slug, label, is_active)
SELECT b, l, true FROM (VALUES
  ('mercedes-benz','Actros'),('mercedes-benz','Arocs'),('mercedes-benz','Atego'),('mercedes-benz','Axor'),
  ('mercedes-benz','Antos'),('mercedes-benz','Econic'),('mercedes-benz','Unimog'),('mercedes-benz','Sprinter'),
  ('mercedes-benz','Vito'),('mercedes-benz','Citan'),
  ('man','TGX'),('man','TGS'),('man','TGM'),('man','TGL'),('man','TGE'),
  ('scania','R-Series'),('scania','S-Series'),('scania','P-Series'),('scania','G-Series'),('scania','L-Series'),
  ('volvo','FH'),('volvo','FH16'),('volvo','FM'),('volvo','FMX'),('volvo','FL'),('volvo','FE'),
  ('daf','XF'),('daf','CF'),('daf','LF'),('daf','XG'),('daf','XD'),
  ('iveco','Stralis'),('iveco','S-Way'),('iveco','Eurocargo'),('iveco','Trakker'),('iveco','X-Way'),('iveco','Daily'),
  ('renault','T'),('renault','T High'),('renault','C'),('renault','K'),('renault','D'),('renault','D Wide'),
  ('renault','Master'),('renault','Trafic'),('renault','Kangoo'),('renault','Midlum'),('renault','Premium'),('renault','Magnum'),
  ('ford','Transit'),('ford','Transit Custom'),('ford','Ranger'),('ford','F-Max'),('ford','Cargo'),
  ('fiat','Ducato'),('fiat','Doblo'),('fiat','Scudo'),('fiat','Talento'),
  ('peugeot','Boxer'),('peugeot','Expert'),('peugeot','Partner'),
  ('citroen','Jumper'),('citroen','Jumpy'),('citroen','Berlingo'),
  ('opel','Movano'),('opel','Vivaro'),('opel','Combo'),
  ('nissan','NV400'),('nissan','NV300'),('nissan','Primastar'),('nissan','Interstar'),
  ('toyota','Proace'),('toyota','Hilux'),('toyota','Dyna'),
  ('volkswagen','Crafter'),('volkswagen','Transporter'),('volkswagen','Caddy'),
  ('isuzu','N-Series'),('isuzu','F-Series'),
  ('fuso','Canter'),
  ('schmitz-cargobull','S.CS Tautliner'),('schmitz-cargobull','S.KO Cool'),('schmitz-cargobull','S.KI Benne'),('schmitz-cargobull','S.BO Fourgon'),
  ('krone','Profi Liner'),('krone','Cool Liner'),('krone','Dry Liner'),('krone','Mega Liner'),
  ('kogel','Cargo'),('kogel','Mega'),('kogel','Cool'),
  ('lecitrailer','Tautliner'),('lecitrailer','Frigo'),('lecitrailer','Porte-conteneurs'),
  ('fruehauf','Tautliner'),('fruehauf','Benne TP'),('fruehauf','Plateau'),
  ('chereau','Frigo Inogam'),('chereau','Frigo Multi-températures'),
  ('benalu','Benne Alu'),('benalu','Fond mouvant'),
  ('samro','Tautliner'),('samro','Plateau'),
  ('wielton','Curtainsider'),('wielton','Benne'),
  ('berger','Ecotrail'),
  ('legras','Fond mouvant'),('legras','Benne céréalière')
) AS v(b,l)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ref_vehicle_models m WHERE m.brand_slug = v.b AND m.label = v.l
);

INSERT INTO public.ref_body_types (slug, label_fr, label_en, applies_to, is_active) VALUES
  ('fourgon','Fourgon','Box body',ARRAY['camion_porteur','semi_remorque','utilitaire'],true),
  ('frigo','Frigo','Refrigerated',ARRAY['camion_porteur','semi_remorque','utilitaire'],true),
  ('tautliner','Tautliner','Curtainsider',ARRAY['camion_porteur','semi_remorque'],true),
  ('benne','Benne','Tipper',ARRAY['camion_porteur','semi_remorque'],true),
  ('plateau','Plateau','Flatbed',ARRAY['camion_porteur','semi_remorque'],true),
  ('citerne','Citerne','Tanker',ARRAY['camion_porteur','semi_remorque'],true),
  ('ampliroll','Ampliroll','Hook lift',ARRAY['camion_porteur'],true),
  ('chassis','Châssis','Chassis cab',ARRAY['camion_porteur'],true),
  ('bdf','BDF','Swap body',ARRAY['camion_porteur'],true),
  ('malaxeur','Malaxeur','Concrete mixer',ARRAY['camion_porteur'],true),
  ('porte_engins','Porte-engins','Machine carrier',ARRAY['camion_porteur'],true),
  ('porte_voitures','Porte-voitures','Car transporter',ARRAY['camion_porteur'],true),
  ('nacelle','Nacelle','Aerial platform',ARRAY['camion_porteur'],true),
  ('depannage','Dépannage','Recovery',ARRAY['camion_porteur'],true),
  ('grumier','Grumier','Timber truck',ARRAY['camion_porteur'],true),
  ('bom','BOM','Refuse collection',ARRAY['camion_porteur'],true),
  ('balayeuse','Balayeuse','Street sweeper',ARRAY['camion_porteur'],true),
  ('aspirateur','Aspirateur','Vacuum truck',ARRAY['camion_porteur'],true),
  ('transport_animal','Transport animal','Livestock',ARRAY['camion_porteur'],true),
  ('porte_boissons','Porte-boissons','Beverage body',ARRAY['camion_porteur'],true),
  ('autre','Autre','Other',ARRAY['camion_porteur','semi_remorque','utilitaire','remorque','tracteur_routier','engin_special'],true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, applies_to=EXCLUDED.applies_to, is_active=true;

INSERT INTO public.ref_fuel_types (slug, label_fr, label_en, is_active) VALUES
  ('diesel','Diesel','Diesel',true),
  ('essence','Essence','Petrol',true),
  ('electrique','Électrique','Electric',true),
  ('hybride','Hybride','Hybrid',true),
  ('gnv','GNV / GNL','CNG / LNG',true),
  ('autre','Autre','Other',true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, is_active=true;

INSERT INTO public.ref_gearbox_types (slug, label_fr, label_en, is_active) VALUES
  ('manuelle','Manuelle','Manual',true),
  ('automatique','Automatique','Automatic',true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, is_active=true;

INSERT INTO public.ref_euro_standards (slug, label, sort_order, is_active) VALUES
  ('euro_3','Euro 3',30,true),
  ('euro_4','Euro 4',40,true),
  ('euro_5','Euro 5',50,true),
  ('euro_6','Euro 6',60,true)
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order, is_active=true;

INSERT INTO public.ref_equipment (slug, label_fr, label_en, is_active) VALUES
  ('groupe_froid','Groupe froid','Refrigeration unit',true),
  ('gps','GPS / navigation','GPS navigation',true),
  ('camera_recul','Caméra de recul','Reversing camera',true),
  ('regulateur','Régulateur de vitesse','Cruise control',true),
  ('ralentisseur','Ralentisseur / retarder','Retarder',true),
  ('attelage','Attelage remorque','Trailer coupling',true),
  ('double_couchette','Double couchette','Double bunk',true),
  ('boite_outils','Boîte à outils','Tool box',true),
  ('essieu_relevable','Essieu relevable','Lift axle',true),
  ('roue_secours','Roue de secours','Spare wheel',true),
  ('chariot_embarque','Chariot embarqué','Truck-mounted forklift',true)
ON CONFLICT (slug) DO UPDATE SET label_fr=EXCLUDED.label_fr, label_en=EXCLUDED.label_en, is_active=true;

INSERT INTO public.ref_countries (code, name_fr, name_en, priority, is_active) VALUES
  ('FR','France','France',1,true),
  ('BE','Belgique','Belgium',2,true),
  ('NL','Pays-Bas','Netherlands',3,true),
  ('DE','Allemagne','Germany',4,true),
  ('ES','Espagne','Spain',5,true),
  ('IT','Italie','Italy',6,true),
  ('LU','Luxembourg','Luxembourg',7,true),
  ('PT','Portugal','Portugal',8,true),
  ('PL','Pologne','Poland',9,true),
  ('AT','Autriche','Austria',20,true),
  ('BG','Bulgarie','Bulgaria',20,true),
  ('HR','Croatie','Croatia',20,true),
  ('CY','Chypre','Cyprus',20,true),
  ('CZ','Tchéquie','Czechia',20,true),
  ('DK','Danemark','Denmark',20,true),
  ('EE','Estonie','Estonia',20,true),
  ('FI','Finlande','Finland',20,true),
  ('GR','Grèce','Greece',20,true),
  ('HU','Hongrie','Hungary',20,true),
  ('IE','Irlande','Ireland',20,true),
  ('LV','Lettonie','Latvia',20,true),
  ('LT','Lituanie','Lithuania',20,true),
  ('MT','Malte','Malta',20,true),
  ('RO','Roumanie','Romania',20,true),
  ('SK','Slovaquie','Slovakia',20,true),
  ('SI','Slovénie','Slovenia',20,true),
  ('SE','Suède','Sweden',20,true)
ON CONFLICT (code) DO UPDATE SET name_fr=EXCLUDED.name_fr, name_en=EXCLUDED.name_en, priority=EXCLUDED.priority, is_active=true;