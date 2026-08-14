# C2 — Cycle de vie « demande » (client acheteur)

## 1. Vue d'ensemble

```text
CLIENT (site public)         WILMET (Demandes acheteurs)      WILMET (Opportunités demande)
--------------------         ---------------------------      -----------------------------
Formulaire de recherche ---> Lead acheteur (Nouveau)
                                  |  \
                                  |   \--> Infos demandées --> (réponse client)
                                  |   \--> Rejeté
                                  |  qualification + conversion
                                  v
                             Opportunité demande (WIL-DEM-...) ---> pipeline
```

## 2. Étapes du pipeline demande

| Statut | Libellé | Étape | Ce qui doit être vrai |
| --- | --- | --- | --- |
| `nouvelle` | Nouvelle | Qualification | Demande créée |
| `qualifiee` | Qualifiée | Qualification | Besoin, budget, délai et pays confirmés avec le client |
| `en_recherche` | En recherche | Sourcing | Recherche active, véhicules candidats identifiés |
| `proposition_envoyee` | Proposition envoyée | Proposition | Au moins un véhicule rapproché et transmis au client |
| `negociation` | Négociation | Négociation | Le client a répondu sur le prix ou les conditions |
| `gagnee` | Gagnée | Clôture | Accord conclu, achat en cours de finalisation |
| `perdue` | Perdue | Clôture | Motif obligatoire |
| `archivee` | Archivée | Clôture | Demande sans suite |

## 3. Conversion d'un lead acheteur

1. Écran **Pipeline → Demandes acheteurs**.
2. Cliquer sur la ligne pour ouvrir le lead.
3. Vérifier les coordonnées et le besoin.
4. Trois choix : **Convertir** (crée l'opportunité demande et affecte un commercial), **Demander des informations**, **Rejeter**.
5. Résultat de la conversion : une référence `WIL-DEM-…` apparaît dans « Opportunités demande ».

## 4. Sourcing et rapprochement

- Depuis la fiche de l'opportunité demande, utiliser les **suggestions de véhicules** : le système propose les opportunités offre compatibles (type, marque, modèle, année, kilométrage, budget, pays).
- **Rapprocher** un véhicule crée un lien traçable entre la demande et l'offre.
- Un ou plusieurs véhicules peuvent être rapprochés à une même demande.
- Interdiction de passer en « Proposition envoyée » sans au moins un véhicule rapproché.

## 5. Champs de qualification à obtenir du client

Type de véhicule, marque et modèle, carrosserie, année minimale, kilométrage maximal, configuration d'essieux, norme Euro, boîte, budget maximum HT, pays et ville de livraison, délai, usage prévu, mode de financement.

## 6. Erreurs fréquentes

- Convertir un lead sans avoir parlé au client : budget irréaliste découvert trop tard.
- Laisser une demande en « En recherche » sans activité : rendre visible le seuil de 10 jours.
- Envoyer plusieurs propositions sans les rapprocher dans l'outil : perte de traçabilité et de commission.

## 7. Exercice de formation

Créer une demande depuis le formulaire public, la qualifier, la convertir, rapprocher un véhicule existant, envoyer la proposition, clôturer en « Gagnée ».
