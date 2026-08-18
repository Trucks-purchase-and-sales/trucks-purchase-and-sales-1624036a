# Trucks Purchase and Sales

Build a modern, premium, mobile-first web platform for Wilmet, a company that buys and resells trucks, vans, utility vehicles, and industrial vehicles.

The long-term vision of the platform is to manage a complete vehicle trading workflow in three phases:

1. Proposer — external business providers submit vehicle opportunities.

2. Évaluer — Wilmet commercial teams evaluate whether the vehicle is worth buying.

3. Revendre — accepted vehicles are transformed into marketplace listings for resale.

For this first version, build only Phase 1: the “Apporteur d’Affaires” portal.

The goal of Phase 1 is to allow external partners, suppliers, brokers, fleet owners, garages, transport companies, and field contacts to submit vehicle opportunities to Wilmet in a fast, simple, professional way.

The application should feel trustworthy, efficient, and premium. It should make the user feel that Wilmet is serious, responsive, and easy to work with.

The UI language should be French.

Product name:

Wilmet Opportunités

Core concept:

An apporteur d’affaires can quickly submit a vehicle opportunity from their phone while standing in a vehicle yard, garage, warehouse, parking area, or storage site. They provide vehicle details, upload or take photos, add pricing expectations, and submit the opportunity to Wilmet for review.

The first phase must focus on capturing high-quality vehicle opportunities. Do not build the commercial evaluation dashboard, internal margin calculator, marketplace, or client purchasing portal yet. However, the app architecture and data model should be ready for those future phases.

Design direction:

Create a clean, modern B2B interface with a premium automotive / industrial feel.

Style:

- Professional

- Minimal

- Fast

- Mobile-first

- Trustworthy

- Industrial but elegant

- Clear spacing

- Strong typography

- Smooth onboarding

- Dashboard cards

- Large tap-friendly form fields

- High-quality vehicle photo presentation

Suggested visual identity:

- Main color: deep navy or dark charcoal

- Accent color: Wilmet red or strong orange/red for key CTAs

- Background: light grey / off-white

- Cards: white with subtle shadows

- Status badges: clear and color-coded

- Buttons: bold, confident, easy to tap

- Icons: vehicle, camera, document, status, checkmark, euro, location

Primary users for Phase 1:

1. Apporteur d’affaires

2. Wilmet internal admin, only for basic review visibility in this phase

Main Phase 1 features:

A. Public landing page

Create a polished landing page explaining the concept to potential apporteurs d’affaires.

Purpose:

Convince suppliers and business providers to submit vehicle opportunities to Wilmet.

Landing page sections:

Hero section:

Title:

“Proposez vos véhicules à Wilmet en quelques minutes”

Subtitle:

“Camions, utilitaires, tracteurs, porteurs, semi-remorques ou véhicules spécialisés : transmettez vos opportunités directement depuis votre téléphone. L’équipe Wilmet analyse rapidement votre proposition et revient vers vous.”

Primary CTA:

“Proposer un véhicule”

Secondary CTA:

“Créer mon compte apporteur”

Trust indicators:

- Réponse rapide

- Processus simple

- Suivi transparent

- Spécialiste du négoce véhicules industriels

Section 2: How it works

Title:

“Un parcours simple en 3 étapes”

Step 1:

“Décrivez le véhicule”

Text:

“Renseignez les informations essentielles : marque, modèle, année, kilométrage, état, localisation et prix souhaité.”

Step 2:

“Ajoutez les photos”

Text:

“Prenez des photos directement depuis votre téléphone : extérieur, intérieur, tableau de bord, pneus, carrosserie, documents et défauts éventuels.”

Step 3:

“Envoyez à Wilmet”

Text:

“Votre opportunité est transmise à l’équipe Wilmet pour analyse. Vous pouvez suivre son statut depuis votre espace personnel.”

Section 3: Who can use it

Title:

“Pour qui ?”

Cards:

- Garages

- Transporteurs

- Gestionnaires de flotte

- Loueurs

- Concessionnaires

- Marchands

- Courtiers

- Apporteurs indépendants

Section 4: Vehicle types accepted

Title:

“Types de véhicules recherchés”

Cards:

- Utilitaires légers

- Camions porteurs

- Tracteurs routiers

- Semi-remorques

- Bennes

- Frigorifiques

- Plateaux

- Véhicules spécialisés

- Engins ou matériels roulants, if relevant

Section 5: CTA

Title:

“Vous avez une opportunité ?”

Text:

“Soumettez-la en moins de 5 minutes.”

Button:

“Démarrer maintenant”

B. Authentication

Create authentication for apporteurs d’affaires.

Pages:

- Sign up

- Login

- Forgot password

- Account profile

Sign up fields:

- Prénom

- Nom

- Société

- Email

- Téléphone

- Type d’apporteur:

  - Garage

  - Transporteur

  - Loueur

  - Concessionnaire

  - Courtier

  - Particulier professionnel

  - Autre

- Ville

- Pays

- Password

After sign up, redirect to the apporteur dashboard.

C. Apporteur dashboard

Create a clean dashboard for the apporteur.

Dashboard title:

“Mes opportunités”

Top summary cards:

- Opportunités envoyées

- En cours d’analyse

- Acceptées

- Refusées

Primary CTA:

“+ Proposer un véhicule”

Dashboard list/table:

Show submitted vehicle opportunities as cards on mobile and a table on desktop.

Each opportunity should show:

- Main photo thumbnail

- Vehicle title

- Brand / model

- Year

- Mileage

- Location

- Desired price

- Submission date

- Status

- Last update

Status values:

- Brouillon

- Envoyée

- En cours d’analyse

- Informations demandées

- Acceptée

- Refusée

- Archivée

Status badge colors:

- Brouillon: grey

- Envoyée: blue

- En cours d’analyse: orange

- Informations demandées: purple

- Acceptée: green

- Refusée: red

- Archivée: neutral grey

Filters:

- Status

- Vehicle type

- Brand

- Date submitted

Search:

Search by brand, model, registration number, location, or reference number.

D. Vehicle submission flow

Create a beautiful multi-step form for submitting a vehicle.

The flow must be mobile-first and easy to complete on-site.

Form name:

“Nouvelle opportunité véhicule”

Use a progress indicator:

1. Informations générales

2. Caractéristiques

3. État du véhicule

4. Photos

5. Prix & disponibilité

6. Récapitulatif

Allow saving as draft at any step.

Step 1: Informations générales

Fields:

- Type de véhicule

  - Utilitaire

  - Camion porteur

  - Tracteur routier

  - Semi-remorque

  - Remorque

  - Benne

  - Frigorifique

  - Plateau

  - Fourgon

  - Autre

- Marque

- Modèle

- Version / finition

- Année

- Date de première mise en circulation

- Kilométrage

- Immatriculation, optional

- Numéro de châssis / VIN, optional

- Localisation du véhicule:

  - Ville

  - Code postal

  - Pays

- Le véhicule est-il visible sur parc ?

  - Oui

  - Non

  - Sur rendez-vous

Step 2: Caractéristiques

Fields:

- Énergie:

  - Diesel

  - Essence

  - Électrique

  - Hybride

  - GNV

  - Autre

- Boîte de vitesses:

  - Manuelle

  - Automatique

  - Robotisée

- Puissance, optional

- Norme Euro, optional

- PTAC, optional

- Charge utile, optional

- Configuration essieux, optional

- Cabine:

  - Courte

  - Approfondie

  - Double cabine

  - Cabine couchette

  - Autre

- Équipements principaux, multi-select:

  - Hayon

  - Grue

  - Frigo

  - Benne

  - Attelage

  - GPS

  - Caméra de recul

  - Climatisation

  - Régulateur

  - Suspension pneumatique

  - Autre

Step 3: État du véhicule

Fields:

- État général:

  - Très bon

  - Bon

  - Moyen

  - À réparer

  - Accidenté

- Le véhicule roule-t-il ?

  - Oui

  - Non

  - À vérifier

- Contrôle technique valide ?

  - Oui

  - Non

  - Non applicable

  - À vérifier

- Entretien à jour ?

  - Oui

  - Non

  - Partiellement

  - À vérifier

- Défauts connus, textarea

- Travaux à prévoir, textarea

- Commentaires complémentaires, textarea

Add a useful helper text:

“Soyez précis sur les défauts visibles ou connus. Une description transparente permet à Wilmet de vous répondre plus rapidement.”

Step 4: Photos

This is a key part of the platform. Make it excellent.

Allow photo upload from mobile camera and file picker.

Photo categories:

- Vue avant

- Vue arrière

- Côté gauche

- Côté droit

- Intérieur cabine

- Tableau de bord avec kilométrage visible

- Pneus

- Moteur

- Coffre / caisse / benne / remorque

- Plaque constructeur / VIN

- Défauts visibles

- Documents, optional

Requirements:

- Allow multiple photos

- Show upload progress

- Show photo thumbnails

- Allow reordering photos

- Allow deleting photos

- Mark one photo as “photo principale”

- Add guidance text for each category

- Make the camera/upload experience feel fast and smooth

Add a photo quality checklist:

- Photos nettes

- Véhicule complet visible

- Kilométrage lisible

- Défauts photographiés

- Documents utiles ajoutés si disponibles

Step 5: Prix & disponibilité

Fields:

- Prix souhaité HT

- Prix négociable ?

  - Oui

  - Non

  - À discuter

- Disponibilité:

  - Immédiate

  - Sous 7 jours

  - Sous 30 jours

  - À confirmer

- Le véhicule est-il libre de tout engagement ?

  - Oui

  - Non

  - À confirmer

- Conditions particulières, textarea

- Contact sur place:

  - Nom

  - Téléphone

  - Email, optional

Step 6: Récapitulatif

Show a beautiful summary before submission.

Sections:

- Informations véhicule

- Localisation

- État

- Photos

- Prix

- Contact

Add validation warnings for missing recommended information.

Example:

“Il manque des photos du tableau de bord et du côté droit. Vous pouvez tout de même envoyer l’opportunité, mais un dossier complet accélère l’analyse.”

Final CTA:

“Envoyer à Wilmet”

Secondary CTA:

“Enregistrer en brouillon”

After submission:

Show a success page.

Success message:

“Votre opportunité a bien été transmise à Wilmet.”

Subtext:

“L’équipe Wilmet va analyser les informations fournies. Vous pouvez suivre l’avancement depuis votre tableau de bord.”

Buttons:

- “Voir mes opportunités”

- “Proposer un autre véhicule”

E. Opportunity detail page for apporteur

Create a detailed page where the apporteur can view one submitted vehicle.

Sections:

- Header with vehicle title, status badge, and reference number

- Main vehicle photo gallery

- Key information cards:

  - Type

  - Marque

  - Modèle

  - Année

  - Kilométrage

  - Localisation

  - Prix souhaité

- Full vehicle details

- Condition notes

- Photo gallery

- Submission timeline

Timeline examples:

- Brouillon créé

- Opportunité envoyée

- Analyse Wilmet démarrée

- Informations complémentaires demandées

- Opportunité acceptée

- Opportunité refusée

If status is “Informations demandées”, show a highlighted box:

“Wilmet demande des informations complémentaires.”

Allow the apporteur to add:

- Extra comment

- Additional photos

- Missing documents

F. Basic Wilmet admin view for Phase 1

Create a simple internal admin dashboard for Wilmet to view incoming opportunities.

This is not the full commercial dashboard yet. Do not build profitability calculations or marketplace publishing in Phase 1.

Admin dashboard title:

“Opportunités reçues”

Admin can:

- View all submitted opportunities

- Filter by status

- Search by brand/model/apporteur/location

- Open opportunity details

- Change status

- Add internal note

- Request more information from apporteur

Admin status actions:

- Marquer comme “En cours d’analyse”

- Demander des informations

- Marquer comme “Acceptée”

- Marquer comme “Refusée”

- Archiver

Admin opportunity detail page:

Show:

- Apporteur details

- Vehicle information

- Price expectation

- Photos

- Condition notes

- Submission date

- Internal notes

- Status history

Internal notes:

Only visible to Wilmet admin, not the apporteur.

When requesting more information:

Admin can enter a message such as:

“Merci d’ajouter une photo du tableau de bord avec le kilométrage visible et une photo du côté droit du véhicule.”

This should update the opportunity status to “Informations demandées” and show the message to the apporteur on their opportunity detail page.

G. Data model

Create a clean database structure ready for future phases.

Tables/entities:

1. users

Fields:

- id

- first_name

- last_name

- email

- phone

- role

  - apporteur

  - admin

  - commercial_future

  - client_future

- company_name

- provider_type

- city

- country

- created_at

- updated_at

2. vehicle_opportunities

Fields:

- id

- reference_number

- apporteur_id

- status

- vehicle_type

- brand

- model

- version

- year

- first_registration_date

- mileage

- registration_number

- vin

- city

- postal_code

- country

- visible_on_site

- fuel_type

- gearbox

- power

- euro_standard

- gross_vehicle_weight

- payload

- axle_configuration

- cabin_type

- equipment

- general_condition

- vehicle_runs

- technical_inspection_status

- maintenance_status

- known_defects

- expected_repairs

- additional_comments

- desired_price_excl_tax

- price_negotiable

- availability

- free_of_commitment

- special_conditions

- onsite_contact_name

- onsite_contact_phone

- onsite_contact_email

- submitted_at

- created_at

- updated_at

3. vehicle_photos

Fields:

- id

- vehicle_opportunity_id

- photo_url

- category

- is_main_photo

- sort_order

- created_at

4. opportunity_status_history

Fields:

- id

- vehicle_opportunity_id

- old_status

- new_status

- changed_by_user_id

- message

- created_at

5. internal_notes

Fields:

- id

- vehicle_opportunity_id

- admin_id

- note

- created_at

6. information_requests

Fields:

- id

- vehicle_opportunity_id

- admin_id

- message

- status

  - open

  - answered

  - closed

- created_at

- answered_at

Future-ready entities, but do not build UI for them yet:

- purchase_evaluations

- cost_estimates

- resale_listings

- marketplace_inquiries

- client_quotes

- options_prioritaires

H. User experience requirements

The form must be easy to complete on a smartphone.

Important UX rules:

- Use large inputs

- Use clear labels

- Use helpful placeholder text

- Avoid overwhelming the user

- Save progress automatically where possible

- Show clear validation messages

- Use step-by-step flow instead of one massive form

- Make photo upload prominent

- Allow draft saving

- Make submission confirmation satisfying and professional

Add smart microcopy throughout the form.

Examples:

For mileage:

“Indiquez le kilométrage affiché au compteur.”

For desired price:

“Prix souhaité hors taxes. Wilmet pourra revenir vers vous avec une proposition ajustée.”

For defects:

“Précisez les défauts mécaniques, carrosserie ou équipements manquants.”

For photos:

“Plus le dossier photo est complet, plus l’analyse Wilmet sera rapide.”

I. Reference number

Each submitted opportunity should automatically receive a reference number.

Format:

WIL-OPP-YYYY-0001

Example:

WIL-OPP-2026-0042

Show this reference number:

- On the opportunity detail page

- In the dashboard list

- On the submission success page

- In admin view

J. Notifications, simple version

For Phase 1, implement simple in-app notifications.

Apporteur notifications:

- Opportunity submitted successfully

- Wilmet started analysis

- Wilmet requested more information

- Opportunity accepted

- Opportunity refused

Admin notifications:

- New opportunity submitted

- Apporteur added missing information

- New photos added

K. Empty states

Create polished empty states.

Apporteur dashboard empty state:

Title:

“Aucune opportunité pour le moment”

Text:

“Vous pouvez transmettre votre premier véhicule à Wilmet en quelques minutes.”

Button:

“Proposer un véhicule”

Admin dashboard empty state:

Title:

“Aucune opportunité reçue”

Text:

“Les nouvelles propositions envoyées par les apporteurs apparaîtront ici.”

L. Future phase positioning

The app should visibly feel like Phase 1 of a larger trading platform, but without building later modules yet.

Add a small “À venir” area in the admin interface showing future modules disabled:

- Évaluation commerciale

- Calcul de marge

- Transformation en offre de vente

- Marketplace véhicules

- Demandes clients

- Options prioritaires

These should be visually displayed as locked or inactive cards.

Text:

“Ces modules seront activés dans les prochaines phases.”

M. Navigation

Apporteur navigation:

- Tableau de bord

- Proposer un véhicule

- Mes opportunités

- Mon profil

Admin navigation:

- Opportunités reçues

- Apporteurs

- Notifications

- Modules à venir

- Paramètres

N. Permissions

Apporteur:

- Can create vehicle opportunities

- Can edit drafts

- Can submit opportunities

- Can view only their own opportunities

- Can add information/photos when requested

- Cannot see internal Wilmet notes

- Cannot change status after submission

Admin:

- Can view all opportunities

- Can change statuses

- Can add internal notes

- Can request information

- Can archive opportunities

O. Acceptance criteria

The Phase 1 app is successful if:

1. A new apporteur can create an account.

2. The apporteur can submit a vehicle opportunity through a guided multi-step flow.

3. The apporteur can upload multiple categorized photos.

4. The apporteur can save a draft and continue later.

5. The apporteur can see all submitted opportunities in a dashboard.

6. Each opportunity has a clear status.

7. Wilmet admin can see incoming opportunities.

8. Wilmet admin can change the opportunity status.

9. Wilmet admin can request more information.

10. The apporteur can respond by adding missing information or photos.

11. The app feels polished, premium, and ready to evolve into a full vehicle trading platform.

Important:

Do not overbuild the later marketplace or resale workflow yet. Focus on making the Phase 1 apporteur portal excellent, fast, professional, and impressive.

Tone of the product:

Wilmet is not just collecting forms. Wilmet is building a high-performance vehicle opportunity engine.

The first version should make partners feel:

- “This is easy.”

- “Wilmet is serious.”

- “I can submit opportunities quickly.”

- “I can follow what happens.”

- “This looks like a professional trading platform.”

Build this as a production-quality MVP with clean components, scalable database structure, responsive design, polished UI, and excellent mobile usability.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/452845ef-b656-4272-a382-1de28e2d1f1e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
