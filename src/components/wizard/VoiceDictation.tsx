import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { transcribeAudio } from "@/lib/voice.functions";

const LANGS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
  { value: "pl", label: "Polski" },
  { value: "pt", label: "Português" },
  { value: "ro", label: "Română" },
];

const MAX_MS = 60_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture de l'enregistrement impossible"));
    r.readAsDataURL(blob);
  });
}

/**
 * Dictation helper: records the microphone and transcribes it server-side
 * through the Lovable AI gateway (reliable on Firefox/Safari/mobile, unlike Web Speech).
 */
export function VoiceDictation({
  onText,
  className,
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  const transcribeFn = useServerFn(transcribeAudio);
  const [supported, setSupported] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [lang, setLang] = React.useState("fr");
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stop() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    recRef.current?.stop();
    setRecording(false);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size < 1000) return;
        setBusy(true);
        try {
          const dataUrl = await blobToDataUrl(blob);
          const res = await transcribeFn({ data: { data_url: dataUrl, language: lang } });
          if (res.text) onText(res.text);
          else toast.info("Aucune parole détectée.");
        } catch (e) {
          toast.error("Dictée impossible", { description: (e as Error).message });
        } finally {
          setBusy(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      timerRef.current = setTimeout(() => stop(), MAX_MS);
    } catch {
      toast.error("Micro indisponible", { description: "Vérifiez l'autorisation du microphone." });
    }
  }

  if (!supported) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={recording ? "destructive" : "default"}
          className="font-semibold shadow-sm"
          disabled={busy}
          onClick={() => (recording ? stop() : start())}
        >
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : recording ? <Square className="mr-1.5 h-3.5 w-3.5" />
            : <Mic className="mr-1.5 h-4 w-4" />}
          {busy ? "Transcription…" : recording ? "Arrêter" : "Dicter"}
        </Button>
        <Select value={lang} onValueChange={(v) => { if (recording) stop(); setLang(v); }}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
