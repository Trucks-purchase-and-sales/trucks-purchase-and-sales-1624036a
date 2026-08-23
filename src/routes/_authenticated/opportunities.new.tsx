import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useStepScroll } from "@/hooks/useStepScroll";
import { useServerFn } from "@tanstack/react-start";
import {
  saveOpportunity,
  submitOpportunity,
  getOpportunity,
  addPhotoRecord,
  deletePhoto,
  setMainPhoto,
  signPhotoUrls,
  reorderPhotos,
  createPhotoUploadUrl,
} from "@/lib/opportunities.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  CalendarIcon,
  Camera,
  Check,
  ImageIcon,
  Info,
  Save,
  Send,
  Star,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { OcrPrefillDialog } from "@/components/ocr/OcrPrefillDialog";
import { VoiceDictation } from "@/components/wizard/VoiceDictation";
import { useAiFeatures } from "@/hooks/useAiFeatures";

import {
  AVAILABILITY_OPTIONS,
  AXLE_CONFIG_OPTIONS,
  CABIN_OPTIONS,
  CONDITION_OPTIONS,
  EQUIPMENT_OPTIONS,
  EU27_CODES,
  EURO_OPTIONS,
  FUEL_OPTIONS,
  GEARBOX_OPTIONS,
  ACCIDENT_OPTIONS,
  NEGOTIABLE_OPTIONS,
  PHOTO_CATEGORIES,
  requiredPhotoCategories,
  KEYS_COUNT_OPTIONS,
  VISIBILITY_OPTIONS,
  SUSPENSION_OPTIONS,
  YES_NO_OPTIONS,
  TAIL_LIFT_CONDITION_OPTIONS,
  missingSubmissionFields,
  categoryProfile,
  labelFor,
  formatPrice,
} from "@/lib/wilmet-constants";
import { getReferenceData } from "@/lib/reference-data.functions";
import { SearchableCombobox } from "@/components/pickers/SearchableCombobox";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Defensive: never show a raw JSON / Zod issue blob to the seller.
 * The server already returns readable French messages; this is a backstop
 * for older builds or transport-level payloads.
 */
function readableError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const trimmed = raw.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("[")))
    return trimmed || i18n.t("wizard.errors.unknown");
  try {
    const parsed = JSON.parse(trimmed);
    const issues = Array.isArray(parsed) ? parsed : (parsed.issues ?? parsed.errors);
    if (Array.isArray(issues) && issues.length) {
      const fields = Array.from(
        new Set(
          issues.map((i: { path?: unknown[] }) => String(i?.path?.[0] ?? "")).filter(Boolean),
        ),
      );
      if (fields.length)
        return i18n.t("wizard.errors.invalidFields", { fields: fields.join(", ") });
    }
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* fall through */
  }
  return i18n.t("wizard.errors.invalidGeneric");
}

type OppState = {
  id?: string;
  reference_number?: string | null;
  vehicle_type?: string | null;
  vehicle_category?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  first_registration_date?: string | null;
  mileage?: number | null;
  registration_number?: string | null;
  vin?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  visible_on_site?: string | null;
  fuel_type?: string | null;
  gearbox?: string | null;
  power?: string | null;
  euro_standard?: string | null;
  gross_vehicle_weight?: string | null;
  payload?: string | null;
  axle_configuration?: string | null;
  cabin_type?: string | null;
  equipment?: string[] | null;
  general_condition?: string | null;
  vehicle_runs?: string | null;
  technical_inspection_status?: string | null;
  maintenance_status?: string | null;
  known_defects?: string | null;
  expected_repairs?: string | null;
  additional_comments?: string | null;
  desired_price_excl_tax?: number | null;
  price_negotiable?: string | null;
  availability?: string | null;
  free_of_commitment?: string | null;
  special_conditions?: string | null;
  onsite_contact_name?: string | null;
  onsite_contact_phone?: string | null;
  onsite_contact_email?: string | null;
  vat_recoverable?: string | null;

  has_breakdown?: string | null;
  maintenance_history?: string | null;
  body_type?: string | null;
  body_type_other?: string | null;
  wheelbase_mm?: number | null;
  suspension_type?: string | null;
  tyre_size?: string | null;
  box_height_mm?: number | null;
  box_width_mm?: number | null;
  box_depth_mm?: number | null;
  not_running_reason?: string | null;
  has_accident?: string | null;
  inspection_valid_until?: string | null;
  has_service_book?: string | null;
  key_code?: string | null;
  keys_count?: number | null;
  defects_and_comments?: string | null;
  free_of_pledge?: string | null;

  has_air_conditioning?: string | null;
  has_heating?: string | null;
  has_hydraulic_hook?: string | null;
  has_crane?: string | null;
  crane_details?: string | null;
  other_equipment_details?: string | null;
  location_url?: string | null;
  tail_lift_present?: string | null;
  tail_lift_homologated?: string | null;
  tail_lift_homologation_book?: string | null;
  tail_lift_maintenance_book?: string | null;
  tail_lift_condition?: string | null;
  tail_lift_comment?: string | null;
};

type Photo = {
  id: string;
  storage_path: string;
  category: string | null;
  is_main_photo: boolean;
  sort_order: number;
};

type PendingPhoto = {
  id: string;
  category: string | null;
  url: string;
  name: string;
};

const STEP_KEYS = [
  "wizard.steps.general",
  "wizard.steps.specs",
  "wizard.steps.condition",
  "wizard.steps.photos",
  "wizard.steps.pricing",
  "wizard.steps.summary",
] as const;

export const Route = createFileRoute("/_authenticated/opportunities/new")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s.id === "string" ? { id: s.id } : {},
  component: WizardPage,
});

function WizardPage() {
  const { t } = useTranslation();
  const STEPS = useMemo(() => STEP_KEYS.map((k) => t(k)), [t]);
  const { userId } = Route.useRouteContext();
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ["seller-gate", userId],
    queryFn: async () => {
      const [{ data: roles }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("id, partner_kind").eq("id", userId).maybeSingle(),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "platform_admin");
      return {
        isAdmin,
        hasProfile: !!prof,
        kind: (prof?.partner_kind ?? null) as "client" | "seller" | null,
      };
    },
    staleTime: 60_000,
  });

  const { id: initialId } = Route.useSearch();
  const [opp, setOpp] = useState<OppState>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const saveFn = useServerFn(saveOpportunity);
  const submitFn = useServerFn(submitOpportunity);
  const getFn = useServerFn(getOpportunity);
  const addPhotoFn = useServerFn(addPhotoRecord);
  const createUploadUrlFn = useServerFn(createPhotoUploadUrl);
  const delPhotoFn = useServerFn(deletePhoto);
  const setMainFn = useServerFn(setMainPhoto);
  const signFn = useServerFn(signPhotoUrls);
  const reorderFn = useServerFn(reorderPhotos);

  const refFn = useServerFn(getReferenceData);
  const {
    data: refData,
    isLoading: refLoading,
    isError: refError,
    refetch: refRefetch,
  } = useQuery({
    queryKey: ["reference-data"],
    queryFn: () => refFn(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const refPartialFailure = (refData?.failed?.length ?? 0) > 0;
  const refState: RefState = {
    loading: refLoading,
    error: refError,
    retry: () => {
      void refRefetch();
    },
  };

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Load existing draft on mount if id present.
  useEffect(() => {
    if (!initialId) return;
    (async () => {
      try {
        const res = await getFn({ data: { id: initialId } });
        const cleaned: OppState = { ...(res.opp as unknown as OppState) };
        setOpp(cleaned);
        setPhotos((res.photos as Photo[]) ?? []);
      } catch (e) {
        toast.error(t("wizard.toast.loadDraftError"));
      }
    })();
  }, [initialId, getFn, t]);

  // Sign photo URLs.
  useEffect(() => {
    const paths = photos.map((p) => p.storage_path);
    if (paths.length === 0) {
      setSignedUrls({});
      return;
    }
    signFn({ data: { paths } })
      .then((r) => setSignedUrls(r.urls))
      .catch(() =>
        toast.error(t("wizard.toast.photoPreviewUnavailable.title"), {
          description: t("wizard.toast.photoPreviewUnavailable.text"),
        }),
      );
  }, [photos, signFn, t]);

  const set = <K extends keyof OppState>(k: K, v: OppState[K]) => setOpp((o) => ({ ...o, [k]: v }));

  async function persist(): Promise<string | null> {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...opp };
      // Only pass id when set; drop reference_number & status from payload.
      delete payload.reference_number;
      const res = await saveFn({ data: payload as never });
      setOpp((o) => ({ ...o, id: res.id, reference_number: res.reference_number }));
      return res.id;
    } catch (e) {
      toast.error(t("wizard.toast.saveError"), { description: readableError(e) });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    const id = await persist();
    if (id) toast.success(t("wizard.toast.draftSaved"));
  }

  async function next() {
    const id = await persist();
    if (id) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submitAll() {
    const missingFields = missingSubmissionFields(opp as unknown as Record<string, unknown>);
    if (missingFields.length > 0) {
      toast.error(t("wizard.toast.missingRequired"), {
        description: missingFields.map((f) => f.label).join(", "),
      });
      setStep(missingFields[0].step);
      return;
    }
    if (
      categoryProfile(opp.vehicle_category).powered &&
      opp.vehicle_runs === "non" &&
      !opp.not_running_reason?.trim()
    ) {
      toast.error(t("wizard.toast.notRunningReasonRequired.title"), {
        description: t("wizard.toast.notRunningReasonRequired.text"),
      });
      setStep(2);
      return;
    }
    if (opp.technical_inspection_status === "oui" && !opp.inspection_valid_until) {
      toast.error(t("wizard.toast.inspectionDateRequired.title"), {
        description: t("wizard.toast.inspectionDateRequired.text"),
      });
      setStep(2);
      return;
    }
    const covered = new Set(photos.map((p) => p.category));
    const missingPhotos = requiredPhotoCategories(opp as unknown as Record<string, unknown>).filter(
      (c) => !covered.has(c.value),
    );
    if (missingPhotos.length > 0) {
      toast.error(t("wizard.toast.missingPhotos"), {
        description: missingPhotos.map((m) => m.label).join(", "),
      });
      setStep(3);
      return;
    }
    let id = opp.id;

    if (!id) id = (await persist()) ?? undefined;
    if (!id) return;
    setSubmitting(true);
    try {
      await submitFn({ data: { id } });
      toast.success(t("wizard.toast.submitted"));
      navigate({ to: "/opportunities/success/$id", params: { id } });
    } catch (e) {
      toast.error(t("common.toast.submitError"), { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  async function ensureId(): Promise<string | null> {
    if (opp.id) return opp.id;
    return await persist();
  }

  async function uploadFiles(files: File[], category: string | null) {
    if (files.length === 0) {
      toast.error(t("wizard.toast.noPhotoSelected"));
      return;
    }

    const id = await ensureId();
    if (!id) return;
    const pending = files.map((file) => ({
      id: crypto.randomUUID(),
      category,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setPendingPhotos((current) => [...current, ...pending]);
    setUploadingPhotos(true);
    try {
      const imageCompression = (await import("browser-image-compression")).default;
      let uploadedCount = 0;
      const initialPhotoCount = photos.length;
      for (const original of files) {
        try {
          let file: File = original;
          if (original.type.startsWith("image/") && original.size > 1_200_000) {
            try {
              const blob = await imageCompression(original, {
                maxSizeMB: 1.2,
                maxWidthOrHeight: 2400,
                useWebWorker: true,
                initialQuality: 0.82,
              });
              file = new File([blob], original.name, { type: blob.type || original.type });
            } catch {
              /* fall back to original */
            }
          }
          const upload = await createUploadUrlFn({
            data: { opportunityId: id, fileName: file.name },
          });
          const { error } = await supabase.storage
            .from("vehicle-photos")
            .uploadToSignedUrl(upload.path, upload.token, file, {
              contentType: file.type || "image/jpeg",
            });
          if (error) throw error;
          const rec = await addPhotoFn({
            data: {
              vehicle_opportunity_id: id,
              storage_path: upload.path,
              category,
              is_main_photo: initialPhotoCount === 0 && uploadedCount === 0,
              sort_order: initialPhotoCount + uploadedCount,
            },
          });
          setPhotos((p) => [...p, rec as Photo]);
          uploadedCount += 1;
        } catch (e) {
          toast.error(t("wizard.toast.photoUploadError", { name: original.name }), {
            description: (e as Error).message,
          });
        }
      }
      if (uploadedCount > 0) {
        toast.success(t("wizard.toast.photosAdded", { count: uploadedCount }));
      }
    } catch (e) {
      toast.error(t("wizard.toast.uploadError"), { description: (e as Error).message });
    } finally {
      setUploadingPhotos(false);
      setPendingPhotos((current) =>
        current.filter((item) => !pending.some((p) => p.id === item.id)),
      );
      pending.forEach((item) => URL.revokeObjectURL(item.url));
    }
  }

  async function removePhoto(photoId: string) {
    try {
      await delPhotoFn({ data: { photoId } });
      setPhotos((p) => p.filter((x) => x.id !== photoId));
    } catch (e) {
      toast.error(t("wizard.toast.deleteError"));
    }
  }
  async function makeMain(photoId: string) {
    if (!opp.id) return;
    try {
      await setMainFn({ data: { opportunityId: opp.id, photoId } });
      setPhotos((p) => p.map((x) => ({ ...x, is_main_photo: x.id === photoId })));
    } catch {
      /* ignore */
    }
  }
  async function reorderInCategory(category: string | null, fromId: string, toId: string) {
    if (fromId === toId) return;
    setPhotos((prev) => {
      const inCat = prev.filter((p) => (p.category ?? null) === category);
      const others = prev.filter((p) => (p.category ?? null) !== category);
      const fromIdx = inCat.findIndex((p) => p.id === fromId);
      const toIdx = inCat.findIndex((p) => p.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...inCat];
      const [m] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, m);
      const merged = [...others, ...next];
      const withOrder = merged.map((p, i) => ({ ...p, sort_order: i }));
      reorderFn({
        data: { orders: withOrder.map(({ id, sort_order }) => ({ id, sort_order })) },
      }).catch(() => {
        toast.error(t("wizard.toast.reorderError"));
      });
      return withOrder;
    });
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  const stepRef = useStepScroll(step);

  if (!gateLoading && gate && !gate.isAdmin && (!gate.hasProfile || gate.kind === null)) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <h1 className="text-lg font-semibold">{t("common.accountInitializing.title")}</h1>
            <p className="text-muted-foreground">{t("wizard.gate.noProfile.text")}</p>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              {t("wizard.gate.backToDashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gateLoading && gate && !gate.isAdmin && gate.kind !== "seller") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <h1 className="text-lg font-semibold">{t("wizard.gate.notSeller.title")}</h1>
            <p className="text-muted-foreground">{t("wizard.gate.notSeller.text")}</p>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              {t("wizard.gate.backToDashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-10" ref={stepRef}>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("buyer.actions.back")}
        </Button>
        {opp.reference_number && <Badge variant="outline">{opp.reference_number}</Badge>}
      </div>

      <div className="mb-6">
        <h1
          tabIndex={-1}
          data-step-title
          className="text-2xl font-bold tracking-tight sm:text-3xl outline-none"
        >
          {t("wizard.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("buyer.step", { current: step + 1, total: STEPS.length })} · {STEPS[step]}
        </p>
        <Progress value={progress} className="mt-4 h-1.5" />
        <div className="mt-3 hidden gap-2 sm:flex">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                i === step
                  ? "border-accent bg-accent/10 text-accent"
                  : i < step
                    ? "border-status-accepted bg-status-accepted/40 text-status-accepted-foreground"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {(refError || refPartialFailure) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t("wizard.referenceData.unavailable")}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refRefetch()}>
            {t("wizard.retry")}
          </Button>
        </div>
      )}

      <Card className="border-border/70">
        <CardContent className="p-5 sm:p-8">
          {step === 0 && (
            <Step1
              opp={opp}
              set={set}
              applyOcr={(f: Partial<OppState>) => setOpp((o) => ({ ...o, ...f }))}
              refs={refData}
              refState={refState}
            />
          )}
          {step === 1 && <Step2 opp={opp} set={set} refs={refData} />}

          {step === 2 && <Step3 opp={opp} set={set} />}
          {step === 3 && (
            <Step4
              opp={opp}
              photos={photos}
              pendingPhotos={pendingPhotos}
              uploading={uploadingPhotos}
              signedUrls={signedUrls}
              onUpload={uploadFiles}
              onDelete={removePhoto}
              onMain={makeMain}
              onReorder={reorderInCategory}
            />
          )}
          {step === 4 && <Step5 opp={opp} set={set} />}
          {step === 5 && <Step6 opp={opp} photos={photos} signedUrls={signedUrls} refs={refData} />}
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("wizard.previous")}
            </Button>
          )}
          <Button variant="ghost" onClick={saveDraft} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />{" "}
            {saving ? t("wizard.saving") : t("wizard.saveDraft")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {step < STEPS.length - 1 && (
            <Button
              onClick={next}
              disabled={saving}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("buyer.actions.next")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
          {step === STEPS.length - 1 && (
            <Button
              onClick={submitAll}
              disabled={submitting}
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Send className="mr-1.5 h-4 w-4" />{" "}
              {submitting ? t("wizard.submitting") : t("wizard.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

type Set = <K extends keyof OppState>(k: K, v: OppState[K]) => void;
type Refs = Awaited<ReturnType<typeof getReferenceData>> | undefined;
type RefState = { loading: boolean; error: boolean; retry: () => void };

/**
 * Combobox backed by the reference tables. Never dead-ends: while loading it is
 * disabled with an explicit message, on error it offers a retry, and when the
 * referential comes back empty it degrades to a free-text input.
 */
function RefCombobox({
  value,
  onChange,
  options,
  placeholder,
  state,
  emptyPlaceholder,
  allowCustom,
  customLabel,
  disabled,
  allowFreeTextFallback = false,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  state: RefState;
  emptyPlaceholder?: string;
  /** Creatable: lets the seller enter a real brand/model missing from the catalog. */
  allowCustom?: boolean;
  customLabel?: (q: string) => string;
  /** Dependent selector: disabled until its prerequisite is chosen. */
  disabled?: boolean;
  /**
   * Strict curated lists (catégorie, carrosserie, pays) keep this false: when the
   * référentiel is empty or failed we show an unavailable state + retry instead of
   * silently accepting arbitrary text. Brand/model opt in.
   */
  allowFreeTextFallback?: boolean;
}) {
  // Keep a legacy/stored value selectable even if it is no longer in the catalog.
  const merged = useMemo(() => {
    const v = (value ?? "").trim();
    if (!v || options.some((o) => o.value === v)) return options;
    return [{ value: v, label: v }, ...options];
  }, [options, value]);

  const { t } = useTranslation();
  if (disabled) {
    return <Input disabled placeholder={placeholder} />;
  }
  if (state.loading && merged.length === 0) {
    return <Input disabled placeholder={t("wizard.referenceData.loading")} />;
  }
  if (merged.length === 0 && !allowFreeTextFallback) {
    return (
      <div className="space-y-1.5">
        <Input
          disabled
          value={value ?? ""}
          placeholder={t("wizard.referenceData.closedListUnavailable")}
        />
        <button
          type="button"
          onClick={state.retry}
          className="text-[11px] font-medium text-accent underline"
        >
          {t("wizard.referenceData.retryUnavailable")}
        </button>
        <p className="text-[11px] text-muted-foreground">
          {t("wizard.referenceData.closedListText")}
        </p>
      </div>
    );
  }
  if (merged.length === 0) {
    return (
      <div className="space-y-1.5">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={emptyPlaceholder ?? placeholder}
        />
        {state.error && (
          <button
            type="button"
            onClick={state.retry}
            className="text-[11px] font-medium text-accent underline"
          >
            {t("wizard.referenceData.retryUnavailable")}
          </button>
        )}
      </div>
    );
  }
  return (
    <SearchableCombobox
      value={value ?? undefined}
      onChange={onChange}
      options={merged}
      placeholder={placeholder}
      allowCustom={allowCustom}
      {...(customLabel ? { customLabel } : {})}
    />
  );
}

function Field({
  label,
  hint,
  children,
  action,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  required?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && (
            <span className="ml-1 text-accent" title={t("wizard.requiredOnSubmit")}>
              *
            </span>
          )}
        </Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Selector({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? t("common.select")} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DatePickerField({
  value,
  onChange,
  placeholder,
  disableFuture = false,
  minDate,
  maxDate,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  /** Shorthand for maxDate = today (a first registration cannot be in the future). */
  disableFuture?: boolean;
  /** Earliest selectable date. No arbitrary floor is applied by default. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("wizard.pickDate");
  const upper = maxDate ?? (disableFuture ? new Date() : undefined);
  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(upper ? [{ after: upper }] : []),
  ];
  const [open, setOpen] = useState(false);

  const handleSelect = (date: Date | undefined) => {
    setOpen(false);
    onChange(date ? format(date, "yyyy-MM-dd") : null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISO(value), "dd/MM/yyyy", { locale: fr }) : resolvedPlaceholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={handleSelect}
          initialFocus
          captionLayout="dropdown"
          startMonth={minDate ?? new Date(1950, 0)}
          endMonth={upper ?? new Date(new Date().getFullYear() + 1, 11)}
          {...(disabledMatchers.length ? { disabled: disabledMatchers } : {})}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function Step1({
  opp,
  set,
  applyOcr,
  refs,
  refState,
}: {
  opp: OppState;
  set: Set;
  applyOcr: (f: Partial<OppState>) => void;
  refs: Refs;
  refState: RefState;
}) {
  const { t } = useTranslation();
  const ai = useAiFeatures();
  function handleOcrApply(fields: Record<string, string>) {
    const intFields = new Set([
      "mileage",
      "wheelbase_mm",
      "box_height_mm",
      "box_width_mm",
      "box_depth_mm",
    ]);
    const patch: Partial<OppState> = {};
    for (const [k, v] of Object.entries(fields)) {
      const val = String(v ?? "").trim();
      if (!val) continue; // never blank an existing manual entry
      if (intFields.has(k)) {
        const n = parseInt(val.replace(/\D/g, ""), 10);
        if (!Number.isNaN(n)) (patch as Record<string, unknown>)[k] = n;
        continue;
      }
      (patch as Record<string, unknown>)[k] = val;
    }
    // vehicle_category drives the brand list: it is applied in the same state
    // update as brand so the brand stays selectable.
    applyOcr(patch);
  }

  const categoryOptions = useMemo(
    () => (refs?.vehicleCategories ?? []).map((c) => ({ value: c.slug, label: c.label_fr })),
    [refs],
  );
  /** Brands allowed for the selected category (all brands when no category yet). */
  const brandOptions = useMemo(() => {
    const all = refs?.brands ?? [];
    const withCurrent = (list: Array<{ value: string; label: string }>) =>
      opp.brand && !list.some((o) => o.value === opp.brand)
        ? [{ value: opp.brand, label: opp.brand }, ...list]
        : list;
    if (!opp.vehicle_category)
      return withCurrent(all.map((b) => ({ value: b.label, label: b.label })));
    const allowed = new Set(
      (refs?.categoryBrands ?? [])
        .filter((cb) => cb.category_slug === opp.vehicle_category)
        .map((cb) => cb.brand_slug),
    );
    const filtered = all.filter((b) => allowed.has(b.slug));
    return withCurrent(
      (filtered.length > 0 ? filtered : all).map((b) => ({ value: b.label, label: b.label })),
    );
  }, [refs, opp.vehicle_category, opp.brand]);

  const brandSlug = useMemo(
    () => (refs?.brands ?? []).find((b) => b.label === opp.brand)?.slug,
    [refs, opp.brand],
  );
  const modelOptions = useMemo(() => {
    const list = (refs?.models ?? [])
      .filter((m) => m.brand_slug === brandSlug)
      .map((m) => ({ value: m.label, label: m.label }));
    return opp.model && !list.some((o) => o.value === opp.model)
      ? [{ value: opp.model, label: opp.model }, ...list]
      : list;
  }, [refs, brandSlug, opp.model]);

  const countryOptions = useMemo(
    () =>
      (refs?.countries ?? [])
        .filter((c) => EU27_CODES.has(c.code))
        .map((c) => ({ value: c.name_fr, label: c.name_fr })),
    [refs],
  );

  /** Carrosseries available for the selected category (all when no category yet). */
  const bodyTypeOptions = useMemo(() => {
    const all = refs?.bodyTypes ?? [];
    const scoped = opp.vehicle_category
      ? all.filter((b) => (b.applies_to ?? []).includes(opp.vehicle_category as string))
      : all;
    const list = (scoped.length > 0 ? scoped : all).map((b) => ({
      value: b.slug,
      label: b.label_fr,
    }));
    return opp.body_type && !list.some((o) => o.value === opp.body_type)
      ? [{ value: opp.body_type, label: opp.body_type }, ...list]
      : list;
  }, [refs, opp.vehicle_category, opp.body_type]);

  const profile = categoryProfile(opp.vehicle_category);

  /** Single cascade entry point: changing the category invalidates every dependent value. */
  function onCategoryChange(v: string) {
    set("vehicle_category", v);
    set("brand", null);
    set("model", null);
    set("body_type", null);
    set("body_type_other", null);
    if (!categoryProfile(v).powered) {
      // Engine-specific data cannot apply to a trailer: drop stale values.
      set("fuel_type", null);
      set("gearbox", null);
      set("euro_standard", null);
      set("power", null);
      set("mileage", null);
      set("vehicle_runs", null);
      set("not_running_reason", null);
    }
  }

  return (
    <div className="space-y-6">
      {ai.ocr && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-accent bg-accent p-5 shadow-lg ring-4 ring-accent/20">
          <div className="space-y-1">
            <div className="text-lg font-extrabold uppercase tracking-wide text-accent-foreground sm:text-xl">
              {t("wizard.ocr.banner.title")}
            </div>
            <div className="text-sm font-semibold text-accent-foreground/90 sm:text-base">
              {t("wizard.ocr.banner.text")}
            </div>
          </div>
          <div className="[&_button]:h-12 [&_button]:border-0 [&_button]:bg-background [&_button]:px-6 [&_button]:text-base [&_button]:font-bold [&_button]:text-accent [&_button]:shadow-md [&_button:hover]:bg-background/90">
            <OcrPrefillDialog vehicleOpportunityId={opp.id} onApply={handleOcrApply} />
          </div>
        </div>
      )}

      <SectionTitle
        title={t("wizard.step1.sectionGeneral.title")}
        hint={t("wizard.step1.sectionGeneral.hint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("wizard.fields.vehicleCategory")} required>
          <RefCombobox
            value={opp.vehicle_category}
            onChange={(v) => onCategoryChange(v)}
            options={categoryOptions}
            placeholder={t("wizard.step1.selectCategory")}
            state={refState}
          />
        </Field>
        <Field label={t("wizard.fields.brand")} required hint={t("wizard.step1.brandHint")}>
          <RefCombobox
            value={opp.brand}
            onChange={(v) => {
              set("brand", v);
              set("model", null);
            }}
            options={brandOptions}
            placeholder={
              opp.vehicle_category
                ? t("wizard.step1.selectBrand")
                : t("wizard.step1.selectCategoryFirst")
            }
            disabled={!opp.vehicle_category}
            emptyPlaceholder={t("wizard.step1.enterBrand")}
            state={refState}
            allowFreeTextFallback
            allowCustom
            customLabel={(q) => t("wizard.step1.addBrand", { q })}
          />
        </Field>
        <Field label={t("wizard.fields.model")} required hint={t("wizard.step1.modelHint")}>
          <RefCombobox
            value={opp.model}
            onChange={(v) => set("model", v)}
            options={modelOptions}
            placeholder={
              opp.brand ? t("wizard.step1.selectModel") : t("wizard.step1.selectBrandFirst")
            }
            emptyPlaceholder={t("wizard.step1.enterModel")}
            disabled={!opp.brand}
            state={refState}
            allowFreeTextFallback
            allowCustom
            customLabel={(q) => t("wizard.step1.addModel", { q })}
          />
        </Field>
        <Field label={t("wizard.fields.bodyType")} required hint={t("wizard.step1.bodyTypeHint")}>
          <RefCombobox
            value={opp.body_type}
            onChange={(v) => {
              set("body_type", v);
              if (v !== "autre") set("body_type_other", null);
            }}
            options={bodyTypeOptions}
            placeholder={
              opp.vehicle_category
                ? t("wizard.step1.selectBodyType")
                : t("wizard.step1.selectCategoryFirst")
            }
            disabled={!opp.vehicle_category}
            state={refState}
          />
        </Field>
        {opp.body_type === "autre" && (
          <Field label={t("wizard.step1.specifyBodyType")} required>
            <Input
              value={opp.body_type_other ?? ""}
              onChange={(e) => set("body_type_other", e.target.value)}
              placeholder={t("wizard.step1.bodyTypeOtherPlaceholder")}
            />
          </Field>
        )}

        <Field label={t("wizard.fields.firstRegistrationDate")} required>
          <DatePickerField
            value={opp.first_registration_date}
            onChange={(v) => set("first_registration_date", v)}
            placeholder={t("wizard.fields.pickDate")}
            disableFuture
          />
        </Field>
        {profile.hasOdometer && (
          <Field label={t("wizard.fields.mileage")} required hint={t("wizard.step1.mileageHint")}>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={3000000}
                step={1000}
                inputMode="numeric"
                className="pr-10"
                value={opp.mileage ?? ""}
                onChange={(e) => set("mileage", e.target.value ? parseInt(e.target.value) : null)}
                onBlur={(e) => {
                  if (!e.target.value) return;
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) set("mileage", Math.min(Math.max(n, 0), 3000000));
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                km
              </span>
            </div>
          </Field>
        )}
        <Field label={t("wizard.fields.registrationNumber")}>
          <Input
            value={opp.registration_number ?? ""}
            onChange={(e) => set("registration_number", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label={t("wizard.fields.vin")} required hint={t("wizard.step1.vinHint")}>
          <Input
            value={opp.vin ?? ""}
            onChange={(e) => set("vin", e.target.value.toUpperCase())}
            placeholder={t("wizard.step1.vinPlaceholder")}
          />
        </Field>
      </div>

      <SectionTitle title={t("wizard.step1.sectionLocation.title")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("wizard.fields.city")} required>
          <Input value={opp.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label={t("wizard.fields.postalCode")}>
          <Input
            value={opp.postal_code ?? ""}
            onChange={(e) => set("postal_code", e.target.value)}
          />
        </Field>
        <Field label={t("wizard.fields.countryEu")} required>
          <RefCombobox
            value={opp.country}
            onChange={(v) => set("country", v)}
            options={countryOptions}
            placeholder={t("wizard.step1.selectCountry")}
            state={refState}
          />
        </Field>
      </div>
      <Field label={t("wizard.fields.locationUrl")} hint={t("wizard.step1.locationUrlHint")}>
        <Input
          value={opp.location_url ?? ""}
          onChange={(e) => set("location_url", e.target.value)}
          placeholder="https://maps.google.com/…"
        />
      </Field>

      <Field label={t("wizard.fields.visibleOnSite")} required>
        <RadioGroup
          value={opp.visible_on_site ?? ""}
          onValueChange={(v) => set("visible_on_site", v)}
          className="flex flex-wrap gap-3"
        >
          {VISIBILITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <RadioGroupItem value={o.value} id={`vs-${o.value}`} />
              <span>{o.label}</span>
            </label>
          ))}
        </RadioGroup>
      </Field>
    </div>
  );
}

function Step2({ opp, set, refs }: { opp: OppState; set: Set; refs: Refs }) {
  const { t } = useTranslation();
  const equip = opp.equipment ?? [];
  const toggle = (v: string) => {
    const next = equip.includes(v) ? equip.filter((x) => x !== v) : [...equip, v];
    set("equipment", next);
  };
  const euroOptions = useMemo(() => {
    const fromRef = (refs?.euroStandards ?? []).map((e) => ({ value: e.slug, label: e.label }));
    return fromRef.length > 0 ? fromRef : EURO_OPTIONS;
  }, [refs]);
  const fuelOptions = useMemo(() => {
    const fromRef = (refs?.fuelTypes ?? []).map((f) => ({ value: f.slug, label: f.label_fr }));
    return fromRef.length > 0 ? fromRef : FUEL_OPTIONS;
  }, [refs]);
  const gearboxOptions = useMemo(() => {
    const fromRef = (refs?.gearboxTypes ?? []).map((g) => ({ value: g.slug, label: g.label_fr }));
    return fromRef.length > 0 ? fromRef : GEARBOX_OPTIONS;
  }, [refs]);
  const profile = categoryProfile(opp.vehicle_category);
  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("wizard.step2.sectionTitle")}
        hint={profile.powered ? undefined : t("wizard.step2.notPoweredHint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {profile.powered && (
          <>
            <Field label={t("wizard.fields.fuelType")} required>
              <Selector
                value={opp.fuel_type}
                onChange={(v) => set("fuel_type", v)}
                options={fuelOptions}
              />
            </Field>
            <Field label={t("wizard.fields.gearbox")} required>
              <Selector
                value={opp.gearbox}
                onChange={(v) => set("gearbox", v)}
                options={gearboxOptions}
              />
            </Field>
            <Field label={t("wizard.fields.power")} hint={t("wizard.step2.powerHint")}>
              <Input
                value={opp.power ?? ""}
                onChange={(e) => set("power", e.target.value)}
                placeholder={t("wizard.step2.powerPlaceholder")}
              />
            </Field>
            <Field label={t("wizard.fields.euroStandard")}>
              <Selector
                value={opp.euro_standard}
                onChange={(v) => set("euro_standard", v)}
                options={euroOptions}
              />
            </Field>
          </>
        )}
        <Field
          label={t("wizard.fields.grossVehicleWeight")}
          required
          hint={t("wizard.step2.gvwHint")}
        >
          <div className="relative">
            <Input
              className="pr-8"
              inputMode="decimal"
              value={opp.gross_vehicle_weight ?? ""}
              onChange={(e) => set("gross_vehicle_weight", e.target.value)}
              placeholder="3.5, 19…"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              t
            </span>
          </div>
        </Field>
        <Field label={t("wizard.fields.payload")} hint={t("wizard.step2.payloadHint")}>
          <Input value={opp.payload ?? ""} onChange={(e) => set("payload", e.target.value)} />
        </Field>
        <Field label={t("wizard.fields.axleConfiguration")}>
          <Selector
            value={opp.axle_configuration}
            onChange={(v) => set("axle_configuration", v)}
            options={AXLE_CONFIG_OPTIONS}
          />
        </Field>
        {profile.powered && (
          <Field label={t("wizard.fields.cabinType")}>
            <Selector
              value={opp.cabin_type}
              onChange={(v) => set("cabin_type", v)}
              options={CABIN_OPTIONS}
            />
          </Field>
        )}
        <Field label={t("wizard.fields.wheelbase")}>
          <Input
            type="number"
            min={0}
            value={opp.wheelbase_mm ?? ""}
            onChange={(e) => set("wheelbase_mm", e.target.value ? parseInt(e.target.value) : null)}
          />
        </Field>
        <Field label={t("wizard.fields.suspensionType")}>
          <Selector
            value={opp.suspension_type}
            onChange={(v) => set("suspension_type", v)}
            options={SUSPENSION_OPTIONS}
          />
        </Field>
        <Field label={t("wizard.fields.tyreSize")} hint={t("wizard.step2.tyreSizeHint")}>
          <Input value={opp.tyre_size ?? ""} onChange={(e) => set("tyre_size", e.target.value)} />
        </Field>
      </div>

      {profile.hasBody && (
        <>
          <SectionTitle
            title={t("wizard.step2.sectionBody.title")}
            hint={t("wizard.step2.sectionBody.hint")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("wizard.fields.boxHeight")}>
              <Input
                type="number"
                min={0}
                value={opp.box_height_mm ?? ""}
                onChange={(e) =>
                  set("box_height_mm", e.target.value ? parseInt(e.target.value) : null)
                }
              />
            </Field>
            <Field label={t("wizard.fields.boxWidth")}>
              <Input
                type="number"
                min={0}
                value={opp.box_width_mm ?? ""}
                onChange={(e) =>
                  set("box_width_mm", e.target.value ? parseInt(e.target.value) : null)
                }
              />
            </Field>
            <Field label={t("wizard.fields.boxDepth")}>
              <Input
                type="number"
                min={0}
                value={opp.box_depth_mm ?? ""}
                onChange={(e) =>
                  set("box_depth_mm", e.target.value ? parseInt(e.target.value) : null)
                }
              />
            </Field>
          </div>
        </>
      )}

      <SectionTitle
        title={t("wizard.step2.sectionEquipment.title")}
        hint={t("wizard.step2.sectionEquipment.hint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {profile.hasCabin && (
          <>
            <Field label={t("wizard.fields.hasAirConditioning")}>
              <Selector
                value={opp.has_air_conditioning}
                onChange={(v) => set("has_air_conditioning", v)}
                options={YES_NO_OPTIONS}
              />
            </Field>
            <Field label={t("wizard.fields.hasHeating")}>
              <Selector
                value={opp.has_heating}
                onChange={(v) => set("has_heating", v)}
                options={YES_NO_OPTIONS}
              />
            </Field>
          </>
        )}
        <Field label={t("wizard.fields.hasHydraulicHook")}>
          <Selector
            value={opp.has_hydraulic_hook}
            onChange={(v) => set("has_hydraulic_hook", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
        <Field label={t("wizard.fields.hasCrane")}>
          <Selector
            value={opp.has_crane}
            onChange={(v) => set("has_crane", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
      </div>
      {opp.has_crane === "oui" && (
        <Field label={t("wizard.fields.craneDetails")} hint={t("wizard.step2.craneDetailsHint")}>
          <Textarea
            rows={2}
            value={opp.crane_details ?? ""}
            onChange={(e) => set("crane_details", e.target.value)}
          />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("wizard.fields.tailLiftPresent")}>
          <Selector
            value={opp.tail_lift_present}
            onChange={(v) => set("tail_lift_present", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
        {opp.tail_lift_present === "oui" && (
          <>
            <Field label={t("wizard.fields.tailLiftHomologated")}>
              <Selector
                value={opp.tail_lift_homologated}
                onChange={(v) => set("tail_lift_homologated", v)}
                options={YES_NO_OPTIONS}
              />
            </Field>
            <Field label={t("wizard.fields.tailLiftHomologationBook")}>
              <Selector
                value={opp.tail_lift_homologation_book}
                onChange={(v) => set("tail_lift_homologation_book", v)}
                options={YES_NO_OPTIONS}
              />
            </Field>
            <Field label={t("wizard.fields.tailLiftMaintenanceBook")}>
              <Selector
                value={opp.tail_lift_maintenance_book}
                onChange={(v) => set("tail_lift_maintenance_book", v)}
                options={YES_NO_OPTIONS}
              />
            </Field>
            <Field label={t("wizard.fields.tailLiftCondition")}>
              <Selector
                value={opp.tail_lift_condition}
                onChange={(v) => set("tail_lift_condition", v)}
                options={TAIL_LIFT_CONDITION_OPTIONS}
              />
            </Field>
          </>
        )}
      </div>
      {opp.tail_lift_present === "oui" && (
        <Field
          label={t("wizard.fields.tailLiftComment")}
          hint={t("wizard.step2.tailLiftCommentHint")}
        >
          <Textarea
            rows={2}
            value={opp.tail_lift_comment ?? ""}
            onChange={(e) => set("tail_lift_comment", e.target.value)}
          />
        </Field>
      )}

      <Field label={t("wizard.fields.otherEquipment")} hint={t("wizard.step2.otherEquipmentHint")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EQUIPMENT_OPTIONS.map((e) => (
            <label
              key={e}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <Checkbox checked={equip.includes(e)} onCheckedChange={() => toggle(e)} />
              {e}
            </label>
          ))}
        </div>
      </Field>
      <Field
        label={t("wizard.fields.otherEquipmentDetails")}
        hint={t("wizard.step2.otherEquipmentDetailsHint")}
      >
        <Textarea
          rows={2}
          value={opp.other_equipment_details ?? ""}
          onChange={(e) => set("other_equipment_details", e.target.value)}
        />
      </Field>
    </div>
  );
}

function Step3({ opp, set }: { opp: OppState; set: Set }) {
  const { t } = useTranslation();
  const ai = useAiFeatures();
  const conditionOptions = CONDITION_OPTIONS;
  const profile = categoryProfile(opp.vehicle_category);

  return (
    <div className="space-y-6">
      <SectionTitle title={t("wizard.step3.sectionTitle")} hint={t("wizard.step3.sectionHint")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("wizard.fields.generalCondition")} required>
          <Selector
            value={opp.general_condition}
            onChange={(v) => set("general_condition", v)}
            options={conditionOptions}
          />
        </Field>
        {profile.powered && (
          <Field label={t("wizard.fields.vehicleRuns")} required>
            <Selector
              value={opp.vehicle_runs}
              onChange={(v) => set("vehicle_runs", v)}
              options={YES_NO_OPTIONS}
            />
          </Field>
        )}
        <Field label={t("wizard.fields.technicalInspectionStatus")} required>
          <Selector
            value={opp.technical_inspection_status}
            onChange={(v) => set("technical_inspection_status", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
        {opp.technical_inspection_status === "oui" && (
          <Field
            label={t("wizard.fields.inspectionValidUntil")}
            required
            hint={t("wizard.step3.inspectionValidUntilHint")}
          >
            <DatePickerField
              value={opp.inspection_valid_until}
              onChange={(v) => set("inspection_valid_until", v)}
              placeholder={t("wizard.fields.pickDate")}
            />
          </Field>
        )}
        <Field label={t("wizard.fields.maintenanceStatus")}>
          <Selector
            value={opp.maintenance_status}
            onChange={(v) => set("maintenance_status", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
        <Field
          label={t("wizard.fields.hasAccident")}
          required
          hint={t("wizard.step3.hasAccidentHint")}
        >
          <Selector
            value={opp.has_accident}
            onChange={(v) => set("has_accident", v)}
            options={ACCIDENT_OPTIONS}
          />
        </Field>

        <Field label={t("wizard.fields.hasServiceBook")}>
          <Selector
            value={opp.has_service_book}
            onChange={(v) => set("has_service_book", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
        {profile.hasCabin && (
          <Field label={t("wizard.fields.keysCount")}>
            <Selector
              value={opp.keys_count ? String(opp.keys_count) : null}
              onChange={(v) => set("keys_count", v ? parseInt(v, 10) : null)}
              options={KEYS_COUNT_OPTIONS}
            />
          </Field>
        )}
      </div>
      {profile.powered && opp.vehicle_runs === "non" && (
        <Field
          label={t("wizard.fields.notRunningReason")}
          required
          hint={t("wizard.step3.notRunningReasonHint")}
          action={
            ai.voice ? (
              <VoiceDictation
                onText={(txt: string) =>
                  set(
                    "not_running_reason",
                    `${opp.not_running_reason ? opp.not_running_reason + " " : ""}${txt}`,
                  )
                }
              />
            ) : undefined
          }
        >
          <Textarea
            rows={3}
            value={opp.not_running_reason ?? ""}
            onChange={(e) => set("not_running_reason", e.target.value)}
          />
        </Field>
      )}
      <Field
        label={t("wizard.fields.defectsAndComments")}
        hint={t("wizard.step3.defectsAndCommentsHint")}
        action={
          ai.voice ? (
            <VoiceDictation
              onText={(txt: string) =>
                set(
                  "defects_and_comments",
                  `${opp.defects_and_comments ? opp.defects_and_comments + " " : ""}${txt}`,
                )
              }
            />
          ) : undefined
        }
      >
        <Textarea
          value={opp.defects_and_comments ?? ""}
          rows={5}
          onChange={(e) => set("defects_and_comments", e.target.value)}
        />
      </Field>
    </div>
  );
}

function Step4({
  opp,
  photos,
  pendingPhotos,
  uploading,
  signedUrls,
  onUpload,
  onDelete,
  onMain,
  onReorder,
}: {
  opp: OppState;
  photos: Photo[];
  pendingPhotos: PendingPhoto[];
  uploading: boolean;
  signedUrls: Record<string, string>;
  onUpload: (files: File[], category: string | null) => void;
  onDelete: (id: string) => void;
  onMain: (id: string) => void;
  onReorder: (category: string | null, fromId: string, toId: string) => void;
}) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  function pick(cat: string | null) {
    setActiveCat(cat);
    inputRef.current?.click();
  }
  const required = useMemo(
    () => requiredPhotoCategories(opp as unknown as Record<string, unknown>),
    [opp],
  );
  const requiredValues = useMemo(() => new Set(required.map((r) => r.value)), [required]);
  const missingRequired = required.filter(
    (c) =>
      !photos.some((p) => p.category === c.value) &&
      !pendingPhotos.some((p) => p.category === c.value),
  );
  return (
    <div className="space-y-6">
      <SectionTitle title={t("wizard.step4.sectionTitle")} hint={t("wizard.step4.sectionHint")} />

      {missingRequired.length > 0 && (
        <div className="rounded-xl border border-accent bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <AlertTriangle className="h-4 w-4" /> {t("wizard.toast.missingPhotos")}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("wizard.step4.missingRequiredText", {
              list: missingRequired.map((m) => m.label).join(", "),
            })}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-accent" /> {t("wizard.step4.checklist.title")}
        </div>
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>✓ {t("wizard.step4.checklist.sharp")}</li>
          <li>✓ {t("wizard.step4.checklist.fullVehicle")}</li>
          <li>✓ {t("wizard.step4.checklist.mileageReadable")}</li>
          <li>✓ {t("wizard.step4.checklist.defectsPhotographed")}</li>
          <li>✓ {t("wizard.step4.checklist.documents")}</li>
        </ul>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const selectedFiles = Array.from(e.target.files ?? []);
          e.target.value = "";
          onUpload(selectedFiles, activeCat);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PHOTO_CATEGORIES.map((cat) => {
          const inCat = photos.filter((p) => p.category === cat.value);
          const pendingInCat = pendingPhotos.filter((p) => p.category === cat.value);
          return (
            <div key={cat.value} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {cat.label}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        requiredValues.has(cat.value)
                          ? "bg-accent text-accent-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {requiredValues.has(cat.value)
                        ? t("wizard.step4.required")
                        : t("wizard.step4.recommended")}
                    </span>
                  </div>

                  <div className="mt-0.5 text-[11px] text-muted-foreground">{cat.helper}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pick(cat.value)}
                  disabled={uploading}
                >
                  <Camera className="mr-1 h-4 w-4" />{" "}
                  {uploading ? t("wizard.step4.adding") : t("wizard.step4.add")}
                </Button>
              </div>
              {(inCat.length > 0 || pendingInCat.length > 0) && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {pendingInCat.map((p) => (
                    <PendingPhotoTile key={p.id} photo={p} />
                  ))}
                  {inCat.map((p) => (
                    <PhotoTile
                      key={p.id}
                      photo={p}
                      url={signedUrls[p.storage_path]}
                      onDelete={onDelete}
                      onMain={onMain}
                      isDragging={dragId === p.id}
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onDropOn={(overId) => {
                        if (dragId && dragId !== overId) onReorder(cat.value, dragId, overId);
                        setDragId(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <Button variant="outline" onClick={() => pick(null)} disabled={uploading}>
          <Camera className="mr-1.5 h-4 w-4" />{" "}
          {uploading ? t("wizard.step4.uploading") : t("wizard.step4.addOtherPhotos")}
        </Button>
        {(pendingPhotos.some((p) => p.category === null) ||
          photos.some((p) => p.category === null)) && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {pendingPhotos
              .filter((p) => p.category === null)
              .map((p) => (
                <PendingPhotoTile key={p.id} photo={p} />
              ))}
            {photos
              .filter((p) => p.category === null)
              .map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  url={signedUrls[p.storage_path]}
                  onDelete={onDelete}
                  onMain={onMain}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingPhotoTile({ photo }: { photo: PendingPhoto }) {
  const { t } = useTranslation();
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-accent bg-secondary">
      <img src={photo.url} alt={photo.name} className="h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 grid place-items-center bg-background/40 text-[11px] font-semibold text-foreground">
        {t("wizard.step4.adding")}
      </div>
    </div>
  );
}

function PhotoTile({
  photo,
  url,
  onDelete,
  onMain,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  photo: Photo;
  url?: string;
  onDelete: (id: string) => void;
  onMain: (id: string) => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropOn?: (overId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn?.(photo.id);
      }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 ring-2 ring-accent",
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          className="h-full w-full object-cover pointer-events-none"
        />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground m-auto mt-6" />
      )}
      {photo.is_main_photo && (
        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
          {t("wizard.step4.mainPhoto")}
        </span>
      )}
      <div className="absolute inset-0 flex items-end justify-between gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onMain(photo.id)}
          className="rounded bg-background/90 p-1"
          title={t("wizard.step4.mainPhoto")}
        >
          <Star className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(photo.id)}
          className="rounded bg-background/90 p-1"
          title={t("wizard.step4.delete")}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  );
}

function Step5({ opp, set }: { opp: OppState; set: Set }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <SectionTitle title={t("wizard.step5.sectionTitle")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("wizard.fields.desiredPrice")}
          required
          hint={t("wizard.step5.desiredPriceHint")}
        >
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={2000000}
              step={100}
              inputMode="decimal"
              className="pr-9"
              value={opp.desired_price_excl_tax ?? ""}
              onChange={(e) =>
                set("desired_price_excl_tax", e.target.value ? parseFloat(e.target.value) : null)
              }
              onBlur={(e) => {
                if (!e.target.value) return;
                const n = parseFloat(e.target.value);
                if (!Number.isNaN(n))
                  set("desired_price_excl_tax", Math.min(Math.max(n, 0), 2000000));
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              €
            </span>
          </div>
        </Field>
        <Field label={t("wizard.fields.priceNegotiable")} required>
          <Selector
            value={opp.price_negotiable}
            onChange={(v) => set("price_negotiable", v)}
            options={NEGOTIABLE_OPTIONS}
          />
        </Field>
        <Field label={t("wizard.fields.availability")} required>
          <Selector
            value={opp.availability}
            onChange={(v) => set("availability", v)}
            options={AVAILABILITY_OPTIONS}
          />
        </Field>
        <Field
          label={t("wizard.fields.freeOfPledge")}
          required
          hint={t("wizard.step5.freeOfPledgeHint")}
        >
          <Selector
            value={opp.free_of_pledge}
            onChange={(v) => set("free_of_pledge", v)}
            options={YES_NO_OPTIONS}
          />
        </Field>
      </div>
      <Field label={t("wizard.fields.specialConditions")}>
        <Textarea
          rows={3}
          value={opp.special_conditions ?? ""}
          onChange={(e) => set("special_conditions", e.target.value)}
        />
      </Field>
      <SectionTitle title={t("wizard.step5.sectionContact.title")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("wizard.fields.contactName")} required>
          <Input
            value={opp.onsite_contact_name ?? ""}
            onChange={(e) => set("onsite_contact_name", e.target.value)}
          />
        </Field>
        <Field label={t("wizard.fields.contactPhone")} required>
          <Input
            type="tel"
            value={opp.onsite_contact_phone ?? ""}
            onChange={(e) => set("onsite_contact_phone", e.target.value)}
          />
        </Field>
        <Field label={t("wizard.fields.contactEmailOptional")}>
          <Input
            type="email"
            value={opp.onsite_contact_email ?? ""}
            onChange={(e) => set("onsite_contact_email", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function Step6({
  opp,
  photos,
  signedUrls,
  refs,
}: {
  opp: OppState;
  photos: Photo[];
  signedUrls: Record<string, string>;
  refs: Refs;
}) {
  const { t } = useTranslation();
  const blocking = useMemo(() => {
    const b: string[] = [];
    const covered = new Set(photos.map((p) => p.category).filter(Boolean));
    const missingPhotos = requiredPhotoCategories(opp as unknown as Record<string, unknown>).filter(
      (c) => !covered.has(c.value),
    );
    for (const f of missingSubmissionFields(opp as unknown as Record<string, unknown>)) {
      b.push(t("wizard.step6.missingFieldAtStep", { label: f.label, step: f.step + 1 }));
    }
    if (
      categoryProfile(opp.vehicle_category).powered &&
      opp.vehicle_runs === "non" &&
      !opp.not_running_reason?.trim()
    )
      b.push(t("wizard.step6.blockingNotRunningReason"));
    if (opp.technical_inspection_status === "oui" && !opp.inspection_valid_until)
      b.push(t("wizard.step6.blockingInspectionDate"));
    if (missingPhotos.length)
      b.push(
        t("wizard.step6.blockingMissingPhotos", {
          list: missingPhotos.map((m) => m.label).join(", "),
        }),
      );
    return b;
  }, [opp, photos, t]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!opp.registration_number) w.push(t("wizard.step6.warningRegistrationNumber"));
    if (!opp.power) w.push(t("wizard.step6.warningPower"));
    if (!opp.euro_standard && categoryProfile(opp.vehicle_category).powered)
      w.push(t("wizard.step6.warningEuroStandard"));
    if (!opp.postal_code) w.push(t("wizard.step6.warningPostalCode"));
    return w;
  }, [opp, t]);

  return (
    <div className="space-y-6">
      <SectionTitle title={t("wizard.step6.sectionTitle")} hint={t("wizard.step6.sectionHint")} />

      {blocking.length > 0 && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> {t("wizard.step6.blockingTitle")}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {blocking.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("wizard.step6.blockingFooter")}</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-status-analysis bg-status-analysis/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-status-analysis-foreground">
            <AlertTriangle className="h-4 w-4" /> {t("wizard.step6.warningTitle")}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-status-analysis-foreground">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-status-analysis-foreground/80">
            {t("wizard.step6.warningFooter")}
          </p>
        </div>
      )}

      <RecapBlock
        title={t("wizard.step6.blocks.vehicle")}
        rows={[
          [
            t("wizard.recap.category"),
            (refs?.vehicleCategories ?? []).find((c) => c.slug === opp.vehicle_category)
              ?.label_fr ?? "—",
          ],
          [t("wizard.recap.brandModel"), `${opp.brand ?? "—"} ${opp.model ?? ""}`],
          [
            t("wizard.fields.mileage"),
            opp.mileage ? opp.mileage.toLocaleString("fr-FR") + " km" : "—",
          ],
          [t("wizard.fields.registrationNumber"), opp.registration_number ?? "—"],
          [t("wizard.recap.vin"), opp.vin ?? "—"],
        ]}
      />
      <RecapBlock
        title={t("wizard.step6.blocks.location")}
        rows={[
          [t("wizard.fields.city"), opp.city ?? "—"],
          [t("wizard.fields.postalCode"), opp.postal_code ?? "—"],
          [t("wizard.recap.country"), opp.country ?? "—"],
          [t("wizard.fields.visibleOnSite"), labelFor(VISIBILITY_OPTIONS, opp.visible_on_site)],
        ]}
      />
      <RecapBlock
        title={t("wizard.step2.sectionTitle")}
        rows={[
          [t("wizard.recap.fuelType"), labelFor(FUEL_OPTIONS, opp.fuel_type)],
          [t("wizard.recap.gearbox"), labelFor(GEARBOX_OPTIONS, opp.gearbox)],
          [t("wizard.fields.power"), opp.power ?? "—"],
          [t("wizard.recap.euroStandard"), opp.euro_standard ?? "—"],
          [t("wizard.recap.gvw"), opp.gross_vehicle_weight ?? "—"],
          [t("wizard.fields.cabinType"), labelFor(CABIN_OPTIONS, opp.cabin_type)],
          [t("wizard.recap.wheelbase"), opp.wheelbase_mm ? `${opp.wheelbase_mm} mm` : "—"],
          [t("wizard.fields.suspensionType"), labelFor(SUSPENSION_OPTIONS, opp.suspension_type)],
          [t("wizard.fields.tyreSize"), opp.tyre_size ?? "—"],
          [
            t("wizard.recap.boxDimensions"),
            opp.box_height_mm || opp.box_width_mm || opp.box_depth_mm
              ? `${opp.box_height_mm ?? "—"} × ${opp.box_width_mm ?? "—"} × ${opp.box_depth_mm ?? "—"} mm`
              : "—",
          ],
          [
            t("wizard.fields.hasAirConditioning"),
            labelFor(YES_NO_OPTIONS, opp.has_air_conditioning),
          ],
          [t("wizard.fields.hasHeating"), labelFor(YES_NO_OPTIONS, opp.has_heating)],
          [t("wizard.fields.hasHydraulicHook"), labelFor(YES_NO_OPTIONS, opp.has_hydraulic_hook)],
          [t("wizard.fields.hasCrane"), labelFor(YES_NO_OPTIONS, opp.has_crane)],
          [t("wizard.fields.tailLiftPresent"), labelFor(YES_NO_OPTIONS, opp.tail_lift_present)],
          [
            t("wizard.fields.otherEquipment"),
            [...(opp.equipment ?? []), opp.other_equipment_details].filter(Boolean).join(", ") ||
              "—",
          ],
        ]}
      />
      <RecapBlock
        title={t("wizard.recap.conditionTitle")}
        rows={[
          [t("wizard.fields.generalCondition"), labelFor(CONDITION_OPTIONS, opp.general_condition)],
          [t("wizard.recap.runs"), labelFor(YES_NO_OPTIONS, opp.vehicle_runs)],
          ...(opp.vehicle_runs === "non"
            ? [
                [t("wizard.fields.notRunningReason"), opp.not_running_reason || "—"] as [
                  string,
                  string,
                ],
              ]
            : []),
          [
            t("wizard.recap.technicalInspection"),
            labelFor(YES_NO_OPTIONS, opp.technical_inspection_status),
          ],
          ...(opp.technical_inspection_status === "oui"
            ? [
                [
                  t("wizard.recap.inspectionValidUntilShort"),
                  opp.inspection_valid_until
                    ? format(parseISO(opp.inspection_valid_until), "dd/MM/yyyy")
                    : "—",
                ] as [string, string],
              ]
            : []),
          [t("wizard.recap.maintenanceUpToDate"), labelFor(YES_NO_OPTIONS, opp.maintenance_status)],

          [
            t("wizard.fields.keysCount"),
            labelFor(KEYS_COUNT_OPTIONS, opp.keys_count ? String(opp.keys_count) : null),
          ],
          [t("wizard.fields.defectsAndComments"), opp.defects_and_comments || "—"],
        ]}
      />
      <RecapBlock
        title={t("wizard.recap.priceTitle")}
        rows={[
          [t("wizard.recap.desiredPriceShort"), formatPrice(opp.desired_price_excl_tax)],
          [t("wizard.recap.negotiable"), labelFor(NEGOTIABLE_OPTIONS, opp.price_negotiable)],
          [t("wizard.fields.availability"), labelFor(AVAILABILITY_OPTIONS, opp.availability)],
          [t("wizard.recap.freeOfPledgeShort"), labelFor(YES_NO_OPTIONS, opp.free_of_pledge)],
        ]}
      />
      <RecapBlock
        title={t("wizard.step5.sectionContact.title")}
        rows={[
          [t("wizard.recap.name"), opp.onsite_contact_name ?? "—"],
          [t("wizard.recap.phone"), opp.onsite_contact_phone ?? "—"],
          [t("wizard.recap.email"), opp.onsite_contact_email ?? "—"],
        ]}
      />

      <div>
        <div className="text-sm font-semibold">
          {t("wizard.step6.photosCount", { count: photos.length })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-secondary"
            >
              {signedUrls[p.storage_path] ? (
                <img
                  src={signedUrls[p.storage_path]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="m-auto mt-6 h-6 w-6 text-muted-foreground" />
              )}
              {p.is_main_photo && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
                  {t("wizard.step4.mainPhoto")}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecapBlock({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Check className="h-4 w-4 text-accent" /> {title}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([k, v], i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 border-b border-border/60 pb-1 last:border-b-0"
          >
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="max-w-[60%] text-right text-sm">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
