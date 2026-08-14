import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Upload, Loader2, X, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { runOcrScan, recordOcrApplication } from "@/lib/ocr.functions";
import { extractDocumentText, isOfficeDoc } from "@/lib/document-text";

const FIELD_LABELS: Record<string, string> = {
  brand: "Marque",
  model: "Modèle",
  version: "Version",
  vin: "VIN",
  registration_number: "Immatriculation",
  first_registration_date: "1re mise en circulation",
  mileage: "Kilométrage",
  fuel_type: "Carburant",
  gearbox: "Boîte",
  power: "Puissance",
  euro_standard: "Norme Euro",
  gross_vehicle_weight: "PTAC",
  payload: "Charge utile",
  body_type: "Carrosserie",
  axle_configuration: "Configuration essieux",
  cabin_type: "Cabine",
  wheelbase_mm: "Empattement (mm)",
  suspension_type: "Suspension",
  tyre_size: "Dimension pneus",
  box_height_mm: "Hauteur intérieure (mm)",
  box_width_mm: "Largeur intérieure (mm)",
  box_depth_mm: "Longueur intérieure (mm)",
  inspection_valid_until: "CT valable jusqu'au",
  city: "Ville",
  postal_code: "Code postal",
  country: "Pays",
  vehicle_category: "Catégorie de véhicule",
};

type Detection = {
  name: string;
  value: string;
  confidence: number;
  /** human-readable rendering of `value` (enum code -> label) */
  display?: string;
  /** false when the AI value could not be mapped onto an accepted option */
  resolved?: boolean;
};
type Selected = Record<string, { value: string; keep: boolean }>;

const MAX_FILES = 6;
const MAX_BYTES = 6 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}

export function OcrPrefillDialog({
  vehicleOpportunityId,
  onApply,
}: {
  vehicleOpportunityId?: string;
  /** Called with the accepted fields; parent maps into wizard state. */
  onApply: (fields: Record<string, string>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [running, setRunning] = React.useState(false);
  const [scanId, setScanId] = React.useState<string | null>(null);
  const [detections, setDetections] = React.useState<Detection[]>([]);
  const [sel, setSel] = React.useState<Selected>({});

  const runFn = useServerFn(runOcrScan);
  const recordFn = useServerFn(recordOcrApplication);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      const acceptable = f.type.startsWith("image/") || f.type === "application/pdf" || isOfficeDoc(f);
      if (!acceptable) { toast.error(`${f.name}: format non pris en charge`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name} dépasse 6 Mo`); continue; }
      next.push(f);
    }
    setFiles((cur) => [...cur, ...next].slice(0, MAX_FILES));
  }

  async function runScan() {
    if (files.length === 0) return;
    setRunning(true);
    try {
      const mediaFiles = files.filter((f) => !isOfficeDoc(f));
      const officeFiles = files.filter((f) => isOfficeDoc(f));
      const images = await Promise.all(mediaFiles.map(async (f) => ({ data_url: await fileToDataUrl(f) })));
      const documents: Array<{ name: string; text: string }> = [];
      for (const f of officeFiles.slice(0, 4)) {
        try {
          documents.push({ name: f.name, text: await extractDocumentText(f) });
        } catch (e) {
          toast.error(`${f.name} illisible`, { description: (e as Error).message });
        }
      }
      const res = await runFn({ data: { images, documents, vehicle_opportunity_id: vehicleOpportunityId } });
      setScanId(res.scanId);
      setDetections(res.detections);
      const s: Selected = {};
      for (const d of res.detections) {
        s[d.name] = { value: d.value, keep: d.resolved !== false && d.confidence >= 0.6 };
      }
      setSel(s);
      if (res.detections.length === 0) toast.info("Aucun champ détecté. Réessayez avec des photos plus nettes.");
      else toast.success(`${res.detections.length} champ(s) détecté(s)`);
    } catch (e) {
      toast.error("Scan impossible", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function apply() {
    const fields: Record<string, string> = {};
    const applied: Array<{ field_name: string; final_value: string; action: "confirmed" | "edited" | "rejected" }> = [];
    for (const d of detections) {
      const s = sel[d.name];
      const value = (s?.value ?? "").trim();
      if (!s?.keep || !value) { applied.push({ field_name: d.name, final_value: "", action: "rejected" }); continue; }
      fields[d.name] = s.value;
      applied.push({
        field_name: d.name,
        final_value: s.value,
        action: s.value === d.value ? "confirmed" : "edited",
      });
    }
    onApply(fields);
    if (scanId && applied.length > 0) {
      recordFn({ data: { scan_id: scanId, applied } }).catch(() => {});
    }
    const count = Object.keys(fields).length;
    toast.success(count > 0 ? `${count} champ(s) pré-rempli(s)` : "Aucun champ appliqué");
    reset();
    setOpen(false);
  }

  function reset() {
    setFiles([]); setDetections([]); setSel({}); setScanId(null);
  }

  function confidenceBadge(c: number) {
    if (c >= 0.8) return <Badge className="bg-emerald-600 text-white">Sûr {Math.round(c * 100)}%</Badge>;
    if (c >= 0.5) return <Badge variant="secondary">Moyen {Math.round(c * 100)}%</Badge>;
    return <Badge variant="destructive">Faible {Math.round(c * 100)}%</Badge>;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <ScanLine className="h-4 w-4" /> Scanner mes photos (IA)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pré-remplir avec l'IA</DialogTitle>
          <DialogDescription>Importez un document du véhicule : l'IA extrait les informations et vous choisissez celles à appliquer au formulaire.</DialogDescription>
        </DialogHeader>

        {detections.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ajoutez jusqu'à {MAX_FILES} fichiers (photos, PDF, Excel, Word, CSV) : plaque constructeur, tableau de bord, carte grise, certificat de conformité, contrôle technique…
              L'IA en extrait automatiquement les champs.
            </p>
            <Label htmlFor="ocr-files" className="block">
              <div className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-sm hover:bg-secondary/50">
                <Upload className="h-4 w-4" /> Choisir des photos ou documents (PDF, Excel, Word)
              </div>
              <input
                id="ocr-files"
                type="file"
                accept="image/*,application/pdf,.xlsx,.xlsm,.xls,.csv,.ods,.docx,.txt"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
            </Label>
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-md border">
                    {f.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary p-2 text-center text-[10px]">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="line-clamp-2 break-all">{f.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {detections.map((d) => {
              const s = sel[d.name] ?? { value: d.value, keep: true };
              return (
                <div key={d.name} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {FIELD_LABELS[d.name] ?? d.name}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {d.resolved === false && <Badge variant="destructive">Non reconnu</Badge>}
                        {confidenceBadge(d.confidence)}
                      </div>
                    </div>
                    <Input
                      value={s.value}
                      onChange={(e) => setSel((cur) => ({ ...cur, [d.name]: { ...(cur[d.name] ?? { keep: true }), value: e.target.value } }))}
                      disabled={!s.keep}
                    />
                    {d.resolved === false ? (
                      <p className="text-[11px] text-destructive">
                        Valeur non reconnue par le formulaire — corrigez-la ou saisissez le champ manuellement.
                      </p>
                    ) : d.display && d.display !== s.value ? (
                      <p className="text-[11px] text-muted-foreground">{d.display}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={s.keep ? "default" : "outline"}
                    onClick={() => setSel((cur) => ({ ...cur, [d.name]: { ...(cur[d.name] ?? { value: d.value }), keep: !s.keep } }))}
                  >
                    {s.keep ? <><Check className="mr-1 h-3 w-3" /> Garder</> : "Ignoré"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          {detections.length === 0 ? (
            <Button onClick={runScan} disabled={files.length === 0 || running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {running ? "Analyse…" : "Lancer l'analyse"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>Rescanner</Button>
              <Button onClick={apply} className="gap-2"><Check className="h-4 w-4" /> Appliquer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
