# 01 — Rôles, accès et navigation

## 1. Les rôles du système

| Rôle technique | Nom en formation | Type | Page d'accueil après connexion |
| --- | --- | --- | --- |
| `platform_admin` / `admin` | Administrateur | Interne | `/admin` |
| `company_management` | Direction | Interne | `/direction` |
| `sales_manager` | Manager commercial | Interne | `/manager` |
| `sales_agent` | Commercial | Interne | `/sales` |
| `partenaire` + type « fournisseur » | Partenaire vendeur | Externe | `/dashboard` |
| `partenaire` + type « client » | Client acheteur | Externe | `/mes-demandes` |

Règle absolue : **un utilisateur ne porte qu'un seul rôle**. Un partenaire est soit vendeur, soit acheteur (champ « type de partenaire » sur son profil).

Distinction fondamentale :
- **Employés (internes)** : administrateur, direction, manager, commerciaux. Chaque employé a un **périmètre** : Achat (vendeurs), Vente (acheteurs) ou Les deux. Le périmètre filtre le menu et les listes d'un commercial ; manager et direction voient tout.
- **Partenaires (externes)** : apporteur d'affaire / vendeur (ne voit que ses véhicules et leur avancement) ou client acheteur (ne voit que ses demandes).

La gestion des employés se fait dans **Paramètres > Utilisateurs** (administrateur uniquement) : création, modification du rôle et du périmètre, désactivation/réactivation, réinitialisation de mot de passe, suppression avec transfert des dossiers. Un compte désactivé ne peut plus se connecter.

La redirection après connexion est automatique : l'utilisateur arrive toujours sur son espace, sans avoir à naviguer.


## 2. Menu latéral par rôle

### Administrateur
```text
Accueil       Tableau de bord
Pipeline      Leads vendeurs
              Opportunités offre
              Demandes acheteurs
              Opportunités demande
              Matching IA
Finance       Paiements
              Commissions
Annuaires     Partenaires
Paramètres    Vérifs paiement / Référentiels / Contenu /
              Notifications / Audit / Modules à venir / Général
Compte        Mon profil
```

### Direction
```text
Accueil       Direction (indicateurs)
Pipeline      Leads vendeurs, Opportunités offre, Demandes acheteurs,
              Opportunités demande, Matching IA
Finance       Paiements, Commissions
Compte        Mon profil
```

### Manager commercial
```text
Accueil       Manager
Pipeline      Leads vendeurs, Opportunités offre, Demandes acheteurs,
              Opportunités demande, Matching IA
Finance       Commissions
Annuaires     Partenaires
Compte        Mon profil
```

### Commercial
```text
Accueil       Mon espace
Pipeline      Leads vendeurs, Opportunités offre, Demandes acheteurs,
              Opportunités demande, Mes demandes clients
Compte        Mon profil
```

### Partenaire vendeur
```text
Espace partenaire   Tableau de bord
                    Proposer un véhicule
                    Mes échanges
                    Mes commissions
Compte              Mon profil
```

### Client acheteur
```text
Espace partenaire   Tableau de bord
                    Mes demandes
Compte              Mon profil
```

## 3. Matrice de droits (résumé pédagogique)

| Action | Admin | Direction | Manager | Commercial | Vendeur | Acheteur |
| --- | --- | --- | --- | --- | --- | --- |
| Soumettre un véhicule | — | — | — | — | Oui | — |
| Voir tous les leads / opportunités | Oui | Oui | Oui | Oui | Ses seules fiches | Ses seules demandes |
| Affecter un commercial | Oui | — | Oui | — | — | — |
| Faire avancer le funnel | Oui | — | Oui | Oui (ses dossiers) | — | — |
| Valider le dossier documentaire | Oui | — | Oui | Oui | Fournit les pièces | — |
| Décision Go / No-Go | Oui | Oui | Oui | Propose | — | — |
| Enregistrer un paiement | Oui | Lecture | — | — | — | — |
| Approuver / payer une commission | Oui | Lecture | Approuve | — | Voit ses commissions | — |
| Vérifier un profil de paiement | Oui | — | — | — | Le renseigne | — |
| Référentiels, contenu, audit | Oui | — | — | — | — | — |

## 4. Ce qu'un utilisateur ne voit jamais

- Un partenaire ne voit que ses propres fiches et ses propres échanges.
- Un client acheteur ne voit jamais les coordonnées d'un vendeur, ni l'inverse : Wilmet reste l'intermédiaire.
- Les commerciaux internes n'apparaissent pas dans l'annuaire « Partenaires ».
- Les prix d'achat et les marges ne sont jamais visibles côté partenaire.

## 5. Message de blocage type

Si un utilisateur ouvre une URL réservée à un autre rôle, il est automatiquement renvoyé vers son propre espace. En formation, présenter cela comme un comportement normal et non comme une erreur.
