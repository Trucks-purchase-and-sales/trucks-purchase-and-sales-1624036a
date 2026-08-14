import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public catalogue of published sale listings.
 * Reads are server-side with an explicit safe-column projection: internal
 * fields (purchase price, margin, notes, buyer identity, assignment) never
 * leave the server.
 */

const GENERIC = "Catalogue momentanément indisponible.";

function fail(where: string, error: unknown): never {
  console.error(`[public-catalog:${where}]`, error);
  throw new Error(GENERIC);
}

const PUBLIC_STATUSES = ["publiee", "reservee"] as const;

const LISTING_COLS =
  "id, reference_number, title, sale_price_excl_tax, vat_regime, availability, city, country, status, published_at, created_at, photo_ids, vehicle_opportunity_id";

const OPP_COLS =
  "id, brand, model, version, year, mileage, vehicle_type, vehicle_category, body_type, fuel_type, gearbox, power, euro_standard, gross_vehicle_weight, payload, axle_configuration, cabin_type, equipment, general_condition, city, country";

type PhotoRow = { id: string; storage_path: string; is_main_photo: boolean; sort_order: number };

async function signPhotos(admin: any, rows: PhotoRow[], ttl = 3600) {
  if (!rows.length) return [] as string[];
  const paths = rows
    .slice()
    .sort((a, b) => Number(b.is_main_photo) - Number(a.is_main_photo) || a.sort_order - b.sort_order)
    .map((p) => p.storage_path);
  const { data } = await admin.storage.from("vehicle-photos").createSignedUrls(paths, ttl);
  return ((data ?? []) as Array<{ signedUrl: string | null }>)
    .map((d) => d.signedUrl)
    .filter((u): u is string => Boolean(u));
}

export const listPublicVehicles = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    d
      ? z
          .object({
            q: z.string().max(120).optional(),
            category: z.string().max(60).optional(),
            limit: z.number().int().min(1).max(60).optional(),
          })
          .parse(d)
      : {},
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    let q = admin
      .from("sale_listings")
      .select(`${LISTING_COLS}, vehicle_opportunities(${OPP_COLS})`)
      .in("status", PUBLIC_STATUSES)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(data?.limit ?? 60);
    if (data?.q) q = q.ilike("title", `%${data.q}%`);

    const { data: rows, error } = await q;
    if (error) fail("list", error);

    const listings = (rows ?? []) as any[];
    const filtered = data?.category
      ? listings.filter((l) => l.vehicle_opportunities?.vehicle_category === data.category)
      : listings;

    // One signed cover photo per listing.
    const allIds = filtered.flatMap((l) => (l.photo_ids ?? []) as string[]);
    let photoById = new Map<string, PhotoRow>();
    if (allIds.length) {
      const { data: photos } = await admin
        .from("vehicle_photos")
        .select("id, storage_path, is_main_photo, sort_order")
        .in("id", allIds);
      photoById = new Map(((photos ?? []) as PhotoRow[]).map((p) => [p.id, p]));
    }

    const items = await Promise.all(
      filtered.map(async (l) => {
        const photos = ((l.photo_ids ?? []) as string[])
          .map((id) => photoById.get(id))
          .filter(Boolean) as PhotoRow[];
        const urls = await signPhotos(admin, photos.slice(0, 3));
        const o = l.vehicle_opportunities ?? {};
        return {
          id: l.id as string,
          reference: (l.reference_number ?? null) as string | null,
          title: l.title as string,
          price: l.sale_price_excl_tax === null ? null : Number(l.sale_price_excl_tax),
          vatRegime: (l.vat_regime ?? null) as string | null,
          availability: (l.availability ?? null) as string | null,
          city: (l.city ?? o.city ?? null) as string | null,
          country: (l.country ?? o.country ?? null) as string | null,
          status: l.status as string,
          brand: (o.brand ?? null) as string | null,
          model: (o.model ?? null) as string | null,
          year: (o.year ?? null) as number | null,
          mileage: (o.mileage ?? null) as number | null,
          fuelType: (o.fuel_type ?? null) as string | null,
          gearbox: (o.gearbox ?? null) as string | null,
          category: (o.vehicle_category ?? null) as string | null,
          vehicleType: (o.vehicle_type ?? null) as string | null,
          cover: urls[0] ?? null,
        };
      }),
    );

    return { items };
  });

export const getPublicVehicle = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: row, error } = await admin
      .from("sale_listings")
      .select(`${LISTING_COLS}, description, vehicle_opportunities(${OPP_COLS})`)
      .eq("id", data.id)
      .in("status", PUBLIC_STATUSES)
      .maybeSingle();
    if (error) fail("detail", error);
    if (!row) return { vehicle: null };

    const ids = (row.photo_ids ?? []) as string[];
    let photos: PhotoRow[] = [];
    if (ids.length) {
      const { data: p } = await admin
        .from("vehicle_photos")
        .select("id, storage_path, is_main_photo, sort_order")
        .in("id", ids);
      photos = (p ?? []) as PhotoRow[];
    }
    const images = await signPhotos(admin, photos);
    const o = row.vehicle_opportunities ?? {};

    return {
      vehicle: {
        id: row.id as string,
        reference: (row.reference_number ?? null) as string | null,
        title: row.title as string,
        description: (row.description ?? null) as string | null,
        price: row.sale_price_excl_tax === null ? null : Number(row.sale_price_excl_tax),
        vatRegime: (row.vat_regime ?? null) as string | null,
        availability: (row.availability ?? null) as string | null,
        city: (row.city ?? o.city ?? null) as string | null,
        country: (row.country ?? o.country ?? null) as string | null,
        status: row.status as string,
        images,
        specs: {
          brand: (o.brand ?? null) as string | null,
          model: (o.model ?? null) as string | null,
          version: (o.version ?? null) as string | null,
          year: (o.year ?? null) as number | null,
          mileage: (o.mileage ?? null) as number | null,
          vehicleType: (o.vehicle_type ?? null) as string | null,
          category: (o.vehicle_category ?? null) as string | null,
          bodyType: (o.body_type ?? null) as string | null,
          fuelType: (o.fuel_type ?? null) as string | null,
          gearbox: (o.gearbox ?? null) as string | null,
          power: (o.power ?? null) as string | null,
          euroStandard: (o.euro_standard ?? null) as string | null,
          grossVehicleWeight: (o.gross_vehicle_weight ?? null) as string | null,
          payload: (o.payload ?? null) as string | null,
          axleConfiguration: (o.axle_configuration ?? null) as string | null,
          cabinType: (o.cabin_type ?? null) as string | null,
          generalCondition: (o.general_condition ?? null) as string | null,
          equipment: (o.equipment ?? []) as string[],
        },
      },
    };
  });
