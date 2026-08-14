# Clients, Vendeurs, Employés : séparation nette et suppression réservée à l'admin

## 1. Trois populations distinctes

Aujourd'hui un seul écran « Partenaires » mélange clients acheteurs et vendeurs, avec des boutons pour basculer de l'un à l'autre. Le commercial externe, lui, apparaît côté partenaires alors qu'il travaille pour Wilmet.

Cible :

| Population | Où on la gère | Ce qu'elle est |
| --- | --- | --- |
| Clients | Paramètres > Utilisateurs, onglet **Clients** | comptes externes acheteurs, voient leurs demandes |
| Vendeurs (partenaires) | onglet **Partenaires (vendeurs)** | comptes externes apporteurs, voient leurs véhicules |
| Employés | onglet **Employés** | internes + externes sous contrat (Kamal) |

Le type d'un compte externe est fixé à l'inscription, selon le lien cliqué sur le site. Aujourd'hui ce n'est pas le cas : l'inscription n'envoie aucun type, et tout nouveau compte devient « client » par défaut. Correction : les parcours « Proposer un véhicule » ouvrent l'inscription en mode vendeur, les parcours « Chercher un véhicule » en mode client, l'écran d'inscription indique clairement le type choisi (avec possibilité de le changer avant validation) et transmet ce type à la création du compte. Ensuite, il ne se change plus depuis l'application : les boutons « Promouvoir vendeur » et « Repasser client » disparaissent.

## 2. Le commercial externe rejoint les employés

- Kamal et tout profil équivalent sortent de la liste des partenaires et figurent dans **Employés**.
- Nouveau marqueur sur la fiche employé : case **« Prestataire externe »** (+ le taux de commission déjà existant). Un employé externe reste un commercial normal côté écrans, mais ne voit que ses propres dossiers, comme aujourd'hui.
- Le rôle technique séparé n'est plus nécessaire au quotidien : c'est la case qui pilote l'affichage et la restriction ; les comptes déjà en place sont convertis automatiquement, sans perte d'accès.

## 3. Suppression de compte (administrateur uniquement)

- Bouton **Supprimer** disponible sur les trois onglets, visible uniquement pour un administrateur.
- Confirmation obligatoire avec saisie de l'e-mail du compte.
- **Blocage si le compte a des dossiers** (véhicules apportés, demandes, dossiers assignés, annonces) : le message indique combien et propose plutôt la désactivation, ou le transfert vers un autre commercial pour les employés.
- Un administrateur ne peut ni se supprimer lui-même, ni supprimer le dernier administrateur actif.
- Chaque suppression est journalisée dans l'audit.

## 4. Écran Utilisateurs réorganisé

Quatre onglets : **Employés** · **Groupes** · **Clients** · **Partenaires (vendeurs)**.
Chaque onglet client/vendeur : recherche, état actif/désactivé, date d'inscription, nombre de dossiers, actions Désactiver / Réactiver / Supprimer. L'ancienne page « Partenaires » du menu renvoie vers cet écran.

## Détails techniques

- Migration : `profiles.is_external boolean not null default false` ; backfill `is_external = true` pour les comptes portant `external_agent`, puis bascule de leur rôle vers `sales_agent` (l'enum `external_agent` est conservé pour compatibilité mais n'est plus attribué). RLS et fonctions de visibilité (`agentVisibilityOr` dans `src/lib/admin.functions.ts`, politiques opportunités / demandes / annonces) lisent désormais `is_external` via une fonction security definer `private.is_external_agent(uuid)` au lieu du rôle.
- `src/lib/admin.functions.ts` : suppression de `adminSetPartnerKind` ; `adminListPartenaires` scindé en `adminListClients` et `adminListSellers` (filtre `partner_kind`, exclusion des comptes staff).
- Nouveau `src/lib/users-admin.functions.ts` : `userSetActive`, `userDelete` (admin only, comptage des dépendances `vehicle_opportunities`, `buyer_leads`, `demand_opportunities`, `sale_listings`, `ocr_scans` → refus si > 0, sinon `auth.admin.deleteUser` + purge profil/rôles, audit).
- `src/lib/staff.functions.ts` : `isExternal` ajouté aux entrées create/update et au retour de `staffList` ; `staffDelete` réutilise la même règle de blocage.
- UI : `PartnerDirectory.tsx` remplacé par un composant générique `ExternalUserDirectory` (prop `kind: "client" | "seller"`), sans boutons de bascule ; `EmployeeDirectory.tsx` reçoit la case « prestataire externe » ; `admin.users.tsx` passe à quatre onglets ; `admin.partenaires.tsx` redirige vers `/admin/users`.
- La fonction SQL `public.set_partner_kind` est supprimée ; `handle_new_user` continue de poser `partner_kind` d'après le formulaire d'origine.
