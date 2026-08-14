# Retirer la brique paiement + interrupteur IA dans les réglages

## 1. Ce qui est retiré

Toute la mécanique qui **exécute** un paiement disparaît. Ce qui sert seulement à **suivre l'avancement** reste.

Supprimé :
- **PayCifi** en entier : portefeuille dans le profil, bloc de paiement sur l'opportunité, client API, chiffrement des jetons, mocks, types, erreurs.
- **Moyens de paiement partenaire** (SEPA / SWIFT) : section dans le profil, écran admin « Vérifs paiement » et son workflow de validation.
- **Écran « Paiements » (/admin/finance)** et le panneau d'enregistrement de paiements sur l'opportunité (créer un acompte, marquer reçu, annuler, supprimer).
- Les entrées de menu correspondantes (Finance › Paiements, Réglages › Vérifs paiement) et les étapes d'onboarding qui demandaient d'ajouter un moyen de paiement.

Conservé (lecture seule / suivi) :
- Les étapes du pipeline : Achetée → Paiement en attente → Paiement reçu → Livraison → Gagnée, avec leurs dates, pilotées comme aujourd'hui par le changement de statut.
- Le module **Commissions** (calcul, statut brouillon/validée/payée, « Mes commissions ») — c'est du suivi, pas de l'encaissement. Seul son rattachement à un paiement PayCifi est retiré.

## 2. Base de données

Tables supprimées : `paycifi_sessions`, `paycifi_agreement_links`, `partner_payment_methods`, `opportunity_payments`, ainsi que les types associés devenus inutiles. Les colonnes de suivi sur l'opportunité (paiement reçu, livraison, prix d'achat) sont conservées.

Le lien commission → paiement est supprimé ; le statut de la commission reste géré à la main par l'admin.

## 3. Interrupteur « Assistance IA »

Ajout d'un réglage global dans **Réglages** (admin uniquement) : un interrupteur maître **Assistance IA dans les formulaires**, avec trois sous-interrupteurs pour affiner :
- Pré-remplissage IA par photo/document (OCR)
- Dictée vocale
- Audit IA du dossier

Quand un élément est désactivé :
- le bouton/bandeau correspondant n'apparaît plus dans le formulaire de proposition ni sur la fiche opportunité ;
- la fonction serveur refuse aussi l'appel (« Fonction désactivée par l'administrateur »), pour que la désactivation soit réelle et pas seulement visuelle.

Valeur par défaut : OCR **désactivé** (puisqu'il ne fonctionne pas correctement aujourd'hui), dictée et audit activés — modifiable à tout moment.

## Détails techniques

- Migration : `DROP TABLE ... CASCADE` sur les 4 tables ci-dessus, retrait de la colonne `payout_payment_id` sur `opportunity_commissions`, suppression des enums `payment_channel`, `payment_direction`, `payment_kind`, `payment_status`, `payment_method_kind`, `payment_method_status`, `paycifi_subject_type` (l'enum `payment_method` utilisé sur `vehicle_opportunities` / `buyer_leads` est conservé, c'est une préférence déclarative).
- Fichiers supprimés : `src/lib/paycifi/*`, `src/lib/paycifi.functions.ts`, `src/lib/payment-methods.functions.ts`, `src/lib/payments.functions.ts`, `src/components/paycifi/*`, `src/components/payment-methods/PaymentMethodsSection.tsx`, `src/components/finance/PaymentsPanel.tsx`, `src/routes/_authenticated/admin.payment-methods.tsx`, `src/routes/_authenticated/admin.finance.tsx`.
- Nettoyage des imports/usages dans `profile.tsx`, `admin.opportunities.$id.tsx`, `admin.tsx`, `AppSidebar.tsx`, `onboarding.functions.ts`, `admin.functions.ts`, `confidentialite.tsx` (mention PayCifi), et des secrets/env PayCifi devenus inutiles.
- `app-settings.functions.ts` : nouvelle clé `ai_features` `{ enabled, ocr, voice, dossier_audit }` avec valeurs par défaut, exposée en lecture publique comme les autres réglages ; garde côté serveur dans `ocr.functions.ts`, `voice.functions.ts`, `dossier-ai.functions.ts`.
- UI : nouvelle carte dans `admin.settings.tsx` ; conditionnement de `OcrPrefillDialog`, `VoiceDictation` et `DossierAuditPanel` sur ces réglages.
- Vérification finale : typecheck, puis parcours navigateur du formulaire de proposition et d'une fiche opportunité pour confirmer qu'aucun bloc paiement ne subsiste et que l'interrupteur IA masque bien les fonctions.
