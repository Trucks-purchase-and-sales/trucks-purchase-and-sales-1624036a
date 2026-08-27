import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUIRED = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
] as const;
const EXPECTED_TARGET = "wilmet-staging";
if (process.env.E2E_ALLOW_STAGING_MUTATIONS !== "true")
  throw new Error("Explicit staging mutation opt-in required.");
if (process.env.E2E_TARGET_LABEL !== EXPECTED_TARGET)
  throw new Error(`E2E_TARGET_LABEL must be ${EXPECTED_TARGET}.`);

function env(name: (typeof REQUIRED)[number]) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
const url = env("E2E_SUPABASE_URL");
const anon = env("E2E_SUPABASE_ANON_KEY");
const serviceKey = env("E2E_SUPABASE_SERVICE_ROLE_KEY");
const opts = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const service = createClient(url, serviceKey, opts);
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const evidencePath = "test-results/tm011-workflow-children-e2e.json";

const evidence: {
  suite: string;
  runId: string;
  gitSha: string | null;
  checks: Array<{ name: string; result: "PASS" | "FAIL"; detail?: string }>;
  cleanup?: "PASS" | "FAIL";
} = {
  suite: "TM-011 workflow children real-JWT E2E",
  runId,
  gitSha: process.env.GITHUB_SHA ?? null,
  checks: [],
};

type Identity = { id: string; client: SupabaseClient };
const users: string[] = [];
const opportunities: string[] = [];
let seller: Identity;
let unrelated: Identity;
let purchaseAgent: Identity;
let platformAdmin: Identity;
let oppId: string;
let infoId: string;
let internalActivityId: string;

function fail(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}
function expectRejected(error: { message: string } | null, context: string) {
  if (!error) throw new Error(`${context}: operation unexpectedly succeeded`);
}
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    evidence.checks.push({ name, result: "PASS" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    evidence.checks.push({ name, result: "FAIL", detail });
    throw error;
  }
}

async function provision(input: {
  label: string;
  role: "partenaire" | "sales_agent" | "platform_admin";
  partnerKind?: "seller" | null;
  staffScope?: "purchase" | "sales" | "both" | null;
}): Promise<Identity> {
  const email = `tm011-workflow-${runId}-${input.label}@example.test`;
  const password = `Wilmet-Workflow-${crypto.randomUUID()}!Aa1`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "TM011",
      last_name: input.label,
      partner_kind: input.partnerKind ?? "client",
    },
  });
  fail(created.error, `create ${input.label}`);
  const id = created.data.user?.id;
  if (!id) throw new Error(`create ${input.label}: missing id`);
  users.push(id);

  const profile = await service
    .from("profiles")
    .update({
      partner_kind: input.partnerKind ?? null,
      staff_scope: input.staffScope ?? null,
      is_active: true,
      is_external: false,
    })
    .eq("id", id);
  fail(profile.error, `configure ${input.label}`);
  fail(
    (await service.from("user_roles").delete().eq("user_id", id)).error,
    `clear ${input.label} roles`,
  );
  fail(
    (await service.from("user_roles").insert({ user_id: id, role: input.role })).error,
    `assign ${input.label} role`,
  );

  const client = createClient(url, anon, opts);
  const signed = await client.auth.signInWithPassword({ email, password });
  fail(signed.error, `sign in ${input.label}`);
  return { id, client };
}

beforeAll(async () => {
  seller = await provision({ label: "seller", role: "partenaire", partnerKind: "seller" });
  unrelated = await provision({ label: "unrelated", role: "partenaire", partnerKind: "seller" });
  purchaseAgent = await provision({
    label: "purchase-agent",
    role: "sales_agent",
    staffScope: "purchase",
  });
  platformAdmin = await provision({
    label: "platform-admin",
    role: "platform_admin",
    staffScope: "both",
  });

  const draft = await seller.client
    .from("vehicle_opportunities")
    .insert({
      partenaire_id: seller.id,
      status: "brouillon",
      brand: `TM011-${runId}`,
      model: "workflow-children",
      city: "E2E",
      country: "BE",
    })
    .select("id")
    .single();
  fail(draft.error, "create workflow opportunity");
  if (!draft.data?.id) throw new Error("workflow opportunity missing id");
  oppId = draft.data.id;
  opportunities.push(oppId);

  const submit = await seller.client
    .from("vehicle_opportunities")
    .update({
      status: "envoyee",
      owner_side: "wilmet",
    })
    .eq("id", oppId)
    .select("status,owner_side,assigned_group")
    .single();
  fail(submit.error, "submit workflow opportunity");
  expect(submit.data.owner_side).toBe("wilmet");
  expect(submit.data.assigned_group).toBe("purchase");
});

test("status history inherits parent visibility", async () => {
  await check("status history parent scope", async () => {
    const sellerHistory = await seller.client
      .from("opportunity_status_history")
      .select("id")
      .eq("vehicle_opportunity_id", oppId);
    fail(sellerHistory.error, "seller status history");
    expect((sellerHistory.data ?? []).length).toBeGreaterThan(0);

    const staffHistory = await purchaseAgent.client
      .from("opportunity_status_history")
      .select("id")
      .eq("vehicle_opportunity_id", oppId);
    fail(staffHistory.error, "scoped staff status history");
    expect((staffHistory.data ?? []).length).toBeGreaterThan(0);

    const unrelatedHistory = await unrelated.client
      .from("opportunity_status_history")
      .select("id")
      .eq("vehicle_opportunity_id", oppId);
    fail(unrelatedHistory.error, "unrelated status history query");
    expect(unrelatedHistory.data ?? []).toHaveLength(0);
  });
});

test("platform admin can create/update information requests and parent-visible actors inherit them", async () => {
  await check("information request parent scope and platform admin", async () => {
    const inserted = await platformAdmin.client
      .from("information_requests")
      .insert({
        vehicle_opportunity_id: oppId,
        admin_id: platformAdmin.id,
        message: "TM011 real-JWT information request",
      })
      .select("id")
      .single();
    fail(inserted.error, "platform admin insert information request");
    if (!inserted.data?.id) throw new Error("information request missing id");
    infoId = inserted.data.id;

    const updated = await platformAdmin.client
      .from("information_requests")
      .update({ message: "TM011 real-JWT information request updated" })
      .eq("id", infoId)
      .select("id,message")
      .single();
    fail(updated.error, "platform admin update information request");
    expect(updated.data.message).toContain("updated");

    const sellerRead = await seller.client
      .from("information_requests")
      .select("id")
      .eq("id", infoId)
      .maybeSingle();
    fail(sellerRead.error, "seller information request read");
    expect(sellerRead.data?.id).toBe(infoId);

    const staffRead = await purchaseAgent.client
      .from("information_requests")
      .select("id")
      .eq("id", infoId)
      .maybeSingle();
    fail(staffRead.error, "staff information request read");
    expect(staffRead.data?.id).toBe(infoId);

    const unrelatedRead = await unrelated.client
      .from("information_requests")
      .select("id")
      .eq("id", infoId)
      .maybeSingle();
    fail(unrelatedRead.error, "unrelated information request read");
    expect(unrelatedRead.data).toBeNull();
  });
});

test("partner answers receive database timestamps and become immutable", async () => {
  await check("information request answer audit integrity", async () => {
    const answer = await seller.client
      .from("information_requests")
      .update({
        status: "answered",
        response: "TM011 seller answer",
        answered_at: "2000-01-01T00:00:00.000Z",
        response_at: "2000-01-01T00:00:00.000Z",
      })
      .eq("id", infoId)
      .select("answered_at,response_at,response,status")
      .single();
    fail(answer.error, "seller answer information request");
    expect(answer.data.status).toBe("answered");
    expect(answer.data.response).toBe("TM011 seller answer");
    expect(new Date(answer.data.answered_at as string).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    expect(new Date(answer.data.response_at as string).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );

    const rewrite = await seller.client
      .from("information_requests")
      .update({ response: "TM011 rewritten answer" })
      .eq("id", infoId)
      .select("id");
    expectRejected(rewrite.error, "rewrite answered information request");
  });
});

test("internal activity is hidden from seller and visible to scoped staff", async () => {
  await check("internal activity confidentiality", async () => {
    const internal = await platformAdmin.client
      .from("opportunity_activities")
      .insert({
        vehicle_opportunity_id: oppId,
        kind: "call",
        body: "TM011 INTERNAL CALL - seller must not see",
        author_id: platformAdmin.id,
      })
      .select("id")
      .single();
    fail(internal.error, "platform admin internal activity insert");
    if (!internal.data?.id) throw new Error("internal activity missing id");
    internalActivityId = internal.data.id;

    const sellerRead = await seller.client
      .from("opportunity_activities")
      .select("id,body")
      .eq("id", internalActivityId);
    fail(sellerRead.error, "seller internal activity query");
    expect(sellerRead.data ?? []).toHaveLength(0);

    const staffRead = await purchaseAgent.client
      .from("opportunity_activities")
      .select("id,body")
      .eq("id", internalActivityId)
      .single();
    fail(staffRead.error, "scoped staff internal activity read");
    expect(staffRead.data.id).toBe(internalActivityId);
  });
});

test("scoped staff can add activity but seller notes require editable hand-back state", async () => {
  await check("activity write scope", async () => {
    const staffTask = await purchaseAgent.client
      .from("opportunity_activities")
      .insert({
        vehicle_opportunity_id: oppId,
        kind: "task",
        body: "TM011 scoped staff task",
        author_id: purchaseAgent.id,
      })
      .select("id")
      .single();
    fail(staffTask.error, "scoped staff activity insert");

    const blockedSellerNote = await seller.client
      .from("opportunity_activities")
      .insert({
        vehicle_opportunity_id: oppId,
        kind: "note",
        body: "TM011 seller note while Wilmet owns dossier",
        author_id: seller.id,
      })
      .select("id");
    expectRejected(blockedSellerNote.error, "seller note while Wilmet-owned");

    const handback = await service
      .from("vehicle_opportunities")
      .update({
        owner_side: "partenaire",
        status: "informations_demandees",
        handover_message: "TM011 activity hand-back",
      })
      .eq("id", oppId);
    fail(handback.error, "service hand-back for seller note");

    const sellerNote = await seller.client
      .from("opportunity_activities")
      .insert({
        vehicle_opportunity_id: oppId,
        kind: "note",
        body: "TM011 seller-visible note",
        author_id: seller.id,
      })
      .select("id")
      .single();
    fail(sellerNote.error, "seller note during hand-back");

    const sellerActivities = await seller.client
      .from("opportunity_activities")
      .select("id,kind,body,author_id")
      .eq("vehicle_opportunity_id", oppId);
    fail(sellerActivities.error, "seller activity list");
    expect(
      (sellerActivities.data ?? []).every(
        (row) => row.kind === "note" && row.author_id === seller.id,
      ),
    ).toBe(true);
    expect((sellerActivities.data ?? []).some((row) => row.id === internalActivityId)).toBe(false);
  });
});

afterAll(async () => {
  let cleanupFailed = false;
  try {
    if (opportunities.length) {
      // None of these child tables cascade on delete from
      // vehicle_opportunities -- clear them first or the delete below
      // fails on a foreign key violation.
      const removedActivities = await service
        .from("opportunity_activities")
        .delete()
        .in("vehicle_opportunity_id", opportunities);
      if (removedActivities.error) {
        cleanupFailed = true;
        console.error(removedActivities.error.message);
      }
      const removedRequests = await service
        .from("information_requests")
        .delete()
        .in("vehicle_opportunity_id", opportunities);
      if (removedRequests.error) {
        cleanupFailed = true;
        console.error(removedRequests.error.message);
      }
      const removedHistory = await service
        .from("opportunity_status_history")
        .delete()
        .in("vehicle_opportunity_id", opportunities);
      if (removedHistory.error) {
        cleanupFailed = true;
        console.error(removedHistory.error.message);
      }

      const removed = await service.from("vehicle_opportunities").delete().in("id", opportunities);
      if (removed.error) {
        cleanupFailed = true;
        console.error(removed.error.message);
      }
    }
    if (users.length) {
      const roles = await service.from("user_roles").delete().in("user_id", users);
      if (roles.error) {
        cleanupFailed = true;
        console.error(roles.error.message);
      }
      const profiles = await service.from("profiles").delete().in("id", users);
      if (profiles.error) {
        cleanupFailed = true;
        console.error(profiles.error.message);
      }
      for (const id of users) {
        const removed = await service.auth.admin.deleteUser(id);
        if (removed.error) {
          cleanupFailed = true;
          console.error(removed.error.message);
        }
      }
    }
  } finally {
    evidence.cleanup = cleanupFailed ? "FAIL" : "PASS";
    mkdirSync("test-results", { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  if (cleanupFailed) throw new Error("TM-011 workflow E2E cleanup failed.");
});
