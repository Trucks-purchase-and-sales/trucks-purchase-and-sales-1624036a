export type AnonymousLeadInsertResult = {
  error: unknown | null;
};

export type AnonymousLeadReferenceResult = {
  data: unknown;
  error: unknown | null;
};

export type AnonymousLeadPersistenceDeps = {
  insert: (row: Record<string, unknown>) => PromiseLike<AnonymousLeadInsertResult>;
  lookupReference: (id: string) => PromiseLike<AnonymousLeadReferenceResult>;
  makeId?: () => string;
};

export type AnonymousLeadPersistenceResult =
  | {
      ok: true;
      id: string;
      reference: string | null;
      referenceError: unknown | null;
    }
  | {
      ok: false;
      id: string;
      error: unknown;
    };

/**
 * Persist a lead through an anonymous/RLS-constrained client without relying on
 * INSERT ... RETURNING.
 *
 * Anonymous visitors are intentionally not allowed to SELECT buyer_leads. The
 * row id is therefore generated before INSERT, then the public reference is
 * read through the narrow buyer_lead_reference security-definer RPC.
 */
export async function persistAnonymousBuyerLead(
  row: Record<string, unknown>,
  deps: AnonymousLeadPersistenceDeps,
): Promise<AnonymousLeadPersistenceResult> {
  const id = deps.makeId?.() ?? crypto.randomUUID();

  const { error: insertError } = await deps.insert({ ...row, id });
  if (insertError) {
    return { ok: false, id, error: insertError };
  }

  const { data, error: referenceError } = await deps.lookupReference(id);
  const reference = !referenceError && typeof data === "string" ? data : null;

  return {
    ok: true,
    id,
    reference,
    referenceError,
  };
}
