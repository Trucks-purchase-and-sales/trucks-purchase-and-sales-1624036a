# Formulaire véhicule — suppression des doublons

Oui, je confirme : la liste à cocher « Équipements principaux » (étape 2) est redondante. Chacune de ses cases existe déjà ailleurs, en mieux structuré :

| Case à cocher | Déjà couvert par |
| --- | --- |
| Climatisation | champ « Climatisation » (Oui/Non) juste au-dessus |
| Grue | champ « Grue » (Oui/Non) + « Détails de la grue » |
| Attelage | champ « Crochet / attelage hydraulique » |
| Hayon | section complète « Hayon élévateur » |
| Suspension pneumatique | champ « Type de suspension » |
| Autre | champ « Autres équipements (précisez) » |
| Frigo, GPS, Caméra de recul, Régulateur | rien d'équivalent — seules options réellement utiles |

Résultat : le vendeur peut se contredire (Climatisation = Non et case Climatisation cochée), et la donnée part dans deux colonnes différentes.

## Ce que je propose

1. Supprimer la liste « Équipements principaux » telle quelle et la remplacer par une liste courte, sans doublon, intitulée « Autres équipements » : **Frigo / groupe froid, GPS, Caméra de recul, Régulateur de vitesse**.
2. Garder les dropdowns Oui/Non (Climatisation, Chauffage additionnel, Crochet/attelage, Grue), la section Hayon et « Type de suspension » comme sources uniques de vérité.
3. Garder le champ texte « Autres équipements (précisez) » pour tout le reste (la case « Autre » disparaît).

## Autres doublons / restes relevés dans le formulaire

- Étape 3 : le champ **« Véhicule accidenté ? »** est toujours présent alors qu'il devait être supprimé (remplacé par le motif d'immobilisation + le champ unique de commentaires). À retirer du formulaire et du récapitulatif.
- Étape 3 : **« État général »** propose encore une valeur « Accidenté » filtrée à la main ; on la retire proprement de la liste.
- Étape 6 : le récapitulatif « Caractéristiques » affiche Hayon, Grue et « Équipements » ; on l'aligne sur les nouveaux champs (Climatisation, Chauffage, Attelage, Grue, Hayon, Autres équipements) sans répétition, et on enlève la ligne « Accidenté » de l'état.
- Pas d'autre section dupliquée : Informations générales / Localisation / Caractéristiques / Dimensions / Équipements / Hayon / État / Photos / Prix / Contact / Récapitulatif apparaissent chacune une seule fois.

## Détails techniques

- `src/lib/wilmet-constants.ts` : `EQUIPMENT_OPTIONS` réduit à Frigo, GPS, Caméra de recul, Régulateur ; retrait de `accidente` de `CONDITION_OPTIONS`.
- `src/routes/_authenticated/opportunities.new.tsx` : renommage du bloc en « Autres équipements », suppression du champ `has_accident` (étape 3) et du filtre manuel sur les conditions, mise à jour des blocs récap.
- Vues détail (`admin.opportunities.$id.tsx`, `opportunities.$id.tsx`, `DossierPanel`) : retrait de l'affichage « Accidenté » si présent.
- Aucune migration : les colonnes `has_accident` et `equipment` restent en base pour l'historique ; `has_accident` n'est simplement plus alimenté.
