import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const INTERNAL_ROLES = [
  "admin",
  "platform_admin",
  "sales_manager",
  "sales_agent",
  "company_management",
] as const;

type Ctx = { supabase: any; userId: string };

async function assertInternal(ctx: Ctx) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", INTERNAL_ROLES as unknown as string[]);
  if (error) throw new Error("Vérification des droits impossible");
  if (!data || data.length === 0) throw new Error("Accès refusé");
}

/** Level 2 + 3 — compliance dossier and Go/No-Go grid for one opportunity. */
export const getOpportunityDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertInternal(ctx);
    const [docs, decision] = await Promise.all([
      ctx.supabase
        .from("opportunity_documents")
        .select("id,doc_type,status,storage_path,notes,verified_by,verified_at,updated_at")
        .eq("vehicle_opportunity_id", data.opportunityId),
      ctx.supabase
        .from("opportunity_decisions")
        .select("id,scores,total_score,verdict,notes,decided_by,decided_at,updated_at")
        .eq("vehicle_opportunity_id", data.opportunityId)
        .maybeSingle(),
    ]);
    if (docs.error) throw new Error("Chargement du dossier impossible");
    return {
      documents: docs.data ?? [],
      decision: decision.data ?? null,
    };
  });

export const upsertOpportunityDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        docType: z.string().min(1).max(64),
        status: z.enum(["manquant", "demande", "recu", "valide", "non_applicable"]),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertInternal(ctx);
    const validated = data.status === "valide";
    const { error } = await ctx.supabase.from("opportunity_documents").upsert(
      {
        vehicle_opportunity_id: data.opportunityId,
        doc_type: data.docType,
        status: data.status,
        notes: data.notes ?? null,
        verified_by: validated ? ctx.userId : null,
        verified_at: validated ? new Date().toISOString() : null,
      },
      { onConflict: "vehicle_opportunity_id,doc_type" },
    );
    if (error) throw new Error("Enregistrement du document impossible");
    return { ok: true };
  });

export const saveOpportunityDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        scores: z.record(z.string(), z.number().int().min(0).max(5)),
        verdict: z.enum(["go", "go_conditionnel", "a_creuser", "no_go"]).optional().nullable(),
        notes: z.string().max(4000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertInternal(ctx);
    const values = Object.values(data.scores);
    const total = values.length
      ? Math.round((values.reduce((s, n) => s + n, 0) / (values.length * 5)) * 100)
      : null;
    const { error } = await ctx.supabase.from("opportunity_decisions").upsert(
      {
        vehicle_opportunity_id: data.opportunityId,
        scores: data.scores,
        total_score: total,
        verdict: data.verdict ?? null,
        notes: data.notes ?? null,
        decided_by: ctx.userId,
        decided_at: data.verdict ? new Date().toISOString() : null,
      },
      { onConflict: "vehicle_opportunity_id" },
    );
    if (error) throw new Error("Enregistrement de la décision impossible");
    return { ok: true, total_score: total };
  });

/** Level 3 — manual market benchmark (internal team only). */
export const saveOpportunityBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        opportunityId: z.string().uuid(),
        marketPriceEstimateEur: z.number().min(0).max(5_000_000).optional().nullable(),
        priceAttractive: z.string().max(32).optional().nullable(),
        benchmarkComment: z.string().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertInternal(ctx);
    const { data: opp, error: readErr } = await ctx.supabase
      .from("vehicle_opportunities")
      .select("desired_price_excl_tax")
      .eq("id", data.opportunityId)
      .maybeSingle();
    if (readErr) throw new Error("Chargement de l'opportunité impossible");
    const asked = opp?.desired_price_excl_tax != null ? Number(opp.desired_price_excl_tax) : null;
    const estimate = data.marketPriceEstimateEur ?? null;
    const gap =
      asked != null && estimate != null && estimate > 0
        ? Math.round(((asked - estimate) / estimate) * 1000) / 10
        : null;
    const { error } = await ctx.supabase
      .from("vehicle_opportunities")
      .update({
        market_price_estimate_eur: estimate,
        market_price_gap_pct: gap,
        price_attractive: data.priceAttractive ?? null,
        benchmark_comment: data.benchmarkComment ?? null,
      })
      .eq("id", data.opportunityId);
    if (error) throw new Error("Enregistrement du benchmark impossible");
    return { ok: true, gap };
  });
