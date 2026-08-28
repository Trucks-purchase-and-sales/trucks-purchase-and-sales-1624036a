import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  requiredPhotoCategories,
  missingSubmissionFields,
  categoryProfile,
} from "@/lib/wilmet-constants";
import { parseOpportunityInput, normalise } from "@/lib/opportunity-input";

export const saveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseOpportunityInput(d))

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    // Year is derived from the first registration date (no separate field).
    const derivedYear = rest.first_registration_date
      ? Number(String(rest.first_registration_date).slice(0, 4)) || null
      : null;
    const payload = normalise({ ...rest, year: derivedYear, partenaire_id: userId }) as never;
    if (id) {
      const { data: row, error } = await supabase
        .from("vehicle_opportunities")
        .update(payload)
        .eq("id", id)
        .eq("partenaire_id", userId)
        .select("id, reference_number, status")
        .single();
      if (error) {
        console.error("[opportunities.functions]", error);
        throw new Error("Une erreur est survenue, veuillez réessayer.");
      }
      return row;
    } else {
      const { data: row, error } = await supabase
        .from("vehicle_opportunities")
        .insert({ ...(payload as object), status: "brouillon" } as never)
        .select("id, reference_number, status")
        .single();
      if (error) {
        console.error("[opportunities.functions]", error);
        throw new Error("Une erreur est survenue, veuillez réessayer.");
      }
      return row;
    }
  });

export const submitOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), message: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: current, error: readErr } = await supabase
      .from("vehicle_opportunities")
      .select(
        "vehicle_runs, not_running_reason, technical_inspection_status, inspection_valid_until, assigned_group, referred_by, referral_code, reference_number, brand, model, vehicle_category, body_type, body_type_other, first_registration_date, mileage, vin, city, country, visible_on_site, fuel_type, gearbox, gross_vehicle_weight, general_condition, has_accident, desired_price_excl_tax, price_negotiable, availability, free_of_pledge, onsite_contact_name, onsite_contact_phone, defects_and_comments, known_defects, expected_repairs",
      )
      .eq("id", data.id)
      .eq("partenaire_id", userId)
      .single();
    if (readErr) {
      console.error("[opportunities.functions]", readErr);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    const missingFields = missingSubmissionFields(current as unknown as Record<string, unknown>);
    if (missingFields.length > 0) {
      throw new Error(
        `Informations obligatoires manquantes : ${missingFields.map((f) => f.label).join(", ")}.`,
      );
    }
    if (
      categoryProfile(current.vehicle_category).powered &&
      current.vehicle_runs === "non" &&
      !current.not_running_reason?.trim()
    ) {
      throw new Error("Précisez pourquoi le véhicule ne roule pas avant l'envoi.");
    }
    if (current.technical_inspection_status === "oui" && !current.inspection_valid_until) {
      throw new Error("Indiquez la date de validité du contrôle technique avant l'envoi.");
    }

    const { data: pics, error: picErr } = await supabase
      .from("vehicle_photos")
      .select("category")
      .eq("vehicle_opportunity_id", data.id);
    if (picErr) {
      console.error("[opportunities.functions]", picErr);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    const covered = new Set((pics ?? []).map((p) => p.category));
    const missing = requiredPhotoCategories(current as unknown as Record<string, unknown>).filter(
      (c) => !covered.has(c.value as never),
    );
    if (missing.length > 0) {
      throw new Error(
        `Photos obligatoires manquantes : ${missing.map((m) => m.label).join(", ")}.`,
      );
    }

    // Affiliate fast-track: when the seller came in through a sales person's link
    // (internal or external), that person owns the file directly — no shared
    // triage queue, no group approval step.
    const referrerId = (current as { referred_by?: string | null }).referred_by ?? null;
    let fastTrackOwnerId: string | null = null;
    if (referrerId) {
      const { referrerCanOwnLeads } = await import("@/lib/affiliate.server");
      if (await referrerCanOwnLeads(referrerId)) fastTrackOwnerId = referrerId;
    }

    // Configuration is trusted server data; the opportunity mutation itself
    // remains on the seller's RLS-constrained Supabase session below.
    const { readLeadAssignmentSettingsServer } = await import("@/lib/app-settings.server");
    const routing = await readLeadAssignmentSettingsServer();
    let assignedGroup: "purchase" | null = null;
    if (
      !fastTrackOwnerId &&
      routing.enabled &&
      !(current as { assigned_group?: string | null }).assigned_group
    ) {
      assignedGroup = "purchase";
    }

    const { data: row, error } = await supabase
      .from("vehicle_opportunities")
      .update({
        status: "envoyee",
        owner_side: "wilmet",
        handover_message: data.message ?? null,
        ...(assignedGroup ? { assigned_group: assignedGroup } : {}),
      } as never)
      .eq("id", data.id)
      .eq("partenaire_id", userId)
      .select("id, reference_number, status")
      .single();
    if (error) {
      console.error("[opportunities.functions]", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }

    if (fastTrackOwnerId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: assignErr } = await supabaseAdmin
        .from("vehicle_opportunities")
        .update({
          assigned_sales_agent_id: fastTrackOwnerId,
          status: "en_cours_analyse",
          qualified_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (assignErr) {
        console.error("[opportunities.functions] affiliate fast-track failed", assignErr);
      } else {
        await supabaseAdmin.from("notifications").insert({
          user_id: fastTrackOwnerId,
          type: "opportunity_assigned",
          title: "Nouvelle offre via votre lien d'affiliation",
          body: `${current.reference_number ?? row.reference_number ?? ""} ${current.brand ?? ""} ${current.model ?? ""}`.trim(),
          vehicle_opportunity_id: data.id,
        });
        return { ...row, status: "en_cours_analyse" as const };
      }
    }
    return row;
  });

export const withdrawOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("vehicle_opportunities")
      .update({ status: "archivee", withdrawn_at: nowIso } as never)
      .eq("id", data.id)
      .eq("partenaire_id", userId)
      .select("id");
    if (error) {
      console.error("[opportunities.functions] withdraw", error);
      throw new Error("Retrait impossible.");
    }
    // RLS (opp_partner_update) only allows this update when status=brouillon or
    // owner_side=partenaire. A zero-row result means the policy silently blocked
    // it (e.g. Wilmet already owns this opportunity) -- that must surface as a
    // real failure, not a false success (FD-008).
    if (!updated || updated.length === 0) {
      throw new Error(
        "Retrait impossible : cette opportunité ne peut plus être retirée à ce stade.",
      );
    }
    return { ok: true };
  });

export const listMyInfoRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: opps } = await supabase
      .from("vehicle_opportunities")
      .select("id, reference_number, brand, model")
      .eq("partenaire_id", userId);
    const oppIds = (opps ?? []).map((o) => o.id);
    if (oppIds.length === 0) return { rows: [] };
    const { data: reqs } = await supabase
      .from("information_requests")
      .select("*")
      .in("vehicle_opportunity_id", oppIds)
      .order("created_at", { ascending: false });
    const oppMap: Record<
      string,
      { reference_number: string | null; brand: string | null; model: string | null }
    > = {};
    for (const o of opps ?? []) oppMap[o.id] = o as never;
    return {
      rows: (reqs ?? []).map((r) => ({ ...r, opportunity: oppMap[r.vehicle_opportunity_id] })),
    };
  });

export const listMyOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("vehicle_opportunities")
      .select(
        "id, reference_number, status, vehicle_type, brand, model, year, mileage, city, desired_price_excl_tax, submitted_at, created_at, updated_at, owner_side, handover_message",
      )
      .eq("partenaire_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[opportunities.functions]", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }

    const ids = (data ?? []).map((r) => r.id);
    const mainByOpp: Record<string, string> = {};
    if (ids.length) {
      const { data: photos } = await supabase
        .from("vehicle_photos")
        .select("vehicle_opportunity_id, storage_path, is_main_photo, sort_order")
        .in("vehicle_opportunity_id", ids)
        .order("is_main_photo", { ascending: false })
        .order("sort_order", { ascending: true });
      for (const p of photos ?? []) {
        if (!mainByOpp[p.vehicle_opportunity_id])
          mainByOpp[p.vehicle_opportunity_id] = p.storage_path;
      }
    }
    return { rows: data ?? [], mainByOpp };
  });

export const getOpportunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: opp, error } = await supabase
      .from("vehicle_opportunities")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("[opportunities.functions]", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    if (!opp) throw new Error("Opportunité introuvable");

    const [{ data: photos }, { data: history }, { data: infoReqs }] = await Promise.all([
      supabase
        .from("vehicle_photos")
        .select("*")
        .eq("vehicle_opportunity_id", data.id)
        .order("is_main_photo", { ascending: false })
        .order("sort_order"),
      supabase
        .from("opportunity_status_history")
        .select("*")
        .eq("vehicle_opportunity_id", data.id)
        .order("created_at"),
      supabase
        .from("information_requests")
        .select("*")
        .eq("vehicle_opportunity_id", data.id)
        .order("created_at"),
    ]);
    return { opp, photos: photos ?? [], history: history ?? [], infoRequests: infoReqs ?? [] };
  });

export const signPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paths: z.array(z.string()) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.paths.length === 0) return { urls: {} as Record<string, string> };
    const { data: signed, error } = await context.supabase.storage
      .from("vehicle-photos")
      .createSignedUrls(data.paths, 60 * 60);
    if (error) {
      console.error("[opportunities.functions]", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    const urls: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    return { urls };
  });

export const createPhotoUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        fileName: z.string().min(1).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: opp, error: oppError } = await context.supabase
      .from("vehicle_opportunities")
      .select("id")
      .eq("id", data.opportunityId)
      .single();
    if (oppError || !opp) {
      console.error("[opportunities.functions] upload ownership", oppError);
      throw new Error("Impossible de préparer le téléchargement.");
    }

    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.opportunityId}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await context.supabase.storage
      .from("vehicle-photos")
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !signed) {
      console.error("[opportunities.functions] signed upload", error);
      throw new Error("Impossible de préparer le téléchargement.");
    }
    return { path, token: signed.token };
  });

export const addPhotoRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vehicle_opportunity_id: z.string().uuid(),
        storage_path: z.string(),
        category: z.string().nullable().optional(),
        is_main_photo: z.boolean().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("vehicle_photos")
      .insert({
        vehicle_opportunity_id: data.vehicle_opportunity_id,
        storage_path: data.storage_path,
        category: (data.category ?? null) as never,
        is_main_photo: !!data.is_main_photo,
        sort_order: data.sort_order ?? 0,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[opportunities.functions]", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    return row;
  });

export const setMainPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ opportunityId: z.string().uuid(), photoId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-existing, unrelated to this change
    const sb = context.supabase as any;
    const { error } = await sb.rpc("set_main_vehicle_photo", {
      p_opportunity_id: data.opportunityId,
      p_photo_id: data.photoId,
    });
    if (error) {
      console.error("[opportunities.functions] setMainPhoto", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    return { ok: true };
  });

export const deletePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ photoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: photo, error: deleteError } = await supabase
      .from("vehicle_photos")
      .delete()
      .eq("id", data.photoId)
      .select("storage_path")
      .single();
    if (deleteError || !photo?.storage_path) {
      console.error("[opportunities.functions] deletePhoto.metadata", deleteError);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }

    const { error: storageError } = await supabase.storage
      .from("vehicle-photos")
      .remove([photo.storage_path]);
    if (storageError) {
      console.error("[opportunities.functions] deletePhoto.storage", storageError);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: cleanupError } = await supabaseAdmin.storage
        .from("vehicle-photos")
        .remove([photo.storage_path]);
      if (cleanupError) {
        console.error("[opportunities.functions] deletePhoto.cleanup", cleanupError);
        throw new Error("Une erreur est survenue, veuillez réessayer.");
      }
    }
    return { ok: true };
  });

export const reorderPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orders: z
          .array(
            z.object({
              id: z.string().uuid(),
              sort_order: z.number().int().nonnegative(),
            }),
          )
          .max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-existing, unrelated to this change
    const sb = context.supabase as any;
    const { error } = await sb.rpc("reorder_vehicle_photos", { p_orders: data.orders });
    if (error) {
      console.error("[opportunities.functions] reorderPhotos", error);
      throw new Error("Une erreur est survenue, veuillez réessayer.");
    }
    return { ok: true };
  });

export const answerInfoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), comment: z.string().max(5000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-existing, unrelated to this change
    const sb = context.supabase as any;
    const { error } = await sb.rpc("answer_information_request", {
      p_request_id: data.id,
      p_response: data.comment ?? null,
    });
    if (error) {
      console.error("[opportunities.functions] answerInfoRequest", error);
      throw new Error("Impossible d'envoyer la réponse. Veuillez réessayer.");
    }
    return { ok: true };
  });
