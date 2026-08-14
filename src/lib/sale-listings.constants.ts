export const SALE_LISTING_STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  publiee: "Publiée",
  reservee: "Réservée",
  vendue: "Vendue",
  retiree: "Retirée",
};

export const SALE_LISTING_STATUS_CLASS: Record<string, string> = {
  brouillon: "bg-secondary text-secondary-foreground",
  publiee: "bg-status-info text-status-info-foreground",
  reservee: "bg-status-pending text-status-pending-foreground",
  vendue: "bg-status-accepted text-status-accepted-foreground",
  retiree: "bg-muted text-muted-foreground",
};

/** Margin between a sale price and the purchase price snapshot. */
export function marginOf(
  sale: number | string | null | undefined,
  purchase: number | string | null | undefined,
): { amount: number; pct: number } | null {
  const s = sale == null ? NaN : Number(sale);
  const p = purchase == null ? NaN : Number(purchase);
  if (!Number.isFinite(s) || !Number.isFinite(p) || p <= 0) return null;
  return { amount: s - p, pct: ((s - p) / p) * 100 };
}
