import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LOVABLE_AI_BASE_URL } from "@/lib/ai-gateway.server";
import { enforceAiAbuseLimits, throwAiHttpError } from "@/lib/ai-abuse.server";
import {
  AiInputError,
  MAX_VOICE_DATA_URL_CHARS,
  validateVoiceDataUrl,
} from "@/lib/ai-input-budgets.server";

const Input = z.object({
  /** base64 data URL of a recorded audio clip */
  data_url: z.string().startsWith("data:audio").max(MAX_VOICE_DATA_URL_CHARS),
  /** ISO language hint, e.g. "fr" */
  language: z.string().min(2).max(5).optional(),
});

function extensionForAudioMime(mime: string): string {
  if (mime === "audio/mp4" || mime === "audio/m4a") return "m4a";
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/mpeg") return "mp3";
  return "webm";
}

/** Server-side speech-to-text through the Lovable AI gateway (works on every browser). */
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { assertAiFeatureEnabled } = await import("@/lib/ai-features.server");
    await assertAiFeatureEnabled("voice");
    await enforceAiAbuseLimits("voice", context.userId);

    let audio;
    try {
      audio = validateVoiceDataUrl(data.data_url);
    } catch (error) {
      if (error instanceof AiInputError) {
        throwAiHttpError(error.status, error.message);
      }
      throw error;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[voice.transcribeAudio] LOVABLE_API_KEY missing");
      throwAiHttpError(503, "Transcription momentanément indisponible.");
    }

    const bytes = Uint8Array.from(atob(audio.base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: audio.mime }), `dictee.${extensionForAudioMime(audio.mime)}`);
    form.append("model", "openai/gpt-4o-transcribe");
    if (data.language) form.append("language", data.language);

    let res: Response;
    try {
      res = await fetch(`${LOVABLE_AI_BASE_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { "Lovable-API-Key": apiKey },
        body: form,
      });
    } catch (error) {
      console.error("[voice.transcribeAudio] gateway call failed", error);
      throwAiHttpError(503, "Transcription momentanément indisponible.");
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[voice.transcribeAudio] gateway error", res.status, txt.slice(0, 200));
      throwAiHttpError(503, "Transcription momentanément indisponible.");
    }

    const json = await res.json().catch(() => ({}));
    const text = typeof json?.text === "string" ? json.text.trim() : "";
    return { text };
  });
