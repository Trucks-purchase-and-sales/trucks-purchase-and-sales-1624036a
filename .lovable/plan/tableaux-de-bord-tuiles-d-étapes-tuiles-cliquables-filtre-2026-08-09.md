# Tableaux de bord : tuiles d'étapes + tuiles cliquables (filtre)

## Objectif

Rendre tous les tableaux de bord réellement exploitables :

1. Une **deuxième ligne de tuiles** détaillant les étapes du parcours après acceptation.
2. Des **chiffres cliquables** : cliquer sur une tuile filtre la liste en dessous (ou ouvre le pipeline déjà filtré quand la liste n'est pas sur la même page). Recliquer la même tuile enlève le filtre.

## Étapes suivies dans la 2e ligne

Le parcours après acceptation, dans l'ordre existant du système :

```text
Acceptée → Achetée → Paiement en attente → Paiement reçu → Livraison planifiée → Livrée → Gagnée / Perdue
```

Chaque tuile affiche le compte et son code couleur de statut actuel. Les tuiles vides restent affichées (avec 0) pour que l'étape reste lisible comme un parcours, sauf sur l'espace partenaire où les étapes non atteintes sont masquées afin de ne pas noyer un petit portefeuille.

## Comportement au clic

- **Espace partenaire (Mes opportunités)** : le clic applique le filtre de statut à la grille de cartes de la même page ; la tuile active est surlignée, un bouton « Réinitialiser » apparaît. La ligne 1 (Envoyées / En analyse / Acceptées / Refusées) devient cliquable de la même manière ; « Envoyées » = tout sauf brouillon.
- **Opportunités reçues (admin/commercial)** : ajout d'une ligne de compteurs + la ligne d'étapes au-dessus des filtres existants. Le clic renseigne le filtre de statut déjà présent et bascule sur la vue « Liste complète » pour montrer immédiatement le résultat. Le filtre reste modifiable via le sélecteur existant.
- **Espace commercial, Direction commerciale, Direction de l'entreprise** : ces pages n'ont pas de liste. Le clic ouvre la page Opportunités déjà filtrée sur le statut concerné (et, pour l'espace commercial, restreinte à son portefeuille comme aujourd'hui). Les tuiles non liées aux opportunités (Demandes acheteurs, Partenaires actifs, Non assignées) pointent vers leur page respective, également pré-filtrée quand c'est possible.
- **Mes demandes (client)** : les statuts de demande (Nouveau, En recherche, Offre envoyée, Gagné, Perdu…) deviennent une ligne de tuiles cliquables filtrant la liste de la page.
- Le filtre choisi est inscrit dans l'URL, donc partageable et conservé au rafraîchissement / retour navigateur.

## Détails techniques

- Nouveau composant partagé `src/components/dashboard/StatTile.tsx` : tuile compacte (compte + libellé + pastille de couleur), variantes cliquable / lien / active, accessible au clavier (`button`/`Link`, `aria-pressed`).
- Nouveau composant `src/components/dashboard/StageTiles.tsx` : rend la ligne d'étapes à partir d'une liste de statuts et d'un dictionnaire de comptes, réutilisé par tous les tableaux de bord.
- `src/lib/wilmet-constants.ts` : ajout d'un tableau exporté `POST_ACCEPTANCE_STAGES` (source unique de l'ordre des étapes ci-dessus) afin de ne pas dupliquer la liste dans 5 fichiers.
- `src/lib/dashboards.functions.ts` : `salesAgentKpis`, `managerKpis` et `directionKpis` renvoient en plus `byStatus` (compte par statut) via un seul `select("status")` agrégé côté serveur plutôt qu'un `count` par étape, en conservant les contrôles de rôle actuels.
- `src/routes/_authenticated/admin.index.tsx` : ajout de `validateSearch` (`status`, `view`) avec valeurs de repli, lecture par `Route.useSearch()` et écriture via `navigate({ search })` en remplacement des `useState` correspondants ; les compteurs sont calculés sur une requête non filtrée par statut pour rester stables quand un filtre est actif.
- `src/routes/_authenticated/dashboard.tsx` et `mes-demandes.tsx` : même passage du filtre de statut vers les paramètres d'URL, tuiles branchées dessus.
- `sales.index.tsx`, `manager.index.tsx`, `direction.index.tsx` : tuiles converties en liens vers `/admin?status=…`.
- Aucun changement de schéma de base de données, aucune modification des règles d'accès.

## Vérification

Passage Playwright sur chaque tableau de bord : les deux lignes de tuiles s'affichent, un clic filtre bien la liste, le reclic réinitialise, l'URL reflète le filtre et aucune erreur console n'apparaît.
