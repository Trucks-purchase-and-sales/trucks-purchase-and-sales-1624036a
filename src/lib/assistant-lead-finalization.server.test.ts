import { describe, expect, test } from "bun:test";
import { finalizeAssistantLead } from "./assistant-lead-finalization.server";

const validLead = {
  vehicle_type: "Tracteur routier",
  preferred_brand: "Volvo",
  max_budget_ht: 75000,
  first_name: "Nadia",
  last_name: "Martin",
  email: "nadia@example.com",
  message: "Besoin sous 30 jours",
};

function modelFinalReply(lead: unknown, text = "Parfait, votre demande est enregistrée !") {
  return `${text}\n<<<LEAD${JSON.stringify(lead)}LEAD>>>`;
}

describe("finalizeAssistantLead", () => {
  test("preserves a normal conversational turn when no lead block exists", async () => {
    let persistCalled = false;
    const result = await finalizeAssistantLead("Quel est votre budget maximum ?", async () => {
      persistCalled = true;
      return { ok: true, reference: "WIL-BUY-2026-0001" };
    });

    expect(persistCalled).toBe(false);
    expect(result).toEqual({
      reply: "Quel est votre budget maximum ?",
      reference: null,
      status: 200,
      persistenceError: null,
      referenceError: null,
    });
  });

  test("replaces the model's claimed confirmation with server-authoritative success", async () => {
    let persistedRow: Record<string, unknown> | null = null;
    const result = await finalizeAssistantLead(modelFinalReply(validLead), async (row) => {
      persistedRow = row;
      return { ok: true, reference: "WIL-BUY-2026-0042", referenceError: null };
    });

    expect(result.status).toBe(200);
    expect(result.reference).toBe("WIL-BUY-2026-0042");
    expect(result.reply).toBe(
      "Votre demande a bien été enregistrée. L’équipe Wilmet reviendra vers vous rapidement.",
    );
    expect(result.reply).not.toContain("Parfait");
    expect(persistedRow).toMatchObject({
      vehicle_type: "Tracteur routier",
      first_name: "Nadia",
      last_name: "Martin",
      email: "nadia@example.com",
      max_budget_ht: 75000,
      gdpr_consent: true,
      source: "ai_assistant",
      assigned_group: "sales",
    });
  });

  test("never returns a false confirmation when persistence fails", async () => {
    const dbError = new Error("database unavailable");
    const result = await finalizeAssistantLead(modelFinalReply(validLead), async () => ({
      ok: false,
      error: dbError,
    }));

    expect(result.status).toBe(503);
    expect(result.reference).toBeNull();
    expect(result.persistenceError).toBe(dbError);
    expect(result.reply).toContain("Je n’ai pas pu enregistrer votre demande");
    expect(result.reply).not.toContain("votre demande est enregistrée");
  });

  test("treats a thrown persistence error as retryable failure", async () => {
    const dbError = new Error("network failure");
    const result = await finalizeAssistantLead(modelFinalReply(validLead), async () => {
      throw dbError;
    });

    expect(result).toMatchObject({
      status: 503,
      reference: null,
      persistenceError: dbError,
    });
  });

  test("does not persist malformed lead JSON", async () => {
    let persistCalled = false;
    const result = await finalizeAssistantLead(
      "C'est bon !\n<<<LEAD{not-json}LEAD>>>",
      async () => {
        persistCalled = true;
        return { ok: true, reference: "should-not-exist" };
      },
    );

    expect(persistCalled).toBe(false);
    expect(result.status).toBe(200);
    expect(result.reference).toBeNull();
    expect(result.reply).toContain("Je n’ai pas pu finaliser la demande");
  });

  test("requires the vehicle type as part of the qualified lead contract", async () => {
    let persistCalled = false;
    const { vehicle_type: _removed, ...withoutVehicleType } = validLead;
    const result = await finalizeAssistantLead(modelFinalReply(withoutVehicleType), async () => {
      persistCalled = true;
      return { ok: true, reference: "should-not-exist" };
    });

    expect(persistCalled).toBe(false);
    expect(result.reference).toBeNull();
    expect(result.reply).toContain("confirmer le type de véhicule recherché");
  });

  test("keeps a successful save successful when only reference lookup degrades", async () => {
    const referenceError = new Error("reference helper unavailable");
    const result = await finalizeAssistantLead(modelFinalReply(validLead), async () => ({
      ok: true,
      reference: null,
      referenceError,
    }));

    expect(result.status).toBe(200);
    expect(result.reference).toBeNull();
    expect(result.persistenceError).toBeNull();
    expect(result.referenceError).toBe(referenceError);
    expect(result.reply).toContain("Votre demande a bien été enregistrée");
  });
});
