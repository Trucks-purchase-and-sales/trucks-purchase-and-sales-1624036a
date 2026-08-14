# Liens d'affiliation — apport d'affaires tracé

Chaque commercial (interne ou externe) et chaque partenaire vendeur reçoit un lien personnel. Toute demande ou offre arrivée via ce lien est créditée à son auteur, et sert à l'affectation automatique.

## Principe

```text
Lien: https://wilmet.prisk.app/?ref=CHAFIK-7K2
        |
        v
 clic enregistré  ->  code mémorisé dans le navigateur (90 jours)
        |
        +-- Demande acheteur (formulaire public)  -> lead crédité au référent
        +-- Création de compte via le lien        -> compte rattaché au référent
        +-- Véhicule proposé par ce compte        -> offre créditée au référent
```

## Règles d'affectation (selon votre choix)

- Référent = commercial interne ou externe → le lead lui est affecté directement (propriétaire du dossier) et le crédit d'apport est enregistré.
- Référent = partenaire vendeur → le lead reste au groupe commercial Wilmet ; seul le crédit d'apport est enregistré (le partenaire ne voit pas le dossier des autres).
- Sans lien : comportement actuel inchangé (groupe commercial Wilmet).
- Le crédit reste attaché au dossier pendant tout son cycle de vie, même si un manager réaffecte le dossier.

## Le lien

- Format court : `?ref=CODE` ajouté à n'importe quelle page publique (accueil, catalogue, formulaire de recherche).
- Code généré automatiquement à partir du prénom + suffixe aléatoire (ex. `CHAFIK-7K2`), unique, révocable.
- Page « Mon lien d'affiliation » : lien complet, bouton copier, QR code, et variantes prêtes à l'emploi (accueil, page « Chercher un véhicule », catalogue).
- Admin : peut générer, désactiver ou régénérer le lien de n'importe qui.

## Statistiques

- Pour chaque référent : clics, comptes créés, demandes acheteurs, offres véhicules, dossiers gagnés, taux de conversion.
- Vue personnelle (chacun voit ses chiffres) et vue admin (classement de tous les référents, filtrable par période).
- Le crédit d'apport apparaît aussi sur la fiche du lead/opportunité : « Apporté par : … ».

## Détails techniques

Base de données :
- `affiliate_links` : `owner_id`, `code` unique, `is_active`, compteurs, horodatages. Lecture publique limitée au strict nécessaire (résolution du code), lecture complète pour le propriétaire et les admins.
- `affiliate_clicks` : `link_id`, `landing_path`, `referer`, `locale`, horodatage (pas d'IP en clair — empreinte hachée pour anti-spam).
- Colonnes ajoutées : `referred_by` (+ `referral_code`) sur `buyer_leads`, `vehicle_opportunities` et `profiles`.
- Vue/fonction d'agrégation pour les statistiques par référent.
- Génération des liens pour tous les comptes existants (employés, externes, partenaires) dans la même migration.

Front / serveur :
- Capture du paramètre `ref` dans `PublicShell` : enregistrement du clic via un endpoint public, puis stockage local 90 jours.
- Endpoint public d'enregistrement de clic + résolution de code (limité en débit, réutilise `rate-limit.server`).
- `POST /api/public/buyer-leads` accepte `ref` : résout le code côté serveur, remplit `referred_by`, et applique la règle d'affectation ci-dessus.
- Inscription (`/auth`) : transmet `ref` pour rattacher le profil au référent.
- Soumission d'un véhicule : reprend le `referred_by` du profil du partenaire.
- Nouvelles pages : « Mon lien » (tous rôles concernés) et « Affiliation » côté admin avec le classement.
