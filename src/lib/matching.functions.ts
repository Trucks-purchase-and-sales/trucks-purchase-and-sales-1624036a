import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GENERIC = "Une erreur est survenue, veuillez réessayer.";
function fail(where: string, err: unknown): never {
  console.error(`[matching.functions:${where}]`, err);
  throw new Error(GENERIC);
}

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "platform_admin"]);
  if (error) fail("assertAdmin", error);
  if (!data?.length) throw new Error("Non autorisé");
}

async function assertAdminOrManager(sb: any, userId: string) {
  const { data, error } = await sb
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "platform_admin", "sales_manager"]);
  if (error) fail("assertAdminOrManager", error);
  if (!data?.length) throw new Error("Non autorisé");
}

// ---------- Profiles CRUD ----------
export const listMatchingProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("matching_profiles").select("*").order("is_default", { ascending: false }).order("name");
    if (error) fail("list", error);
    return data ?? [];
  });

const profileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
  weights: z.object({
    attributes: z.number().min(0).max(100),
    geography: z.number().min(0).max(100),
    commercial: z.number().min(0).max(100),
    price: z.number().min(0).max(100),
    freeform: z.number().min(0).max(100),
  }),
  hard_filters: z.object({
    require_vehicle_type: z.boolean(),
    require_brand: z.boolean(),
    year_tolerance: z.number().min(0).max(20),
    price_tolerance_pct: z.number().min(0).max(100),
  }),
  ai_blend: z.number().min(0).max(1),
  min_score: z.number().min(0).max(100),
  max_results: z.number().min(1).max(50),
  auto_notify: z.boolean(),
  model_id: z.string().min(1),
});

export const saveMatchingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const payload = { ...data, created_by: context.userId };
    if (data.is_default) {
      await sb.from("matching_profiles").update({ is_default: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    if (data.id) {
      const { data: row, error } = await sb.from("matching_profiles").update(payload).eq("id", data.id).select().single();
      if (error) fail("save.update", error);
      return row;
    }
    const { data: row, error } = await sb.from("matching_profiles").insert(payload).select().single();
    if (error) fail("save.insert", error);
    return row;
  });

export const deleteMatchingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("matching_profiles").delete().eq("id", data.id);
    if (error) fail("delete", error);
    return { ok: true };
  });

// ---------- Run matching ----------
const runSchema = z.object({
  sourceKind: z.enum(["buyer_lead", "opportunity"]),
  sourceId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  targetKinds: z.array(z.enum(["opportunity", "buyer_lead", "resale_listing"])).optional(),
});

export const runMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => runSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminOrManager(sb, context.userId);
    const helpers = await import("./matching.server");
    const profile = await loadProfile(sb, data.profileId);
    const res = await matchOneSource(sb, context.userId, profile, data.sourceKind, data.sourceId, helpers);
    return res;
  });

// ---------- Global run: everything vs everything ----------
const globalRunSchema = z.object({
  profileId: z.string().uuid().optional(),
  maxLeads: z.number().min(1).max(200).optional(),
});

export const runGlobalMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => globalRunSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminOrManager(sb, context.userId);
    const helpers = await import("./matching.server");
    const profile = await loadProfile(sb, data.profileId);

    // Iterate all active buyer_leads (source) — opportunity candidates are pulled inside.
    const { data: leads } = await sb.from("buyer_leads")
      .select("id, status")
      .in("status", ["nouveau", "a_qualifier", "match_possible", "en_recherche", "offre_envoyee", "option_posee"])
      .limit(data.maxLeads ?? 100);

    let totalMatches = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const l of leads ?? []) {
      try {
        const r = await matchOneSource(sb, context.userId, profile, "buyer_lead", l.id, helpers);
        totalMatches += r.count;
        processed += 1;
      } catch (e) {
        errors.push(`${l.id.slice(0, 8)}: ${(e as Error).message}`);
      }
    }
    return { processed, totalMatches, errors };
  });

async function loadProfile(sb: any, profileId?: string) {
  let profile: any = null;
  if (profileId) {
    const { data: p } = await sb.from("matching_profiles").select("*").eq("id", profileId).single();
    profile = p;
  }
  if (!profile) {
    const { data: p } = await sb.from("matching_profiles").select("*").eq("is_default", true).limit(1).single();
    profile = p;
  }
  if (!profile) throw new Error("Aucun profil de matching disponible");
  return profile;
}

async function matchOneSource(
  sb: any, userId: string, profile: any,
  sourceKind: "buyer_lead" | "opportunity", sourceId: string,
  helpers: typeof import("./matching.server"),
) {
  const { ruleScore, passesHardFilters, embedText, buyerLeadEmbeddingText, opportunityEmbeddingText, aiRank } = helpers;
  const startedAt = Date.now();

  // Load source (+ embedding)
  let source: any;
  if (sourceKind === "buyer_lead") {
    const { data: l, error } = await sb.from("buyer_leads").select("*").eq("id", sourceId).single();
    if (error || !l) throw new Error("Lead introuvable");
    source = {
      kind: "buyer_lead" as const, id: l.id,
      vehicle_type: l.vehicle_type, brand: l.preferred_brand, model: l.preferred_model,
      min_year: l.min_year, max_mileage: l.max_mileage, fuel_type: l.fuel_type, gearbox: l.gearbox,
      euro_standard: l.min_euro_norm, country: l.usage_country ?? l.country, city: l.city,
      max_budget_ht: l.max_budget_ht ? Number(l.max_budget_ht) : null,
      equipment: [...(l.required_equipment ?? []), ...(l.wanted_equipment ?? [])],
      freeform: l.message ?? "", embedding: l.embedding ?? null,
      _text: buyerLeadEmbeddingText(l),
    };
    if (!source.embedding && source._text) {
      try {
        source.embedding = await embedText(source._text);
        await sb.from("buyer_leads").update({ embedding: source.embedding, embedded_at: new Date().toISOString() }).eq("id", l.id);
      } catch (e) { console.warn("[matching] embed lead failed", e); }
    }
  } else {
    const { data: o, error } = await sb.from("vehicle_opportunities").select("*").eq("id", sourceId).single();
    if (error || !o) throw new Error("Offre introuvable");
    source = {
      kind: "opportunity" as const, id: o.id,
      vehicle_type: o.vehicle_type, brand: o.brand, model: o.model, year: o.year,
      mileage: o.mileage, fuel_type: o.fuel_type, gearbox: o.gearbox, euro_standard: o.euro_standard,
      country: o.country, city: o.city,
      price: o.desired_price_excl_tax ? Number(o.desired_price_excl_tax) : null,
      equipment: o.equipment ?? [], freeform: [o.additional_comments, o.known_defects, (o as { defects_and_comments?: string | null }).defects_and_comments].filter(Boolean).join(" — "),
      embedding: o.embedding ?? null, _text: opportunityEmbeddingText(o),
    };
    if (!source.embedding && source._text) {
      try {
        source.embedding = await embedText(source._text);
        await sb.from("vehicle_opportunities").update({ embedding: source.embedding, embedded_at: new Date().toISOString() }).eq("id", o.id);
      } catch (e) { console.warn("[matching] embed opp failed", e); }
    }
  }

  // Load candidates from the opposite pool
  const targetKind = sourceKind === "buyer_lead" ? "opportunity" : "buyer_lead";
  const candidates: any[] = [];
  if (targetKind === "opportunity") {
    const { data: opps } = await sb.from("vehicle_opportunities")
      .select("id,vehicle_type,brand,model,year,mileage,fuel_type,gearbox,euro_standard,country,city,desired_price_excl_tax,equipment,additional_comments,known_defects,defects_and_comments,quality_score,availability,updated_at,embedding,status")
      .in("status", ["en_cours_analyse", "offre_envoyee", "en_negociation", "achetee"])
      .limit(200);
    for (const o of opps ?? []) candidates.push({
      kind: "opportunity", id: o.id, vehicle_type: o.vehicle_type, brand: o.brand, model: o.model,
      year: o.year, mileage: o.mileage, fuel_type: o.fuel_type, gearbox: o.gearbox,
      euro_standard: o.euro_standard, country: o.country, city: o.city,
      price: o.desired_price_excl_tax ? Number(o.desired_price_excl_tax) : null,
      equipment: o.equipment ?? [], freeform: [o.additional_comments, o.known_defects, (o as { defects_and_comments?: string | null }).defects_and_comments].filter(Boolean).join(" — "),
      quality_score: o.quality_score, availability: o.availability, updated_at: o.updated_at,
      embedding: o.embedding,
    });
  } else {
    const { data: leads } = await sb.from("buyer_leads")
      .select("id,vehicle_type,preferred_brand,preferred_model,min_year,max_mileage,fuel_type,gearbox,min_euro_norm,usage_country,country,city,max_budget_ht,required_equipment,wanted_equipment,message,updated_at,embedding")
      .limit(200);
    for (const l of leads ?? []) candidates.push({
      kind: "buyer_lead", id: l.id, vehicle_type: l.vehicle_type, brand: l.preferred_brand,
      model: l.preferred_model, min_year: l.min_year, max_mileage: l.max_mileage,
      fuel_type: l.fuel_type, gearbox: l.gearbox, euro_standard: l.min_euro_norm,
      country: l.usage_country ?? l.country, city: l.city,
      max_budget_ht: l.max_budget_ht ? Number(l.max_budget_ht) : null,
      equipment: [...(l.required_equipment ?? []), ...(l.wanted_equipment ?? [])],
      freeform: l.message ?? "", updated_at: l.updated_at, embedding: l.embedding,
    });
  }

  const scored = candidates
    .filter((c) => passesHardFilters(source, c, profile.hard_filters))
    .map((c) => {
      const { score, breakdown } = ruleScore(source, c, profile.weights, profile.hard_filters);
      return { ...c, rule_score: score, rule_breakdown: breakdown };
    })
    .sort((a, b) => b.rule_score - a.rule_score)
    .slice(0, 25);

  let aiMatches: Awaited<ReturnType<typeof aiRank>>["matches"] = [];
  let usage = { promptTokens: 0, completionTokens: 0 };
  if (scored.length) {
    try {
      const res = await aiRank({ modelId: profile.model_id, source, candidates: scored, weights: profile.weights });
      aiMatches = res.matches;
      usage = res.usage as any;
    } catch (e) { console.warn("[matching] AI ranking failed, falling back to rule score", e); }
  }

  const runInsert = await sb.from("match_runs").insert({
    profile_id: profile.id, source_kind: sourceKind, source_id: sourceId,
    target_kinds: [targetKind], candidates_scored: scored.length,
    candidates_returned: 0, model_id: profile.model_id, ran_by: userId,
  }).select().single();
  const runId = runInsert.data?.id;

  const results: any[] = [];
  for (const c of scored) {
    const ai = aiMatches.find((m) => m.target_id === c.id);
    const aiScore = ai?.ai_score ?? c.rule_score;
    const blend = profile.ai_blend ?? 0.6;
    const finalScore = Math.round(blend * aiScore + (1 - blend) * c.rule_score);
    results.push({
      profile_id: profile.id, run_id: runId,
      source_kind: sourceKind, source_id: sourceId,
      target_kind: targetKind, target_id: c.id,
      score: finalScore, ai_score: ai?.ai_score ?? null, rule_score: c.rule_score,
      verdict: ai?.verdict ?? (finalScore >= 80 ? "strong" : finalScore >= 60 ? "good" : "weak"),
      ai_rationale: ai?.rationale ?? null,
      criteria_breakdown: { rule: c.rule_breakdown, ai: ai?.criteria ?? null },
      status: "suggested" as const,
    });
  }
  results.sort((a, b) => b.score - a.score);
  const kept = results.slice(0, profile.max_results ?? 10);

  if (kept.length) {
    await sb.from("match_candidates").upsert(kept, {
      onConflict: "source_kind,source_id,target_kind,target_id,profile_id",
    });
  }

  await sb.from("match_runs").update({
    candidates_returned: kept.length,
    latency_ms: Date.now() - startedAt,
    prompt_tokens: usage.promptTokens ?? null,
    completion_tokens: usage.completionTokens ?? null,
  }).eq("id", runId);

  if (profile.auto_notify) {
    for (const m of kept.filter((r) => r.score >= (profile.min_score ?? 60))) {
      try { await notifyForMatch(sb, m, source); } catch (e) { console.warn("[matching] notify failed", e); }
    }
  }

  return { runId, count: kept.length, results: kept };
}

async function notifyForMatch(sb: any, m: any, source: any) {
  // Notify the owner of both sides
  const rationale = m.ai_rationale ? ` — ${m.ai_rationale.slice(0, 160)}` : "";
  const title = `Nouveau match ${m.score}%`;
  // Fetch owners
  let sourceUserId: string | null = null;
  let targetUserId: string | null = null;
  if (m.source_kind === "buyer_lead") {
    const { data } = await sb.from("buyer_leads").select("user_id").eq("id", m.source_id).single();
    sourceUserId = data?.user_id ?? null;
  } else if (m.source_kind === "opportunity") {
    const { data } = await sb.from("vehicle_opportunities").select("partenaire_id").eq("id", m.source_id).single();
    sourceUserId = data?.partenaire_id ?? null;
  }
  if (m.target_kind === "buyer_lead") {
    const { data } = await sb.from("buyer_leads").select("user_id").eq("id", m.target_id).single();
    targetUserId = data?.user_id ?? null;
  } else if (m.target_kind === "opportunity") {
    const { data } = await sb.from("vehicle_opportunities").select("partenaire_id").eq("id", m.target_id).single();
    targetUserId = data?.partenaire_id ?? null;
  }
  const body = `${(source?.brand ?? "")} ${(source?.model ?? "")}${rationale}`.trim();
  const rows = [];
  if (sourceUserId) rows.push({ user_id: sourceUserId, type: "match_found", title, body });
  if (targetUserId && targetUserId !== sourceUserId) rows.push({ user_id: targetUserId, type: "match_found", title, body });
  if (rows.length) await sb.from("notifications").insert(rows);
  await sb.from("match_candidates").update({ notified_at: new Date().toISOString() }).eq("source_kind", m.source_kind).eq("source_id", m.source_id).eq("target_kind", m.target_kind).eq("target_id", m.target_id).eq("profile_id", m.profile_id);
}

// ---------- List candidates for a source ----------
export const listMatchCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sourceKind: z.enum(["buyer_lead", "opportunity"]),
    sourceId: z.string().uuid(),
    profileId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    let q = sb.from("match_candidates").select("*")
      .eq("source_kind", data.sourceKind).eq("source_id", data.sourceId)
      .order("score", { ascending: false });
    if (data.profileId) q = q.eq("profile_id", data.profileId);
    const { data: rows, error } = await q;
    if (error) fail("listCandidates", error);
    // Hydrate target labels
    const oppIds = (rows ?? []).filter((r: any) => r.target_kind === "opportunity").map((r: any) => r.target_id);
    const leadIds = (rows ?? []).filter((r: any) => r.target_kind === "buyer_lead").map((r: any) => r.target_id);
    const opps: Record<string, any> = {};
    const leads: Record<string, any> = {};
    if (oppIds.length) {
      const { data: os } = await sb.from("vehicle_opportunities")
        .select("id,reference_number,brand,model,year,city,country,desired_price_excl_tax,mileage,vehicle_type").in("id", oppIds);
      for (const o of os ?? []) opps[o.id] = o;
    }
    if (leadIds.length) {
      const { data: ls } = await sb.from("buyer_leads")
        .select("id,reference_number,preferred_brand,preferred_model,min_year,city,country,max_budget_ht,vehicle_type,company_name").in("id", leadIds);
      for (const l of ls ?? []) leads[l.id] = l;
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      target: r.target_kind === "opportunity" ? opps[r.target_id] : leads[r.target_id],
    }));
  });

// ---------- Update candidate status ----------
export const setMatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["suggested", "pinned", "excluded", "confirmed", "dismissed"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("match_candidates").update({ status: data.status }).eq("id", data.id);
    if (error) fail("setStatus", error);
    return { ok: true };
  });

// ---------- Feedback ----------
export const voteMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    matchId: z.string().uuid(),
    vote: z.union([z.literal(1), z.literal(-1)]),
    note: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { error } = await sb.from("match_feedback").upsert({
      match_candidate_id: data.matchId, admin_id: context.userId,
      vote: data.vote, note: data.note ?? null,
    }, { onConflict: "match_candidate_id,admin_id" });
    if (error) fail("vote", error);
    return { ok: true };
  });

// ---------- Notify manually ----------
export const notifyMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data: m, error } = await sb.from("match_candidates").select("*").eq("id", data.id).single();
    if (error || !m) fail("notify.load", error);
    await notifyForMatch(sb, m, {});
    return { ok: true };
  });

// ---------- Sources for the picker ----------
export const listMatchingSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["buyer_lead", "opportunity"]),
    search: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    if (data.kind === "buyer_lead") {
      let q = sb.from("buyer_leads")
        .select("id,reference_number,vehicle_type,preferred_brand,preferred_model,company_name,city,country,max_budget_ht,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (data.search) q = q.ilike("reference_number", `%${data.search}%`);
      const { data: rows } = await q;
      return rows ?? [];
    }
    let q = sb.from("vehicle_opportunities")
      .select("id,reference_number,vehicle_type,brand,model,year,city,country,desired_price_excl_tax,status,created_at")
      .in("status", ["en_cours_analyse","offre_envoyee","en_negociation","achetee"])
      .order("created_at", { ascending: false }).limit(100);
    if (data.search) q = q.ilike("reference_number", `%${data.search}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

// ---------- List ALL match_candidates (global view) ----------
const listAllSchema = z.object({
  profileId: z.string().uuid().optional(),
  minScore: z.number().min(0).max(100).optional(),
  status: z.enum(["suggested", "pinned", "excluded", "confirmed", "dismissed"]).optional(),
  onlyUnnotified: z.boolean().optional(),
  limit: z.number().min(1).max(2000).optional(),
});
export const listAllMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listAllSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminOrManager(sb, context.userId);
    let q = sb.from("match_candidates").select("*").order("score", { ascending: false }).limit(data.limit ?? 500);
    if (data.profileId) q = q.eq("profile_id", data.profileId);
    if (typeof data.minScore === "number") q = q.gte("score", data.minScore);
    if (data.status) q = q.eq("status", data.status);
    if (data.onlyUnnotified) q = q.is("notified_at", null);
    const { data: rows, error } = await q;
    if (error) fail("listAllMatches", error);

    const leadIds = new Set<string>();
    const oppIds = new Set<string>();
    for (const r of rows ?? []) {
      if (r.source_kind === "buyer_lead") leadIds.add(r.source_id); else oppIds.add(r.source_id);
      if (r.target_kind === "buyer_lead") leadIds.add(r.target_id); else oppIds.add(r.target_id);
    }
    const leads: Record<string, any> = {};
    const opps: Record<string, any> = {};
    if (leadIds.size) {
      const { data: ls } = await sb.from("buyer_leads")
        .select("id,reference_number,preferred_brand,preferred_model,min_year,city,country,max_budget_ht,vehicle_type,company_name,status")
        .in("id", Array.from(leadIds));
      for (const l of ls ?? []) leads[l.id] = l;
    }
    if (oppIds.size) {
      const { data: os } = await sb.from("vehicle_opportunities")
        .select("id,reference_number,brand,model,year,city,country,desired_price_excl_tax,mileage,vehicle_type,status")
        .in("id", Array.from(oppIds));
      for (const o of os ?? []) opps[o.id] = o;
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      source: r.source_kind === "buyer_lead" ? leads[r.source_id] : opps[r.source_id],
      target: r.target_kind === "buyer_lead" ? leads[r.target_id] : opps[r.target_id],
    }));
  });

// ---------- Aggregate analytics ----------
export const matchingAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await assertAdminOrManager(sb, context.userId);
    let q = sb.from("match_candidates").select("score,status,notified_at,created_at,source_kind,target_kind,source_id,target_id").limit(2000);
    if (data.profileId) q = q.eq("profile_id", data.profileId);
    const { data: rows, error } = await q;
    if (error) fail("analytics", error);
    const list = rows ?? [];
    const total = list.length;
    const notified = list.filter((r: any) => r.notified_at).length;
    const confirmed = list.filter((r: any) => r.status === "confirmed").length;
    const excluded = list.filter((r: any) => r.status === "excluded" || r.status === "dismissed").length;
    const avgScore = total ? Math.round(list.reduce((a: number, r: any) => a + Number(r.score || 0), 0) / total) : 0;
    // Score distribution buckets of 10
    const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}-${i * 10 + 9}`, count: 0 }));
    for (const r of list) {
      const s = Math.max(0, Math.min(99, Math.floor(Number(r.score || 0))));
      buckets[Math.floor(s / 10)].count++;
    }
    // By day (last 14)
    const byDay: Record<string, number> = {};
    for (const r of list) {
      const d = String(r.created_at).slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date, count }));
    return { total, notified, confirmed, excluded, avgScore, buckets, days };
  });

