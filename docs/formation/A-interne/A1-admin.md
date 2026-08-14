# A1 — Administrateur

## 1. Rôle et périmètre

L'administrateur est le superviseur de la plateforme. Il voit tout, débloque tout, et est le seul à toucher aux référentiels, au contenu du site public et aux paiements entrants.

Ce qu'il **ne fait pas** : il ne soumet pas de véhicule (rôle réservé aux partenaires vendeurs) et il n'apparaît pas dans la liste des commerciaux affectables.

## 2. Connexion

1. Ouvrir l'application, saisir e-mail et mot de passe.
2. Redirection automatique vers « Tableau de bord » (`/admin`).

## 3. Journée type

### 3.1 Traiter les leads vendeurs (matin)
1. Écran **Pipeline → Leads vendeurs**.
2. Ouvrir chaque fiche « Reçue ».
3. Contrôler la cohérence : marque, modèle, année, kilométrage, prix demandé (en euros), photos.
4. Trois issues possibles :
   - **Demander des informations** : la fiche passe en « Infos demandées », le partenaire reçoit une notification et répond depuis « Mes échanges ».
   - **Disqualifier** : la fiche est archivée avec motif.
   - **Qualifier et affecter un commercial** : la fiche devient une opportunité offre et entre dans le funnel.
5. Résultat attendu : plus aucune fiche « Reçue » de plus de 48 h.

### 3.2 Piloter les opportunités offre
1. Écran **Pipeline → Opportunités offre** (vue Kanban ou liste).
2. Vérifier que chaque opportunité a un commercial et une prochaine action datée.
3. Faire avancer un statut uniquement quand la réalité le justifie (voir `C1-cycle-offre.md`).

### 3.3 Traiter les demandes acheteurs
1. Écran **Pipeline → Demandes acheteurs**.
2. Cliquer sur une ligne pour ouvrir la fiche du lead acheteur.
3. Qualifier → convertir en **Opportunité demande** (référence `WIL-DEM-…`), ou demander des informations, ou rejeter.

### 3.4 Rapprocher offre et demande
Écran **Pipeline → Matching IA** : lancer un matching global, examiner les paires proposées, valider ou écarter, notifier le commercial concerné. Détail dans `C3-matching-ia.md`.

### 3.5 Finance
1. **Finance → Paiements** : enregistrer les encaissements (acompte, solde), suivre les statuts, lier une transaction PayCifi.
2. **Finance → Commissions** : approuver puis marquer payées les commissions partenaires. Un paiement sortant est alors créé automatiquement.

### 3.6 Administration
- **Paramètres → Vérifs paiement** : valider ou rejeter les profils bancaires des partenaires. Un partenaire non vérifié ne peut pas être payé.
- **Paramètres → Référentiels** : marques, modèles, carrosseries, pays. Toute nouvelle valeur ajoutée ici apparaît immédiatement dans le formulaire véhicule.
- **Paramètres → Contenu** : textes du site public.
- **Paramètres → Notifications** : envoi d'annonces aux partenaires.
- **Paramètres → Audit** : journal des actions sensibles, à consulter en cas de litige.

## 4. Points de contrôle imposés à l'admin

| Avant de… | Vérifier que… |
| --- | --- |
| Qualifier un lead | Les champs techniques clés sont renseignés |
| Passer en « Achetée » | Le dossier documentaire est complet et la décision est « GO » |
| Enregistrer un solde | L'acompte est déjà en « Reçu » |
| Payer une commission | Le profil de paiement du partenaire est « Vérifié » |

## 5. Erreurs fréquentes

- Affecter une opportunité à un utilisateur interne non commercial : impossible, la liste ne propose que les commerciaux.
- Modifier une fiche pendant que le partenaire y répond : privilégier le fil « Activité » pour tracer les échanges.
- Faire avancer le funnel sans note d'activité : le dossier devient incompréhensible pour l'équipe.

## 6. Checklist de fin de formation

- [ ] Je sais qualifier, affecter et disqualifier un lead vendeur.
- [ ] Je sais convertir une demande acheteur en opportunité demande.
- [ ] Je sais compléter le dossier documentaire et enregistrer une décision Go/No-Go.
- [ ] Je sais enregistrer un acompte puis un solde et vérifier le total encaissé.
- [ ] Je sais approuver et payer une commission.
- [ ] Je sais vérifier un profil de paiement partenaire.
- [ ] Je sais ajouter une marque ou un modèle dans les référentiels.
