import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { LOVABLE_AI_BASE_URL } from "@/lib/ai-gateway.server";

const Input = z.object({
  /** data URL of a recorded audio clip (audio/webm, audio/mp4, …) */
  data_url: z.string().startsWith("data:audio").max(9_000_000),
  /** ISO language hint, e.g. "fr" */
  language: z.string().min(2).max(5).optional(),
});

/** Server-side speech-to-text through the Lovable AI gateway (works on every browser). */
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { assertAiFeatureEnabled } = await import("@/lib/ai-features.server");
    await assertAiFeatureEnabled("voice");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Transcription indisponible.");

    const match = /^data:([^;]+);base64,(.*)$/.exec(data.data_url);
    if (!match) throw new Error("Enregistrement illisible.");
    const mime = match[1]!;
    const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
    const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a"
      : mime.includes("ogg") ? "ogg"
      : mime.includes("wav") ? "wav"
      : "webm";

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), `dictee.${ext}`);
    form.append("model", "openai/gpt-4o-transcribe");
    if (data.language) form.append("language", data.language);

    const res = await fetch(`${LOVABLE_AI_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[voice.transcribeAudio]", res.status, txt.slice(0, 200));
      if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
      if (res.status === 402) throw new Error("Crédits IA insuffisants pour la dictée.");
      throw new Error("Transcription indisponible pour le moment.");
    }

    const json = await res.json().catch(() => ({}));
    const text = typeof json?.text === "string" ? json.text.trim() : "";
    return { text };
  });
