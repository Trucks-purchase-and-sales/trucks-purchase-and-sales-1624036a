import { describe, expect, test } from "bun:test";
import { persistAnonymousBuyerLead } from "./anonymous-buyer-lead.server";

describe("persistAnonymousBuyerLead", () => {
  test("inserts with a pre-generated id then resolves the narrow public reference", async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const lookedUpIds: string[] = [];

    const result = await persistAnonymousBuyerLead(
      { email: "buyer@example.com", source: "ai_assistant" },
      {
        makeId: () => "lead-123",
        insert: async (row) => {
          insertedRows.push(row);
          return { error: null };
        },
        lookupReference: async (id) => {
          lookedUpIds.push(id);
          return { data: "WIL-BUY-2026-0999", error: null };
        },
      },
    );

    expect(insertedRows).toEqual([
      { email: "buyer@example.com", source: "ai_assistant", id: "lead-123" },
    ]);
    expect(lookedUpIds).toEqual(["lead-123"]);
    expect(result).toEqual({
      ok: true,
      id: "lead-123",
      reference: "WIL-BUY-2026-0999",
      referenceError: null,
    });
  });

  test("does not attempt a reference lookup when the insert fails", async () => {
    let lookupCalled = false;
    const dbError = new Error("RLS insert denied");

    const result = await persistAnonymousBuyerLead(
      { email: "buyer@example.com" },
      {
        makeId: () => "lead-456",
        insert: async () => ({ error: dbError }),
        lookupReference: async () => {
          lookupCalled = true;
          return { data: null, error: null };
        },
      },
    );

    expect(lookupCalled).toBe(false);
    expect(result).toEqual({ ok: false, id: "lead-456", error: dbError });
  });

  test("keeps a successful insert even when the reference lookup fails", async () => {
    const referenceError = new Error("reference helper unavailable");

    const result = await persistAnonymousBuyerLead(
      { email: "buyer@example.com" },
      {
        makeId: () => "lead-789",
        insert: async () => ({ error: null }),
        lookupReference: async () => ({ data: null, error: referenceError }),
      },
    );

    expect(result).toEqual({
      ok: true,
      id: "lead-789",
      reference: null,
      referenceError,
    });
  });
});
