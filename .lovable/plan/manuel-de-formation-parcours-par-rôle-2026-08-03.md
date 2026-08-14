# Manuel de formation — parcours par rôle

Objectif : produire la documentation complète des flux de l'application, en français, sous forme de fichiers Markdown versionnés dans le projet. Aucune modification du code applicatif.

## Livrables

```text
docs/formation/
  00-README.md                  Sommaire, glossaire, conventions
  01-roles-et-acces.md          Matrice rôles / sections / droits
  A-interne/
    A1-admin.md                 Administrateur / platform_admin
    A2-direction.md             Direction (company_management)
    A3-manager.md               Manager commercial
    A4-commercial.md            Commercial (sales_agent)
  B-externe/
    B1-partenaire-vendeur.md    Apporteur / fournisseur
    B2-client-acheteur.md       Client acheteur
  C-processus/
    C1-cycle-offre.md           Lead vendeur → opportunité offre → achat/vente
    C2-cycle-demande.md         Demande acheteur → opportunité demande
    C3-matching-ia.md           Matching IA, scores, consoles
    C4-dossier-et-decision.md   Checklist documents, contrôles IA, Go/No-Go
    C5-paiements-commissions.md Acompte, solde, PayCifi, commissions
```

## Contenu de chaque guide de rôle

Structure identique pour chaque rôle, afin de faciliter le découpage en modules de formation :

1. Qui est ce rôle et ce qu'il peut / ne peut pas faire (règle : un seul rôle par compte).
2. Connexion et page d'accueil par défaut (redirection selon rôle).
3. Menu latéral visible pour ce rôle, section par section.
4. Parcours quotidiens, décrits pas à pas (écran → action → résultat attendu → qui est notifié).
5. Statuts et transitions autorisées, avec diagramme ASCII.
6. Erreurs fréquentes et messages de blocage (droits, dossier incomplet, champs obligatoires).
7. Checklist de fin de formation pour le rôle.

## Partie A — équipe interne

- **Admin** : tableau de bord, leads vendeurs, opportunités offre, demandes acheteurs, opportunités demande, matching IA, paiements, commissions, annuaire partenaires, paramètres (vérifs paiement, référentiels, contenu, notifications, audit, général).
- **Direction** : vue pilotage, paiements, commissions, indicateurs.
- **Manager** : affectation des opportunités aux commerciaux, suivi d'équipe, commissions, partenaires, matching IA.
- **Commercial** : mon espace, mes demandes clients, qualification, avancement du funnel, saisie dossier.

## Partie B — partenaires externes

- **Partenaire vendeur** : création de compte, profil de paiement (SEPA / SWIFT / PayCifi) et vérification, formulaire « Proposer un véhicule » (étapes, champs techniques, photos, scan IA de documents PDF/photo/Excel, dictée vocale), suivi des échanges, commissions et paiements.
- **Client acheteur** : formulaire public de recherche de véhicule, création de la demande, échanges avec le commercial, réception des propositions, décision et paiement.

## Partie C — processus transverses

Chaque processus est décrit avec les statuts réels utilisés dans l'app (nouvelle, qualifiée, en recherche, proposition envoyée, négociation, gagnée, perdue, archivée pour la demande ; funnel offre côté vendeur), les rôles responsables à chaque étape et les points de contrôle (dossier complet, Go/No-Go, acompte reçu).

## Méthode

Les flux seront extraits du code existant (routes, garde-fous par rôle, statuts en base, fonctions serveur) pour que le manuel décrive le comportement réel, et non une version idéalisée. Les diagrammes seront en texte brut, donc facilement repris dans un support de formation.
