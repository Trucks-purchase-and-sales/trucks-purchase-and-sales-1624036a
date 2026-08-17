// Shared label maps and constants for Wilmet Opportunités (French).

export type OpportunityStatus =
  | "brouillon" | "envoyee" | "en_cours_analyse" | "offre_envoyee" | "en_negociation"
  | "achetee" | "livree" | "refusee" | "archivee";

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  brouillon: "Brouillon",
  envoyee: "Reçue",
  en_cours_analyse: "En traitement",
  offre_envoyee: "Offre envoyée",
  en_negociation: "En négociation",
  achetee: "Achetée",
  livree: "Livrée",
  refusee: "Non aboutie",
  archivee: "Archivée",
};

export const STATUS_STYLE: Record<OpportunityStatus, string> = {
  brouillon: "bg-status-draft text-status-draft-foreground",
  envoyee: "bg-status-sent text-status-sent-foreground",
  en_cours_analyse: "bg-status-analysis text-status-analysis-foreground",
  offre_envoyee: "bg-status-info text-status-info-foreground",
  en_negociation: "bg-status-pending text-status-pending-foreground",
  achetee: "bg-status-accepted text-status-accepted-foreground",
  livree: "bg-status-accepted text-status-accepted-foreground",
  refusee: "bg-status-refused text-status-refused-foreground",
  archivee: "bg-status-archived text-status-archived-foreground",
};

/** Lead-phase statuses: unassigned inbound submissions awaiting triage. */
export const LEAD_STAGES: OpportunityStatus[] = ["envoyee", "en_cours_analyse"];

/** Ordered pipeline stages for the stage bar (once a sales agent owns it). */
export const PIPELINE_STAGES: OpportunityStatus[] = [
  "en_cours_analyse",
  "offre_envoyee",
  "en_negociation",
  "achetee",
  "livree",
];

/**
 * The whole simplified funnel, in order, plus the single lost outcome.
 * Single source of truth for the dashboard stage tiles.
 */
export const FUNNEL_STAGES: OpportunityStatus[] = [
  "envoyee",
  "en_cours_analyse",
  "offre_envoyee",
  "en_negociation",
  "achetee",
  "livree",
  "refusee",
];

export const TERMINAL_STATUSES: OpportunityStatus[] = ["livree", "refusee", "archivee"];


/** True when the record is still in the lead inbox (no sales agent owns it yet). */
export function isLeadPhase(assignedSalesAgentId: string | null | undefined): boolean {
  return !assignedSalesAgentId;
}

export const CLOSED_LOST_REASONS: { value: string; label: string }[] = [
  { value: "prix", label: "Prix trop élevé" },
  { value: "concurrence", label: "Perdue face à un concurrent" },
  { value: "vendu_ailleurs", label: "Véhicule vendu ailleurs" },
  { value: "qualite", label: "Qualité / état insuffisant" },
  { value: "delai", label: "Délais incompatibles" },
  { value: "autre", label: "Autre" },
];

export const VEHICLE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "utilitaire", label: "Utilitaire" },
  { value: "camion_porteur", label: "Camion porteur" },
  { value: "tracteur_routier", label: "Tracteur routier" },
  { value: "semi_remorque", label: "Semi-remorque" },
  { value: "remorque", label: "Remorque" },
  { value: "benne", label: "Benne" },
  { value: "frigorifique", label: "Frigorifique" },
  { value: "plateau", label: "Plateau" },
  { value: "fourgon", label: "Fourgon" },
  { value: "autre", label: "Autre" },
];

export const PROVIDER_TYPE_OPTIONS = [
  { value: "garage", label: "Garage" },
  { value: "transporteur", label: "Transporteur" },
  { value: "loueur", label: "Loueur" },
  { value: "concessionnaire", label: "Concessionnaire" },
  { value: "courtier", label: "Courtier" },
  { value: "particulier_professionnel", label: "Particulier professionnel" },
  { value: "autre", label: "Autre" },
];

export const FUEL_OPTIONS = [
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
  { value: "electrique", label: "Électrique" },
  { value: "hybride", label: "Hybride" },
  { value: "gnv", label: "GNV" },
  { value: "autre", label: "Autre" },
];

export const GEARBOX_OPTIONS = [
  { value: "manuelle", label: "Manuelle" },
  { value: "automatique", label: "Automatique" },
];

export const CABIN_OPTIONS = [
  { value: "courte", label: "Cabine courte" },
  { value: "approfondie", label: "Cabine approfondie" },
  { value: "double_cabine", label: "Double cabine" },
  { value: "cabine_couchette", label: "Cabine couchette" },
  { value: "autre", label: "Autre" },
];

// Only equipments that are not already captured by a dedicated field
// (climatisation, chauffage, attelage hydraulique, grue, hayon, suspension).
export const EQUIPMENT_OPTIONS = [
  "Frigo / groupe froid", "GPS", "Caméra de recul", "Régulateur de vitesse",
];

export const CONDITION_OPTIONS = [
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
];


export const VISIBILITY_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "sur_rendez_vous", label: "Sur rendez-vous" },
];

export const AVAILABILITY_OPTIONS = [
  { value: "immediate", label: "Immédiate" },
  { value: "moins_15_jours", label: "< 15 jours" },
  { value: "15_30_jours", label: "15-30 jours" },
  { value: "plus_30_jours", label: "> 30 jours" },
  { value: "a_confirmer", label: "À confirmer" },
];

export const AXLE_CONFIG_OPTIONS = [
  { value: "4x2", label: "4x2" },
  { value: "6x2", label: "6x2" },
  { value: "6x4", label: "6x4" },
  { value: "8x4", label: "8x4" },
  { value: "autre", label: "Autre" },
];

export const EURO_OPTIONS = [
  { value: "euro_3", label: "Euro 3" },
  { value: "euro_4", label: "Euro 4" },
  { value: "euro_5", label: "Euro 5" },
  { value: "euro_6", label: "Euro 6" },
  { value: "non_precise", label: "Non précisé" },
];

export const VAT_OPTIONS = [
  { value: "oui", label: "Oui, TVA récupérable" },
  { value: "non", label: "Non, TVA non récupérable" },
  { value: "marge", label: "Régime de la marge" },
];

export const MAINTENANCE_HISTORY_OPTIONS = [
  { value: "complet_constructeur", label: "Complet — réseau constructeur" },
  { value: "complet_independant", label: "Complet — garage indépendant" },
  { value: "partiel", label: "Partiel" },
  { value: "aucun", label: "Aucun historique" },
];

export const SUSPENSION_OPTIONS = [
  { value: "lam_lam", label: "LAM-LAM (Lames / Lames)" },
  { value: "lam_r", label: "LAM-R (Lames / Air)" },
  { value: "r_r", label: "R-R (Air / Air)" },
];

export const YES_NO_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export const TAIL_LIFT_CONDITION_OPTIONS = [
  { value: "fonctionnel", label: "Fonctionnel" },
  { value: "a_reviser", label: "À réviser" },
  { value: "hors_service", label: "Hors service" },
];

export const PRICE_ATTRACTIVE_OPTIONS = [
  { value: "tres_attractif", label: "Très attractif" },
  { value: "correct", label: "Correct / marché" },
  { value: "eleve", label: "Élevé" },
  { value: "hors_marche", label: "Hors marché" },
];

/** Level 2 — compliance dossier checklist (back-office only). */
export const DOCUMENT_CHECKLIST: { value: string; label: string; required: boolean }[] = [
  { value: "carte_grise", label: "Carte grise / certificat d'immatriculation", required: true },
  { value: "certificat_conformite", label: "Certificat de conformité", required: true },
  { value: "controle_technique", label: "Procès-verbal de contrôle technique", required: true },
  { value: "certificat_non_gage", label: "Certificat de non-gage / situation administrative", required: true },
  { value: "facture_achat", label: "Facture d'achat / d'origine", required: true },
  { value: "mandat_vente", label: "Mandat de vente signé", required: true },
  { value: "kbis", label: "Kbis / extrait registre du vendeur", required: true },
  { value: "piece_identite", label: "Pièce d'identité du signataire", required: true },
  { value: "carnet_entretien", label: "Carnet d'entretien / factures d'entretien", required: false },
  { value: "homologation_hayon", label: "Homologation hayon / grue (VGP)", required: false },
  { value: "solde_leasing", label: "Attestation de solde leasing / crédit-bail", required: false },
  { value: "mainlevee_gage", label: "Mainlevée de gage", required: false },
];

export const DOCUMENT_STATUS_OPTIONS = [
  { value: "manquant", label: "Manquant" },
  { value: "demande", label: "Demandé" },
  { value: "recu", label: "Reçu" },
  { value: "valide", label: "Validé" },
  { value: "non_applicable", label: "Non applicable" },
];

/** Level 3 — internal Go / No-Go scoring grid (0-5 per criterion). */
export const DECISION_CRITERIA: { key: string; label: string; group: string; hint?: string }[] = [
  { key: "source_fiabilite", label: "Fiabilité de la source", group: "Source", hint: "Historique du partenaire / vendeur." },
  { key: "source_tracabilite", label: "Traçabilité du véhicule", group: "Source", hint: "Propriétaires, provenance, documents." },
  { key: "juridique_gage", label: "Absence de gage / opposition", group: "Juridique & financier" },
  { key: "juridique_leasing", label: "Situation leasing / crédit-bail claire", group: "Juridique & financier" },
  { key: "juridique_documents", label: "Dossier documentaire complet", group: "Juridique & financier" },
  { key: "technique_etat", label: "État technique général", group: "Technique" },
  { key: "technique_travaux", label: "Travaux à prévoir maîtrisés", group: "Technique" },
  { key: "eco_prix", label: "Prix vs benchmark marché", group: "Économique" },
  { key: "eco_marge", label: "Marge estimée", group: "Économique" },
  { key: "eco_liquidite", label: "Liquidité / demande sur le modèle", group: "Économique" },
];

export const DECISION_VERDICTS = [
  { value: "go", label: "GO — on avance" },
  { value: "go_conditionnel", label: "GO conditionnel" },
  { value: "a_creuser", label: "À creuser" },
  { value: "no_go", label: "NO GO" },
];



// EU-27 ISO codes (used to filter ref_countries in partner/public forms).
export const EU27_CODES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE",
  "IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
]);

export const NEGOTIABLE_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  
];

export const TRISTATE_YNV = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export const TRISTATE_YNAV = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "non_applicable", label: "Non applicable" },
];

export const TRISTATE_YNPV = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "partiellement", label: "Partiellement" },
];

export const KEYS_COUNT_OPTIONS = [
  { value: "1", label: "1 clé" },
  { value: "2", label: "2 clés" },
  { value: "3", label: "3 clés" },
  { value: "4", label: "4 clés ou plus" },
];

export const PHOTO_CATEGORIES: {
  value: string; label: string; helper: string;
  /** Always required at final submission. */
  required?: boolean;
  /** Required only for motorised vehicles (a trailer has no dashboard). */
  requiredWhenPowered?: boolean;
  /** Required only when the seller declared defects. */
  requiredWhenDefects?: boolean;
}[] = [
  { value: "vue_avant", label: "Vue avant", helper: "Face avant complète du véhicule.", required: true },
  { value: "vue_arriere", label: "Vue arrière", helper: "Face arrière complète.", required: true },
  { value: "cote_gauche", label: "Côté gauche", helper: "Profil gauche entier.", required: true },
  { value: "cote_droit", label: "Côté droit", helper: "Profil droit entier.", required: true },
  { value: "tableau_de_bord", label: "Tableau de bord avec moteur allumé", helper: "Moteur en marche : kilométrage lisible et absence de voyants de défaut.", requiredWhenPowered: true },
  { value: "plaque_vin", label: "Plaque constructeur / VIN", helper: "Plaque constructeur ou numéro de châssis.", required: true },
  { value: "interieur_cabine", label: "Intérieur cabine", helper: "Sièges, volant, planche de bord." },
  { value: "pneus", label: "Photos de tous les pneus", helper: "État des pneumatiques." },
  { value: "moteur", label: "Moteur", helper: "Compartiment moteur, si accessible." },
  { value: "coffre", label: "Caisse / benne / remorque", helper: "Caisse, benne, plateau, coffre selon le véhicule." },
  { value: "defauts", label: "Défauts visibles", helper: "Chocs, rouille, casses, usures. Obligatoire si vous déclarez des défauts.", requiredWhenDefects: true },
  { value: "documents", label: "Documents (optionnel)", helper: "Carte grise, factures, contrôle technique." },
];

/** Photo categories required whatever the vehicle category. */
export const REQUIRED_PHOTO_CATEGORIES = PHOTO_CATEGORIES.filter((c) => c.required);

/**
 * Category relevance: a semi-remorque / remorque has no engine and no odometer,
 * so engine-specific fields are neither displayed nor required for them.
 * Unknown categories default to "powered" so nothing is ever silently skipped.
 */
export type CategoryProfile = { powered: boolean; hasOdometer: boolean };

const NON_POWERED_CATEGORIES = new Set(["semi_remorque", "remorque", "semi-remorque"]);

export function categoryProfile(slug?: string | null): CategoryProfile {
  if (slug && NON_POWERED_CATEGORIES.has(slug)) {
    return { powered: false, hasOdometer: false };
  }
  return { powered: true, hasOdometer: true };
}

/**
 * Photo categories that block final submission for this particular record.
 * Shared by the wizard and by `submitOpportunity` so both agree.
 */
export function requiredPhotoCategories(
  rec: Record<string, unknown>,
): { value: string; label: string }[] {
  const profile = categoryProfile(rec["vehicle_category"] as string | null | undefined);
  const hasDefects = String(rec["defects_and_comments"] ?? "").trim() !== ""
    || String(rec["known_defects"] ?? "").trim() !== "";
  return PHOTO_CATEGORIES.filter((c) =>
    c.required
    || (c.requiredWhenPowered && profile.powered)
    || (c.requiredWhenDefects && hasDefects),
  ).map(({ value, label }) => ({ value, label }));
}

/**
 * Business minimum enforced at FINAL SUBMISSION only (drafts stay permissive).
 * `step` is the 0-based wizard step the user is sent back to.
 * `appliesTo` scopes a field to the categories where it makes sense.
 */
export const SUBMISSION_REQUIRED_FIELDS: {
  key: string; label: string; step: number; appliesTo?: (p: CategoryProfile) => boolean;
}[] = [
  { key: "vehicle_category", label: "Catégorie de véhicule", step: 0 },
  { key: "brand", label: "Marque", step: 0 },
  { key: "model", label: "Modèle", step: 0 },
  { key: "body_type", label: "Carrosserie", step: 0 },
  { key: "first_registration_date", label: "Date de 1re mise en circulation", step: 0 },
  { key: "mileage", label: "Kilométrage", step: 0, appliesTo: (p) => p.hasOdometer },
  { key: "vin", label: "Numéro de châssis / VIN", step: 0 },
  { key: "city", label: "Ville", step: 0 },
  { key: "country", label: "Pays", step: 0 },
  { key: "visible_on_site", label: "Visibilité du véhicule sur parc", step: 0 },
  { key: "fuel_type", label: "Énergie", step: 1, appliesTo: (p) => p.powered },
  { key: "gross_vehicle_weight", label: "PTAC", step: 1 },
  { key: "general_condition", label: "État général", step: 2 },
  { key: "vehicle_runs", label: "Véhicule roulant", step: 2, appliesTo: (p) => p.powered },
  { key: "desired_price_excl_tax", label: "Prix souhaité HT", step: 4 },
  { key: "price_negotiable", label: "Prix négociable", step: 4 },
  { key: "availability", label: "Disponibilité", step: 4 },
  { key: "onsite_contact_name", label: "Nom du contact sur place", step: 4 },
  { key: "onsite_contact_phone", label: "Téléphone du contact sur place", step: 4 },
];

/** Returns the labels of the missing required fields for a candidate record. */
export function missingSubmissionFields(
  rec: Record<string, unknown>,
): { key: string; label: string; step: number }[] {
  const profile = categoryProfile(rec["vehicle_category"] as string | null | undefined);
  const missing = SUBMISSION_REQUIRED_FIELDS.filter((f) => {
    if (f.appliesTo && !f.appliesTo(profile)) return false;
    const v = rec[f.key];
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    return false;
  }).map(({ key, label, step }) => ({ key, label, step }));
  if (rec["body_type"] === "autre" && !String(rec["body_type_other"] ?? "").trim()) {
    missing.push({ key: "body_type_other", label: "Précision carrosserie « Autre »", step: 0 });
  }
  const price = Number(rec["desired_price_excl_tax"] ?? 0);
  if (!missing.some((m) => m.key === "desired_price_excl_tax") && !(price > 0)) {
    missing.push({ key: "desired_price_excl_tax", label: "Prix souhaité HT (supérieur à 0 €)", step: 4 });
  }
  return missing;
}




export function formatPrice(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function labelFor(list: { value: string; label: string }[], v: string | null | undefined) {
  if (!v) return "—";
  return list.find((o) => o.value === v)?.label ?? v;
}
