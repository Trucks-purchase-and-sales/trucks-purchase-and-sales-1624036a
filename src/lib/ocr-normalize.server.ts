/**
 * Server-side normalisation of AI/OCR detections into the exact codes the
 * vehicle proposal form accepts (enum codes, reference slugs, canonical labels).
 */
import {
  AXLE_CONFIG_OPTIONS, CABIN_OPTIONS, EURO_OPTIONS, FUEL_OPTIONS,
  GEARBOX_OPTIONS, SUSPENSION_OPTIONS,
} from "@/lib/wilmet-constants";

export type RawDetection = { name: string; value: string; confidence: number };
export type NormalizedDetection = {
  name: string;
  /** Canonical value to inject in the form (enum code / ref slug / ref label). */
  value: string;
  /** Human-readable rendering of `value` (may equal `value`). */
  display: string;
  confidence: number;
  /** false when the AI value could not be mapped onto an accepted option. */
  resolved: boolean;
};

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Loose key used to compare brands/models: letters+digits only. */
function tightKey(s: string): string {
  return slugify(s).replace(/\s+/g, "");
}

type Opt = { value: string; label: string };

function matchOption(raw: string, options: Opt[], aliases: Record<string, string> = {}): Opt | null {
  const k = slugify(raw);
  if (!k) return null;
  if (aliases[k]) {
    const target = aliases[k];
    return options.find((o) => o.value === target) ?? null;
  }
  const byValue = options.find((o) => slugify(o.value) === k);
  if (byValue) return byValue;
  const byLabel = options.find((o) => slugify(o.label) === k);
  if (byLabel) return byLabel;
  const tight = k.replace(/\s+/g, "");
  const byTight = options.find(
    (o) => o.value.replace(/[^a-z0-9]/gi, "").toLowerCase() === tight
      || slugify(o.label).replace(/\s+/g, "") === tight,
  );
  return byTight ?? null;
}

const FUEL_ALIASES: Record<string, string> = {
  gazole: "diesel", go: "diesel", gasoil: "diesel", d: "diesel",
  petrol: "essence", gasoline: "essence", benzin: "essence",
  electric: "electrique", ev: "electrique", bev: "electrique",
  hybrid: "hybride", hev: "hybride",
  cng: "gnv", gnc: "gnv", lng: "gnv", gnl: "gnv", gpl: "gnv",
  other: "autre",
};

const GEARBOX_ALIASES: Record<string, string> = {
  manual: "manuelle", mecanique: "manuelle", bvm: "manuelle", m: "manuelle",
  automatic: "automatique", auto: "automatique", bva: "automatique",
  // robotised / semi-auto boxes are treated as automatic (no dedicated option)
  robotisee: "automatique", robotise: "automatique", "semi automatique": "automatique",
  amt: "automatique", opticruise: "automatique", ishift: "automatique",
  "i shift": "automatique", powershift: "automatique",
};

const EURO_ALIASES: Record<string, string> = {
  euro3: "euro_3", eu3: "euro_3", "euro iii": "euro_3", e3: "euro_3", "3": "euro_3",
  euro4: "euro_4", eu4: "euro_4", "euro iv": "euro_4", e4: "euro_4", "4": "euro_4",
  euro5: "euro_5", eu5: "euro_5", "euro v": "euro_5", e5: "euro_5", eev: "euro_5", "5": "euro_5",
  euro6: "euro_6", eu6: "euro_6", "euro vi": "euro_6", e6: "euro_6", "6": "euro_6",
  "euro 6d": "euro_6", "euro 6c": "euro_6", "euro 6e": "euro_6",
  inconnu: "non_precise", unknown: "non_precise", na: "non_precise",
};

const SUSPENSION_ALIASES: Record<string, string> = {
  lames: "lam_lam", lame: "lam_lam", ressorts: "lam_lam", leaf: "lam_lam",
  "lames lames": "lam_lam", "lam lam": "lam_lam", acier: "lam_lam", steel: "lam_lam",
  mixte: "lam_r", "lames air": "lam_r", "lames pneumatique": "lam_r", "lam r": "lam_r",
  "leaf air": "lam_r",
  pneumatique: "r_r", air: "r_r", "air air": "r_r", "r r": "r_r",
  "suspension pneumatique": "r_r", ecas: "r_r", "full air": "r_r",
  hydraulique: "r_r",
};

const CABIN_ALIASES: Record<string, string> = {
  courte: "courte", "cabine courte": "courte", "day cab": "courte", jour: "courte",
  approfondie: "approfondie", "cabine approfondie": "approfondie",
  "double cabine": "double_cabine", "doube cabine": "double_cabine",
  doublecabine: "double_cabine", "crew cab": "double_cabine", equipage: "double_cabine",
  "cabine couchette": "cabine_couchette", couchette: "cabine_couchette",
  sleeper: "cabine_couchette", globetrotter: "cabine_couchette",
};

const AXLE_ALIASES: Record<string, string> = {
  "4 x 2": "4x2", "4x2": "4x2", "42": "4x2",
  "6 x 2": "6x2", "6x2": "6x2", "62": "6x2",
  "6 x 4": "6x4", "6x4": "6x4", "64": "6x4",
  "8 x 4": "8x4", "8x4": "8x4", "84": "8x4",
  "8 x 2": "autre", "10 x 4": "autre",
};

const BODY_ALIASES: Record<string, string> = {
  bache: "bache", bachee: "bache", tarpaulin: "bache", rideaux: "tautliner",
  "rideaux coulissants": "tautliner", tautliner: "tautliner", pl_tautliner: "tautliner",
  van: "fourgon", box: "caisse", "caisse seche": "caisse", "caisse fermee": "caisse",
  refrigere: "frigorifique", frigo: "frigorifique", reefer: "frigorifique",
  tipper: "benne", benne: "benne", ampliroll: "benne_ampliroll",
  "porte conteneur": "porte_conteneur", container: "porte_conteneur",
  flatbed: "plateau", plateau: "plateau", tank: "citerne", citerne: "citerne",
  "porte engins": "porte_engins", "porte voitures": "autre",
};

export type Refs = {
  brands: Array<{ slug: string; label: string }>;
  models: Array<{ brand_slug: string; label: string }>;
  categoryBrands: Array<{ category_slug: string; brand_slug: string }>;
  bodyTypes: Array<{ slug: string; label_fr: string }>;
  countries: Array<{ code: string; name_fr: string; name_en: string }>;
};

const DATE_FIELDS = new Set(["first_registration_date", "inspection_valid_until"]);
const INT_FIELDS = new Set([
  "mileage", "wheelbase_mm", "box_height_mm", "box_width_mm", "box_depth_mm",
]);

function normalizeDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}-01`;
  return null;
}

/**
 * Maps raw detections onto the codes/labels the wizard accepts.
 * Also infers `vehicle_category` from the resolved brand when unambiguous.
 */
export function normalizeDetections(raw: RawDetection[], refs: Refs): NormalizedDetection[] {
  const out: NormalizedDetection[] = [];
  const keep = (d: NormalizedDetection) => { if (!out.some((o) => o.name === d.name)) out.push(d); };

  let resolvedBrandSlug: string | null = null;

  // Resolve brand first so model + category can build on it.
  const brandRaw = raw.find((r) => r.name === "brand");
  if (brandRaw) {
    const k = tightKey(brandRaw.value);
    const hit = refs.brands.find((b) => tightKey(b.label) === k || tightKey(b.slug) === k)
      ?? refs.brands.find((b) => k.length >= 4 && (tightKey(b.label).startsWith(k) || k.startsWith(tightKey(b.label))));
    if (hit) {
      resolvedBrandSlug = hit.slug;
      keep({ name: "brand", value: hit.label, display: hit.label, confidence: brandRaw.confidence, resolved: true });
    } else {
      keep({ name: "brand", value: brandRaw.value, display: brandRaw.value, confidence: brandRaw.confidence, resolved: false });
    }
  }

  if (resolvedBrandSlug) {
    const cats = refs.categoryBrands.filter((cb) => cb.brand_slug === resolvedBrandSlug);
    if (cats.length === 1 && !raw.some((r) => r.name === "vehicle_category")) {
      keep({
        name: "vehicle_category", value: cats[0]!.category_slug, display: cats[0]!.category_slug,
        confidence: 0.6, resolved: true,
      });
    }
  }

  for (const r of raw) {
    if (r.name === "brand") continue;
    const v = String(r.value ?? "").trim();
    if (!v) continue;
    const base = { name: r.name, confidence: r.confidence };

    if (r.name === "model") {
      const k = tightKey(v);
      const pool = resolvedBrandSlug
        ? refs.models.filter((m) => m.brand_slug === resolvedBrandSlug)
        : refs.models;
      const hit = pool.find((m) => tightKey(m.label) === k)
        ?? pool.find((m) => k.length >= 3 && tightKey(m.label).startsWith(k));
      if (hit) keep({ ...base, value: hit.label, display: hit.label, resolved: true });
      else keep({ ...base, value: v, display: v, resolved: false });
      continue;
    }

    if (INT_FIELDS.has(r.name)) {
      const digits = v.replace(/[^\d]/g, "");
      if (!digits) continue;
      keep({ ...base, value: digits, display: digits, resolved: true });
      continue;
    }

    if (DATE_FIELDS.has(r.name)) {
      const d = normalizeDate(v);
      if (d) keep({ ...base, value: d, display: d, resolved: true });
      else keep({ ...base, value: v, display: v, resolved: false });
      continue;
    }

    if (r.name === "country") {
      const k = slugify(v);
      const hit = refs.countries.find((c) => c.code.toLowerCase() === k)
        ?? refs.countries.find((c) => slugify(c.name_fr) === k || slugify(c.name_en) === k)
        ?? refs.countries.find((c) => k.length >= 3 && (slugify(c.name_fr).startsWith(k) || slugify(c.name_en).startsWith(k)));
      if (hit) keep({ ...base, value: hit.code, display: hit.name_fr, resolved: true });
      else keep({ ...base, value: v, display: v, resolved: false });
      continue;
    }

    if (r.name === "body_type") {
      const opts: Opt[] = refs.bodyTypes.map((b) => ({ value: b.slug, label: b.label_fr }));
      const hit = matchOption(v, opts, BODY_ALIASES);
      if (hit) keep({ ...base, value: hit.value, display: hit.label, resolved: true });
      else keep({ ...base, value: v, display: v, resolved: false });
      continue;
    }

    const enumMap: Record<string, { opts: Opt[]; aliases: Record<string, string> }> = {
      fuel_type: { opts: FUEL_OPTIONS, aliases: FUEL_ALIASES },
      gearbox: { opts: GEARBOX_OPTIONS, aliases: GEARBOX_ALIASES },
      euro_standard: { opts: EURO_OPTIONS, aliases: EURO_ALIASES },
      suspension_type: { opts: SUSPENSION_OPTIONS, aliases: SUSPENSION_ALIASES },
      cabin_type: { opts: CABIN_OPTIONS, aliases: CABIN_ALIASES },
      axle_configuration: { opts: AXLE_CONFIG_OPTIONS, aliases: AXLE_ALIASES },
    };
    const cfg = enumMap[r.name];
    if (cfg) {
      const hit = matchOption(v, cfg.opts, cfg.aliases);
      if (hit) keep({ ...base, value: hit.value, display: hit.label, resolved: true });
      else keep({ ...base, value: v, display: v, resolved: false });
      continue;
    }

    // free-text fields
    keep({ ...base, value: v, display: v, resolved: true });
  }

  return out;
}
