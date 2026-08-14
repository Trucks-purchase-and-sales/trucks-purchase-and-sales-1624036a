# Employés vs Partenaires — séparation des accès et gestion complète des utilisateurs

## Où nous en sommes aujourd'hui

Déjà en place :
- Rôles uniques par compte : Administrateur, Direction, Manager commercial, Commercial, Partenaire.
- Les partenaires sont déjà typés « client » (acheteur) ou « vendeur » (apporteur d'affaire), avec des espaces distincts (`/dashboard`, `/mes-demandes`).
- Menu latéral et gardes de routes par rôle ; un partenaire ne voit que ses propres fiches.
- Annuaire « Partenaires » qui exclut déjà les utilisateurs internes, avec bascule client/vendeur.

Ce qui manque pour votre cible :
1. Aucun écran de gestion des employés : impossible de créer, modifier, désactiver ou supprimer un utilisateur interne depuis l'app (aujourd'hui c'est fait en coulisses).
2. Pas de notion de « périmètre » pour un employé : un commercial n'est ni marqué côté achat (vendeurs) ni côté vente (acheteurs) ni les deux.
3. Un commercial voit encore l'ensemble des dossiers, pas seulement les siens ; le manager et la direction voient tout, mais sans distinction explicite.
4. Un compte désactivé peut encore se connecter (le drapeau existe en base mais n'est pas appliqué).

## Ce qui sera construit

### 1. Périmètre employé
Nouveau champ « périmètre » sur les comptes internes : **Achat (vendeurs)**, **Vente (acheteurs)** ou **Les deux**.
- Il pilote ce que le commercial voit dans son menu et ses listes : périmètre achat -> leads vendeurs et opportunités offre ; périmètre vente -> demandes acheteurs et opportunités demande ; les deux -> tout.
- Manager commercial, Direction et Administrateur voient toujours les deux côtés, sans filtre.

### 2. Gestion complète des utilisateurs (Administrateur uniquement)
Nouvelle page **Paramètres > Utilisateurs** avec deux onglets :
- **Employés** : liste avec nom, e-mail, rôle, périmètre, état (actif/désactivé), dossiers en cours. Actions : créer un employé (e-mail + nom + rôle + périmètre, mot de passe temporaire ou invitation par e-mail), modifier rôle/périmètre/coordonnées, désactiver / réactiver, réinitialiser le mot de passe, supprimer.
- **Partenaires** : l'annuaire actuel (bascule client/vendeur, promotion vendeur), déplacé sous le même écran pour que la séparation interne / externe soit visible.

Règles de sécurité appliquées :
- Un compte ne porte qu'un seul rôle ; changer de rôle remplace l'ancien.
- Un employé ne peut pas être transformé en partenaire (et inversement) sans passer par l'écran, qui nettoie les données incohérentes.
- Impossible de se désactiver, se rétrograder ou se supprimer soi-même ; il doit toujours rester au moins un administrateur actif.
- Suppression : si l'employé a des dossiers assignés, l'écran demande d'abord un transfert vers un autre commercial ; sinon proposition de simple désactivation.
- Chaque action (création, changement de rôle, désactivation, suppression, reset mot de passe) est journalisée dans l'audit.

### 3. Application de la désactivation
À la connexion et à chaque entrée dans l'espace connecté, un compte désactivé est déconnecté avec le message « Votre compte a été désactivé. Contactez l'administrateur. »

### 4. Cloisonnement des vues
- **Commercial** : ne voit que les leads/opportunités qui lui sont assignés, plus la file d'attente non assignée de son périmètre.
- **Manager commercial** : tout, plus l'affectation et la vue par commercial.
- **Direction** : lecture de tout.
- **Apporteur d'affaire (vendeur externe)** : uniquement ses véhicules et leur avancement (inchangé, vérifié).
- **Client acheteur** : uniquement ses demandes et leur avancement (inchangé, vérifié).

## Détails techniques

- Migration : ajout d'un type `staff_scope` (`purchase` / `sales` / `both`) et de la colonne `staff_scope` sur `profiles` ; réutilisation de `profiles.is_active` pour l'activation ; contrainte logicielle « un seul rôle » conservée côté fonctions serveur.
- Nouveau module `src/lib/staff.functions.ts` (server functions, `requireSupabaseAuth` + vérification du rôle administrateur via la fonction de rôle existante) : `staffList`, `staffCreate`, `staffUpdate`, `staffSetActive`, `staffResetPassword`, `staffDelete` (avec transfert d'assignations). Les opérations d'annuaire utilisateur utilisent le client privilégié chargé dans le handler après vérification du rôle.
- Nouvelle route `src/routes/_authenticated/admin.users.tsx` (garde admin), onglets Employés / Partenaires ; l'annuaire partenaires actuel est réutilisé comme composant.
- `AppSidebar` : entrée « Utilisateurs » dans Paramètres ; filtrage des entrées Pipeline selon `staff_scope` pour les commerciaux.
- Filtres serveur des listes leads/opportunités : restriction par `assigned_sales_agent_id` pour le rôle commercial, par périmètre pour les files non assignées.
- Contrôle de désactivation dans le layout authentifié (déconnexion + redirection `/auth`).
- Documentation formation mise à jour (`docs/formation/01-roles-et-acces.md`) avec le périmètre employé et la gestion des utilisateurs.
