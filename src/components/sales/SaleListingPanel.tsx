import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tag, ArrowUpRight } from "lucide-react";
import {
  AVAILABILITY_OPTIONS,
  VAT_OPTIONS,
  formatPrice,
  PHOTO_CATEGORIES,
} from "@/lib/wilmet-constants";
import {
  createSaleListingFromOpportunity,
  getSaleListingByOpportunity,
} from "@/lib/sale-listings.functions";
import { SALE_LISTING_STATUS_LABEL, marginOf } from "@/lib/sale-listings.constants";

const SELLABLE = ["achetee", "livree"];

export function SaleListingPanel({
  opportunityId,
  opp,
  photos,
}: {
  opportunityId: string;
  opp: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  photos: { id: string; category: string | null }[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const createFn = useServerFn(createSaleListingFromOpportunity);
  const getFn = useServerFn(getSaleListingByOpportunity);
  const { data } = useQuery({
    queryKey: ["sale-listing-by-opp", opportunityId],
    queryFn: () => getFn({ data: { opportunityId } }),
  });
  const listing = data?.listing as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const defaultTitle = [opp.brand, opp.model, opp.year].filter(Boolean).join(" ");
  const [title, setTitle] = useState(defaultTitle);
  const [price, setPrice] = useState("");
  const [vat, setVat] = useState<string>(opp.vat_recoverable ?? "oui");
  const [availability, setAvailability] = useState<string>(opp.availability ?? "a_confirmer");
  const [city, setCity] = useState<string>(opp.city ?? "");
  const [country, setCountry] = useState<string>(opp.country ?? "");
  const [description, setDescription] = useState<string>(
    [opp.additional_comments, opp.defects_and_comments, opp.expected_repairs]
      .filter(Boolean)
      .join("\n\n"),
  );
  const [selected, setSelected] = useState<string[]>(photos.map((p) => p.id));

  const purchase = opp.purchase_price_excl_tax != null ? Number(opp.purchase_price_excl_tax) : null;
  const margin = useMemo(() => marginOf(Number(price) || null, purchase), [price, purchase]);

  if (!SELLABLE.includes(opp.status)) return null;

  async function submit() {
    const p = Number(price);
    if (!title.trim() || !Number.isFinite(p) || p <= 0) {
      toast.error(t("admin.saleListings.panel.validationError"));
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          opportunityId,
          title: title.trim(),
          description: description || undefined,
          salePrice: p,
          vatRegime: vat,
          availability,
          city: city || undefined,
          country: country || undefined,
          photoIds: selected,
        },
      });
      toast.success(
        res.reference
          ? t("admin.saleListings.panel.createdToastWithRef", { ref: res.reference })
          : t("admin.saleListings.panel.createdToast"),
      );
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sale-listing-by-opp", opportunityId] });
      qc.invalidateQueries({ queryKey: ["sale-listings"] });
    } catch (e) {
      toast.error(t("admin.common.error"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-accent/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Tag className="h-4 w-4 text-accent" /> {t("admin.saleListings.panel.heading")}
          </div>
          {listing ? (
            <Badge variant="outline">
              {SALE_LISTING_STATUS_LABEL[listing.status] ?? listing.status}
            </Badge>
          ) : (
            <Badge variant="outline">{t("admin.saleListings.panel.notCreatedBadge")}</Badge>
          )}
        </div>

        {listing ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info
                label={t("admin.saleListings.panel.referenceLabel")}
                value={listing.reference_number ?? "—"}
              />
              <Info
                label={t("admin.saleListings.panel.salePriceLabel")}
                value={formatPrice(listing.sale_price_excl_tax)}
              />
              <Info
                label={t("admin.saleListings.panel.marginLabel")}
                value={(() => {
                  const m = marginOf(
                    listing.sold_price_excl_tax ?? listing.sale_price_excl_tax,
                    listing.purchase_price_snapshot,
                  );
                  return m ? `${formatPrice(m.amount)} (${m.pct.toFixed(1)} %)` : "—";
                })()}
              />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/sale-listings/$id" params={{ id: listing.id }}>
                {t("admin.saleListings.panel.openButton")} <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("admin.saleListings.panel.introText")}
            </p>
            <Button
              onClick={() => setOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("admin.saleListings.panel.transformButton")}
            </Button>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("admin.saleListings.panel.transformButton")}</DialogTitle>
              <DialogDescription>
                {purchase != null
                  ? t("admin.saleListings.panel.purchasePriceKnown", {
                      price: formatPrice(purchase),
                    })
                  : t("admin.saleListings.panel.purchasePriceUnknown")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("admin.saleListings.panel.titleLabel")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("admin.saleListings.panel.salePriceFieldLabel")}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.saleListings.panel.marginLabel")}</Label>
                  <div className="flex h-9 items-center rounded-md border border-border bg-secondary/40 px-3 text-sm">
                    {margin ? (
                      <span
                        className={
                          margin.amount >= 0
                            ? "text-status-accepted-foreground"
                            : "text-status-refused-foreground"
                        }
                      >
                        {formatPrice(margin.amount)} · {margin.pct.toFixed(1)} %
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("admin.common.fields.vatRegime")}</Label>
                  <Select value={vat} onValueChange={setVat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.common.fields.availability")}</Label>
                  <Select value={availability} onValueChange={setAvailability}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("admin.common.fields.city")}</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("admin.common.fields.country")}</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("admin.common.fields.description")}</Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {photos.length > 0 && (
                <div className="space-y-2">
                  <Label>
                    {t("admin.saleListings.panel.photosKeptLabel", {
                      selected: selected.length,
                      total: photos.length,
                    })}
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {photos.map((p) => {
                      const cat = PHOTO_CATEGORIES.find((c) => c.value === p.category);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={selected.includes(p.id)}
                            onCheckedChange={(v) =>
                              setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                            }
                          />
                          <span>
                            {cat?.label ??
                              p.category ??
                              t("admin.saleListings.panel.photoFallback")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("admin.common.cancel")}
              </Button>
              <Button onClick={submit} disabled={busy}>
                {t("admin.saleListings.panel.createButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
