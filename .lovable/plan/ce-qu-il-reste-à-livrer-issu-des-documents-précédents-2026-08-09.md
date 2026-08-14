# Ce qu'il reste à livrer (issu des documents précédents)

Après vérification du code, tout le formulaire véhicule, le dossier de conformité, la grille Go/No-Go, la saisie vocale, le scan IA (images, PDF, Excel/Word) et la transformation en offre de vente sont bien en place. Il reste 4 chantiers explicitement listés comme « non inclus » ou « à faire plus tard ».

## 1. Aligner le formulaire « Chercher un véhicule » sur le formulaire véhicule (confirmé manquant)
Le formulaire acheteur ne connaît pas encore la notion de **catégorie de véhicule** avec marques/modèles dépendants, alors que le formulaire vendeur l'utilise. Résultat : les deux côtés ne parlent pas le même référentiel, ce qui dégrade le matching.
- Ajouter le champ « Catégorie de véhicule » en premier, filtrer les marques puis les modèles selon la catégorie choisie.
- Aligner la liste des pays sur l'UE-27 utilisée côté vendeur, sans valeur par défaut.
- Reprendre les carrosseries filtrées par catégorie (même logique que côté vendeur).

## 2. Annonce automatique après achat + notification des acheteurs pertinents
Aujourd'hui la transformation en offre de vente est manuelle et sans notification.
- Quand une opportunité passe en « Achetée », créer automatiquement l'offre de vente en brouillon (au lieu d'attendre le clic), le commercial n'a plus qu'à valider le prix et publier.
- À la publication, identifier les demandes acheteurs correspondantes via le moteur de matching existant et notifier les acheteurs concernés (notification in-app, e-mail si l'envoi d'e-mails est activé).

## 3. Affectation automatique des leads au groupe (validée sur le principe, volontairement non activée)
- Règle configurable dans Paramètres : les nouveaux leads sont affectés automatiquement au groupe concerné (Vente pour les propositions de véhicule, Achat pour les demandes acheteurs), sans attribution à un commercial précis — le groupe se répartit le travail lui-même.
- Trace dans l'historique du lead : « affecté automatiquement au groupe … ».

## 4. Agent conversationnel IA hors heures ouvrées
- Chat sur le site public qui qualifie une demande acheteur (type de véhicule, budget, délai, contact) et crée directement une demande acheteur en base.
- Paramétrable : plage horaire d'activation, questions posées, message de sortie.

## Recommandation d'ordre
1 → 2, puis 3, puis 4. Le point 1 est court et améliore tout de suite la qualité du matching ; le point 2 est le vrai gain commercial ; les points 3 et 4 sont des automatisations à part entière.

## Détails techniques
- Point 1 : `src/lib/buyer-leads.schema.ts` (nouveau champ catégorie + validation), `src/routes/chercher-un-vehicule.index.tsx`, `src/lib/reference-data.functions.ts` (exposer la hiérarchie catégorie → marques → modèles déjà utilisée par le wizard), migration ajoutant `vehicle_category` sur `buyer_leads` et `demand_opportunities`.
- Point 2 : déclenchement dans la transition de statut de `src/lib/opportunities.functions.ts` réutilisant `createSaleListingFromOpportunity`, puis `src/lib/matching.server.ts` pour les correspondances et insertion dans `notifications`.
- Point 3 : table de configuration `lead_assignment_settings` + attribution dans les fonctions de création de leads (`src/routes/api/public/buyer-leads.ts`, `opportunities.functions.ts`).
- Point 4 : route publique `src/routes/api/public/assistant.ts` (chat streaming via passerelle IA) + widget client, création de lead via le chemin buyer-leads existant avec le rate limiting actuel.
