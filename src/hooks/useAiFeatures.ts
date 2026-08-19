import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiFeatureSettings } from "@/lib/app-settings.functions";

/** Admin-controlled AI assistance flags (OCR prefill, voice dictation, dossier audit). */
export function useAiFeatures() {
  const read = useServerFn(getAiFeatureSettings);
  const { data: flags } = useQuery({
    queryKey: ["ai-feature-settings"],
    queryFn: () => read(),
    staleTime: 5 * 60 * 1000,
  });
  // Optional external processing is visible only after an explicit admin opt-in.
  const on = flags?.enabled === true;
  return {
    ocr: on && flags?.ocr === true,
    voice: on && flags?.voice === true,
    dossierAudit: on && flags?.dossier_audit === true,
  };
}
