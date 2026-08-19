import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LOVABLE_AI_BASE_URL } from "@/lib/ai-gateway.server";
import { enforceAiAbuseLimits, throwAiHttpError } from "@/lib/ai-abuse.server";
import {
  AiInputError,
  MAX_OCR_AGGREGATE_DATA_URL_CHARS,
  MAX_OCR_IMAGE_DATA_URL_CHARS,
  validateOcrImageBudgets,
} from "@/lib/ai-input-budgets.server";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";

const OCR_FIELDS = [
  "brand", "model", "version", "vin", "registration_number",
  "first_registration_date", "mileage",
  "fuel_type", "gearbox", "power", "euro_standard",
  "gross_vehicle_weight", "payload",
  "body_type", "axle_configuration", "cabin_type",
  "wheelbase_mm", "suspension_type", "tyre_size",
  "box_height_mm", "box_width_mm", "box_depth_mm",
  "inspection_valid_until", "city", "postal_code", "country",
] as const;
type OcrField = typeof OCR_FIELDS[number];

const INT_FIELDS = new Set<string>([
  "mileage", "wheelbase_mm", "box_height_mm", "box_width_mm", "box_depth_mm",
]);

const InputImage = z.object({
  /** base64 data URL for an approved image/PDF MIME — user-selected local file */
  data_url: z.string().startsWith("data:").max(MAX_OCR_IMAGE_DATA_URL_CHARS),
  /** optional label — plaque / tableau de bord / carte grise / autre */
  hint: z.string().max(40).optional(),
});

const InputDocument = z.object({
  name: z.string().max(200),
  /** plain text extracted client-side from Excel / Word / CSV */
  text: z.string().min(1).max(14000),
});

const RunInput = z.object({
  vehicle_opportunity_id: z.string().uuid().optional(),
  images: z.array(InputImage).max(6).default([]),
  documents: z.array(InputDocument).max(4).default([]),
}).refine((v) => v.images.length + v.documents.length > 0, {
  message: "Ajoutez au moins un fichier",
}).refine(
  (v) => v.images.reduce((sum, image) => sum + image.data_url.length, 0) <= MAX_OCR_AGGREGATE_DATA_URL_CHARS,
  { message: "Volume total des fichiers trop important", path: ["images"] },
);

const SYSTEM_PROMPT = `Tu es un assistant d'extraction documentaire spécialisé dans les véhicules utilitaires et poids-lourds européens.
On te fournit des photos ou des documents (PDF): plaque constructeur, tableau de bord (compteur), carte grise,
certificat de conformité, procès-verbal de contrôle technique, fiche technique ou annonce.
Extrais uniquement les champs pour lesquels tu es raisonnablement certain, avec un score de confiance entre 0 et 1.
Ne devine jamais. Si tu n'es pas sûr, mets confidence < 0.5 ou omets le champ.
Retourne strictement un JSON valide correspondant au schéma demandé.`;

const USER_INSTRUCTION = `Analyse les fichiers fournis et extrais les champs véhicule suivants quand ils sont visibles.
IMPORTANT: pour les champs à liste fermée, réponds EXACTEMENT avec l'un des codes indiqués (minuscules, sans accent).

brand (marque exacte, ex "Mercedes-Benz", "Renault Trucks"), model, version, vin, registration_number,
first_registration_date (YYYY-MM-DD), mileage (entier, km),
fuel_type: diesel | essence | electrique | hybride | gnv | autre
gearbox: manuelle | automatique   (une boîte robotisée/AMT/I-Shift/Opticruise = automatique)
power (ch ou kW en texte),
euro_standard: euro_3 | euro_4 | euro_5 | euro_6 | non_precise
gross_vehicle_weight (kg ou t en texte), payload (kg ou t en texte),
body_type: fourgon | benne | benne_ampliroll | plateau | bache | tautliner | frigorifique | citerne |
porte_engins | porte_conteneur | caisse | savoyarde | betaillere | grue | bdf | malaxeur | bennes_ordures | autre
axle_configuration: 4x2 | 6x2 | 6x4 | 8x4 | autre
cabin_type: courte | approfondie | double_cabine | cabine_couchette | autre
wheelbase_mm (entier, millimètres),
suspension_type: lam_lam (lames/lames) | lam_r (lames/air) | r_r (air/air)
tyre_size (texte, ex 315/70 R22.5),
box_height_mm, box_width_mm, box_depth_mm (entiers, dimensions intérieures en millimètres — convertis les cm/m en mm),
inspection_valid_until (YYYY-MM-DD, fin de validité du contrôle technique),
city, postal_code, country (code ISO 2 lettres, ex FR, BE, DE, NL, ES, IT).
Réponds avec {"fields":[{"name":"brand","value":"Renault Trucks","confidence":0.92}, ...]}.
N'inclus que les champs détectés. Aucune prose, uniquement le JSON.`;

type FieldDetection = { name: OcrField; value: string; confidence: number };

function normalizeValue(name: OcrField, value: string): string {
  const v = value.trim();
  if (name === "vin") return v.toUpperCase().replace(/\s+/g, "");
  if (name === "registration_number") return v.toUpperCase().replace(/\s+/g, "");
  if (INT_FIELDS.has(name)) return v.replace(/[^\d]/g, "");
  return v;
}

async function callGeminiVision(
  apiKey: string,
  images: { data_url: string; hint?: string }[],
  documents: { name: string; text: string }[] = [],
): Promise<FieldDetection[]> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: USER_INSTRUCTION },
  ];
  for (const img of images) {
    if (img.hint) content.push({ type: "text", text: `Photo: ${img.hint}` });
    content.push({ type: "image_url", image_url: { url: img.data_url } });
  }
  for (const doc of documents) {
    content.push({
      type: "text",
      text: `Contenu texte du document "${doc.name}" (extrait d'un fichier Excel/Word/CSV):\n${doc.text}`,
    });
  }

  let res: Response;
  try {
    res = await fetch(`${LOVABLE_AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });
  } catch (error) {
    console.error("[ocr.runOcrScan] gateway call failed", error);
    throwAiHttpError(503, "OCR momentanément indisponible.");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[ocr.runOcrScan] gateway error", res.status, txt.slice(0, 200));
    throwAiHttpError(503, "OCR momentanément indisponible.");
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { fields?: Array<{ name?: string; value?: unknown; confidence?: unknown }> } = {};
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  const out: FieldDetection[] = [];
  const known = new Set<string>(OCR_FIELDS);
  for (const f of parsed.fields ?? []) {
    if (!f?.name || !known.has(f.name)) continue;
    if (f.value === null || f.value === undefined || f.value === "") continue;
    const conf = typeof f.confidence === "number" ? Math.max(0, Math.min(1, f.confidence)) : 0.5;
    out.push({
      name: f.name as OcrField,
      value: normalizeValue(f.name as OcrField, String(f.value)),
      confidence: conf,
    });
  }
  return out;
}

export const runOcrScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RunInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAiFeatureEnabled } = await import("@/lib/ai-features.server");
    await assertAiFeatureEnabled("ocr");
    await enforceAiAbuseLimits("ocr", context.userId);

    try {
      validateOcrImageBudgets(data.images);
    } catch (error) {
      if (error instanceof AiInputError) {
        throwAiHttpError(error.status, error.message);
      }
      throw error;
    }

    const sb = context.supabase as any;
    const userId = context.userId as string;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[ocr.runOcrScan] LOVABLE_API_KEY missing");
      throwAiHttpError(503, "OCR momentanément indisponible.");
    }

    // Create the audit row only after feature, abuse and payload guards pass.
    const { data: scanRow, error: scanErr } = await sb
      .from("ocr_scans")
      .insert({
        uploader_id: userId,
        vehicle_opportunity_id: data.vehicle_opportunity_id ?? null,
        status: "en_cours",
      })
      .select("id")
      .single();
    if (scanErr || !scanRow) {
      console.error("[ocr.runOcrScan.insertScan]", scanErr);
      throw new Error(GENERIC);
    }
    const scanId: string = scanRow.id;

    try {
      const rawDetections = await callGeminiVision(apiKey, data.images, data.documents);

      // Map AI values onto the exact codes/labels the wizard accepts.
      const { normalizeDetections } = await import("@/lib/ocr-normalize.server");
      const [brands, models, categoryBrands, bodyTypes, countries] = await Promise.all([
        sb.from("ref_vehicle_brands").select("slug,label").eq("is_active", true),
        sb.from("ref_vehicle_models").select("brand_slug,label").eq("is_active", true),
        sb.from("ref_category_brands").select("category_slug,brand_slug"),
        sb.from("ref_body_types").select("slug,label_fr").eq("is_active", true),
        sb.from("ref_countries").select("code,name_fr,name_en").eq("is_active", true),
      ]);
      const detections = normalizeDetections(rawDetections, {
        brands: brands.data ?? [],
        models: models.data ?? [],
        categoryBrands: categoryBrands.data ?? [],
        bodyTypes: bodyTypes.data ?? [],
        countries: countries.data ?? [],
      });

      if (detections.length > 0) {
        await sb.from("ocr_field_detections").insert(
          detections.map((d) => ({
            scan_id: scanId,
            field_name: d.name,
            detected_value: d.value,
            confidence: d.confidence,
            action: "pending",
          })),
        );
      }

      await sb.from("ocr_scans").update({
        status: "termine",
        raw_result: { count: detections.length },
      }).eq("id", scanId);

      return { scanId, detections };

    } catch (err) {
      const msg = err instanceof Error ? err.message : "erreur inconnue";
      await sb.from("ocr_scans").update({ status: "echec", error_message: msg.slice(0, 500) }).eq("id", scanId);
      console.error("[ocr.runOcrScan.callGemini]", err);
      throw err instanceof Error ? err : new Error(GENERIC);
    }
  });

const ApplyInput = z.object({
  scan_id: z.string().uuid(),
  applied: z.array(z.object({
    field_name: z.string(),
    final_value: z.string(),
    action: z.enum(["confirmed", "edited", "rejected"]),
  })),
});

export const recordOcrApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApplyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    for (const a of data.applied) {
      await sb.from("ocr_field_detections")
        .update({ final_value: a.final_value, action: a.action })
        .eq("scan_id", data.scan_id)
        .eq("field_name", a.field_name);
    }
    return { ok: true };
  });
