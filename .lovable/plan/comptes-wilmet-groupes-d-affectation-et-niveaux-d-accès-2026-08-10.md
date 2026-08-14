# Comptes Wilmet, groupes d'affectation et niveaux d'accès

## 1. Les comptes à créer / promouvoir

| Personne | E-mail | Niveau | Compte existant |
| --- | --- | --- | --- |
| Samuele Bennici | samuele.bennici@wilmet.com | Direction (lecture de tout) | à créer |
| Raphaël Bitschy | raphael.bitschy@gmail.com | Direction (lecture de tout) | existe en partenaire → promu |
| Issam S. | issam.s@ccsg.info | Directeur commercial (encadrement) | existe en partenaire → promu |
| Chafik Maknoun | chafik@wilmet.com | Commercial interne, achat + vente | à créer |
| François Herbillon | francois@wilmet.com | Commercial interne, achat + vente | existe en partenaire → promu |
| Kamal | kamal@wilmet.com | Commercial externe (nouveau niveau) | à créer |

Règles appliquées à la promotion : le rôle partenaire est remplacé (un seul rôle par compte), le typage client/vendeur est effacé, le périmètre employé est posé, le compte reste actif.

Chaque compte créé affiche un mot de passe temporaire à l'écran, à transmettre à la personne (modifiable ensuite depuis son profil ou réinitialisable par l'administrateur).

## 2. Nouveau niveau : commercial externe (cas Kamal)

Plus qu'un partenaire, moins qu'un commercial interne :
- il travaille à l'achat **et** à la vente ;
- il ne voit **que ses propres dossiers** (véhicules qu'il a apportés ou dossiers qui lui sont assignés) — jamais la file globale ni ceux des collègues ;
- il est rattaché à Issam, qui voit tout ce qu'il fait ;
- il utilise les mêmes écrans d'opportunités et de demandes que les internes, mais filtrés sur lui.

## 3. Taux de commission dans le profil

Nouveau champ « taux de commission (%) » sur les profils commerciaux (internes et externes), visible et modifiable dans Paramètres > Utilisateurs. Le calcul de commission d'un dossier proposera par défaut le taux du commercial rattaché, tout en restant modifiable dossier par dossier comme aujourd'hui.

## 4. Groupes d'affectation

Aujourd'hui l'affectation se fait sur deux côtés figés (Achat / Vente). On ajoute une vraie notion de **groupe** nommé, au-dessus des utilisateurs :

- Un écran **Paramètres > Groupes** (administrateur) : créer / renommer / désactiver un groupe, choisir son côté (achat, vente ou les deux), ajouter et retirer des membres.
- Deux groupes créés au départ :
  - **Wilmet Sales** (interne, achat + vente) : Chafik, François.
  - **Wilmet Externe** (achat + vente) : Kamal.
- Toute nouvelle opportunité véhicule et toute nouvelle demande acheteur est affectée automatiquement au groupe par défaut de son côté (Wilmet Sales), sauf si elle est créée par un commercial externe : elle reste alors sur lui seul.
- Tous les membres d'un groupe voient et travaillent tous les dossiers du groupe (sauf les externes, limités à leurs dossiers). Un dossier peut aussi être affecté nominativement.
- Filtre « Groupe » ajouté aux listes leads / opportunités / demandes, et sélecteur de groupe dans le panneau d'affectation.

## 5. Matrice d'accès finale

| Niveau | Voit | Peut modifier |
| --- | --- | --- |
| Administrateur | tout | tout, comptes, groupes, référentiels |
| Direction (Samuele, Raphaël) | tout : dossiers, pipeline, finance, commissions | rien (lecture seule) |
| Directeur commercial (Issam) | tout le pipeline achat + vente, tous les groupes, activité de Kamal | dossiers, affectations, commissions |
| Commercial interne (Chafik, François) | dossiers de leurs groupes + files non affectées de leur périmètre | leurs dossiers et ceux de leurs groupes |
| Commercial externe (Kamal) | uniquement ses propres dossiers | ses propres dossiers |
| Partenaire vendeur | ses véhicules | ses véhicules |
| Partenaire client | ses demandes | ses demandes |

## Détails techniques

- Migration : nouveau rôle `external_agent` dans `app_role` ; tables `staff_groups` (nom, côté, actif, is_default) et `staff_group_members` (groupe, utilisateur) avec GRANT + RLS (lecture pour tout membre du staff, écriture administrateur) ; colonne `assigned_group_id` sur `vehicle_opportunities`, `buyer_leads`, `demand_opportunities`, `sale_listings` (l'enum `staff_group` existant est conservé pour la compatibilité et alimenté en parallèle) ; colonne `profiles.commission_rate numeric(5,2)`.
- RLS : politiques mises à jour pour `external_agent` (accès limité à `partenaire_id = auth.uid()` ou `assigned_sales_agent_id = auth.uid()`) et pour les rôles internes via appartenance au groupe (`private.is_group_member`, security definer, sur le modèle des fonctions de rôle existantes). Direction en lecture seule (pas de politique d'écriture).
- Données : création des comptes et promotions via l'API d'administration (rôle remplacé dans `user_roles`, `partner_kind` remis à nul, `staff_scope` posé), plus insertion des deux groupes et de leurs membres.
- Code : `src/lib/staff.functions.ts` étendu (rôle externe, `commission_rate`, CRUD groupes) ; nouveau `src/lib/staff-groups.functions.ts` ; filtres de visibilité de `src/lib/admin.functions.ts` et `src/lib/demand-opportunities.functions.ts` étendus au groupe et au cas externe ; `src/components/admin/EmployeeDirectory.tsx` (taux de commission, rôle externe) ; nouvel onglet Groupes dans `src/routes/_authenticated/admin.users.tsx` ; `AppSidebar` et `useRoleHome` adaptés au rôle externe et à la Direction en lecture seule ; `CommissionPanel` pré-remplit le taux du commercial.
- Documentation de formation (`docs/formation/01-roles-et-acces.md`) mise à jour avec le niveau externe et les groupes.
