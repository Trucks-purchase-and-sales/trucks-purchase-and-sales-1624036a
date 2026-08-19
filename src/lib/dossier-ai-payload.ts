export const DOSSIER_AI_OPPORTUNITY_FIELDS = [
  "vehicle_type",
  "vehicle_category",
  "brand",
  "model",
  "version",
  "year",
  "first_registration_date",
  "mileage",
  "fuel_type",
  "gearbox",
  "power",
  "euro_standard",
  "gross_vehicle_weight",
  "payload",
  "axle_configuration",
  "cabin_type",
  "equipment",
  "general_condition",
  "vehicle_runs",
  "technical_inspection_status",
  "inspection_valid_until",
  "maintenance_status",
  "body_type",
  "wheelbase_mm",
  "suspension_type",
  "tyre_size",
  "box_height_mm",
  "box_width_mm",
  "box_depth_mm",
  "has_service_book",
  "has_air_conditioning",
  "has_heating",
  "has_hydraulic_hook",
  "has_crane",
  "tail_lift_present",
  "tail_lift_homologated",
  "tail_lift_homologation_book",
  "tail_lift_maintenance_book",
  "tail_lift_condition",
  "keys_count",
  "has_accident",
  "has_breakdown",
] as const;

export const DOSSIER_AI_OPPORTUNITY_SELECT = DOSSIER_AI_OPPORTUNITY_FIELDS.join(",");

export const DOSSIER_AI_OCR_FIELDS = [
  "brand",
  "model",
  "version",
  "first_registration_date",
  "mileage",
  "fuel_type",
  "gearbox",
  "power",
  "euro_standard",
  "gross_vehicle_weight",
  "payload",
  "body_type",
  "axle_configuration",
  "cabin_type",
  "wheelbase_mm",
  "suspension_type",
  "tyre_size",
  "box_height_mm",
  "box_width_mm",
  "box_depth_mm",
  "inspection_valid_until",
] as const;

const OCR_FIELD_SET = new Set<string>(DOSSIER_AI_OCR_FIELDS);
const MAX_FIELD_TEXT = 240;
const MAX_ARRAY_ITEMS = 40;

type SafeValue = string | number | boolean | string[];

export type DossierAiDocumentStatus = {
  doc_type: string;
  status: string;
};

export type DossierAiDocumentChecklistItem = {
  value: string;
  label: string;
  required?: boolean;
};

export type DossierAiOcrDetection = {
  field_name: string;
  detected_value: string;
  confidence: number;
  action: string;
};

export type DossierAiPayload = {
  vehicle: Record<string, SafeValue>;
  documents: Array<{
    type: string;
    label: string;
    required: boolean;
    status: string;
  }>;
  ocr: Array<{
    field: string;
    value: string;
    confidence_pct: number;
    action: string;
  }>;
};

function boundedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, MAX_FIELD_TEXT);
}

function safeValue(value: unknown): SafeValue | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return boundedText(value);
  if (Array.isArray(value)) {
    const strings = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => boundedText(item))
      .filter((item): item is string => item !== null);
    return strings.length > 0 ? strings : null;
  }
  return null;
}

/**
 * Deny-by-default projection for data sent to the external dossier AI processor.
 * Unknown/new database columns are excluded automatically because only this
 * explicit allowlist is copied.
 */
export function projectOpportunityForDossierAi(
  opportunity: Record<string, unknown>,
): Record<string, SafeValue> {
  const projected: Record<string, SafeValue> = {};
  for (const field of DOSSIER_AI_OPPORTUNITY_FIELDS) {
    const value = safeValue(opportunity[field]);
    if (value !== null) projected[field] = value;
  }
  return projected;
}

/**
 * Document free-text notes are intentionally not accepted by this contract.
 * The external processor receives only checklist identity/requiredness/status.
 */
export function projectDocumentsForDossierAi(
  checklist: readonly DossierAiDocumentChecklistItem[],
  documents: readonly DossierAiDocumentStatus[],
): DossierAiPayload["documents"] {
  const statusByType = new Map(documents.map((row) => [row.doc_type, row.status]));
  return checklist.map((item) => ({
    type: boundedText(item.value) ?? "unknown",
    label: boundedText(item.label) ?? "Document",
    required: item.required === true,
    status: boundedText(statusByType.get(item.value)) ?? "absent",
  }));
}

/**
 * OCR may contain direct identifiers (VIN, registration, location). Only the
 * technical comparison fields needed for dossier consistency analysis leave
 * Wilmet. Unknown future OCR fields are excluded by default.
 */
export function projectOcrForDossierAi(
  detections: readonly DossierAiOcrDetection[],
): DossierAiPayload["ocr"] {
  return detections.flatMap((detection) => {
    if (!OCR_FIELD_SET.has(detection.field_name)) return [];
    const value = boundedText(detection.detected_value);
    if (!value) return [];
    const confidence = Number.isFinite(detection.confidence)
      ? Math.max(0, Math.min(1, detection.confidence))
      : 0;
    return [{
      field: detection.field_name,
      value,
      confidence_pct: Math.round(confidence * 100),
      action: boundedText(detection.action) ?? "unknown",
    }];
  });
}

export function buildDossierAiPayload(input: {
  opportunity: Record<string, unknown>;
  checklist: readonly DossierAiDocumentChecklistItem[];
  documents: readonly DossierAiDocumentStatus[];
  detections: readonly DossierAiOcrDetection[];
}): DossierAiPayload {
  return {
    vehicle: projectOpportunityForDossierAi(input.opportunity),
    documents: projectDocumentsForDossierAi(input.checklist, input.documents),
    ocr: projectOcrForDossierAi(input.detections),
  };
}

export function serializeDossierAiPayload(payload: DossierAiPayload): string {
  return JSON.stringify(payload, null, 2);
}
