import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * New-format Supabase API keys (`sb_publishable_…`, `sb_secret_…`) are opaque
 * strings, not JWTs: sending them as `Authorization: Bearer …` can be rejected.
 * Mirror the generated clients and send them via the `apikey` header only.
 */
function isOpaqueKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (isOpaqueKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const getReferenceData = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [countries, types, brands, models, bodies, fuels, gearboxes, euros, equipment, categories, categoryBrands] = await Promise.all([
    sb.from("ref_countries").select("code,name_fr,name_en,priority").eq("is_active", true).order("priority").order("name_fr"),
    sb.from("ref_vehicle_types").select("slug,label_fr,label_en,sort_order").eq("is_active", true).order("sort_order"),
    sb.from("ref_vehicle_brands").select("slug,label,sort_order").eq("is_active", true).order("sort_order"),
    sb.from("ref_vehicle_models").select("id,brand_slug,label").eq("is_active", true).order("label"),
    sb.from("ref_body_types").select("slug,label_fr,label_en,applies_to").eq("is_active", true).order("label_fr"),
    sb.from("ref_fuel_types").select("slug,label_fr,label_en").eq("is_active", true).order("label_fr"),
    sb.from("ref_gearbox_types").select("slug,label_fr,label_en").eq("is_active", true).order("label_fr"),
    sb.from("ref_euro_standards").select("slug,label,sort_order").eq("is_active", true).order("sort_order"),
    sb.from("ref_equipment").select("slug,label_fr,label_en").eq("is_active", true).order("label_fr"),
    sb.from("ref_vehicle_categories").select("slug,label_fr,label_en,sort_order").eq("is_active", true).order("sort_order"),
    sb.from("ref_category_brands").select("category_slug,brand_slug"),
  ]);

  /** Names of the tables whose query failed, so the UI can warn instead of showing an empty list. */
  const failed: string[] = [];
  const results = {
    countries, vehicleTypes: types, brands, models, bodyTypes: bodies, fuelTypes: fuels,
    gearboxTypes: gearboxes, euroStandards: euros, equipment, vehicleCategories: categories,
    categoryBrands,
  };
  for (const [name, res] of Object.entries(results)) {
    if (res.error) {
      failed.push(name);
      console.error(`[reference-data:${name}]`, res.error);
    }
  }
  if (failed.length === Object.keys(results).length) {
    throw new Error("Référentiels indisponibles, veuillez réessayer.");
  }

  return {
    countries: countries.data ?? [],
    vehicleTypes: types.data ?? [],
    brands: brands.data ?? [],
    models: models.data ?? [],
    bodyTypes: bodies.data ?? [],
    fuelTypes: fuels.data ?? [],
    gearboxTypes: gearboxes.data ?? [],
    euroStandards: euros.data ?? [],
    equipment: equipment.data ?? [],
    vehicleCategories: categories.data ?? [],
    categoryBrands: categoryBrands.data ?? [],
    failed,
  };
});


export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
