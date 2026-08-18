type LeadPersistenceSuccess = {
  ok: true;
  reference: string | null;
  referenceError?: unknown | null;
};

type LeadPersistenceFailure = {
  ok: false;
  error: unknown;
};

type LeadPersistenceResult = LeadPersistenceSuccess | LeadPersistenceFailure;

type PersistLead = (row: Record<string, unknown>) => Promise<LeadPersistenceResult>;

export type AssistantLeadFinalization = {
  reply: string;
  reference: string | null;
  status: 200 | 503;
  persistenceError: unknown | null;
  referenceError: unknown | null;
};

const LEAD_BLOCK = /<<<LEAD([\s\S]*?)LEAD>>>/;

const INVALID_LEAD_REPLY =
  "Je n’ai pas pu finaliser la demande avec les informations reçues. Merci de confirmer le type de véhicule recherché, votre prénom, votre nom et votre e-mail.";

const PERSISTENCE_FAILURE_REPLY =
  "Je n’ai pas pu enregistrer votre demande pour le moment. Merci de réessayer dans un instant ou d’utiliser le formulaire « Chercher un véhicule ».";

const PERSISTENCE_SUCCESS_REPLY =
  "Votre demande a bien été enregistrée. L’équipe Wilmet reviendra vers vous rapidement.";

function textField(raw: Record<string, unknown>, key: string, max = 200): string | null {
  const value = raw[key];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

/**
 * Turn an LLM response into an application-authoritative lead outcome.
 *
 * If no structured lead block exists, this is still a normal assistant turn and
 * the model text is returned unchanged. Once a lead block exists, however, the
 * model is no longer authoritative about whether anything was saved: its
 * human-facing text is discarded and the server returns a deterministic reply
 * based only on validation and the real persistence result.
 */
export async function finalizeAssistantLead(
  modelReply: string,
  persistLead: PersistLead,
): Promise<AssistantLeadFinalization> {
  const match = modelReply.match(LEAD_BLOCK);
  if (!match) {
    return {
      reply: modelReply,
      reference: null,
      status: 200,
      persistenceError: null,
      referenceError: null,
    };
  }

  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(match[1]!) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Assistant lead block is not a JSON object");
    }
    raw = parsed as Record<string, unknown>;
  } catch {
    return {
      reply: INVALID_LEAD_REPLY,
      reference: null,
      status: 200,
      persistenceError: null,
      referenceError: null,
    };
  }

  const email = textField(raw, "email");
  const firstName = textField(raw, "first_name", 80);
  const lastName = textField(raw, "last_name", 80);
  const vehicleType = textField(raw, "vehicle_type", 80);

  if (!email || !/.+@.+\..+/.test(email) || !firstName || !lastName || !vehicleType) {
    return {
      reply: INVALID_LEAD_REPLY,
      reference: null,
      status: 200,
      persistenceError: null,
      referenceError: null,
    };
  }

  const rawBudget = raw.max_budget_ht;
  const budget =
    typeof rawBudget === "number" &&
    Number.isFinite(rawBudget) &&
    rawBudget >= 0 &&
    rawBudget <= 10_000_000
      ? rawBudget
      : null;

  const row: Record<string, unknown> = {
    vehicle_type: vehicleType,
    preferred_brand: textField(raw, "preferred_brand", 80),
    preferred_model: textField(raw, "preferred_model", 80),
    usage_country: textField(raw, "usage_country", 80),
    buy_timeline: textField(raw, "buy_timeline", 40),
    max_budget_ht: budget,
    currency: "EUR",
    first_name: firstName,
    last_name: lastName,
    company_name: textField(raw, "company_name", 120),
    email,
    phone: textField(raw, "phone", 40),
    message: textField(raw, "message", 2000),
    gdpr_consent: true,
    locale: "fr",
    source: "ai_assistant",
    assigned_group: "sales",
  };

  let persisted: LeadPersistenceResult;
  try {
    persisted = await persistLead(row);
  } catch (error) {
    return {
      reply: PERSISTENCE_FAILURE_REPLY,
      reference: null,
      status: 503,
      persistenceError: error,
      referenceError: null,
    };
  }

  if (!persisted.ok) {
    return {
      reply: PERSISTENCE_FAILURE_REPLY,
      reference: null,
      status: 503,
      persistenceError: persisted.error,
      referenceError: null,
    };
  }

  return {
    reply: PERSISTENCE_SUCCESS_REPLY,
    reference: persisted.reference,
    status: 200,
    persistenceError: null,
    referenceError: persisted.referenceError ?? null,
  };
}
