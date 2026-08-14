import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/app-settings.functions";

/** Admin-controlled AI assistance flags (OCR prefill, voice dictation, dossier audit). */
export function useAiFeatures() {
  const read = useServerFn(getAppSettings);
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => read(),
    staleTime: 5 * 60 * 1000,
  });
  const f = data?.ai_features;
  const on = f?.enabled ?? true;
  return {
    ocr: on && (f?.ocr ?? false),
    voice: on && (f?.voice ?? true),
    dossierAudit: on && (f?.dossier_audit ?? true),
  };
}
