import { describe, expect, test } from "bun:test";
import { bridgeLegacyValues, normalise, parseOpportunityInput } from "./opportunity-input";

describe("seller opportunity input security contract", () => {
  test("keeps drafts partial and trims supplied strings", () => {
    const parsed = parseOpportunityInput({ brand: "  Volvo  ", city: "  Lyon " });
    expect(parsed.brand).toBe("Volvo");
    expect(parsed.city).toBe("Lyon");
  });

  test("strips database-only and privileged fields instead of forwarding them", () => {
    const parsed = parseOpportunityInput({
      id: "00000000-0000-4000-8000-000000000001",
      brand: "DAF",
      status: "achetee",
      partenaire_id: "00000000-0000-4000-8000-000000000002",
      assigned_sales_agent_id: "00000000-0000-4000-8000-000000000003",
      purchase_price_excl_tax: 1,
    }) as Record<string, unknown>;

    expect(parsed.brand).toBe("DAF");
    expect(parsed.status).toBeUndefined();
    expect(parsed.partenaire_id).toBeUndefined();
    expect(parsed.assigned_sales_agent_id).toBeUndefined();
    expect(parsed.purchase_price_excl_tax).toBeUndefined();
  });

  test("rejects oversized short text with a readable field name", () => {
    expect(() => parseOpportunityInput({ brand: "x".repeat(121) })).toThrow("Marque");
  });

  test("rejects oversized long-form text", () => {
    expect(() => parseOpportunityInput({ defects_and_comments: "x".repeat(4001) })).toThrow();
  });

  test("rejects unsafe numeric ranges", () => {
    expect(() => parseOpportunityInput({ mileage: 3_000_001 })).toThrow("Kilométrage");
    expect(() => parseOpportunityInput({ desired_price_excl_tax: 2_000_001 })).toThrow("Prix souhaité HT");
    expect(() => parseOpportunityInput({ wheelbase_mm: -1 })).toThrow("Empattement");
  });

  test("validates contact email, phone and location URL when supplied", () => {
    expect(() => parseOpportunityInput({ onsite_contact_email: "not-an-email" })).toThrow("Contact sur place (e-mail)");
    expect(() => parseOpportunityInput({ onsite_contact_phone: "<script>" })).toThrow("Contact sur place (téléphone)");
    expect(() => parseOpportunityInput({ location_url: "javascript:alert(1)" })).toThrow("Lien de localisation");
  });

  test("validates calendar dates and prevents future first registration", () => {
    expect(() => parseOpportunityInput({ first_registration_date: "2026-02-31" })).toThrow("Date de 1re immatriculation");
    expect(() => parseOpportunityInput({ first_registration_date: "2999-01-01" })).toThrow("Date de 1re immatriculation");
    expect(() => parseOpportunityInput({ inspection_valid_until: "not-a-date" })).toThrow("Validité du contrôle technique");
  });

  test("keeps legacy industrial chassis identifiers compatible", () => {
    const parsed = parseOpportunityInput({ vin: "CHASSIS-1234" });
    expect(parsed.vin).toBe("CHASSIS-1234");
  });

  test("bridges known legacy availability values before enum validation", () => {
    expect(bridgeLegacyValues({ availability: "15_30_jours" })).toEqual({ availability: "sous_30_jours" });
    expect(parseOpportunityInput({ availability: "moins_15_jours" }).availability).toBe("a_confirmer");
  });

  test("normalises blank validated strings to null", () => {
    expect(normalise({ brand: "", city: "Lille" })).toEqual({ brand: null, city: "Lille" });
  });
});
