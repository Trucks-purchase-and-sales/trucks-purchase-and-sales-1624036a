import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
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
  };
});


export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
