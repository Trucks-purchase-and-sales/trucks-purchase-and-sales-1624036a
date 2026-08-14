# Retirer "Modules à venir" + livrer la Transformation en offre de vente

## 1. Nettoyage
- Supprimer l'entrée "Modules à venir" du menu (Paramètres) et la page `/admin/upcoming`.

## 2. Transformation d'un véhicule acheté en offre de vente
Objectif : dès qu'une opportunité passe en **Achetée** (ou Closed Won), un bouton **"Transformer en offre de vente"** crée une annonce interne reprenant automatiquement toutes les données du véhicule.

### Parcours
1. Sur la fiche opportunité (statut achetée / closed_won), bouton "Transformer en offre de vente".
2. Une boîte de dialogue pré-remplie s'ouvre : titre de l'annonce (généré : marque + modèle + année), prix de vente HT, TVA, disponibilité, ville/pays, description (reprise des commentaires/défauts), photos existantes cochées.
3. Affichage automatique de la marge indicative : prix de vente − prix d'achat (montant + %), recalculée en direct quand on change le prix.
4. Validation → création de l'annonce en statut **Brouillon**, liée à l'opportunité. Un lien "Offre de vente" apparaît sur la fiche opportunité (transformation unique, pas de doublon).
5. Nouvel écran **Pipeline > Offres de vente** : liste filtrable (brouillon / publiée / réservée / vendue), recherche, ouverture d'une fiche annonce éditable, changement de statut, et bouton "Voir l'opportunité d'origine".
6. Quand l'annonce passe en **Vendue** : saisie du prix de vente réel + acheteur, l'opportunité d'origine bascule en `vendue` et la marge réelle est figée.

### Visibilité / droits
- Admin et direction : toutes les offres.
- Manager / commercial du groupe **Vente** : offres de leur groupe ou celles qui leur sont assignées (même logique de groupes que les opportunités).
- Apporteurs / acheteurs externes : aucun accès (module interne ; la vitrine publique Marketplace reste un module séparé, non inclus ici).

## Détails techniques
- Migration : table `public.sale_listings` (id, opportunity_id unique, reference `WIL-SALE-YYYY-NNNN`, title, description, sale_price_excl_tax, vat_regime, availability, city, country, status enum brouillon/publiee/reservee/vendue/retiree, assigned_to, assigned_group, purchase_price_snapshot, sold_price, sold_to, sold_at, timestamps) + table de liaison photos (ou colonne `photo_ids uuid[]`).
- GRANT sur `authenticated` + `service_role`, RLS activée : SELECT/UPDATE réservés au staff via les fonctions de rôle existantes (`private` schema), aucun accès `anon`.
- `src/lib/sale-listings.functions.ts` : `createSaleListingFromOpportunity`, `listSaleListings`, `getSaleListing`, `updateSaleListing`, `markSaleListingSold` — toutes derrière `requireSupabaseAuth` + le gate interne existant (`assertInternal`) avec filtrage par groupe/scope.
- Routes : `src/routes/_authenticated/admin.sale-listings.tsx` (Outlet), `.index.tsx` (liste), `.$id.tsx` (fiche).
- Fiche opportunité : nouveau bloc/bouton dans `admin.opportunities.$id.tsx` + dialogue `SaleListingDialog.tsx`.
- Sidebar : ajout "Offres de vente" dans le groupe Pipeline (admin/direction/manager/commercial vente), suppression du lien "Modules à venir" et du fichier `admin.upcoming.tsx`.
