# Refonte du formulaire véhicule + préqualification (cahier des charges WT)

## Ce que j'ai compris du document

Le document demande trois choses distinctes :

1. **Niveau 1 — Fiche opportunité** (remplie par le fournisseur / apporteur / équipe WT) : formulaire simplifié, réordonné, avec de nouveaux champs métier poids-lourds, assisté par scan IA et saisie vocale.
2. **Niveau 2 — Dossier de conformité documentaire** (rempli par l'équipe Wilmet) : checklist des documents clés (carte grise, conformité, cession, non-gage, carnet, facture, hayon, plaque, châssis) avec statut Oui/Non/À confirmer + pièces jointes.
3. **Niveau 3 — Grille interne Go / No-Go** (réservée à l'équipe) : scoring source, documentaire, juridique, technique, économique, benchmark prix → décision.

Tout est faisable. Le point 1 est du travail direct sur le wizard existant ; le 2 et le 3 sont deux nouveaux modules côté back-office. Le benchmark prix automatique et le scan de PDF/Excel/Word ont des limites que je détaille en questions.

## Niveau 1 — Formulaire véhicule

### À supprimer

- `Version / finition`, `Année` (l'année reste extraite par l'IA si présente dans un document, mais plus de champ métier obligatoire)
- Boîte de vitesses `Robotisée`
- Case équipement `Benne` (remplacée par Crochet hydraulique)
- Champ `Véhicule en panne` (redondant avec Véhicule roulant)
- `Historique d'entretien` détaillé (remplacé par Carnet d'entretien Oui/Non)
- Euro `E6E` et Euro `Électrique` (garder Euro 3/4/5/6)
- Marque `Renault Trucks` fusionnée dans `Renault` (migration des modèles et des opportunités existantes)
- Champ TVR (à confirmer, cf. questions)

### Nouvel ordre de saisie

1. Scan / joindre documents + photos → remplissage IA
2. Saisie vocale → structuration IA
3. Marque → 4. Modèle → 5. Carrosserie / type de véhicule → 6. Kilométrage
4. Énergie / norme Euro → 8. PTAC → 9. Empattement → 10. Suspension
5. État général → 12. Infos techniques complémentaires → 13. Documents
6. Options / équipements → 15. Localisation

### Nouveaux champs


| Champ                          | Type                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Carrosserie / type de véhicule | liste + « Autre » → champ libre obligatoire                                               |
| Empattement                    | numérique, mm                                                                             |
| Type de suspension             | LAM-LAM (Lames/Lames), LAM-R (Lames/Air), R-R (Air/Air)                                   |
| Monte de pneumatiques          | texte libre (ex. 315/80 R22.5)                                                            |
| Dimensions intérieures caisse  | hauteur / largeur / profondeur, en mm                                                     |
| Véhicule roulant               | Oui / Non → si Non, raison obligatoire (liste + Autre)                                    |
| État général                   | Bon / Moyen / Mauvais                                                                     |
| Contrôle technique             | Oui / Non → si Oui, « Valable jusqu'au » (date)                                           |
| Accidenté                      | Oui / Non                                                                                 |
| Carnet d'entretien             | Oui / Non                                                                                 |
| Plaque constructeur            | obligatoire (photo/scan)                                                                  |
| Numéro de châssis              | obligatoire (saisie ou photo)                                                             |
| Code de clé                    | optionnel                                                                                 |
| Climatisation / Chauffage      | deux Oui/Non distincts                                                                    |
| Crochet hydraulique            | Oui / Non                                                                                 |
| Grue                           | Oui / Non → marque, modèle, capacité, nb extensions, télécommande, docs                   |
| Autre équipement               | Oui / Non → champ libre                                                                   |
| Lien de localisation           | URL (Google Maps / Waze)                                                                  |
| Hayon présent                  | Oui / Non → homologué, carnet homologation, carnet maintenance, photos, état, commentaire |


### Listes carrosserie

- **Porteur** : Fourgon, Frigo, Tautliner, Benne, Plateau, Ampliroll, Châssis, BDF, Citerne, Malaxeur, Porte-engins, Porte-voitures, Nacelle, Dépannage, Grumier, BOM, Balayeuse, Aspirateur, Transport animal, Porte-boissons, Autre
- **Semi-remorque** : Fourgon, Frigo, Tautliner, Benne, Plateau, Citerne, Autre

## Niveau 2 — Dossier de conformité (back-office)

Nouvel onglet sur la fiche opportunité, visible équipe WT uniquement, avec pour chaque ligne un statut et une pièce jointe :

Carte grise · Certificat de conformité · Certificat de cession · Carnet d'entretien (visites techniques) · Dernier contrôle technique (+ date de validité) · Non-gage / non-leasing / réserve de propriété · Facture conforme · Plaque constructeur · Numéro de châssis · Documents hayon (homologation, maintenance) · Photos hayon · Documents grue · Autres pièces.

Statuts : `Oui / Non / À confirmer / À recevoir / Non applicable`. Un indicateur de complétude documentaire (%) alimente le niveau 3.

## Niveau 3 — Grille Go / No-Go (back-office)

Onglet « Décision » avec 5 axes de scoring et une décision finale `Go / No-Go / À compléter` :

- **Source** : historique vs inconnue, fiabilité fournisseur, qualité des documents, risque de fraude, réputation
- **Documentaire** : dérivé du niveau 2, avec règles bloquantes (facture non conforme, gage/leasing non levé = No-Go)
- **Juridique / financier** : gage, leasing, réserve de propriété, vendeur non propriétaire, facture incohérente
- **Technique** : roulant, accidenté, défaut majeur, hayon non homologué, état général, photos suffisantes, carnet, visite WT effectuée
- **Économique** : prix vs marché, marge estimée, coûts transport, risque réparation, potentiel de revente

Le score et les alertes sont indicatifs ; la décision reste manuelle et tracée (auteur, date, commentaire) dans l'historique.

## Assistance IA

- **Scan documentaire** : l'OCR photo existe déjà (Gemini via passerelle IA). Extension aux PDF et images de documents, extraction élargie (marque, modèle, VIN, immatriculation, année, km, PTAC, type, dimensions, contrôle technique, conformité, carte grise, carnet, docs hayon/grue). Les valeurs extraites restent **proposées à validation** avant d'être écrites dans la fiche (le dialogue de validation existe déjà).
- **Saisie vocale** : enregistrement micro → transcription (speech-to-text via la passerelle IA) → structuration en champs → validation utilisateur. Multilingue : FR, EN, AR, IT, ES, DE, NL, PL, PT.
- **Contrôles IA** : détection d'incohérences entre documents, résumé automatique de l'opportunité, liste des informations manquantes à demander au vendeur.

## Notes techniques

- Migration base : nouvelles colonnes sur `vehicle_opportunities` (empattement, suspension, pneumatiques, dimensions, hayon, grue, climatisation/chauffage, crochet, lien localisation, code clé, raison non-roulant, date validité CT), deux nouvelles tables (`opportunity_documents` pour le niveau 2, `opportunity_decisions` pour le niveau 3) avec GRANTs + RLS (équipe interne en écriture, partenaire en lecture sur ses lignes uniquement pour le niveau 1).
- Fusion Renault : mise à jour `ref_vehicle_brands` / `ref_vehicle_models` + réaffectation des opportunités existantes.
- Nouvelle table `ref_body_types` déjà présente → alimentée avec les listes porteur / semi-remorque.
- Le récapitulatif, les vues admin, la recherche et le moteur de matching sont mis à jour pour tenir compte des nouveaux champs.
- Champs abandonnés : conservés en base (pas de perte de données) mais retirés de l'interface.

## Ordre de livraison proposé

1. Migration base + référentiels (carrosseries, fusion Renault, nouvelles colonnes)
2. Refonte du wizard : ordre, suppressions, nouveaux champs, logique conditionnelle
3. Extension du scan IA (PDF + champs élargis)
4. Saisie vocale multilingue
5. Niveau 2 — dossier de conformité
6. Niveau 3 — grille Go / No-Go + alertes IA
7. Module benchmark prix (dernier, cf. questions)

## Questions avant de démarrer

1. **Unité des dimensions intérieures** : je fige tout en **mm** comme suggéré dans le document — tu confirmes ? pas encore confirmé
2. **Champ TVR** : je ne trouve pas de champ « TVR » dans le formulaire actuel. Il s'agit bien de la TVA récupérable (`TVA récupérable ?`) à supprimer, ou d'autre chose ? no, skip
3. **Année** : je la retire du formulaire, mais elle reste utile pour la recherche et le matching. Je la garde en champ **optionnel non obligatoire** rempli surtout par l'IA — OK ? leave it unless it is repeatitive
4. **Excel / Word en scan IA** : le modèle IA lit les images et PDF nativement, pas les .xlsx/.docx. Je peux les convertir côté serveur avant analyse — c'est un besoin réel, ou les documents arrivent en pratique en PDF/photo ? you can try, maybe they want to push any type of files
5. **Benchmark prix marché** : il n'existe pas de source de données de marché dans l'app aujourd'hui. Je livre d'abord une saisie manuelle (prix estimé marché + écart calculé + « prix attractif ? » + commentaire). L'estimation automatique nécessiterait un accès à une source d'annonces (mobile.de ou équivalent) — tu en as un ? can you compare to [mobile.de](http://mobile.de) without any specific access.
6. **Portée du niveau 3** : la grille Go/No-Go doit-elle être visible par les commerciaux, ou réservée au manager / direction ? par les commerciaux aussi
7. **Le nouveau formulaire s'applique-t-il aussi à la demande acheteur** (`Chercher un véhicule`), ou uniquement à la fiche véhicule vendeur ? let's align them. 