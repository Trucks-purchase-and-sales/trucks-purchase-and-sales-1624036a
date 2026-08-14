# C1 — Cycle de vie « offre » (véhicule proposé)

## 1. Vue d'ensemble

```text
PARTENAIRE VENDEUR                WILMET (inbox)                 WILMET (funnel)
------------------                --------------                 ---------------
Brouillon
   |  soumission
   v
Reçue  ------------------------>  En analyse
                                     |  \
                                     |   \--> Infos demandées --> (réponse vendeur) --> En analyse
                                     |   \--> Disqualifiée / Archivée
                                     |  affectation d'un commercial
                                     v
                                  Qualifiée ---------------------> funnel commercial
```

Tant qu'aucun commercial n'est affecté, la fiche est un **lead** et reste dans « Leads vendeurs ». Dès l'affectation, elle devient une **opportunité** et apparaît dans le funnel.

## 2. Phase lead

| Statut | Libellé interface | Qui agit | Action suivante |
| --- | --- | --- | --- |
| `envoyee` | Reçue | Admin / Manager | Ouvrir et contrôler |
| `en_cours_analyse` | En analyse | Admin / Manager / Commercial | Compléter ou demander des infos |
| `informations_demandees` | Infos demandées | Partenaire vendeur | Répondre et joindre les pièces |

Sorties de la phase lead : **affectation** (devient opportunité), **disqualification**, **archivage**.

## 3. Funnel commercial

```text
Qualifiée -> Offre envoyée -> En négociation -> Acceptée -> Paiement en attente
   -> Paiement reçu -> Livraison planifiée -> Livrée -> Closed Won
                                   \
                                    -> Refusée / Archivée / Closed Lost
```

| Étape | Condition d'entrée | Responsable |
| --- | --- | --- |
| Qualifiée | Fiche technique exploitable, commercial affecté | Commercial |
| Offre envoyée | Benchmark prix saisi, offre formulée au vendeur | Commercial |
| En négociation | Le vendeur a répondu | Commercial |
| Acceptée | Accord de prix écrit | Commercial |
| Achetée | Dossier documentaire complet + décision GO | Admin |
| Paiement en attente | Paiement attendu enregistré | Admin |
| Paiement reçu | Encaissement constaté | Admin |
| Livraison planifiée | Transport organisé, date confirmée | Commercial |
| Livrée | Véhicule remis, PV de livraison | Commercial / Admin |
| Closed Won | Dossier soldé, commission calculée | Admin |

## 4. Motifs de clôture perdue

Prix trop élevé, perdue face à un concurrent, véhicule déjà vendu, vendeur injoignable, dossier non conforme, décision No-Go interne. Le motif est obligatoire : il alimente les analyses de la direction.

## 5. Traçabilité

Chaque changement de statut est historisé (date, auteur, ancien et nouveau statut). Les notes et actions sont dans l'onglet **Activité**. En formation : montrer un dossier réel et lire son historique de bout en bout.

## 6. Notifications déclenchées

| Événement | Destinataire |
| --- | --- |
| Nouvelle fiche soumise | Équipe interne |
| Demande d'informations | Partenaire vendeur |
| Réponse du vendeur | Commercial affecté |
| Affectation d'un commercial | Commercial |
| Changement de statut significatif | Partenaire vendeur |
| Commission approuvée ou payée | Partenaire vendeur |

## 7. Exercice de formation

Dérouler un dossier de A à Z sur l'environnement de test : soumission par un compte vendeur, demande d'information, réponse, qualification, affectation, dossier documentaire, Go, achat, acompte, solde, livraison, clôture, commission.
