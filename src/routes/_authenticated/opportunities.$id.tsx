
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOpportunity, signPhotoUrls, answerInfoRequest, addPhotoRecord, withdrawOpportunity,
} from "@/lib/opportunities.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Camera, Circle, Gauge, MapPin, Send, Truck, MessageCircle, Building2, User2, XCircle,
} from "lucide-react";
import {
  AVAILABILITY_OPTIONS, CABIN_OPTIONS, CONDITION_OPTIONS, FUEL_OPTIONS, GEARBOX_OPTIONS,
  NEGOTIABLE_OPTIONS, PHOTO_CATEGORIES, STATUS_LABEL, YES_NO_OPTIONS,
  VEHICLE_TYPE_OPTIONS, VISIBILITY_OPTIONS, formatDate, formatDateTime,

  formatPrice, labelFor, type OpportunityStatus,
} from "@/lib/wilmet-constants";

import { StageBar } from "@/components/opportunity/StageBar";

export const Route = createFileRoute("/_authenticated/opportunities/$id")({
  component: OpportunityDetail,
});

function OpportunityDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getOpportunity);
  const signFn = useServerFn(signPhotoUrls);
  const answerFn = useServerFn(answerInfoRequest);
  const addPhotoFn = useServerFn(addPhotoRecord);
  const withdrawFn = useServerFn(withdrawOpportunity);

  const { data, isLoading } = useQuery({
    queryKey: ["opp", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const paths = useMemo(() => (data?.photos ?? []).map((p) => p.storage_path), [data]);
  const { data: urlsData } = useQuery({
    queryKey: ["opp-urls", paths.join("|")],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
  });
  const urls = urlsData?.urls ?? {};

  const [respondText, setRespondText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !data) {
    return <div className="py-20 text-center text-muted-foreground">Chargement…</div>;
  }
  const opp = data.opp as unknown as Record<string, unknown> & { id: string; status: OpportunityStatus; reference_number: string | null; owner_side: "partenaire" | "wilmet"; handover_message: string | null };
  const photos = data.photos as Array<{ id: string; storage_path: string; category: string | null; is_main_photo: boolean; sort_order: number }>;
  const history = data.history as Array<{ id: string; old_status: string | null; new_status: string; created_at: string; message: string | null }>;
  const infoReqs = data.infoRequests as Array<{ id: string; message: string; status: string; created_at: string; response: string | null; response_at: string | null }>;

  const openReq = infoReqs.find((r) => r.status === "open");
  const isDraft = opp.status === "brouillon";
  const isPartenaireOwner = opp.owner_side === "partenaire" && !isDraft;
  const canWithdraw = !["achetee","livree","archivee"].includes(opp.status);
  const main = photos.find((p) => p.is_main_photo) ?? photos[0];

  async function uploadExtras(files: FileList) {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("vehicle-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        await addPhotoFn({ data: { vehicle_opportunity_id: id, storage_path: path, category: null, is_main_photo: false, sort_order: photos.length } });
      }
      qc.invalidateQueries({ queryKey: ["opp", id] });
      toast.success("Photos ajoutées");
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function respond() {
    if (!openReq) return;
    setBusy(true);
    try {
      await answerFn({ data: { id: openReq.id, comment: respondText || undefined } });
      toast.success("Réponse envoyée à Wilmet");
      setRespondText("");
      qc.invalidateQueries({ queryKey: ["opp", id] });
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function withdraw() {
    setBusy(true);
    try {
      await withdrawFn({ data: { id } });
      toast.success("Opportunité retirée");
      qc.invalidateQueries({ queryKey: ["opp", id] });
      qc.invalidateQueries({ queryKey: ["my-opps"] });
    } catch (e) {
      toast.error("Retrait impossible", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={opp.status} />
            {opp.reference_number && <Badge variant="outline">{opp.reference_number}</Badge>}
            <Badge variant="outline" className={isPartenaireOwner ? "border-accent/50 text-accent" : ""}>
              {isPartenaireOwner ? <><User2 className="mr-1 h-3 w-3" /> Chez vous</> : <><Building2 className="mr-1 h-3 w-3" /> Chez Wilmet</>}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {(opp.brand as string) || "—"} {(opp.model as string) || ""}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {labelFor(VEHICLE_TYPE_OPTIONS, opp.vehicle_type as string)} · {opp.first_registration_date ? formatDate(opp.first_registration_date as string) : (opp.year as number ?? "—")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isDraft || isPartenaireOwner) && (
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/opportunities/new" search={{ id }}>
                {isDraft ? "Continuer le brouillon" : "Compléter et renvoyer"}
              </Link>
            </Button>
          )}
          {canWithdraw && !isDraft && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="default"><XCircle className="mr-1.5 h-4 w-4" /> Retirer</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retirer cette opportunité ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'opportunité sera archivée et Wilmet n'y aura plus accès pour analyse. Cette action peut être demandée à Wilmet pour être annulée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={withdraw} disabled={busy}>Retirer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {opp.status !== "brouillon" && (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          {opp.assigned_sales_agent_id ? (
            <StageBar status={opp.status} />
          ) : (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">En attente de prise en charge par Wilmet.</span>{" "}
              Un commercial vous contactera dès qu'il aura été assigné à votre dossier.
            </div>
          )}
        </div>
      )}



      {isPartenaireOwner && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
          <div className="font-semibold text-accent">Wilmet vous a rendu la main</div>
          {opp.handover_message && <p className="mt-1 whitespace-pre-wrap text-foreground/80">{opp.handover_message}</p>}
          <p className="mt-2 text-muted-foreground">
            Complétez, corrigez ou ajoutez des photos, puis renvoyez à Wilmet via le bouton « Compléter et renvoyer ».
          </p>
        </div>
      )}

      {infoReqs.length > 0 && (
        <Card className="border-border/70">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-accent" /> Échanges avec Wilmet
            </div>
            <ol className="space-y-3">
              {infoReqs.map((r) => (
                <li key={r.id} className="rounded-md border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Wilmet · {formatDateTime(r.created_at)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{r.message}</p>
                  {r.response && (
                    <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-2">
                      <div className="text-[11px] uppercase tracking-widest text-accent">
                        Votre réponse · {r.response_at ? formatDateTime(r.response_at) : ""}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{r.response}</p>
                    </div>
                  )}
                  {r.status === "answered" && !r.response && (
                    <div className="mt-2 text-[11px] uppercase tracking-widest text-muted-foreground">Répondu</div>
                  )}
                </li>
              ))}
            </ol>
            {openReq && (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="text-sm font-medium">Répondre à Wilmet</div>
                <Textarea placeholder="Votre réponse" rows={3} value={respondText} onChange={(e) => setRespondText(e.target.value)} />
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && uploadExtras(e.target.files)} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                    <Camera className="mr-1.5 h-4 w-4" /> Ajouter des photos
                  </Button>
                  <Button onClick={respond} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Send className="mr-1.5 h-4 w-4" /> Envoyer
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden border-border/70">
            <div className="aspect-[16/10] w-full bg-secondary">
              {main && urls[main.storage_path] ? (
                <img src={urls[main.storage_path]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <Truck className="h-12 w-12 opacity-40" />
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-6">
                {photos.map((p) => (
                  <div key={p.id} className="relative aspect-square overflow-hidden rounded-md border border-border">
                    {urls[p.storage_path] ? (
                      <img src={urls[p.storage_path]} alt="" className="h-full w-full object-cover" />
                    ) : <div className="h-full w-full bg-secondary" />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <KeyCard icon={Truck} label="Type" value={labelFor(VEHICLE_TYPE_OPTIONS, opp.vehicle_type as string)} />
            <KeyCard icon={Gauge} label="Kilométrage" value={opp.mileage ? (opp.mileage as number).toLocaleString("fr-FR") + " km" : "—"} />
            <KeyCard icon={MapPin} label="Localisation" value={`${opp.city ?? "—"}${opp.postal_code ? " (" + opp.postal_code + ")" : ""}`} />
          </div>

          <DetailBlock title="Caractéristiques" rows={[
            ["Marque", (opp.brand as string) ?? "—"],
            ["Modèle", (opp.model as string) ?? "—"],
            ["Version", (opp.version as string) ?? "—"],
            ["1re mise en circulation", formatDate(opp.first_registration_date as string)],
            ["Énergie", labelFor(FUEL_OPTIONS, opp.fuel_type as string)],
            ["Boîte", labelFor(GEARBOX_OPTIONS, opp.gearbox as string)],
            ["Puissance", (opp.power as string) ?? "—"],
            ["Norme Euro", (opp.euro_standard as string) ?? "—"],
            ["PTAC", (opp.gross_vehicle_weight as string) ?? "—"],
            ["Cabine", labelFor(CABIN_OPTIONS, opp.cabin_type as string)],
            ["Équipements", ((opp.equipment as string[]) ?? []).join(", ") || "—"],
            ["Visible sur parc", labelFor(VISIBILITY_OPTIONS, opp.visible_on_site as string)],
          ]} />

          <DetailBlock title="État & commentaires" rows={[
            ["État général", labelFor(CONDITION_OPTIONS, opp.general_condition as string)],
            ["Roule", labelFor(YES_NO_OPTIONS, opp.vehicle_runs as string)],
            ...(opp.vehicle_runs === "non"
              ? [["Raison de l'immobilisation", (opp.not_running_reason as string) || "—"] as [string, string]] : []),
            ["Contrôle technique", labelFor(YES_NO_OPTIONS, opp.technical_inspection_status as string)],
            ...(opp.technical_inspection_status === "oui"
              ? [["CT valable jusqu'au", formatDate(opp.inspection_valid_until as string)] as [string, string]] : []),
            ["Entretien", labelFor(YES_NO_OPTIONS, opp.maintenance_status as string)],
            ["Nombre de clés", opp.keys_count ? String(opp.keys_count) : "—"],
            ["Défauts, travaux et commentaires", (opp.defects_and_comments as string)
              || [opp.known_defects, opp.expected_repairs, opp.additional_comments].filter(Boolean).join(" — ") || "—"],
          ]} />
        </div>

        <div className="space-y-4">
          <Card className="border-border/70">
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Prix souhaité HT</div>
              <div className="mt-1 text-2xl font-bold text-accent">{formatPrice(opp.desired_price_excl_tax as number)}</div>
              <div className="mt-3 grid gap-2 text-sm">
                <Row k="Négociable" v={labelFor(NEGOTIABLE_OPTIONS, opp.price_negotiable as string)} />
                <Row k="Disponibilité" v={labelFor(AVAILABILITY_OPTIONS, opp.availability as string)} />
                <Row k="Libre de tout gage" v={labelFor(YES_NO_OPTIONS, (opp.free_of_pledge ?? opp.free_of_commitment) as string)} />

              </div>
              {opp.special_conditions ? (
                <p className="mt-3 text-sm text-muted-foreground">{opp.special_conditions as string}</p>
              ) : null}
            </CardContent>
          </Card>



          <Card className="border-border/70">
            <CardContent className="p-5">
              <div className="text-sm font-semibold">Contact sur place</div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div>{(opp.onsite_contact_name as string) || "—"}</div>
                <div>{(opp.onsite_contact_phone as string) || "—"}</div>
                <div>{(opp.onsite_contact_email as string) || "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="p-5">
              <div className="mb-3 text-sm font-semibold">Historique</div>
              <ol className="space-y-3">
                {history.length === 0 && <li className="text-sm text-muted-foreground">Aucun événement.</li>}
                {history.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-accent stroke-accent" />
                    <div>
                      <div className="text-sm font-medium">{STATUS_LABEL[h.new_status as OpportunityStatus] ?? h.new_status}</div>
                      <div className="text-[11px] text-muted-foreground">{formatDateTime(h.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KeyCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="truncate text-sm font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="mb-3 text-sm font-semibold">{title}</div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v], i) => <Row key={i} k={k} v={v} />)}
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-1 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="max-w-[60%] text-right text-sm">{v || "—"}</dd>
    </div>
  );
}
