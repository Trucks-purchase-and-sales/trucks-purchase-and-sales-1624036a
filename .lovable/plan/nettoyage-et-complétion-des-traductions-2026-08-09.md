# Nettoyage et complétion des traductions

## État constaté

- `src/i18n/locales/*.json` : 132 clés par langue. **fr** et **en** sont complets.
- **nl, de, it, es, pt, pl** sont des copies du français : seulement 2 clés sur 132 y sont réellement traduites. Le sélecteur de langue propose donc 6 langues qui affichent du français.
- Pages publiques du catalogue (`/vehicules`, `/vehicules/$id`, `PublicShell`) : textes en français codés en dur, hors i18n.
- Table `public.translations` : 0 ligne, aucun code ne la lit.
- Table `public.site_content` : 4 lignes, dont 2 réglages OCR (`ocr.enabled`, `ocr.confidence_threshold`) utilisés par l'admin, et 2 textes d'accueil `fr` non consommés par le front. Elle reste en place.

## Ce qui sera fait

### 1. Langues : FR, EN, NL, DE

- Traduction complète des 132 clés en **néerlandais** et en **allemand** (navigation, page d'accueil, sections « Comment ça marche », types de véhicules, « Pourquoi Wilmet », contact, pied de page, formulaire acheteur complet avec ses libellés, choix, messages d'erreur et de succès).
- Suppression des locales **it, es, pt, pl** : fichiers JSON supprimés, retirés des imports et de `SUPPORTED_LOCALES`, donc absentes du sélecteur de langue.
- Repli inchangé : toute clé manquante retombe sur le français.

### 2. Catalogue public traduisible

- Extraction des textes de `/vehicules` et `/vehicules/$id` vers une nouvelle section `catalog.*` dans les 4 fichiers de langue : titre et méta de page, champs de recherche et filtres, état « aucun véhicule », étiquettes des caractéristiques (marque, modèle, kilométrage, carburant, boîte, norme Euro, PTAC, cabine, état, équipements), « Prix hors TVA », disponibilité, statut, bouton « Ce véhicule m'intéresse », retour au catalogue.
- Les pages utiliseront `useTranslation()` comme le reste du site public ; en-tête et pied de page de `PublicShell` également.

### 3. Base de données

- Migration : suppression de la table vide `public.translations`.
- `site_content` conservée telle quelle (réglages OCR actifs).

## Détails techniques

- Fichiers touchés : `src/i18n/index.ts`, `src/i18n/locales/{nl,de}.json` (remplis), suppression de `{it,es,pt,pl}.json`, `src/routes/vehicules.index.tsx`, `src/routes/vehicules.$id.tsx`, `src/components/public/PublicShell.tsx`.
- Le `head()` des routes catalogue reste en français (le SEO côté serveur est rendu en FR par défaut, comme aujourd'hui pour les autres pages) ; seuls les textes de l'interface sont traduits.
- Aucun changement d'API ni de logique métier ; les libellés métier internes (statuts, back-office) restent en français comme aujourd'hui.
