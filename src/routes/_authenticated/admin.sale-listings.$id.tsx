import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getSaleListing, updateSaleListing, markSaleListingSold,
} from "@/lib/sale-listings.functions";
import { adminListSalesAgents } from "@/lib/admin.functions";
import { signPhotoUrls } from "@/lib/opportunities.functions";
import { SALE_LISTING_STATUS_LABEL, SALE_LISTING_STATUS_CLASS, marginOf } from "@/lib/sale-listings.constants";
import {
  AVAILABILITY_OPTIONS, VAT_OPTIONS, formatPrice, formatDateTime, labelFor,
} from "@/lib/wilmet-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, ArrowUpRight, Save, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sale-listings/$id")({
  head: () => ({
    meta: [
      { title: "Offre de vente — Wilmet Trucks" },
      { name: "description", content: "Détail et suivi d'une annonce de revente Wilmet." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getSaleListing);
  const updFn = useServerFn(updateSaleListing);
  const soldFn = useServerFn(markSaleListingSold);
  const signFn = useServerFn(signPhotoUrls);
  const agentsFn = useServerFn(adminListSalesAgents);

  const { data } = useQuery({ queryKey: ["sale-listing", id], queryFn: () => getFn({ data: { id } }) });
  const { data: agentsData } = useQuery({ queryKey: ["sales-agents"], queryFn: () => agentsFn() });

  const listing = data?.listing as any;
  const opp = listing?.vehicle_opportunities as any;
  const kept = useMemo(() => {
    const ids: string[] = listing?.photo_ids ?? [];
    return ((data?.photos ?? []) as any[]).filter((p) => ids.includes(p.id));
  }, [data, listing]);
  const paths = kept.map((p) => p.storage_path);
  const { data: urlsData } = useQuery({
    queryKey: ["sale-listing-urls", paths.join("|")],
    queryFn: () => signFn({ data: { paths } }),
    enabled: paths.length > 0,
  });
  const urls = urlsData?.urls ?? {};

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [vat, setVat] = useState("oui");
  const [availability, setAvailability] = useState("a_confirmer");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [agent, setAgent] = useState("none");
  const [busy, setBusy] = useState(false);
  const [soldOpen, setSoldOpen] = useState(false);
  const [soldPrice, setSoldPrice] = useState("");
  const [soldTo, setSoldTo] = useState("");

  useEffect(() => {
    if (!listing) return;
    setTitle(listing.title ?? "");
    setPrice(listing.sale_price_excl_tax != null ? String(listing.sale_price_excl_tax) : "");
    setVat(listing.vat_regime ?? "oui");
    setAvailability(listing.availability ?? "a_confirmer");
    setCity(listing.city ?? "");
    setCountry(listing.country ?? "");
    setDescription(listing.description ?? "");
    setNotes(listing.notes ?? "");
    setAgent(listing.assigned_sales_agent_id ?? "none");
    setSoldPrice(listing.sale_price_excl_tax != null ? String(listing.sale_price_excl_tax) : "");
  }, [listing?.id]);

  if (!listing) return <div className="py-20 text-center text-muted-foreground">Chargement…</div>;

  const isSold = listing.status === "vendue";
  const margin = marginOf(isSold ? listing.sold_price_excl_tax : Number(price) || null, listing.purchase_price_snapshot);
  const agents = (agentsData?.agents ?? []) as any[];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sale-listing", id] });
    qc.invalidateQueries({ queryKey: ["sale-listings"] });
    qc.invalidateQueries({ queryKey: ["sale-listing-by-opp", listing.vehicle_opportunity_id] });
  };

  async function run<T>(fn: () => Promise<T>, okMsg: string) {
    setBusy(true);
    try { await fn(); toast.success(okMsg); invalidate(); }
    catch (e) { toast.error("Erreur", { description: (e as Error).message }); }
    finally { setBusy(false); }
  }

  const save = () =>
    run(() => updFn({
      data: {
        id,
        title: title.trim(),
        description: description || null,
        salePrice: Number(price) > 0 ? Number(price) : null,
        vatRegime: vat,
        availability,
        city: city || null,
        country: country || null,
        notes: notes || null,
        assignedSalesAgentId: agent === "none" ? null : agent,
      },
    }), "Offre enregistrée");

  const setStatus = (s: "brouillon" | "publiee" | "reservee" | "retiree") =>
    run(() => updFn({ data: { id, status: s } }), `Statut : ${SALE_LISTING_STATUS_LABEL[s]}`);

  async function confirmSold() {
    const p = Number(soldPrice);
    if (!Number.isFinite(p) || p <= 0 || !soldTo.trim()) { toast.error("Prix et acheteur requis"); return; }
    await run(() => soldFn({ data: { id, soldPrice: p, soldTo: soldTo.trim() } }), "Offre vendue");
    setSoldOpen(false);
  }

  return (
    <div className="space-y-6 pb-10">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/sale-listings" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux offres
      </Button>

      <div className="rounded-xl border border-border/70 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SALE_LISTING_STATUS_CLASS[listing.status]}>
                {SALE_LISTING_STATUS_LABEL[listing.status] ?? listing.status}
              </Badge>
              {listing.reference_number && <Badge variant="outline">{listing.reference_number}</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{listing.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {opp?.brand} {opp?.model} · {opp?.year ?? "—"} · {opp?.mileage ? `${opp.mileage} km` : "—"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Achat HT" value={formatPrice(listing.purchase_price_snapshot)} />
            <Kpi label="Vente HT" value={formatPrice(listing.sold_price_excl_tax ?? listing.sale_price_excl_tax)} />
            <Kpi label="Marge" value={margin ? `${formatPrice(margin.amount)} · ${margin.pct.toFixed(1)} %` : "—"} />
            <Kpi label="Vendue le" value={listing.sold_at ? formatDateTime(listing.sold_at) : "—"} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!isSold && listing.status !== "publiee" && (
            <Button size="sm" disabled={busy} onClick={() => setStatus("publiee")}>Publier</Button>
          )}
          {!isSold && listing.status === "publiee" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("reservee")}>Marquer réservée</Button>
          )}
          {!isSold && (
            <Button size="sm" className="bg-status-accepted text-status-accepted-foreground hover:bg-status-accepted/80" disabled={busy} onClick={() => setSoldOpen(true)}>
              <Trophy className="mr-1 h-4 w-4" /> Marquer vendue
            </Button>
          )}
          {!isSold && listing.status !== "retiree" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("retiree")}>Retirer</Button>
          )}
          {!isSold && listing.status === "retiree" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus("brouillon")}>Remettre en brouillon</Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/opportunities/$id" params={{ id: listing.vehicle_opportunity_id }}>
              Voir l'opportunité d'origine <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="text-sm font-semibold">Annonce</div>
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSold} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prix de vente HT (€)</Label>
                <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isSold} />
              </div>
              <div className="space-y-1.5">
                <Label>Régime de TVA</Label>
                <Select value={vat} onValueChange={setVat} disabled={isSold}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Disponibilité</Label>
                <Select value={availability} onValueChange={setAvailability} disabled={isSold}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Commercial assigné</Label>
                <Select value={agent} onValueChange={setAgent} disabled={isSold}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pool groupe Vente</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ville</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} disabled={isSold} />
              </div>
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} disabled={isSold} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSold} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes internes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSold} />
            </div>
            {!isSold && (
              <Button onClick={save} disabled={busy}><Save className="mr-1 h-4 w-4" /> Enregistrer</Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="text-sm font-semibold">Véhicule</div>
              <Row label="Réf. opportunité" value={opp?.reference_number ?? "—"} />
              <Row label="Type" value={opp?.vehicle_type ?? "—"} />
              <Row label="Kilométrage" value={opp?.mileage ? `${opp.mileage} km` : "—"} />
              <Row label="Carburant" value={opp?.fuel_type ?? "—"} />
              <Row label="Boîte" value={opp?.gearbox ?? "—"} />
              <Row label="Norme Euro" value={opp?.euro_standard ?? "—"} />
              <Row label="TVA (achat)" value={labelFor(VAT_OPTIONS, opp?.vat_recoverable)} />
              {isSold && <Row label="Acheteur" value={listing.sold_to ?? "—"} />}
            </CardContent>
          </Card>

          {kept.length > 0 && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="text-sm font-semibold">Photos ({kept.length})</div>
                <div className="grid grid-cols-2 gap-2">
                  {kept.map((p) => (
                    <img
                      key={p.id}
                      src={urls[p.storage_path]}
                      alt={p.category ?? "Photo du véhicule"}
                      loading="lazy"
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={soldOpen} onOpenChange={setSoldOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer l'offre vendue</DialogTitle><DialogDescription>Enregistrez la vente et le montant final de cette annonce.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Prix de vente réel HT (€)</Label>
              <Input type="number" min="0" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Acheteur</Label>
              <Input value={soldTo} onChange={(e) => setSoldTo(e.target.value)} placeholder="Société / contact" />
            </div>
            <p className="text-xs text-muted-foreground">
              L'opportunité d'origine passera en « Closed Won » avec ce prix de vente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoldOpen(false)}>Annuler</Button>
            <Button onClick={confirmSold} disabled={busy}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
