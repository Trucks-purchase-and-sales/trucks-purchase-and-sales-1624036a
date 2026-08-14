# Formulaire véhicule — mise à jour issue du point commercial du 3 août

Oui, j'ai relevé toutes les demandes du compte rendu. Elles concernent presque toutes le formulaire de proposition de véhicule (`/opportunities/new`). Les autres points du compte rendu (contrats, vision équipe) ne sont pas des sujets applicatifs.

## 1. État du véhicule (étape 3)

- « Le véhicule roule-t-il ? » devient un choix strict **Oui / Non** — suppression de l'option « À vérifier ». Cette règle s'applique à **tous** les champs du formulaire qui proposent aujourd'hui « À vérifier » (ou « Non précisé ») : on ne garde que **Oui / Non**.
- Si **Non** : le champ de commentaire expliquant la nature du problème (panne moteur, boîte, accident…) devient **obligatoire**. C'est ce champ qui remplace la catégorie « accidenté ».
- Suppression du champ **« Véhicule accidenté ? »**.
- Consolidation de **« Défauts connus » + « Travaux à prévoir » + « Commentaires complémentaires »** en un seul champ texte unique : « Défauts, travaux à prévoir et commentaires », avec dictée vocale conservée.
- **Carnet d'entretien** : conservé tel quel.
- **« Code clé / nombre de clés »** remplacé par **« Nombre de clés »** (liste : 1, 2, 3, 4+).

## 2. Contrôle technique

- Le champ « Contrôle technique valide ? » est conservé en **Oui / Non**.
- Si **Oui** : la date **« Valable jusqu'au »** devient **obligatoire**.
- Si **Non** : la date est masquée.
- Dans les fiches et récapitulatifs, la mention du contrôle technique et sa date ne s'affichent que si le contrôle est valide.

## 3. Prix et statut juridique (étape 5)

- Suppression du champ **« TVA récupérable ? »** — on garde uniquement le **prix HT en euros**.
- Le champ « Libre de tout engagement ? » est renommé **« Libre de tout gage ? »** (Oui / Non).

## 4. Photos (étape 4)

- **Plaque constructeur / numéro de châssis (VIN)** : photo rendue **obligatoire**.
- Nouvelle catégorie **« Tableau de bord, moteur tournant »** — obligatoire, avec aide expliquant qu'elle sert à vérifier l'absence de voyants de défaut. L'ancienne catégorie « Tableau de bord (kilométrage) » reste pour le kilométrage.
- Blocage de la soumission si une catégorie obligatoire est absente, avec message clair listant ce qui manque.

## 5. Cohérence dans le reste de l'application

- Récapitulatif étape 6, fiche opportunité admin/commercial, panneau dossier : retrait des champs supprimés, affichage du nouveau champ unique de commentaires, du nombre de clés, de la date de CT conditionnelle et du libellé « Libre de tout gage ».

## Points du compte rendu hors formulaire (non inclus, à confirmer plus tard)

- Assignation automatique des leads : validée sur le principe mais **volontairement non activée** pour l'instant.
- Génération automatique d'une annonce marketplace après achat validé + notification email des clients pertinents.
- Création de compte autonome acheteur/vendeur (déjà en place aujourd'hui).
- Agent conversationnel IA paramétrable pour qualifier les demandes hors heures ouvrées.

Dis-moi si tu veux que j'en intègre un dans ce lot.

## Détails techniques

- Migration base : ajout `keys_count` (int), `defects_and_comments` (text), `free_of_pledge` (text) ; les colonnes `has_accident`, `vat_recoverable`, `key_code` restent en base mais ne sont plus alimentées (retrait des écrans) afin de ne pas perdre l'historique. Reprise des données existantes : concaténation de `known_defects` + `expected_repairs` + `additional_comments` dans `defects_and_comments`, `free_of_commitment` → `free_of_pledge`, extraction numérique de `key_code` → `keys_count` quand possible.
- `src/lib/wilmet-constants.ts` : nouvelles listes `YES_NO_OPTIONS` réutilisées pour roulant / CT / gage, `KEYS_COUNT_OPTIONS`, ajout de la catégorie photo `tableau_de_bord_moteur` et d'un indicateur `required` sur `PHOTO_CATEGORIES`.
- `src/routes/_authenticated/opportunities.new.tsx` : refonte des étapes 3, 4 (validation photos requises), 5 et 6.
- `src/lib/opportunities.functions.ts` : schéma Zod mis à jour + validations serveur (motif obligatoire si non roulant, date CT obligatoire si CT valide).
- `src/lib/ocr.functions.ts` / `DossierPanel` / vues admin : mise à jour des champs mappés.
