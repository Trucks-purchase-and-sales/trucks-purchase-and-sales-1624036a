import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStepScroll } from "@/hooks/useStepScroll";
import { useServerFn } from "@tanstack/react-start";
import {
  saveOpportunity, submitOpportunity, getOpportunity, addPhotoRecord,
  deletePhoto, setMainPhoto, signPhotoUrls, reorderPhotos, createPhotoUploadUrl,
} from "@/lib/opportunities.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, CalendarIcon, Camera, Check, ImageIcon, Info, Save, Send, Star,
  Trash2, X, AlertTriangle,
} from "lucide-react";
import { OcrPrefillDialog } from "@/components/ocr/OcrPrefillDialog";
import { VoiceDictation } from "@/components/wizard/VoiceDictation";
import { useAiFeatures } from "@/hooks/useAiFeatures";

import {
  AVAILABILITY_OPTIONS, AXLE_CONFIG_OPTIONS, CABIN_OPTIONS, CONDITION_OPTIONS,
  EQUIPMENT_OPTIONS, EU27_CODES, EURO_OPTIONS, FUEL_OPTIONS, GEARBOX_OPTIONS,
  ACCIDENT_OPTIONS, NEGOTIABLE_OPTIONS, PHOTO_CATEGORIES, requiredPhotoCategories,
  KEYS_COUNT_OPTIONS, VISIBILITY_OPTIONS,
  SUSPENSION_OPTIONS, YES_NO_OPTIONS, TAIL_LIFT_CONDITION_OPTIONS, missingSubmissionFields,
  categoryProfile,
  labelFor, formatPrice,

} from "@/lib/wilmet-constants";
import { getReferenceData } from "@/lib/reference-data.functions";
import { SearchableCombobox } from "@/components/pickers/SearchableCombobox";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

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

const STEPS = [
  "Informations générales", "Caractéristiques", "État du véhicule",
  "Photos", "Prix & disponibilité", "Récapitulatif",
];

export const Route = createFileRoute("/_authenticated/opportunities/new")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s.id === "string" ? { id: s.id } : {},
  component: WizardPage,
});

function WizardPage() {
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
    data: refData, isLoading: refLoading, isError: refError, refetch: refRefetch,
  } = useQuery({
    queryKey: ["reference-data"],
    queryFn: () => refFn(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const refPartialFailure = (refData?.failed?.length ?? 0) > 0;
  const refState: RefState = { loading: refLoading, error: refError, retry: () => { void refRefetch(); } };


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
        toast.error("Impossible de charger le brouillon");
      }
    })();
  }, [initialId, getFn]);

  // Sign photo URLs.
  useEffect(() => {
    const paths = photos.map((p) => p.storage_path);
    if (paths.length === 0) { setSignedUrls({}); return; }
    signFn({ data: { paths } })
      .then((r) => setSignedUrls(r.urls))
      .catch(() => toast.error("Prévisualisation photo indisponible", { description: "La photo est enregistrée, mais son aperçu n'a pas pu être chargé." }));
  }, [photos, signFn]);

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
      toast.error("Sauvegarde impossible", { description: (e as Error).message });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    const id = await persist();
    if (id) toast.success("Brouillon enregistré");
  }

  async function next() {
    const id = await persist();
    if (id) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submitAll() {
    const missingFields = missingSubmissionFields(opp as unknown as Record<string, unknown>);
    if (missingFields.length > 0) {
      toast.error("Informations obligatoires manquantes", {
        description: missingFields.map((f) => f.label).join(", "),
      });
      setStep(missingFields[0].step); return;
    }
    if (categoryProfile(opp.vehicle_category).powered && opp.vehicle_runs === "non" && !opp.not_running_reason?.trim()) {
      toast.error("Motif d'immobilisation obligatoire", { description: "Précisez pourquoi le véhicule ne roule pas (étape 3)." });
      setStep(2); return;
    }
    if (opp.technical_inspection_status === "oui" && !opp.inspection_valid_until) {
      toast.error("Date de contrôle technique obligatoire", { description: "Indiquez jusqu'à quand le contrôle technique est valable (étape 3)." });
      setStep(2); return;
    }
    const covered = new Set(photos.map((p) => p.category));
    const missingPhotos = requiredPhotoCategories(opp as unknown as Record<string, unknown>)
      .filter((c) => !covered.has(c.value));
    if (missingPhotos.length > 0) {
      toast.error("Photos obligatoires manquantes", { description: missingPhotos.map((m) => m.label).join(", ") });
      setStep(3); return;
    }
    let id = opp.id;

    if (!id) id = (await persist()) ?? undefined;
    if (!id) return;
    setSubmitting(true);
    try {
      await submitFn({ data: { id } });
      toast.success("Opportunité envoyée à Wilmet");
      navigate({ to: "/opportunities/success/$id", params: { id } });
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
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
      toast.error("Aucune photo sélectionnée");
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
                maxSizeMB: 1.2, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.82,
              });
              file = new File([blob], original.name, { type: blob.type || original.type });
            } catch { /* fall back to original */ }
          }
          const upload = await createUploadUrlFn({ data: { opportunityId: id, fileName: file.name } });
          const { error } = await supabase.storage.from("vehicle-photos").uploadToSignedUrl(upload.path, upload.token, file, {
            contentType: file.type || "image/jpeg",
          });
          if (error) throw error;
          const rec = await addPhotoFn({
            data: {
              vehicle_opportunity_id: id, storage_path: upload.path, category,
              is_main_photo: initialPhotoCount === 0 && uploadedCount === 0,
              sort_order: initialPhotoCount + uploadedCount,
            },
          });
          setPhotos((p) => [...p, rec as Photo]);
          uploadedCount += 1;
        } catch (e) {
          toast.error(`Photo non téléchargée: ${original.name}`, { description: (e as Error).message });
        }
      }
      if (uploadedCount > 0) {
        toast.success(uploadedCount === 1 ? "Photo ajoutée" : `${uploadedCount} photos ajoutées`);
      }
    } catch (e) {
      toast.error("Téléchargement impossible", { description: (e as Error).message });
    } finally {
      setUploadingPhotos(false);
      setPendingPhotos((current) => current.filter((item) => !pending.some((p) => p.id === item.id)));
      pending.forEach((item) => URL.revokeObjectURL(item.url));
    }
  }

  async function removePhoto(photoId: string) {
    try {
      await delPhotoFn({ data: { photoId } });
      setPhotos((p) => p.filter((x) => x.id !== photoId));
    } catch (e) {
      toast.error("Suppression impossible");
    }
  }
  async function makeMain(photoId: string) {
    if (!opp.id) return;
    try {
      await setMainFn({ data: { opportunityId: opp.id, photoId } });
      setPhotos((p) => p.map((x) => ({ ...x, is_main_photo: x.id === photoId })));
    } catch { /* ignore */ }
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
      reorderFn({ data: { orders: withOrder.map(({ id, sort_order }) => ({ id, sort_order })) } }).catch(() => {
        toast.error("Ordre non sauvegardé");
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
            <h1 className="text-lg font-semibold">Compte en cours d&apos;initialisation</h1>
            <p className="text-muted-foreground">
              Votre profil applicatif n&apos;a pas encore été créé, votre type de compte est donc inconnu.
              Ce n&apos;est pas une restriction liée à votre rôle : contactez Wilmet pour finaliser
              l&apos;initialisation de votre compte.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Retour au tableau de bord</Button>
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
            <h1 className="text-lg font-semibold">Fonction réservée aux vendeurs</h1>
            <p className="text-muted-foreground">
              Votre compte est configuré comme client (recherche de véhicules). Pour proposer un véhicule à la vente,
              contactez Wilmet afin que votre compte soit activé en tant que vendeur.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>Retour au tableau de bord</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-10" ref={stepRef}>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
        {opp.reference_number && <Badge variant="outline">{opp.reference_number}</Badge>}
      </div>

      <div className="mb-6">
        <h1 tabIndex={-1} data-step-title className="text-2xl font-bold tracking-tight sm:text-3xl outline-none">Nouvelle opportunité véhicule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
        </p>
        <Progress value={progress} className="mt-4 h-1.5" />
        <div className="mt-3 hidden gap-2 sm:flex">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                i === step ? "border-accent bg-accent/10 text-accent" :
                i < step ? "border-status-accepted bg-status-accepted/40 text-status-accepted-foreground" :
                "border-border bg-card text-muted-foreground",
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
            <span>
              Catalogue indisponible ou incomplet — la saisie libre reste possible, vos informations sont conservées.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refRefetch()}>Réessayer</Button>
        </div>
      )}

      <Card className="border-border/70">
        <CardContent className="p-5 sm:p-8">
          {step === 0 && <Step1 opp={opp} set={set} applyOcr={(f: Partial<OppState>) => setOpp((o) => ({ ...o, ...f }))} refs={refData} refState={refState} />}
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
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Précédent
            </Button>
          )}
          <Button variant="ghost" onClick={saveDraft} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer en brouillon"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {step < STEPS.length - 1 && (
            <Button onClick={next} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Continuer <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
          {step === STEPS.length - 1 && (
            <Button onClick={submitAll} disabled={submitting} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Send className="mr-1.5 h-4 w-4" /> {submitting ? "Envoi…" : "Envoyer à Wilmet"}
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
  value, onChange, options, placeholder, state, emptyPlaceholder, allowCustom, customLabel, disabled, curated,
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
  /** Curated catalogs (catégorie, carrosserie, pays) never degrade to free text. */
  curated?: boolean;
}) {
  if (disabled) {
    return <Input disabled placeholder={placeholder} />;
  }
  if (state.loading && options.length === 0) {
    return <Input disabled placeholder="Chargement des référentiels…" />;
  }
  if (options.length === 0 && curated) {
    return (
      <div className="space-y-1.5">
        <Input disabled value={value ?? ""} placeholder="Référentiel indisponible" />
        <button type="button" onClick={state.retry} className="text-[11px] font-medium text-accent underline">
          Référentiel indisponible — réessayer
        </button>
        <p className="text-[11px] text-muted-foreground">
          Cette liste est fermée : la saisie libre n'est pas autorisée. Votre brouillon reste enregistrable.
        </p>
      </div>
    );
  }
  if (state.error && options.length === 0) {
    return (
      <div className="space-y-1.5">
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={emptyPlaceholder ?? "Saisie libre"} />
        <button type="button" onClick={state.retry} className="text-[11px] font-medium text-accent underline">
          Référentiel indisponible — réessayer
        </button>
      </div>
    );
  }
  if (options.length === 0) {
    return <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={emptyPlaceholder ?? placeholder} />;
  }
  return (
    <SearchableCombobox
      value={value ?? undefined}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowCustom={allowCustom}
      {...(customLabel ? { customLabel } : {})}
    />
  );
}


function Field({ label, hint, children, action, required }: { label: string; hint?: string; children: React.ReactNode; action?: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-accent" title="Requis à l'envoi">*</span>}
        </Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}


function Selector({
  value, onChange, options, placeholder,
}: { value: string | null | undefined; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder ?? "Sélectionner"} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function DatePickerField({
  value,
  onChange,
  placeholder = "Sélectionner une date",
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
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISO(value), "dd/MM/yyyy", { locale: fr }) : placeholder}
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

function Step1({ opp, set, applyOcr, refs, refState }: { opp: OppState; set: Set; applyOcr: (f: Partial<OppState>) => void; refs: Refs; refState: RefState }) {
  const ai = useAiFeatures();
  function handleOcrApply(fields: Record<string, string>) {
    const intFields = new Set([
      "mileage", "wheelbase_mm", "box_height_mm", "box_width_mm", "box_depth_mm",
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
    if (!opp.vehicle_category) return withCurrent(all.map((b) => ({ value: b.label, label: b.label })));
    const allowed = new Set(
      (refs?.categoryBrands ?? [])
        .filter((cb) => cb.category_slug === opp.vehicle_category)
        .map((cb) => cb.brand_slug),
    );
    const filtered = all.filter((b) => allowed.has(b.slug));
    return withCurrent((filtered.length > 0 ? filtered : all).map((b) => ({ value: b.label, label: b.label })));
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
    () => (refs?.countries ?? [])
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
    const list = (scoped.length > 0 ? scoped : all).map((b) => ({ value: b.slug, label: b.label_fr }));
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
            Gagnez du temps avec l'IA
          </div>
          <div className="text-sm font-semibold text-accent-foreground/90 sm:text-base">
            Photographiez la plaque et la carte grise : l'IA remplit les champs pour vous.
          </div>
        </div>
        <div className="[&_button]:h-12 [&_button]:border-0 [&_button]:bg-background [&_button]:px-6 [&_button]:text-base [&_button]:font-bold [&_button]:text-accent [&_button]:shadow-md [&_button:hover]:bg-background/90">
          <OcrPrefillDialog vehicleOpportunityId={opp.id} onApply={handleOcrApply} />
        </div>
      </div>
      )}

      <SectionTitle title="Informations générales" hint="Ces éléments identifient le véhicule." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie de véhicule" required>
          <RefCombobox
            value={opp.vehicle_category}
            onChange={(v) => onCategoryChange(v)}
            options={categoryOptions}
            placeholder="Sélectionner une catégorie"
            state={refState}
          />
        </Field>
        <Field label="Marque" required hint="Marque absente de la liste ? Saisissez-la, elle sera conservée.">
          <RefCombobox
            value={opp.brand}
            onChange={(v) => { set("brand", v); set("model", null); }}
            options={brandOptions}
            placeholder={opp.vehicle_category ? "Sélectionner une marque" : "Sélectionnez d'abord une catégorie"}
            disabled={!opp.vehicle_category}
            emptyPlaceholder="Saisir la marque"
            state={refState}
            allowCustom
            customLabel={(q) => `Ajouter la marque « ${q} »`}
          />
        </Field>
        <Field label="Modèle" required hint="Modèle absent de la liste ? Saisissez-le librement.">
          {modelOptions.length > 0 ? (
            <SearchableCombobox
              value={opp.model ?? undefined}
              onChange={(v) => set("model", v)}
              options={modelOptions}
              placeholder="Sélectionner un modèle"
              allowCustom
              customLabel={(q) => `Ajouter le modèle « ${q} »`}
            />
          ) : (
            <Input value={opp.model ?? ""} onChange={(e) => set("model", e.target.value)} disabled={!opp.brand} placeholder={opp.brand ? "Saisir le modèle" : "Sélectionnez d'abord une marque"} />
          )}
        </Field>
        <Field label="Carrosserie" required hint="Type de carrosserie du véhicule.">
          <RefCombobox
            value={opp.body_type}
            onChange={(v) => { set("body_type", v); if (v !== "autre") set("body_type_other", null); }}
            options={bodyTypeOptions}
            placeholder={opp.vehicle_category ? "Sélectionner une carrosserie" : "Sélectionnez d'abord une catégorie"}
            disabled={!opp.vehicle_category}
            emptyPlaceholder="Saisir la carrosserie"
            state={refState}
          />
        </Field>
        {opp.body_type === "autre" && (
          <Field label="Précisez la carrosserie" required>
            <Input value={opp.body_type_other ?? ""} onChange={(e) => set("body_type_other", e.target.value)} placeholder="ex : porte-conteneurs" />
          </Field>
        )}


        <Field label="Date de 1re mise en circulation" required>
          <DatePickerField
            value={opp.first_registration_date}
            onChange={(v) => set("first_registration_date", v)}
            placeholder="Choisir la date"
            disableFuture
          />
        </Field>
        {profile.hasOdometer && (
          <Field label="Kilométrage (km)" required hint="Kilométrage actuel affiché au compteur.">
            <div className="relative">
              <Input
                type="number" min={0} max={3000000} step={1000} inputMode="numeric" className="pr-10"
                value={opp.mileage ?? ""}
                onChange={(e) => set("mileage", e.target.value ? parseInt(e.target.value) : null)}
                onBlur={(e) => {
                  if (!e.target.value) return;
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isNaN(n)) set("mileage", Math.min(Math.max(n, 0), 3000000));
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">km</span>
            </div>
          </Field>
        )}
        <Field label="Immatriculation (optionnel)"><Input value={opp.registration_number ?? ""} onChange={(e) => set("registration_number", e.target.value.toUpperCase())} /></Field>
        <Field label="Numéro de châssis / VIN" required hint="17 caractères, visible sur la plaque constructeur ou le châssis. Indispensable pour l'expertise Wilmet."><Input value={opp.vin ?? ""} onChange={(e) => set("vin", e.target.value.toUpperCase())} placeholder="ex : VF3XXXXXXXXXXXXXX" /></Field>
      </div>

      <SectionTitle title="Localisation du véhicule" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ville" required><Input value={opp.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Code postal"><Input value={opp.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} /></Field>
        <Field label="Pays (UE-27)" required>
          <RefCombobox
            value={opp.country}
            onChange={(v) => set("country", v)}
            options={countryOptions}
            placeholder="Sélectionner un pays"
            emptyPlaceholder="Saisir le pays"
            state={refState}
          />
        </Field>

      </div>
      <Field label="Lien de localisation (optionnel)" hint="Lien Google Maps ou adresse précise du lieu où se trouve le véhicule.">
        <Input value={opp.location_url ?? ""} onChange={(e) => set("location_url", e.target.value)} placeholder="https://maps.google.com/…" />
      </Field>

      <Field label="Le véhicule est-il visible sur parc ?" required>
        <RadioGroup value={opp.visible_on_site ?? ""} onValueChange={(v) => set("visible_on_site", v)} className="flex flex-wrap gap-3">
          {VISIBILITY_OPTIONS.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
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
        title="Caractéristiques"
        hint={profile.powered ? undefined : "Catégorie non motorisée : les champs moteur ne sont pas demandés."}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {profile.powered && (
          <>
            <Field label="Énergie" required><Selector value={opp.fuel_type} onChange={(v) => set("fuel_type", v)} options={fuelOptions} /></Field>
            <Field label="Boîte de vitesses"><Selector value={opp.gearbox} onChange={(v) => set("gearbox", v)} options={gearboxOptions} /></Field>
            <Field label="Puissance" hint="En chevaux (ch) ou kilowatts (kW)."><Input value={opp.power ?? ""} onChange={(e) => set("power", e.target.value)} placeholder="ex : 320 ch / 235 kW" /></Field>
            <Field label="Norme Euro"><Selector value={opp.euro_standard} onChange={(v) => set("euro_standard", v)} options={euroOptions} /></Field>
          </>
        )}
        <Field label="PTAC / poids total autorisé (t)" required hint="En tonnes (ex. 3.5, 19, 44).">
          <div className="relative">
            <Input className="pr-8" inputMode="decimal" value={opp.gross_vehicle_weight ?? ""} onChange={(e) => set("gross_vehicle_weight", e.target.value)} placeholder="3.5, 19…" />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">t</span>
          </div>
        </Field>
        <Field label="Charge utile (kg)" hint="En kilogrammes."><Input value={opp.payload ?? ""} onChange={(e) => set("payload", e.target.value)} /></Field>
        <Field label="Configuration essieux"><Selector value={opp.axle_configuration} onChange={(v) => set("axle_configuration", v)} options={AXLE_CONFIG_OPTIONS} /></Field>
        {profile.powered && (
          <Field label="Cabine"><Selector value={opp.cabin_type} onChange={(v) => set("cabin_type", v)} options={CABIN_OPTIONS} /></Field>
        )}
        <Field label="Empattement (mm)"><Input type="number" min={0} value={opp.wheelbase_mm ?? ""} onChange={(e) => set("wheelbase_mm", e.target.value ? parseInt(e.target.value) : null)} /></Field>
        <Field label="Type de suspension"><Selector value={opp.suspension_type} onChange={(v) => set("suspension_type", v)} options={SUSPENSION_OPTIONS} /></Field>
        <Field label="Dimension des pneus" hint="ex : 315/70 R22.5"><Input value={opp.tyre_size ?? ""} onChange={(e) => set("tyre_size", e.target.value)} /></Field>
      </div>

      <SectionTitle title="Dimensions intérieures (caisse / benne)" hint="Toutes les dimensions sont en millimètres (mm)." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Hauteur intérieure (mm)"><Input type="number" min={0} value={opp.box_height_mm ?? ""} onChange={(e) => set("box_height_mm", e.target.value ? parseInt(e.target.value) : null)} /></Field>
        <Field label="Largeur intérieure (mm)"><Input type="number" min={0} value={opp.box_width_mm ?? ""} onChange={(e) => set("box_width_mm", e.target.value ? parseInt(e.target.value) : null)} /></Field>
        <Field label="Longueur intérieure (mm)"><Input type="number" min={0} value={opp.box_depth_mm ?? ""} onChange={(e) => set("box_depth_mm", e.target.value ? parseInt(e.target.value) : null)} /></Field>
      </div>

      <SectionTitle title="Équipements" hint="Confort, levage puis équipements complémentaires." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Climatisation"><Selector value={opp.has_air_conditioning} onChange={(v) => set("has_air_conditioning", v)} options={YES_NO_OPTIONS} /></Field>
        <Field label="Chauffage additionnel"><Selector value={opp.has_heating} onChange={(v) => set("has_heating", v)} options={YES_NO_OPTIONS} /></Field>
        <Field label="Crochet / attelage hydraulique"><Selector value={opp.has_hydraulic_hook} onChange={(v) => set("has_hydraulic_hook", v)} options={YES_NO_OPTIONS} /></Field>
        <Field label="Grue"><Selector value={opp.has_crane} onChange={(v) => set("has_crane", v)} options={YES_NO_OPTIONS} /></Field>
      </div>
      {opp.has_crane === "oui" && (
        <Field label="Détails de la grue" hint="Marque, tonnage/mètre, nombre de sections, VGP.">
          <Textarea rows={2} value={opp.crane_details ?? ""} onChange={(e) => set("crane_details", e.target.value)} />
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hayon élévateur"><Selector value={opp.tail_lift_present} onChange={(v) => set("tail_lift_present", v)} options={YES_NO_OPTIONS} /></Field>
        {opp.tail_lift_present === "oui" && (
          <>
            <Field label="Hayon homologué ?"><Selector value={opp.tail_lift_homologated} onChange={(v) => set("tail_lift_homologated", v)} options={YES_NO_OPTIONS} /></Field>
            <Field label="Carnet d'homologation fourni ?"><Selector value={opp.tail_lift_homologation_book} onChange={(v) => set("tail_lift_homologation_book", v)} options={YES_NO_OPTIONS} /></Field>
            <Field label="Carnet d'entretien du hayon fourni ?"><Selector value={opp.tail_lift_maintenance_book} onChange={(v) => set("tail_lift_maintenance_book", v)} options={YES_NO_OPTIONS} /></Field>
            <Field label="État du hayon"><Selector value={opp.tail_lift_condition} onChange={(v) => set("tail_lift_condition", v)} options={TAIL_LIFT_CONDITION_OPTIONS} /></Field>
          </>
        )}
      </div>
      {opp.tail_lift_present === "oui" && (
        <Field label="Commentaire hayon" hint="Marque, capacité de levage, dernière VGP.">
          <Textarea rows={2} value={opp.tail_lift_comment ?? ""} onChange={(e) => set("tail_lift_comment", e.target.value)} />
        </Field>
      )}

      <Field label="Autres équipements" hint="Climatisation, chauffage, attelage hydraulique, grue, hayon et suspension sont déjà renseignés ci-dessus.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EQUIPMENT_OPTIONS.map((e) => (
            <label key={e} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <Checkbox checked={equip.includes(e)} onCheckedChange={() => toggle(e)} />
              {e}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Autres équipements (précisez)" hint="Tout équipement non listé ci-dessus.">
        <Textarea rows={2} value={opp.other_equipment_details ?? ""} onChange={(e) => set("other_equipment_details", e.target.value)} />
      </Field>

    </div>
  );
}

function Step3({ opp, set }: { opp: OppState; set: Set }) {
  const ai = useAiFeatures();
  const conditionOptions = CONDITION_OPTIONS;

  return (
    <div className="space-y-6">
      <SectionTitle title="État du véhicule" hint="Soyez précis sur les défauts visibles ou connus. Une description transparente permet à Wilmet de vous répondre plus rapidement." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="État général" required><Selector value={opp.general_condition} onChange={(v) => set("general_condition", v)} options={conditionOptions} /></Field>
        {categoryProfile(opp.vehicle_category).powered && (
          <Field label="Le véhicule roule-t-il ?" required><Selector value={opp.vehicle_runs} onChange={(v) => set("vehicle_runs", v)} options={YES_NO_OPTIONS} /></Field>
        )}
        <Field label="Contrôle technique valide ?"><Selector value={opp.technical_inspection_status} onChange={(v) => set("technical_inspection_status", v)} options={YES_NO_OPTIONS} /></Field>
        {opp.technical_inspection_status === "oui" && (
          <Field label="Contrôle technique valable jusqu'au" required hint="Date obligatoire lorsque le contrôle technique est valide.">
            <DatePickerField value={opp.inspection_valid_until} onChange={(v) => set("inspection_valid_until", v)} placeholder="Choisir la date" />
          </Field>
        )}
        <Field label="Entretien à jour ?"><Selector value={opp.maintenance_status} onChange={(v) => set("maintenance_status", v)} options={YES_NO_OPTIONS} /></Field>
        <Field label="Véhicule accidenté ?" hint="Sinistre déclaré ou réparation structurelle connue."><Selector value={opp.has_accident} onChange={(v) => set("has_accident", v)} options={ACCIDENT_OPTIONS} /></Field>
        
        <Field label="Carnet d'entretien disponible ?"><Selector value={opp.has_service_book} onChange={(v) => set("has_service_book", v)} options={YES_NO_OPTIONS} /></Field>
        <Field label="Nombre de clés">
          <Selector
            value={opp.keys_count ? String(opp.keys_count) : null}
            onChange={(v) => set("keys_count", v ? parseInt(v, 10) : null)}
            options={KEYS_COUNT_OPTIONS}
          />
        </Field>
      </div>
      {categoryProfile(opp.vehicle_category).powered && opp.vehicle_runs === "non" && (
        <Field
          label="Pourquoi le véhicule ne roule-t-il pas ?" required
          hint="Champ obligatoire : panne moteur, boîte, freins, batterie, immobilisation administrative…"
          action={ai.voice ? (
            <VoiceDictation
              onText={(t: string) => set("not_running_reason", `${opp.not_running_reason ? opp.not_running_reason + " " : ""}${t}`)}
            />
          ) : undefined}
        >
          <Textarea rows={3} value={opp.not_running_reason ?? ""} onChange={(e) => set("not_running_reason", e.target.value)} />
        </Field>
      )}
      <Field
        label="Défauts, travaux et commentaires"
        hint="Défauts mécaniques ou carrosserie, travaux à prévoir, équipements manquants et toute autre remarque utile."
        action={ai.voice ? (
          <VoiceDictation
            onText={(t: string) => set("defects_and_comments", `${opp.defects_and_comments ? opp.defects_and_comments + " " : ""}${t}`)}
          />
        ) : undefined}
      >
        <Textarea value={opp.defects_and_comments ?? ""} rows={5} onChange={(e) => set("defects_and_comments", e.target.value)} />
      </Field>
    </div>
  );
}


function Step4({
  opp, photos, pendingPhotos, uploading, signedUrls, onUpload, onDelete, onMain, onReorder,
}: {
  opp: OppState;
  photos: Photo[]; pendingPhotos: PendingPhoto[]; uploading: boolean; signedUrls: Record<string, string>;
  onUpload: (files: File[], category: string | null) => void;
  onDelete: (id: string) => void; onMain: (id: string) => void;
  onReorder: (category: string | null, fromId: string, toId: string) => void;
}) {
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
    (c) => !photos.some((p) => p.category === c.value) && !pendingPhotos.some((p) => p.category === c.value),
  );
  return (
    <div className="space-y-6">
      <SectionTitle title="Photos" hint="Plus le dossier photo est complet, plus l'analyse Wilmet sera rapide." />

      {missingRequired.length > 0 && (
        <div className="rounded-xl border border-accent bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <AlertTriangle className="h-4 w-4" /> Photos obligatoires manquantes
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {missingRequired.map((m) => m.label).join(", ")} — l'envoi à Wilmet sera bloqué sans ces photos.
          </p>
        </div>
      )}




      <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-accent" /> Checklist qualité
        </div>
        <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>✓ Photos nettes</li>
          <li>✓ Véhicule complet visible</li>
          <li>✓ Kilométrage lisible</li>
          <li>✓ Défauts photographiés</li>
          <li>✓ Documents utiles ajoutés si disponibles</li>
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
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                      requiredValues.has(cat.value)
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}>
                      {requiredValues.has(cat.value) ? "Obligatoire" : "Recommandé"}
                    </span>
                  </div>


                  <div className="mt-0.5 text-[11px] text-muted-foreground">{cat.helper}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => pick(cat.value)} disabled={uploading}>
                  <Camera className="mr-1 h-4 w-4" /> {uploading ? "Ajout…" : "Ajouter"}
                </Button>
              </div>
              {(inCat.length > 0 || pendingInCat.length > 0) && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {pendingInCat.map((p) => <PendingPhotoTile key={p.id} photo={p} />)}
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
          <Camera className="mr-1.5 h-4 w-4" /> {uploading ? "Téléchargement…" : "Ajouter d'autres photos"}
        </Button>
        {(pendingPhotos.some((p) => p.category === null) || photos.some((p) => p.category === null)) && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {pendingPhotos.filter((p) => p.category === null).map((p) => <PendingPhotoTile key={p.id} photo={p} />)}
            {photos.filter((p) => p.category === null).map((p) => (
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
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-accent bg-secondary">
      <img src={photo.url} alt={photo.name} className="h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 grid place-items-center bg-background/40 text-[11px] font-semibold text-foreground">
        Ajout…
      </div>
    </div>
  );
}

function PhotoTile({
  photo, url, onDelete, onMain,
  isDragging, onDragStart, onDragEnd, onDropOn,
}: {
  photo: Photo; url?: string;
  onDelete: (id: string) => void; onMain: (id: string) => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDropOn?: (overId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => { e.preventDefault(); onDropOn?.(photo.id); }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 ring-2 ring-accent",
      )}
    >
      {url ? <img src={url} alt="" draggable={false} className="h-full w-full object-cover pointer-events-none" /> : <ImageIcon className="h-6 w-6 text-muted-foreground m-auto mt-6" />}
      {photo.is_main_photo && (
        <span className="absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
          Principale
        </span>
      )}
      <div className="absolute inset-0 flex items-end justify-between gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={() => onMain(photo.id)} className="rounded bg-background/90 p-1" title="Photo principale">
          <Star className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(photo.id)} className="rounded bg-background/90 p-1" title="Supprimer">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
    </div>
  );
}

function Step5({ opp, set }: { opp: OppState; set: Set }) {
  return (
    <div className="space-y-6">
      <SectionTitle title="Prix & disponibilité" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prix souhaité HT (en euros €)" required hint="Montant hors taxes, en euros. Wilmet pourra revenir vers vous avec une proposition ajustée.">
          <div className="relative">
            <Input
              type="number" min={0} max={2000000} step={100} inputMode="decimal" className="pr-9"
              value={opp.desired_price_excl_tax ?? ""}
              onChange={(e) => set("desired_price_excl_tax", e.target.value ? parseFloat(e.target.value) : null)}
              onBlur={(e) => {
                if (!e.target.value) return;
                const n = parseFloat(e.target.value);
                if (!Number.isNaN(n)) set("desired_price_excl_tax", Math.min(Math.max(n, 0), 2000000));
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">€</span>
          </div>
        </Field>
        <Field label="Prix négociable ?" required><Selector value={opp.price_negotiable} onChange={(v) => set("price_negotiable", v)} options={NEGOTIABLE_OPTIONS} /></Field>
        <Field label="Disponibilité" required><Selector value={opp.availability} onChange={(v) => set("availability", v)} options={AVAILABILITY_OPTIONS} /></Field>
        <Field label="Libre de tout gage ?" hint="Aucun gage, crédit-bail ou nantissement en cours sur le véhicule."><Selector value={opp.free_of_pledge} onChange={(v) => set("free_of_pledge", v)} options={YES_NO_OPTIONS} /></Field>

      </div>
      <Field label="Conditions particulières">
        <Textarea rows={3} value={opp.special_conditions ?? ""} onChange={(e) => set("special_conditions", e.target.value)} />
      </Field>
      <SectionTitle title="Contact sur place" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nom" required><Input value={opp.onsite_contact_name ?? ""} onChange={(e) => set("onsite_contact_name", e.target.value)} /></Field>
        <Field label="Téléphone" required><Input type="tel" value={opp.onsite_contact_phone ?? ""} onChange={(e) => set("onsite_contact_phone", e.target.value)} /></Field>
        <Field label="Email (optionnel)"><Input type="email" value={opp.onsite_contact_email ?? ""} onChange={(e) => set("onsite_contact_email", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Step6({ opp, photos, signedUrls, refs }: { opp: OppState; photos: Photo[]; signedUrls: Record<string, string>; refs: Refs }) {
  const blocking = useMemo(() => {
    const b: string[] = [];
    const covered = new Set(photos.map((p) => p.category).filter(Boolean));
    const missingPhotos = requiredPhotoCategories(opp as unknown as Record<string, unknown>)
      .filter((c) => !covered.has(c.value));
    for (const f of missingSubmissionFields(opp as unknown as Record<string, unknown>)) {
      b.push(`${f.label} — champ obligatoire (étape ${f.step + 1}).`);
    }
    if (categoryProfile(opp.vehicle_category).powered && opp.vehicle_runs === "non" && !opp.not_running_reason?.trim()) b.push("Le motif d'immobilisation est obligatoire lorsque le véhicule ne roule pas.");
    if (opp.technical_inspection_status === "oui" && !opp.inspection_valid_until) b.push("La date de validité du contrôle technique est obligatoire.");
    if (missingPhotos.length) b.push(`Photos obligatoires manquantes : ${missingPhotos.map((m) => m.label).join(", ")}.`);
    return b;
  }, [opp, photos]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!opp.registration_number) w.push("Immatriculation non renseignée (recommandée).");
    if (!opp.power) w.push("Puissance non renseignée (recommandée).");
    if (!opp.euro_standard && categoryProfile(opp.vehicle_category).powered) w.push("Norme Euro non renseignée (recommandée).");
    if (!opp.postal_code) w.push("Code postal non renseigné (recommandé).");
    return w;
  }, [opp]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Récapitulatif" hint="Vérifiez les informations avant l'envoi." />

      {blocking.length > 0 && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Éléments obligatoires manquants
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {blocking.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            L'envoi à Wilmet est bloqué tant que ces éléments manquent. Vous pouvez enregistrer un brouillon.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-status-analysis bg-status-analysis/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-status-analysis-foreground">
            <AlertTriangle className="h-4 w-4" /> Éléments recommandés manquants
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-status-analysis-foreground">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <p className="mt-3 text-xs text-status-analysis-foreground/80">
            Vous pouvez tout de même envoyer l'opportunité — un dossier complet accélère l'analyse.
          </p>
        </div>
      )}


      <RecapBlock title="Informations véhicule" rows={[
        ["Catégorie", (refs?.vehicleCategories ?? []).find((c) => c.slug === opp.vehicle_category)?.label_fr ?? "—"],
        ["Marque / modèle", `${opp.brand ?? "—"} ${opp.model ?? ""}`],
        ["Kilométrage", opp.mileage ? opp.mileage.toLocaleString("fr-FR") + " km" : "—"],
        ["Immatriculation", opp.registration_number ?? "—"],
        ["VIN", opp.vin ?? "—"],
      ]} />
      <RecapBlock title="Localisation" rows={[
        ["Ville", opp.city ?? "—"],
        ["Code postal", opp.postal_code ?? "—"],
        ["Pays", opp.country ?? "—"],
        ["Visible sur parc", labelFor(VISIBILITY_OPTIONS, opp.visible_on_site)],
      ]} />
      <RecapBlock title="Caractéristiques" rows={[
        ["Énergie", labelFor(FUEL_OPTIONS, opp.fuel_type)],
        ["Boîte", labelFor(GEARBOX_OPTIONS, opp.gearbox)],
        ["Puissance", opp.power ?? "—"],
        ["Norme Euro", opp.euro_standard ?? "—"],
        ["PTAC", opp.gross_vehicle_weight ?? "—"],
        ["Cabine", labelFor(CABIN_OPTIONS, opp.cabin_type)],
        ["Empattement", opp.wheelbase_mm ? `${opp.wheelbase_mm} mm` : "—"],
        ["Suspension", labelFor(SUSPENSION_OPTIONS, opp.suspension_type)],
        ["Pneus", opp.tyre_size ?? "—"],
        ["Dimensions int. (H×L×Lo)", opp.box_height_mm || opp.box_width_mm || opp.box_depth_mm
          ? `${opp.box_height_mm ?? "—"} × ${opp.box_width_mm ?? "—"} × ${opp.box_depth_mm ?? "—"} mm` : "—"],
        ["Climatisation", labelFor(YES_NO_OPTIONS, opp.has_air_conditioning)],
        ["Chauffage additionnel", labelFor(YES_NO_OPTIONS, opp.has_heating)],
        ["Crochet / attelage hydraulique", labelFor(YES_NO_OPTIONS, opp.has_hydraulic_hook)],
        ["Grue", labelFor(YES_NO_OPTIONS, opp.has_crane)],
        ["Hayon", labelFor(YES_NO_OPTIONS, opp.tail_lift_present)],
        ["Autres équipements", [...(opp.equipment ?? []), opp.other_equipment_details].filter(Boolean).join(", ") || "—"],

      ]} />
      <RecapBlock title="État" rows={[
        ["État général", labelFor(CONDITION_OPTIONS, opp.general_condition)],
        ["Roule", labelFor(YES_NO_OPTIONS, opp.vehicle_runs)],
        ...(opp.vehicle_runs === "non" ? [["Raison de l'immobilisation", opp.not_running_reason || "—"] as [string, string]] : []),
        ["Contrôle technique", labelFor(YES_NO_OPTIONS, opp.technical_inspection_status)],
        ...(opp.technical_inspection_status === "oui"
          ? [["CT valable jusqu'au", opp.inspection_valid_until ? format(parseISO(opp.inspection_valid_until), "dd/MM/yyyy") : "—"] as [string, string]]
          : []),
        ["Entretien à jour", labelFor(YES_NO_OPTIONS, opp.maintenance_status)],
        
        ["Nombre de clés", labelFor(KEYS_COUNT_OPTIONS, opp.keys_count ? String(opp.keys_count) : null)],
        ["Défauts, travaux et commentaires", opp.defects_and_comments || "—"],
      ]} />
      <RecapBlock title="Prix" rows={[
        ["Prix souhaité HT", formatPrice(opp.desired_price_excl_tax)],
        ["Négociable", labelFor(NEGOTIABLE_OPTIONS, opp.price_negotiable)],
        ["Disponibilité", labelFor(AVAILABILITY_OPTIONS, opp.availability)],
        ["Libre de tout gage", labelFor(YES_NO_OPTIONS, opp.free_of_pledge)],

      ]} />
      <RecapBlock title="Contact sur place" rows={[
        ["Nom", opp.onsite_contact_name ?? "—"],
        ["Téléphone", opp.onsite_contact_phone ?? "—"],
        ["Email", opp.onsite_contact_email ?? "—"],
      ]} />

      <div>
        <div className="text-sm font-semibold">Photos ({photos.length})</div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-secondary">
              {signedUrls[p.storage_path] ? (
                <img src={signedUrls[p.storage_path]} alt="" className="h-full w-full object-cover" />
              ) : <ImageIcon className="m-auto mt-6 h-6 w-6 text-muted-foreground" />}
              {p.is_main_photo && (
                <span className="absolute left-1 top-1 rounded bg-accent px-1 py-0.5 text-[9px] font-semibold uppercase text-accent-foreground">
                  Principale
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
          <div key={i} className="flex items-start justify-between gap-3 border-b border-border/60 pb-1 last:border-b-0">
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
