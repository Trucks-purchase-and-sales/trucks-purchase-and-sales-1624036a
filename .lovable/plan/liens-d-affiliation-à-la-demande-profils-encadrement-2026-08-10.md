# Liens d'affiliation à la demande + profils encadrement

## Ce qui change

Aujourd'hui chaque compte reçoit automatiquement un lien d'affiliation (y compris direction, managers, admins et clients). On passe à une création **à la demande**, réservée aux personnes qui apportent réellement des affaires.

### Qui peut avoir un lien

- Éligibles : partenaires vendeurs et commerciaux (internes ou externes).
- Non éligibles : direction, managers, administrateurs, clients acheteurs.

### Création / suppression

- **Page Affiliation (admin)** : deux zones.
  - Le classement actuel, qui ne liste plus que les liens existants.
  - Un bouton « Créer un lien » ouvrant une fenêtre avec la liste des personnes éligibles sans lien (recherche par nom/email) → création immédiate.
  - Chaque ligne gagne une action « Supprimer le lien » (confirmation), en plus de copier / régénérer / désactiver. Les crédits déjà attribués aux dossiers restent en place.
- **Page « Mon lien d'affiliation »** :
  - Personne éligible sans lien : écran d'invitation avec un bouton « Générer mon lien ».
  - Personne non éligible : l'entrée disparaît du menu et la page affiche un message expliquant que l'affiliation ne s'applique pas à son rôle.
- Les comptes créés à l'avenir n'obtiennent plus de lien automatiquement. Les liens déjà générés pour des rôles non éligibles et jamais utilisés (0 clic, 0 apport) sont supprimés lors de la mise en place ; ceux qui ont servi sont conservés.

### Profils encadrement

Dans la fiche employé (création et modification), les champs **Taux de commission** et **Externe** ne s'affichent plus pour les rôles d'encadrement (administrateur plateforme, administrateur, direction, manager commercial) — comme c'est déjà le cas pour le périmètre. La colonne « Commission » du tableau affiche « — » pour ces rôles.

## Détails techniques

- Migration : retirer l'insertion `affiliate_links` de `handle_new_user()`; nettoyage ciblé des liens inutilisés de rôles non éligibles.
- `src/lib/affiliate.functions.ts` :
  - `getMyAffiliateLink` ne crée plus à la volée ; retourne `{ link: null, eligible: boolean }`.
  - Nouvelles fonctions : `createMyAffiliateLink` (vérifie l'éligibilité), `adminListAffiliateCandidates`, `adminCreateAffiliateLink`, `adminDeleteAffiliateLink` (admin/platform_admin).
  - Éligibilité partagée : rôle `sales_agent` (interne ou externe) ou `partenaire` avec `partner_kind = 'seller'`.
- `admin.affiliation.tsx` : bouton + dialog de création, action suppression.
- `mon-lien.tsx` : états « pas de lien » / « non éligible ».
- `AppSidebar.tsx` : entrée « Mon lien d'affiliation » conditionnée à l'éligibilité.
- `EmployeeDirectory.tsx` : masquer commission et externe via `isManagementRole`, et forcer ces valeurs à nul côté serveur (`users-admin.functions.ts`) pour ces rôles.
