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
const evidencePath = "test-results/workflow-transactions-e2e.json";

const evidence: {
  suite: string;
  runId: string;
  gitSha: string | null;
  checks: Array<{ name: string; result: "PASS" | "FAIL"; detail?: string }>;
  cleanup?: "PASS" | "FAIL";
} = {
  suite: "Workflow transaction RPC real-JWT E2E",
  runId,
  gitSha: process.env.GITHUB_SHA ?? null,
  checks: [],
};

type Identity = { id: string; client: SupabaseClient };
const users: string[] = [];
const opportunities: string[] = [];
let seller: Identity;
let platformAdmin: Identity;
let oppId: string;
let photoA: string;
let photoB: string;

function fail(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
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
  role: "partenaire" | "platform_admin";
  partnerKind?: "seller" | null;
}): Promise<Identity> {
  const email = `workflow-txn-${runId}-${input.label}@example.test`;
  const password = `Wilmet-WorkflowTxn-${crypto.randomUUID()}!Aa1`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Txn",
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
      staff_scope: input.role === "platform_admin" ? "both" : null,
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
  platformAdmin = await provision({ label: "platform", role: "platform_admin" });

  const draft = await seller.client
    .from("vehicle_opportunities")
    .insert({
      partenaire_id: seller.id,
      status: "brouillon",
      brand: `TXN-${runId}`,
      model: "atomic-workflow",
      city: "E2E",
      country: "BE",
    })
    .select("id")
    .single();
  fail(draft.error, "create transaction opportunity");
  if (!draft.data?.id) throw new Error("transaction opportunity missing id");
  oppId = draft.data.id;
  opportunities.push(oppId);

  const photos = await seller.client
    .from("vehicle_photos")
    .insert([
      {
        vehicle_opportunity_id: oppId,
        storage_path: `${oppId}/txn-a.png`,
        is_main_photo: true,
        sort_order: 0,
      },
      {
        vehicle_opportunity_id: oppId,
        storage_path: `${oppId}/txn-b.png`,
        is_main_photo: false,
        sort_order: 1,
      },
    ])
    .select("id,sort_order,is_main_photo")
    .order("sort_order");
  fail(photos.error, "create transaction photo metadata");
  if ((photos.data ?? []).length !== 2) throw new Error("expected two photo fixtures");
  photoA = photos.data![0].id;
  photoB = photos.data![1].id;

  const submit = await seller.client
    .from("vehicle_opportunities")
    .update({ status: "envoyee", owner_side: "wilmet" })
    .eq("id", oppId)
    .select("status,owner_side")
    .single();
  fail(submit.error, "submit transaction opportunity");
});

test("admin handover and information-request creation commit together", async () => {
  await check("atomic admin handover", async () => {
    const rpc = await platformAdmin.client.rpc(
      "admin_handover_to_partner" as never,
      {
        p_opportunity_id: oppId,
        p_message: "Atomic handover",
      } as never,
    );
    fail(rpc.error, "admin_handover_to_partner");

    const parent = await service
      .from("vehicle_opportunities")
      .select("owner_side,status,handover_message")
      .eq("id", oppId)
      .single();
    fail(parent.error, "verify handover parent");
    expect(parent.data.owner_side).toBe("partenaire");
    expect(parent.data.handover_message).toBe("Atomic handover");

    const request = await service
      .from("information_requests")
      .select("id,message,status")
      .eq("vehicle_opportunity_id", oppId)
      .eq("message", "Atomic handover")
      .single();
    fail(request.error, "verify handover request");
    expect(request.data.status).toBe("open");
  });
});

test("seller answer and parent return to Wilmet commit together", async () => {
  await check("atomic seller answer", async () => {
    const request = await service
      .from("information_requests")
      .select("id")
      .eq("vehicle_opportunity_id", oppId)
      .eq("message", "Atomic handover")
      .single();
    fail(request.error, "load handover request");

    const rpc = await seller.client.rpc(
      "answer_information_request" as never,
      {
        p_request_id: request.data.id,
        p_response: "Atomic answer",
      } as never,
    );
    fail(rpc.error, "answer_information_request");

    const answered = await service
      .from("information_requests")
      .select("status,response,answered_at,response_at")
      .eq("id", request.data.id)
      .single();
    fail(answered.error, "verify answered request");
    expect(answered.data.status).toBe("answered");
    expect(answered.data.response).toBe("Atomic answer");
    expect(answered.data.answered_at).toBeTruthy();
    expect(answered.data.response_at).toBeTruthy();

    const parent = await service
      .from("vehicle_opportunities")
      .select("status,owner_side")
      .eq("id", oppId)
      .single();
    fail(parent.error, "verify seller return parent");
    expect(parent.data.status).toBe("envoyee");
    expect(parent.data.owner_side).toBe("wilmet");
  });
});

test("admin request-info RPC creates trail and parent status together", async () => {
  await check("atomic admin request info", async () => {
    const rpc = await platformAdmin.client.rpc(
      "admin_request_information" as never,
      {
        p_opportunity_id: oppId,
        p_message: "Atomic request without handback",
      } as never,
    );
    fail(rpc.error, "admin_request_information");

    const request = await service
      .from("information_requests")
      .select("id")
      .eq("vehicle_opportunity_id", oppId)
      .eq("message", "Atomic request without handback")
      .single();
    fail(request.error, "verify atomic request row");
    const parent = await service
      .from("vehicle_opportunities")
      .select("status,owner_side")
      .eq("id", oppId)
      .single();
    fail(parent.error, "verify atomic request parent");
    expect(parent.data.status).toBe("en_cours_analyse");
    expect(parent.data.owner_side).toBe("wilmet");
  });
});

test("photo reorder is all-or-nothing", async () => {
  await check("atomic photo reorder", async () => {
    fail(
      (
        await service
          .from("vehicle_opportunities")
          .update({ owner_side: "partenaire" })
          .eq("id", oppId)
      ).error,
      "hand back for reorder",
    );

    const bad = await seller.client.rpc(
      "reorder_vehicle_photos" as never,
      {
        p_orders: [
          { id: photoA, sort_order: 41 },
          { id: crypto.randomUUID(), sort_order: 42 },
        ],
      } as never,
    );
    if (!bad.error) throw new Error("invalid batch unexpectedly succeeded");

    const unchanged = await service
      .from("vehicle_photos")
      .select("id,sort_order")
      .in("id", [photoA, photoB])
      .order("sort_order");
    fail(unchanged.error, "verify failed reorder rollback");
    expect(unchanged.data?.map((row) => row.sort_order)).toEqual([0, 1]);

    const good = await seller.client.rpc(
      "reorder_vehicle_photos" as never,
      {
        p_orders: [
          { id: photoA, sort_order: 11 },
          { id: photoB, sort_order: 12 },
        ],
      } as never,
    );
    fail(good.error, "valid reorder");

    const changed = await service
      .from("vehicle_photos")
      .select("id,sort_order")
      .in("id", [photoA, photoB])
      .order("sort_order");
    fail(changed.error, "verify valid reorder");
    expect(changed.data?.map((row) => row.sort_order)).toEqual([11, 12]);
  });
});

test("main-photo switch is atomic and a bad target preserves the current main", async () => {
  await check("atomic main photo", async () => {
    const good = await seller.client.rpc(
      "set_main_vehicle_photo" as never,
      {
        p_opportunity_id: oppId,
        p_photo_id: photoB,
      } as never,
    );
    fail(good.error, "valid main photo switch");

    const selected = await service
      .from("vehicle_photos")
      .select("id,is_main_photo")
      .in("id", [photoA, photoB]);
    fail(selected.error, "verify selected main photo");
    const selectedMap = new Map((selected.data ?? []).map((row) => [row.id, row.is_main_photo]));
    expect(selectedMap.get(photoA)).toBe(false);
    expect(selectedMap.get(photoB)).toBe(true);

    const bad = await seller.client.rpc(
      "set_main_vehicle_photo" as never,
      {
        p_opportunity_id: oppId,
        p_photo_id: crypto.randomUUID(),
      } as never,
    );
    if (!bad.error) throw new Error("invalid main photo target unexpectedly succeeded");

    const retained = await service
      .from("vehicle_photos")
      .select("id,is_main_photo")
      .in("id", [photoA, photoB]);
    fail(retained.error, "verify main photo preserved after failure");
    const retainedMap = new Map((retained.data ?? []).map((row) => [row.id, row.is_main_photo]));
    expect(retainedMap.get(photoA)).toBe(false);
    expect(retainedMap.get(photoB)).toBe(true);
  });
});

afterAll(async () => {
  let cleanupFailed = false;
  try {
    if (opportunities.length) {
      // None of these child tables cascade on delete from
      // vehicle_opportunities -- clear them first or the delete below
      // fails on a foreign key violation. vehicle_photos and
      // information_requests are both populated here (the latter via
      // the admin_handover_to_partner/admin_request_information RPCs).
      const removedPhotos = await service
        .from("vehicle_photos")
        .delete()
        .in("vehicle_opportunity_id", opportunities);
      if (removedPhotos.error) {
        cleanupFailed = true;
        console.error(removedPhotos.error.message);
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
  if (cleanupFailed) throw new Error("Workflow transaction E2E cleanup failed.");
});
