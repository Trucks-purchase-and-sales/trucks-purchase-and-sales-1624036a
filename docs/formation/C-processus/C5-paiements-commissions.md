# C5 — Paiements, PayCifi et commissions

## 1. Types de mouvements

| Type | Sens | Description |
| --- | --- | --- |
| **Acompte** (`deposit`) | Entrant ou sortant | Premier versement sécurisant l'opération |
| **Solde** (`balance`) | Entrant ou sortant | Complément avant livraison |
| **Remboursement** (`refund`) | Sortant | Annulation partielle ou totale |
| **Paiement de commission** | Sortant | Versement au partenaire apporteur |

Moyens : **PayCifi**, **virement**, **chèque**, **autre**.

Statuts d'un mouvement : **Attendu** → **En cours** → **Reçu**, ou **Échoué** / **Annulé**.

## 2. Enchaînement avec le funnel

```text
Acceptée
  -> Paiement en attente        (acompte enregistré comme "Attendu")
  -> Paiement reçu              (acompte "Reçu")
  -> [solde enregistré puis "Reçu"]
  -> Livraison planifiée
  -> Livrée
  -> Closed Won                 (commission calculée)
```

Règles :
- Le solde ne s'enregistre pas avant que l'acompte soit en « Reçu ».
- Le passage en « Livrée » suppose le solde encaissé, sauf accord écrit contraire.

## 3. Écran Finance → Paiements

1. Ouvrir l'opportunité concernée.
2. **Enregistrer un paiement** : sens, type, moyen, montant en euros, échéance, référence.
3. Mettre à jour le statut lorsque les fonds sont constatés (date d'encaissement enregistrée automatiquement).
4. Lire la synthèse financière du dossier : total attendu, total encaissé, total sortant, reste à payer.

## 4. PayCifi (paiement sécurisé)

Principe : les fonds sont placés en séquestre et libérés selon les conditions convenues, ce qui protège l'acheteur comme le vendeur sur des transactions transfrontalières.

Parcours :
1. Le partenaire connecte son portefeuille depuis son profil de paiement.
2. Wilmet crée un accord PayCifi rattaché à l'opportunité (montant, participants, arbitre éventuel).
3. Les parties acceptent l'accord.
4. Le versement est effectué ; le statut de l'accord est synchronisé dans la fiche.
5. À la livraison conforme, les fonds sont libérés ; en cas de litige, un arbitre peut être saisi.

À enseigner côté partenaire : PayCifi est optionnel, présenté comme une garantie et non comme une contrainte.

## 5. Commissions partenaires

### Règles de calcul
Une règle définit une base (**achat** ou **vente**), un type (**pourcentage du prix d'achat**, **pourcentage de la marge**, **montant fixe**) et un périmètre d'application (tous, un partenaire, un pays, un type de véhicule).

### Cycle d'une commission

```text
Brouillon (calculée automatiquement au moment de l'achat ou de la vente)
   -> Approuvée   (Manager ou Admin)
   -> Payée       (Admin : crée le paiement sortant correspondant)
   -> Annulée     (avec motif)
```

Conditions pour payer : dossier réellement acheté ou vendu, commission approuvée, **profil de paiement du partenaire vérifié**.

### Côté partenaire
Écran **Mes commissions** : montant, dossier concerné, base de calcul et statut. Le partenaire est notifié à l'approbation et au paiement.

## 6. Contrôles à enseigner

| Contrôle | Qui | Quand |
| --- | --- | --- |
| Cohérence montant / prix négocié | Commercial | Avant enregistrement |
| Profil de paiement vérifié | Admin | Avant tout paiement sortant |
| Rapprochement bancaire | Admin | À chaque encaissement |
| Encours de commissions | Direction | Revue hebdomadaire |

## 7. Erreurs fréquentes

- Marquer un paiement « Reçu » sur simple promesse de virement.
- Approuver une commission sur un dossier encore en négociation.
- Payer un partenaire dont le profil bancaire est « En attente » ou « Rejeté ».

## 8. Exercice de formation

Sur un dossier de test : enregistrer un acompte attendu, le passer en reçu, enregistrer et encaisser le solde, marquer le véhicule livré, clôturer en gagné, puis approuver et payer la commission du partenaire.
