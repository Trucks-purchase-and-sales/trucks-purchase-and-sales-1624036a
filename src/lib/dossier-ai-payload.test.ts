import { describe, expect, test } from "bun:test";
import {
  buildDossierAiPayload,
  DOSSIER_AI_OPPORTUNITY_SELECT,
  DOSSIER_AI_OCR_FIELDS,
  serializeDossierAiPayload,
} from "./dossier-ai-payload";

const checklist = [
  { value: "registration_certificate", label: "Carte grise", required: true },
  { value: "technical_inspection", label: "Contrôle technique", required: true },
] as const;

describe("dossier AI minimization contract", () => {
  test("includes approved technical fields and excludes identifiers, workflow and finance fields", () => {
    const payload = buildDossierAiPayload({
      opportunity: {
        brand: "Renault Trucks",
        model: "T 480",
        year: 2022,
        mileage: 345000,
        euro_standard: "euro_6",
        gross_vehicle_weight: "19 t",
        equipment: ["climatisation", "hayon"],
        general_condition: "bon",
        inspection_valid_until: "2026-12-15",

        id: "OPPORTUNITY-ID-SECRET",
        reference_number: "REFERENCE-SECRET",
        partenaire_id: "PARTNER-ID-SECRET",
        assigned_sales_agent_id: "ASSIGNMENT-ID-SECRET",
        assigned_group_id: "GROUP-ID-SECRET",
        referred_by: "REFERRER-ID-SECRET",
        referral_code: "REFERRAL-CODE-SECRET",
        owner_side: "partenaire",
        handover_message: "HANDOVER-SECRET",
        registration_number: "PLATE-SECRET",
        vin: "VIN-SECRET-123456789",
        city: "CITY-SECRET",
        postal_code: "POSTAL-SECRET",
        country: "COUNTRY-SECRET",
        location_url: "https://location.example/LOCATION-SECRET",
        onsite_contact_name: "CONTACT-NAME-SECRET",
        onsite_contact_phone: "CONTACT-PHONE-SECRET",
        onsite_contact_email: "contact-secret@example.test",
        desired_price_excl_tax: 111111,
        purchase_price_excl_tax: 222222,
        total_contract_value_eur: 333333,
        final_sale_price_eur: 444444,
        market_price_estimate_eur: 555555,
        market_price_gap_pct: 66,
        payment_method: "PAYMENT-METHOD-SECRET",
        purchase_reference: "PURCHASE-REFERENCE-SECRET",
        free_of_pledge: "PLEDGE-SECRET",
        vat_recoverable: "VAT-SECRET",
        delivery_notes: "DELIVERY-NOTE-SECRET",
        known_defects: "FREE-TEXT-DEFECTS-SECRET",
        expected_repairs: "FREE-TEXT-REPAIRS-SECRET",
        additional_comments: "FREE-TEXT-COMMENTS-SECRET",
        defects_and_comments: "FREE-TEXT-NEW-COMMENTS-SECRET",
        special_conditions: "SPECIAL-CONDITIONS-SECRET",
        future_secret_column: "FUTURE-SECRET-SHOULD-NEVER-LEAK",
      },
      checklist,
      documents: [],
      detections: [],
    });

    expect(payload.vehicle).toEqual({
      brand: "Renault Trucks",
      model: "T 480",
      year: 2022,
      mileage: 345000,
      euro_standard: "euro_6",
      gross_vehicle_weight: "19 t",
      equipment: ["climatisation", "hayon"],
      general_condition: "bon",
      inspection_valid_until: "2026-12-15",
    });

    const serialized = serializeDossierAiPayload(payload);
    for (const secret of [
      "OPPORTUNITY-ID-SECRET",
      "REFERENCE-SECRET",
      "PARTNER-ID-SECRET",
      "ASSIGNMENT-ID-SECRET",
      "GROUP-ID-SECRET",
      "REFERRER-ID-SECRET",
      "REFERRAL-CODE-SECRET",
      "HANDOVER-SECRET",
      "PLATE-SECRET",
      "VIN-SECRET",
      "CITY-SECRET",
      "POSTAL-SECRET",
      "COUNTRY-SECRET",
      "LOCATION-SECRET",
      "CONTACT-NAME-SECRET",
      "CONTACT-PHONE-SECRET",
      "contact-secret@example.test",
      "111111",
      "222222",
      "333333",
      "444444",
      "555555",
      "PAYMENT-METHOD-SECRET",
      "PURCHASE-REFERENCE-SECRET",
      "PLEDGE-SECRET",
      "VAT-SECRET",
      "DELIVERY-NOTE-SECRET",
      "FREE-TEXT-DEFECTS-SECRET",
      "FREE-TEXT-REPAIRS-SECRET",
      "FREE-TEXT-COMMENTS-SECRET",
      "FREE-TEXT-NEW-COMMENTS-SECRET",
      "SPECIAL-CONDITIONS-SECRET",
      "FUTURE-SECRET-SHOULD-NEVER-LEAK",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("document notes are not part of the processor contract", () => {
    const payload = buildDossierAiPayload({
      opportunity: { brand: "DAF" },
      checklist,
      documents: [
        {
          doc_type: "registration_certificate",
          status: "valide",
          // Runtime rows may have extra properties; the contract intentionally ignores them.
          notes: "DOC-NOTE-WITH-NAME-PHONE-AND-SECRET",
        } as { doc_type: string; status: string; notes: string },
      ],
      detections: [],
    });

    expect(payload.documents[0]).toEqual({
      type: "registration_certificate",
      label: "Carte grise",
      required: true,
      status: "valide",
    });
    expect(serializeDossierAiPayload(payload)).not.toContain("DOC-NOTE-WITH-NAME-PHONE-AND-SECRET");
  });

  test("OCR excludes direct identifiers, location and unknown future fields by default", () => {
    const payload = buildDossierAiPayload({
      opportunity: {},
      checklist: [],
      documents: [],
      detections: [
        { field_name: "mileage", detected_value: "456789", confidence: 0.94, action: "confirmed" },
        { field_name: "euro_standard", detected_value: "euro_6", confidence: 0.88, action: "pending" },
        { field_name: "vin", detected_value: "OCR-VIN-SECRET", confidence: 0.99, action: "pending" },
        { field_name: "registration_number", detected_value: "OCR-PLATE-SECRET", confidence: 0.99, action: "pending" },
        { field_name: "city", detected_value: "OCR-CITY-SECRET", confidence: 0.8, action: "pending" },
        { field_name: "postal_code", detected_value: "OCR-POSTAL-SECRET", confidence: 0.8, action: "pending" },
        { field_name: "country", detected_value: "OCR-COUNTRY-SECRET", confidence: 0.8, action: "pending" },
        { field_name: "future_private_field", detected_value: "OCR-FUTURE-SECRET", confidence: 1, action: "pending" },
      ],
    });

    expect(payload.ocr).toEqual([
      { field: "mileage", value: "456789", confidence_pct: 94, action: "confirmed" },
      { field: "euro_standard", value: "euro_6", confidence_pct: 88, action: "pending" },
    ]);

    const serialized = serializeDossierAiPayload(payload);
    expect(serialized).not.toContain("OCR-VIN-SECRET");
    expect(serialized).not.toContain("OCR-PLATE-SECRET");
    expect(serialized).not.toContain("OCR-CITY-SECRET");
    expect(serialized).not.toContain("OCR-POSTAL-SECRET");
    expect(serialized).not.toContain("OCR-COUNTRY-SECRET");
    expect(serialized).not.toContain("OCR-FUTURE-SECRET");
  });

  test("database and OCR query allowlists themselves contain no known sensitive columns", () => {
    const forbiddenOpportunityColumns = [
      "id",
      "reference_number",
      "partenaire_id",
      "registration_number",
      "vin",
      "city",
      "postal_code",
      "country",
      "location_url",
      "onsite_contact_name",
      "onsite_contact_phone",
      "onsite_contact_email",
      "assigned_sales_agent_id",
      "assigned_group_id",
      "assigned_group",
      "referred_by",
      "referral_code",
      "desired_price_excl_tax",
      "purchase_price_excl_tax",
      "total_contract_value_eur",
      "final_sale_price_eur",
      "market_price_estimate_eur",
      "market_price_gap_pct",
      "payment_method",
      "purchase_reference",
      "free_of_pledge",
      "vat_recoverable",
    ];
    const selected = new Set(DOSSIER_AI_OPPORTUNITY_SELECT.split(","));
    for (const field of forbiddenOpportunityColumns) expect(selected.has(field)).toBe(false);

    for (const field of ["vin", "registration_number", "city", "postal_code", "country"]) {
      expect((DOSSIER_AI_OCR_FIELDS as readonly string[]).includes(field)).toBe(false);
    }
  });
});
