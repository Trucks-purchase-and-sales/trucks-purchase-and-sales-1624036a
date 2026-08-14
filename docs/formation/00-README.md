# Manuel de formation — Wilmet Trucks

Documentation complète des parcours utilisateurs de l'application, destinée à la construction d'un support de formation interne et à la formation des partenaires vendeurs et des clients acheteurs.

## Sommaire

| Fichier | Contenu |
| --- | --- |
| `01-roles-et-acces.md` | Matrice des rôles, menus visibles, droits |
| `A-interne/A1-admin.md` | Administrateur / platform_admin |
| `A-interne/A2-direction.md` | Direction |
| `A-interne/A3-manager.md` | Manager commercial |
| `A-interne/A4-commercial.md` | Commercial |
| `B-externe/B1-partenaire-vendeur.md` | Partenaire apporteur / fournisseur |
| `B-externe/B2-client-acheteur.md` | Client acheteur |
| `C-processus/C1-cycle-offre.md` | Lead vendeur → opportunité offre → livraison |
| `C-processus/C2-cycle-demande.md` | Demande acheteur → opportunité demande |
| `C-processus/C3-matching-ia.md` | Matching IA |
| `C-processus/C4-dossier-et-decision.md` | Dossier conformité, contrôles IA, Go/No-Go |
| `C-processus/C5-paiements-commissions.md` | Paiements, PayCifi, commissions |

## Conventions de lecture

- **Écran** : nom du menu tel qu'il apparaît dans la barre latérale gauche.
- **Action** : bouton ou champ à utiliser.
- **Résultat** : ce que l'utilisateur doit constater (statut, notification, e-mail).
- Les libellés entre guillemets sont exactement ceux de l'interface (français).

## Glossaire

| Terme | Définition |
| --- | --- |
| **Lead vendeur** | Véhicule soumis par un partenaire, pas encore affecté à un commercial. Reste dans « Leads vendeurs ». |
| **Opportunité offre** | Lead vendeur qualifié et affecté à un commercial : il entre dans le funnel commercial. |
| **Demande acheteur** | Formulaire public rempli par un client cherchant un véhicule. |
| **Opportunité demande** | Demande acheteur qualifiée et convertie, suivie dans son propre pipeline. |
| **Dossier** | Ensemble des pièces justificatives d'un véhicule (carte grise, non-gage, etc.). |
| **Go / No-Go** | Grille de scoring interne validant l'achat d'un véhicule. |
| **Matching IA** | Moteur de rapprochement automatique entre offres et demandes. |
| **PayCifi** | Prestataire de paiement sécurisé (séquestre) utilisé pour acompte et solde. |
| **Partenaire** | Compte externe : soit vendeur/apporteur, soit client acheteur (jamais les deux). |

## Règles structurantes à rappeler en formation

1. **Un compte = un seul rôle.** Un administrateur n'est pas partenaire, un vendeur n'est pas acheteur.
2. **Le funnel commercial ne démarre qu'après affectation** à un commercial. Avant cela, on parle de lead.
3. **Aucun achat sans dossier documentaire complet et sans décision Go**.
4. **Aucun paiement sortant vers un partenaire sans profil de paiement vérifié**.
5. Toute action sensible est tracée (historique de statuts, journal d'audit).
