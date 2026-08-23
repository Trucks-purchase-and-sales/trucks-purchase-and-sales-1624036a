import * as React from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Upload, Loader2, X, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { runOcrScan, recordOcrApplication } from "@/lib/ocr.functions";
import { extractDocumentText, isOfficeDoc } from "@/lib/document-text";

const FIELD_LABEL_KEYS: Record<string, string> = {
  brand: "ocr.fields.brand",
  model: "ocr.fields.model",
  version: "ocr.fields.version",
  vin: "ocr.fields.vin",
  registration_number: "ocr.fields.registrationNumber",
  first_registration_date: "ocr.fields.firstRegistrationDate",
  mileage: "ocr.fields.mileage",
  fuel_type: "ocr.fields.fuelType",
  gearbox: "ocr.fields.gearbox",
  power: "ocr.fields.power",
  euro_standard: "ocr.fields.euroStandard",
  gross_vehicle_weight: "ocr.fields.grossVehicleWeight",
  payload: "ocr.fields.payload",
  body_type: "ocr.fields.bodyType",
  axle_configuration: "ocr.fields.axleConfiguration",
  cabin_type: "ocr.fields.cabinType",
  wheelbase_mm: "ocr.fields.wheelbaseMm",
  suspension_type: "ocr.fields.suspensionType",
  tyre_size: "ocr.fields.tyreSize",
  box_height_mm: "ocr.fields.boxHeightMm",
  box_width_mm: "ocr.fields.boxWidthMm",
  box_depth_mm: "ocr.fields.boxDepthMm",
  inspection_valid_until: "ocr.fields.inspectionValidUntil",
  city: "ocr.fields.city",
  postal_code: "ocr.fields.postalCode",
  country: "ocr.fields.country",
  vehicle_category: "ocr.fields.vehicleCategory",
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
    r.onerror = () => reject(new Error(i18n.t("ocr.errors.fileReadError")));
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
  const { t } = useTranslation();
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
      const acceptable =
        f.type.startsWith("image/") || f.type === "application/pdf" || isOfficeDoc(f);
      if (!acceptable) {
        toast.error(t("ocr.errors.unsupportedFormat", { name: f.name }));
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(t("ocr.errors.tooLarge", { name: f.name }));
        continue;
      }
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
      const images = await Promise.all(
        mediaFiles.map(async (f) => ({ data_url: await fileToDataUrl(f) })),
      );
      const documents: Array<{ name: string; text: string }> = [];
      for (const f of officeFiles.slice(0, 4)) {
        try {
          documents.push({ name: f.name, text: await extractDocumentText(f) });
        } catch (e) {
          toast.error(t("ocr.errors.unreadable", { name: f.name }), {
            description: (e as Error).message,
          });
        }
      }
      const res = await runFn({
        data: { images, documents, vehicle_opportunity_id: vehicleOpportunityId },
      });
      setScanId(res.scanId);
      setDetections(res.detections);
      const s: Selected = {};
      for (const d of res.detections) {
        s[d.name] = { value: d.value, keep: d.resolved !== false && d.confidence >= 0.6 };
      }
      setSel(s);
      if (res.detections.length === 0) toast.info(t("ocr.toast.noFieldsDetected"));
      else toast.success(t("ocr.toast.fieldsDetected", { count: res.detections.length }));
    } catch (e) {
      toast.error(t("ocr.toast.scanError"), { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function apply() {
    const fields: Record<string, string> = {};
    const applied: Array<{
      field_name: string;
      final_value: string;
      action: "confirmed" | "edited" | "rejected";
    }> = [];
    for (const d of detections) {
      const s = sel[d.name];
      const value = (s?.value ?? "").trim();
      if (!s?.keep || !value) {
        applied.push({ field_name: d.name, final_value: "", action: "rejected" });
        continue;
      }
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
    toast.success(
      count > 0 ? t("ocr.toast.fieldsApplied", { count }) : t("ocr.toast.noFieldsApplied"),
    );
    reset();
    setOpen(false);
  }

  function reset() {
    setFiles([]);
    setDetections([]);
    setSel({});
    setScanId(null);
  }

  function confidenceBadge(c: number) {
    if (c >= 0.8)
      return (
        <Badge className="bg-emerald-600 text-white">
          {t("ocr.confidence.high", { pct: Math.round(c * 100) })}
        </Badge>
      );
    if (c >= 0.5)
      return (
        <Badge variant="secondary">
          {t("ocr.confidence.medium", { pct: Math.round(c * 100) })}
        </Badge>
      );
    return (
      <Badge variant="destructive">{t("ocr.confidence.low", { pct: Math.round(c * 100) })}</Badge>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <ScanLine className="h-4 w-4" /> {t("ocr.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("ocr.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("ocr.dialogDescription")}</DialogDescription>
        </DialogHeader>

        {detections.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("ocr.instructions", { maxFiles: MAX_FILES })}
            </p>
            <Label htmlFor="ocr-files" className="block">
              <div className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-sm hover:bg-secondary/50">
                <Upload className="h-4 w-4" /> {t("ocr.chooseFiles")}
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
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-full w-full object-cover"
                      />
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
                <div
                  key={d.name}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {FIELD_LABEL_KEYS[d.name] ? t(FIELD_LABEL_KEYS[d.name]) : d.name}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {d.resolved === false && (
                          <Badge variant="destructive">{t("ocr.notRecognized")}</Badge>
                        )}
                        {confidenceBadge(d.confidence)}
                      </div>
                    </div>
                    <Input
                      value={s.value}
                      onChange={(e) =>
                        setSel((cur) => ({
                          ...cur,
                          [d.name]: { ...(cur[d.name] ?? { keep: true }), value: e.target.value },
                        }))
                      }
                      disabled={!s.keep}
                    />
                    {d.resolved === false ? (
                      <p className="text-[11px] text-destructive">{t("ocr.valueNotRecognized")}</p>
                    ) : d.display && d.display !== s.value ? (
                      <p className="text-[11px] text-muted-foreground">{d.display}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={s.keep ? "default" : "outline"}
                    onClick={() =>
                      setSel((cur) => ({
                        ...cur,
                        [d.name]: { ...(cur[d.name] ?? { value: d.value }), keep: !s.keep },
                      }))
                    }
                  >
                    {s.keep ? (
                      <>
                        <Check className="mr-1 h-3 w-3" /> {t("ocr.keep")}
                      </>
                    ) : (
                      t("ocr.ignored")
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          {detections.length === 0 ? (
            <Button onClick={runScan} disabled={files.length === 0 || running} className="gap-2">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              {running ? t("ocr.analyzing") : t("ocr.runAnalysis")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                {t("ocr.rescan")}
              </Button>
              <Button onClick={apply} className="gap-2">
                <Check className="h-4 w-4" /> {t("ocr.apply")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
