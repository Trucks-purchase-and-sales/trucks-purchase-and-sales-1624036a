import { z } from "zod";

const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).max(16),
  gdprConsent: z.literal(true),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export type AssistantRequestParseResult =
  | { ok: true; messages: AssistantMessage[] }
  | {
      ok: false;
      status: 400;
      error: string;
      consentRequired: boolean;
    };

/**
 * Deterministic privacy boundary for the public AI assistant.
 *
 * Consent is an application input, never an inference from chat text or an
 * LLM-generated field. Only the literal boolean `true` authorizes the server to
 * send the conversation to the AI gateway and potentially persist a lead.
 */
export function parseAssistantRequest(payload: unknown): AssistantRequestParseResult {
  const parsed = assistantRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const consentIssue = parsed.error.issues.some((issue) => issue.path[0] === "gdprConsent");
    return {
      ok: false,
      status: 400,
      error: consentIssue
        ? "Votre consentement est requis pour utiliser l’assistant."
        : "Message invalide.",
      consentRequired: consentIssue,
    };
  }

  const messages = parsed.data.messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({ ...message, content: message.content.trim() }));

  if (messages.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Message manquant",
      consentRequired: false,
    };
  }

  return { ok: true, messages };
}
