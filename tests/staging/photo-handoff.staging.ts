import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const EXPECTED_TARGET = "wilmet-staging";
const BUCKET = "vehicle-photos";

if (process.env.E2E_ALLOW_STAGING_MUTATIONS !== "true") {
  throw new Error("E2E_ALLOW_STAGING_MUTATIONS=true is required for disposable staging fixtures.");
}
if (process.env.E2E_TARGET_LABEL !== EXPECTED_TARGET) {
  throw new Error(`E2E_TARGET_LABEL must be exactly ${EXPECTED_TARGET}.`);
}

function env(name: (typeof REQUIRED_ENV)[number]) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing staging E2E environment variable: ${name}`);
  return value;
}

const supabaseUrl = env("E2E_SUPABASE_URL");
const anonKey = env("E2E_SUPABASE_ANON_KEY");
const serviceKey = env("E2E_SUPABASE_SERVICE_ROLE_KEY");
const opts = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const service = createClient(supabaseUrl, serviceKey, opts);
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const evidencePath = "test-results/tm011-photo-handoff-e2e.json";

const evidence: {
  suite: string;
  runId: string;
  gitSha: string | null;
  targetLabel: string;
  checks: Array<{ name: string; result: "PASS" | "FAIL"; detail?: string }>;
  cleanup?: "PASS" | "FAIL";
} = {
  suite: "TM-011 photo parent-scope real-JWT E2E",
  runId,
  gitSha: process.env.GITHUB_SHA ?? null,
  targetLabel: EXPECTED_TARGET,
  checks: [],
};

type Identity = { id: string; email: string; client: SupabaseClient };
const userIds: string[] = [];
const opportunityIds: string[] = [];
const storagePaths: string[] = [];
let sellerA: Identity;
let sellerB: Identity;
let purchaseAgent: Identity;
let oppId: string;
let photoId: string;
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
  "base64",
);

function fail(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}
function rejected(error: { message: string } | null, context: string) {
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
  role: "partenaire" | "sales_agent";
  partnerKind?: "seller" | null;
  staffScope?: "purchase" | "sales" | "both" | null;
}): Promise<Identity> {
  const email = `tm011-${runId}-${input.label}@example.test`;
  const password = `Wilmet-TM011-${crypto.randomUUID()}!Aa1`;
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
  if (!id) throw new Error(`create ${input.label}: no user id`);
  userIds.push(id);

  const profile = await service
    .from("profiles")
    .update({
      partner_kind: input.partnerKind ?? null,
      staff_scope: input.staffScope ?? null,
      is_external: false,
      is_active: true,
    })
    .eq("id", id);
  fail(profile.error, `configure profile ${input.label}`);

  fail(
    (await service.from("user_roles").delete().eq("user_id", id)).error,
    `clear role ${input.label}`,
  );
  fail(
    (await service.from("user_roles").insert({ user_id: id, role: input.role })).error,
    `assign role ${input.label}`,
  );

  const client = createClient(supabaseUrl, anonKey, opts);
  const signed = await client.auth.signInWithPassword({ email, password });
  fail(signed.error, `sign in ${input.label}`);
  return { id, email, client };
}

beforeAll(async () => {
  sellerA = await provision({ label: "seller-a", role: "partenaire", partnerKind: "seller" });
  sellerB = await provision({ label: "seller-b", role: "partenaire", partnerKind: "seller" });
  purchaseAgent = await provision({
    label: "purchase-agent",
    role: "sales_agent",
    staffScope: "purchase",
  });

  const draft = await sellerA.client
    .from("vehicle_opportunities")
    .insert({
      partenaire_id: sellerA.id,
      status: "brouillon",
      brand: `TM011-${runId}`,
      model: "photo-handoff",
      city: "E2E",
      country: "BE",
    })
    .select("id")
    .single();
  fail(draft.error, "create seller draft");
  if (!draft.data?.id) throw new Error("create seller draft: no id");
  oppId = draft.data.id;
  opportunityIds.push(oppId);
});

test("draft owner can upload photo and create metadata", async () => {
  await check("draft seller photo mutation allowed", async () => {
    const path = `${oppId}/tm011/${runId}-draft.png`;
    storagePaths.push(path);
    const upload = await sellerA.client.storage.from(BUCKET).upload(path, onePixelPng, {
      contentType: "image/png",
      upsert: false,
    });
    fail(upload.error, "draft seller upload");

    const record = await sellerA.client
      .from("vehicle_photos")
      .insert({
        vehicle_opportunity_id: oppId,
        storage_path: path,
        is_main_photo: true,
        sort_order: 0,
      })
      .select("id,sort_order")
      .single();
    fail(record.error, "draft seller photo metadata insert");
    if (!record.data?.id) throw new Error("photo metadata insert: no id");
    photoId = record.data.id;
  });
});

test("unrelated seller cannot upload into another seller opportunity", async () => {
  await check("cross-owner photo upload denied", async () => {
    const path = `${oppId}/tm011/${runId}-cross-owner.png`;
    storagePaths.push(path);
    const result = await sellerB.client.storage.from(BUCKET).upload(path, onePixelPng, {
      contentType: "image/png",
      upsert: false,
    });
    rejected(result.error, "cross-owner upload");
  });
});

test("submitted Wilmet-owned dossier freezes seller photo mutations and exposes photos to scoped staff", async () => {
  await check("submitted photo integrity and staff parent read", async () => {
    const submit = await sellerA.client
      .from("vehicle_opportunities")
      .update({
        status: "envoyee",
        owner_side: "wilmet",
      })
      .eq("id", oppId)
      .select("status,owner_side,assigned_group")
      .single();
    fail(submit.error, "submit opportunity");
    expect(submit.data.owner_side).toBe("wilmet");
    expect(submit.data.assigned_group).toBe("purchase");

    const blockedPath = `${oppId}/tm011/${runId}-wilmet-owned.png`;
    storagePaths.push(blockedPath);
    const blockedUpload = await sellerA.client.storage
      .from(BUCKET)
      .upload(blockedPath, onePixelPng, {
        contentType: "image/png",
        upsert: false,
      });
    rejected(blockedUpload.error, "seller upload after Wilmet handoff");

    const update = await sellerA.client
      .from("vehicle_photos")
      .update({ sort_order: 99 })
      .eq("id", photoId)
      .select("id,sort_order");
    fail(update.error, "submitted metadata update query");
    expect(update.data ?? []).toHaveLength(0);

    const servicePhoto = await service
      .from("vehicle_photos")
      .select("sort_order")
      .eq("id", photoId)
      .single();
    fail(servicePhoto.error, "verify frozen photo metadata");
    expect(servicePhoto.data.sort_order).toBe(0);

    const staffRead = await purchaseAgent.client
      .from("vehicle_photos")
      .select("id")
      .eq("vehicle_opportunity_id", oppId);
    fail(staffRead.error, "scoped purchase staff photo read");
    expect(staffRead.data ?? []).toHaveLength(1);
  });
});

test("explicit hand-back re-enables seller photo upload and metadata changes", async () => {
  await check("photo mutation allowed only during partner hand-back", async () => {
    const handback = await service
      .from("vehicle_opportunities")
      .update({
        owner_side: "partenaire",
        status: "informations_demandees",
        handover_message: "TM011 photo evidence requested",
      })
      .eq("id", oppId);
    fail(handback.error, "service hand-back");

    const path = `${oppId}/tm011/${runId}-handback.png`;
    storagePaths.push(path);
    const upload = await sellerA.client.storage.from(BUCKET).upload(path, onePixelPng, {
      contentType: "image/png",
      upsert: false,
    });
    fail(upload.error, "seller upload during hand-back");

    const add = await sellerA.client.from("vehicle_photos").insert({
      vehicle_opportunity_id: oppId,
      storage_path: path,
      is_main_photo: false,
      sort_order: 1,
    });
    fail(add.error, "seller metadata insert during hand-back");

    const update = await sellerA.client
      .from("vehicle_photos")
      .update({ sort_order: 2 })
      .eq("id", photoId)
      .select("sort_order")
      .single();
    fail(update.error, "seller metadata update during hand-back");
    expect(update.data.sort_order).toBe(2);
  });
});

test("Wilmet reclaim blocks seller Storage API deletion", async () => {
  await check("photo Storage delete denied after reclaim", async () => {
    const reclaim = await service
      .from("vehicle_opportunities")
      .update({
        owner_side: "wilmet",
        status: "envoyee",
        handover_message: "TM011 hand-back completed",
      })
      .eq("id", oppId);
    fail(reclaim.error, "service reclaim");

    const path = `${oppId}/tm011/${runId}-handback.png`;
    const remove = await sellerA.client.storage.from(BUCKET).remove([path]);
    rejected(remove.error, "seller Storage removal after reclaim");

    const objectCheck = await service.storage.from(BUCKET).list(`${oppId}/tm011`, {
      search: `${runId}-handback.png`,
    });
    fail(objectCheck.error, "verify reclaimed object remains");
    expect((objectCheck.data ?? []).some((row) => row.name === `${runId}-handback.png`)).toBe(true);
  });
});

afterAll(async () => {
  let failed = false;
  try {
    if (storagePaths.length) {
      const remove = await service.storage.from(BUCKET).remove(storagePaths);
      if (remove.error) {
        failed = true;
        console.error(remove.error.message);
      }
    }
    if (opportunityIds.length) {
      // Neither table cascades on delete from vehicle_opportunities --
      // clear them first or the delete below fails on a foreign key
      // violation. vehicle_photos rows are inserted throughout this
      // test; opportunity_status_history picks up the hand-back status
      // transition.
      const removedPhotos = await service
        .from("vehicle_photos")
        .delete()
        .in("vehicle_opportunity_id", opportunityIds);
      if (removedPhotos.error) {
        failed = true;
        console.error(removedPhotos.error.message);
      }
      const removedHistory = await service
        .from("opportunity_status_history")
        .delete()
        .in("vehicle_opportunity_id", opportunityIds);
      if (removedHistory.error) {
        failed = true;
        console.error(removedHistory.error.message);
      }

      const remove = await service.from("vehicle_opportunities").delete().in("id", opportunityIds);
      if (remove.error) {
        failed = true;
        console.error(remove.error.message);
      }
    }
    if (userIds.length) {
      const roles = await service.from("user_roles").delete().in("user_id", userIds);
      if (roles.error) {
        failed = true;
        console.error(roles.error.message);
      }
      const profiles = await service.from("profiles").delete().in("id", userIds);
      if (profiles.error) {
        failed = true;
        console.error(profiles.error.message);
      }
      for (const id of userIds) {
        const removed = await service.auth.admin.deleteUser(id);
        if (removed.error) {
          failed = true;
          console.error(removed.error.message);
        }
      }
    }
  } finally {
    evidence.cleanup = failed ? "FAIL" : "PASS";
    mkdirSync("test-results", { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  if (failed) throw new Error("TM-011 E2E cleanup failed; inspect logs.");
});
