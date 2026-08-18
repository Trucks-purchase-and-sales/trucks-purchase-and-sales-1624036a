import { describe, expect, test } from "bun:test";
import { parseBuyerLead } from "./buyer-leads.schema";

const baseLead = {
  vehicle_category: "camion_porteur",
  vehicle_type: "camion_porteur",
  first_name: "Jean",
  last_name: "Test",
  email: "jean.test@example.com",
  gdpr_consent: true as const,
};

describe("buyer lead honeypot", () => {
  test("accepts a bounded non-empty honeypot value so the route can silently drop it", () => {
    const result = parseBuyerLead({ ...baseLead, website: "https://spam.example" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.website).toBe("https://spam.example");
  });

  test("still bounds honeypot input", () => {
    const result = parseBuyerLead({ ...baseLead, website: "x".repeat(201) });
    expect(result.ok).toBe(false);
  });
});
