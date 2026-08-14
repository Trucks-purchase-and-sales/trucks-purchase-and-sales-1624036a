# C4 — Dossier de conformité, contrôles IA et décision Go / No-Go

Écran : fiche d'une opportunité offre, onglet **Dossier**. Accès interne uniquement.

## 1. Checklist documentaire

| Pièce | Obligatoire |
| --- | --- |
| Carte grise / certificat d'immatriculation | Oui |
| Certificat de conformité | Oui |
| Procès-verbal de contrôle technique | Oui |
| Certificat de non-gage / situation administrative | Oui |
| Facture d'achat / d'origine | Oui |
| Mandat de vente signé | Oui |
| Kbis / extrait de registre du vendeur | Oui |
| Pièce d'identité du signataire | Oui |
| Carnet d'entretien / factures d'entretien | Non |
| Homologation hayon / grue (VGP) | Non |
| Attestation de solde leasing / crédit-bail | Non |
| Mainlevée de gage | Non |

Statuts possibles par pièce : **Manquant**, **Demandé**, **Reçu**, **Validé**, **Non applicable**.

Règle : aucune opportunité ne passe en « Achetée » si une pièce obligatoire n'est pas **Validée** ou explicitement **Non applicable** avec justification.

## 2. Contrôles IA du dossier

Bouton **Analyser le dossier**. L'IA compare la fiche saisie, les documents joints et les valeurs extraites automatiquement, puis restitue :

1. **Niveau de risque** : faible / moyen / élevé.
2. **Synthèse automatique** du dossier, réutilisable dans une note interne.
3. **Incohérences détectées**, avec sévérité (basse, moyenne, haute) et champ concerné — par exemple un kilométrage déclaré inférieur à celui du dernier contrôle technique, ou un VIN différent entre la fiche et la carte grise.
4. **Informations manquantes**, avec la raison pour laquelle elles sont nécessaires.

À enseigner : l'analyse peut être relancée après chaque nouvelle pièce reçue. Une incohérence de sévérité haute doit être levée avant l'achat.

## 3. Benchmark prix

Saisir le prix de marché observé pour un véhicule comparable. Le système calcule l'écart entre le prix demandé et le benchmark. Cet écart alimente le critère économique de la grille Go/No-Go et sert d'argument dans la négociation.

## 4. Grille Go / No-Go

Notation de 0 à 5 par critère, regroupés en quatre familles :

| Famille | Critères |
| --- | --- |
| **Source** | Fiabilité de la source, traçabilité du véhicule |
| **Juridique et financier** | Absence de gage / opposition, situation leasing claire, dossier documentaire complet |
| **Technique** | État technique général, travaux à prévoir maîtrisés |
| **Économique** | Prix vs benchmark marché, marge estimée, liquidité du modèle |

Verdicts possibles :

| Verdict | Signification | Suite |
| --- | --- | --- |
| **GO** | On avance | Passage à l'achat |
| **GO conditionnel** | On avance sous conditions écrites | Conditions à lever, puis achat |
| **À creuser** | Informations insuffisantes | Compléter le dossier, réévaluer |
| **NO GO** | On n'achète pas | Clôture en perdue avec motif |

Le verdict, les notes et le commentaire sont enregistrés et consultables par la direction.

## 5. Enchaînement recommandé

```text
Pièces demandées au vendeur
   -> Pièces reçues et validées
   -> Contrôles IA (incohérences levées)
   -> Benchmark prix saisi
   -> Grille Go/No-Go notée
   -> Verdict enregistré
   -> Décision d'achat
```

## 6. Erreurs fréquentes

- Noter la grille avant d'avoir les pièces : le score est faux.
- Ignorer une incohérence signalée « haute » : risque juridique réel.
- Marquer une pièce « Non applicable » sans justification écrite.

## 7. Exercice de formation

Sur un dossier de test incomplet : demander deux pièces, les marquer reçues puis validées, lancer les contrôles IA, corriger une incohérence, saisir un benchmark, noter la grille et enregistrer un verdict « GO conditionnel » avec conditions.
