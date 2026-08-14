// Server-only helpers for the AI matching engine.
// Never import from browser code.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;
export const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

// ---------- Types ----------
export type Weights = {
  attributes: number;
  geography: number;
  commercial: number;
  price: number;
  freeform: number;
};

export type HardFilters = {
  require_vehicle_type: boolean;
  require_brand: boolean;
  year_tolerance: number;
  price_tolerance_pct: number;
};

export type Source = {
  kind: "buyer_lead" | "opportunity" | "resale_listing";
  id: string;
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  fuel_type?: string | null;
  gearbox?: string | null;
  euro_standard?: string | null;
  country?: string | null;
  city?: string | null;
  price?: number | null;
  equipment?: string[] | null;
  freeform?: string | null;
  embedding?: number[] | null;
  // buyer-lead specifics
  min_year?: number | null;
  max_mileage?: number | null;
  max_budget_ht?: number | null;
};

// ---------- Embeddings ----------
export async function embedText(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(`${LOVABLE_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`embed failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

function cosine(a: number[] | null | undefined, b: number[] | null | undefined) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))));
}

// ---------- Deterministic scoring ----------
function norm(s?: string | null) {
  return (s ?? "").toLowerCase().trim();
}

export function attributeScore(src: Source, tgt: Source): number {
  let hits = 0, total = 0;
  const cmp = (a?: string | null, b?: string | null) => {
    total++;
    if (norm(a) && norm(a) === norm(b)) hits++;
  };
  cmp(src.vehicle_type, tgt.vehicle_type);
  cmp(src.brand, tgt.brand);
  cmp(src.model, tgt.model);
  cmp(src.fuel_type, tgt.fuel_type);
  cmp(src.gearbox, tgt.gearbox);
  cmp(src.euro_standard, tgt.euro_standard);
  // year proximity
  total++;
  const yA = src.year ?? src.min_year;
  const yB = tgt.year;
  if (yA && yB) {
    const diff = Math.abs(yA - yB);
    hits += diff === 0 ? 1 : diff <= 1 ? 0.85 : diff <= 3 ? 0.6 : diff <= 5 ? 0.3 : 0;
  }
  // equipment overlap
  const se = src.equipment ?? [];
  const te = tgt.equipment ?? [];
  if (se.length && te.length) {
    total++;
    const inter = se.filter((e) => te.map(norm).includes(norm(e))).length;
    hits += inter / Math.max(se.length, te.length);
  }
  return total ? hits / total : 0;
}

export function geographyScore(src: Source, tgt: Source): number {
  if (!src.country || !tgt.country) return 0.3;
  if (norm(src.country) === norm(tgt.country)) {
    if (src.city && tgt.city && norm(src.city) === norm(tgt.city)) return 1;
    return 0.75;
  }
  return 0.4; // both in EU catalog anyway
}

export function priceScore(src: Source, tgt: Source, tolerancePct: number): number {
  const budget = src.price ?? src.max_budget_ht;
  const ask = tgt.price;
  if (!budget || !ask) return 0.5;
  if (ask <= budget) return 1;
  const overrun = (ask - budget) / budget;
  if (overrun <= tolerancePct / 100) return 1 - overrun / (tolerancePct / 100) * 0.5;
  return Math.max(0, 0.5 - overrun);
}

export function commercialScore(tgt: {
  quality_score?: string | null;
  availability?: string | null;
  updated_at?: string | null;
  partner_confirmed_matches?: number | null;
}): number {
  let s = 0.5;
  const q = norm(tgt.quality_score);
  if (q === "excellent") s += 0.25;
  else if (q === "bon") s += 0.15;
  else if (q === "correct") s += 0.05;
  if (tgt.availability && norm(tgt.availability).includes("immediate")) s += 0.1;
  if (tgt.updated_at) {
    const ageDays = (Date.now() - new Date(tgt.updated_at).getTime()) / 86_400_000;
    if (ageDays < 7) s += 0.1;
    else if (ageDays > 90) s -= 0.1;
  }
  if ((tgt.partner_confirmed_matches ?? 0) > 3) s += 0.05;
  return Math.max(0, Math.min(1, s));
}

export function freeformScore(src: Source, tgt: Source): number {
  return cosine(src.embedding, tgt.embedding);
}

export function passesHardFilters(src: Source, tgt: Source, hf: HardFilters): boolean {
  if (hf.require_vehicle_type && norm(src.vehicle_type) && norm(src.vehicle_type) !== norm(tgt.vehicle_type)) return false;
  if (hf.require_brand && norm(src.brand) && norm(src.brand) !== norm(tgt.brand)) return false;
  const yA = src.year ?? src.min_year;
  if (yA && tgt.year && Math.abs(yA - tgt.year) > (hf.year_tolerance ?? 5) * 3) return false;
  return true;
}

export function ruleScore(src: Source, tgt: Source, w: Weights, hf: HardFilters) {
  const attributes = attributeScore(src, tgt);
  const geography = geographyScore(src, tgt);
  const price = priceScore(src, tgt, hf.price_tolerance_pct ?? 20);
  const commercial = commercialScore(tgt as never);
  const freeform = freeformScore(src, tgt);
  const total = w.attributes + w.geography + w.commercial + w.price + w.freeform || 1;
  const score =
    (attributes * w.attributes +
      geography * w.geography +
      commercial * w.commercial +
      price * w.price +
      freeform * w.freeform) /
    total;
  return {
    score: Math.round(score * 100),
    breakdown: {
      attributes: Math.round(attributes * 100),
      geography: Math.round(geography * 100),
      commercial: Math.round(commercial * 100),
      price: Math.round(price * 100),
      freeform: Math.round(freeform * 100),
    },
  };
}

// ---------- AI ranking ----------
const AiMatchSchema = z.object({
  matches: z.array(
    z.object({
      target_id: z.string(),
      ai_score: z.number(),
      verdict: z.enum(["strong", "good", "weak"]),
      rationale: z.string(),
      criteria: z.object({
        attributes: z.number(),
        geography: z.number(),
        commercial: z.number(),
        price: z.number(),
        freeform: z.number(),
      }),
    }),
  ),
});

export type AiMatchResult = z.infer<typeof AiMatchSchema>["matches"][number];

export async function aiRank(params: {
  modelId: string;
  source: Source;
  candidates: Array<Source & { rule_score: number }>;
  weights: Weights;
}): Promise<{ matches: AiMatchResult[]; usage: { promptTokens?: number; completionTokens?: number } }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: LOVABLE_BASE,
    supportsStructuredOutputs: params.modelId.startsWith("openai/"),
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  const compact = (s: Source & { rule_score?: number }) => ({
    id: s.id,
    kind: s.kind,
    vehicle_type: s.vehicle_type,
    brand: s.brand,
    model: s.model,
    year: s.year ?? s.min_year,
    mileage: s.mileage ?? s.max_mileage,
    fuel_type: s.fuel_type,
    gearbox: s.gearbox,
    euro_standard: s.euro_standard,
    country: s.country,
    city: s.city,
    price: s.price ?? s.max_budget_ht,
    equipment: s.equipment,
    notes: (s.freeform ?? "").slice(0, 400),
    rule_score: s.rule_score,
  });

  const prompt = [
    "Tu es l'assistant de matching de Wilmet, courtier européen de camions d'occasion.",
    "Compare une source (demande client OU offre partenaire) à une liste de candidats et classe-les.",
    "Pour chaque candidat, retourne un score 0-100 (ai_score), un verdict (strong ≥ 80, good ≥ 60, weak sinon),",
    "une justification en français (2 phrases max), et un breakdown par critère (0-100).",
    "Respecte les poids admin fournis. Sois strict : refuse un match si le type de véhicule ou la marque ne correspondent pas.",
    "",
    `Poids: ${JSON.stringify(params.weights)}`,
    `Source: ${JSON.stringify(compact(params.source))}`,
    `Candidats (${params.candidates.length}):`,
    JSON.stringify(params.candidates.map(compact)),
  ].join("\n");

  try {
    const { output, usage } = await generateText({
      model: provider(params.modelId),
      output: Output.object({ schema: AiMatchSchema }),
      prompt,
    });
    return {
      matches: output.matches,
      usage: {
        promptTokens: (usage as unknown as { inputTokens?: number }).inputTokens,
        completionTokens: (usage as unknown as { outputTokens?: number }).outputTokens,
      },
    };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      try {
        const parsed = JSON.parse(err.text ?? "{}");
        return { matches: AiMatchSchema.parse(parsed).matches, usage: {} };
      } catch {
        return { matches: [], usage: {} };
      }
    }
    throw err;
  }
}

// ---------- Text builders for embeddings ----------
export function buyerLeadEmbeddingText(l: Record<string, unknown>): string {
  return [
    l.vehicle_type, l.body_type, l.preferred_brand, l.preferred_model,
    l.intended_use, l.usage_country, l.min_euro_norm, l.fuel_type, l.gearbox,
    Array.isArray(l.required_equipment) ? (l.required_equipment as string[]).join(", ") : null,
    Array.isArray(l.wanted_equipment) ? (l.wanted_equipment as string[]).join(", ") : null,
    l.message,
  ].filter(Boolean).join(" | ");
}

export function opportunityEmbeddingText(o: Record<string, unknown>): string {
  return [
    o.vehicle_type, o.brand, o.model, o.version, o.year, o.fuel_type, o.gearbox,
    o.euro_standard, o.axle_configuration, o.cabin_type,
    Array.isArray(o.equipment) ? (o.equipment as string[]).join(", ") : null,
    o.general_condition, o.known_defects, o.expected_repairs, o.additional_comments, o.defects_and_comments,
    o.city, o.country,
  ].filter(Boolean).join(" | ");
}
