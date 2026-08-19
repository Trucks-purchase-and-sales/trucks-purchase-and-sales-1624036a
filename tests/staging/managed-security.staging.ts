import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_MANAGED_CONFIG_JSON",
] as const;

const MUTATION_GUARD = "E2E_ALLOW_STAGING_MUTATIONS";
const TARGET_GUARD = "E2E_TARGET_LABEL";
const EXPECTED_TARGET = "wilmet-staging";
const VEHICLE_BUCKET = "vehicle-photos";
const MAX_VEHICLE_PHOTO_BYTES = 10 * 1024 * 1024;
const evidencePath = "test-results/staging-managed-real-jwt.json";

function requiredEnv(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required staging E2E environment variable: ${name}`);
  }
  return value;
}

function requireExplicitStagingMutationOptIn() {
  if (process.env[MUTATION_GUARD] !== "true") {
    throw new Error(
      `${MUTATION_GUARD}=true is required because this suite performs bounded staging mutations.`,
    );
  }

  if (process.env[TARGET_GUARD] !== EXPECTED_TARGET) {
    throw new Error(
      `${TARGET_GUARD} must be exactly ${EXPECTED_TARGET}; refusing to exercise an unlabelled target.`,
    );
  }
}

requireExplicitStagingMutationOptIn();

const supabaseUrl = requiredEnv("E2E_SUPABASE_URL");
const anonKey = requiredEnv("E2E_SUPABASE_ANON_KEY");

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

type IdentityConfig = {
  email: string;
  password: string;
};

type ManagedConfig = {
  identities: {
    sellerA: IdentityConfig;
    sellerB: IdentityConfig;
    purchaseAgent: IdentityConfig;
    salesOnlyAgent: IdentityConfig;
    externalAgent: IdentityConfig;
  };
  fixtures: {
    sellerADraftId: string;
    sellerBDraftId: string;
    submittedPurchaseId: string;
    externalAssignedId: string;
  };
};

type TestIdentity = {
  id: string;
  client: SupabaseClient;
};

type CheckResult = {
  name: string;
  result: "PASS" | "FAIL";
  detail?: string;
};

function parseManagedConfig(): ManagedConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(requiredEnv("E2E_MANAGED_CONFIG_JSON"));
  } catch {
    throw new Error("E2E_MANAGED_CONFIG_JSON must contain valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("E2E_MANAGED_CONFIG_JSON must contain an object");
  }

  const config = parsed as ManagedConfig;
  const identityNames = [
    "sellerA",
    "sellerB",
    "purchaseAgent",
    "salesOnlyAgent",
    "externalAgent",
  ] as const;
  const fixtureNames = [
    "sellerADraftId",
    "sellerBDraftId",
    "submittedPurchaseId",
    "externalAssignedId",
  ] as const;

  for (const name of identityNames) {
    const identity = config.identities?.[name];
    if (!identity?.email?.trim() || !identity.password) {
      throw new Error(`Managed E2E identity ${name} is not fully configured`);
    }
  }

  for (const name of fixtureNames) {
    if (!config.fixtures?.[name]?.trim()) {
      throw new Error(`Managed E2E fixture ${name} is not configured`);
    }
  }

  return config;
}

const managedConfig = parseManagedConfig();
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const evidence: {
  suite: string;
  runId: string;
  startedAt: string;
  finishedAt?: string;
  targetHost: string;
  targetLabel: string;
  gitSha: string | null;
  checks: CheckResult[];
  cleanup?: "PASS" | "FAIL";
} = {
  suite: "Wilmet Lovable-managed real-JWT staging security E2E",
  runId,
  startedAt: new Date().toISOString(),
  targetHost: new URL(supabaseUrl).host,
  targetLabel: EXPECTED_TARGET,
  gitSha: process.env.GITHUB_SHA ?? null,
  checks: [],
};

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

function failOnError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function signIn(label: string, identity: IdentityConfig): Promise<TestIdentity> {
  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const signedIn = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  failOnError(signedIn.error, `sign in ${label}`);

  const session = signedIn.data.session;
  const user = signedIn.data.user;
  if (!session?.access_token || !user?.id) {
    throw new Error(`sign in ${label}: no real Auth session returned`);
  }

  return { id: user.id, client };
}

async function rowVisible(client: SupabaseClient, id: string): Promise<boolean> {
  const result = await client
    .from("vehicle_opportunities")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  failOnError(result.error, `read vehicle opportunity ${id}`);
  return result.data?.id === id;
}

async function readOpportunity(client: SupabaseClient, id: string) {
  const result = await client
    .from("vehicle_opportunities")
    .select(
      "id,status,owner_side,assigned_group,assigned_sales_agent_id,purchase_price_excl_tax,partenaire_id",
    )
    .eq("id", id)
    .single();
  failOnError(result.error, `read owned vehicle opportunity ${id}`);
  return result.data;
}

let sellerA: TestIdentity;
let sellerB: TestIdentity;
let purchaseAgent: TestIdentity;
let salesOnlyAgent: TestIdentity;
let externalAgent: TestIdentity;
const createdStoragePaths: string[] = [];

beforeAll(async () => {
  [sellerA, sellerB, purchaseAgent, salesOnlyAgent, externalAgent] = await Promise.all([
    signIn("sellerA", managedConfig.identities.sellerA),
    signIn("sellerB", managedConfig.identities.sellerB),
    signIn("purchaseAgent", managedConfig.identities.purchaseAgent),
    signIn("salesOnlyAgent", managedConfig.identities.salesOnlyAgent),
    signIn("externalAgent", managedConfig.identities.externalAgent),
  ]);
});

test("pre-provisioned identities receive real Supabase Auth sessions", async () => {
  await check("real managed Auth sessions", async () => {
    for (const identity of [sellerA, sellerB, purchaseAgent, salesOnlyAgent, externalAgent]) {
      expect(identity.id).toMatch(/^[0-9a-f-]{36}$/i);
    }
    expect(new Set([sellerA.id, sellerB.id, purchaseAgent.id, salesOnlyAgent.id, externalAgent.id]).size).toBe(
      5,
    );
  });
});

test("real JWTs keep seller drafts private across identities and staff", async () => {
  await check("seller draft isolation", async () => {
    expect(await rowVisible(sellerA.client, managedConfig.fixtures.sellerADraftId)).toBe(true);
    expect(await rowVisible(sellerA.client, managedConfig.fixtures.sellerBDraftId)).toBe(false);
    expect(await rowVisible(sellerB.client, managedConfig.fixtures.sellerBDraftId)).toBe(true);
    expect(await rowVisible(purchaseAgent.client, managedConfig.fixtures.sellerADraftId)).toBe(false);
    expect(await rowVisible(externalAgent.client, managedConfig.fixtures.sellerADraftId)).toBe(false);
  });
});

test("purchase and external-agent scopes are enforced with real JWTs", async () => {
  await check("managed staff scope matrix", async () => {
    expect(await rowVisible(purchaseAgent.client, managedConfig.fixtures.submittedPurchaseId)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, managedConfig.fixtures.submittedPurchaseId)).toBe(false);
    expect(await rowVisible(externalAgent.client, managedConfig.fixtures.submittedPurchaseId)).toBe(false);
    expect(await rowVisible(sellerB.client, managedConfig.fixtures.submittedPurchaseId)).toBe(false);

    expect(await rowVisible(externalAgent.client, managedConfig.fixtures.externalAssignedId)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, managedConfig.fixtures.externalAssignedId)).toBe(false);
  });
});

test("submitted seller cannot tamper with staff-controlled workflow state", async () => {
  await check("managed seller tamper resistance", async () => {
    const before = await readOpportunity(sellerA.client, managedConfig.fixtures.submittedPurchaseId);
    expect(before.partenaire_id).toBe(sellerA.id);
    expect(before.status).toBe("envoyee");
    expect(before.owner_side).toBe("wilmet");
    expect(before.assigned_group).toBe("purchase");
    expect(before.assigned_sales_agent_id).toBeNull();
    expect(before.purchase_price_excl_tax).toBeNull();

    await sellerA.client
      .from("vehicle_opportunities")
      .update({
        status: "acceptee",
        assigned_group: "sales",
        assigned_sales_agent_id: sellerA.id,
        purchase_price_excl_tax: 1,
      })
      .eq("id", managedConfig.fixtures.submittedPurchaseId)
      .select("id");

    const after = await readOpportunity(sellerA.client, managedConfig.fixtures.submittedPurchaseId);
    expect(after.status).toBe(before.status);
    expect(after.owner_side).toBe(before.owner_side);
    expect(after.assigned_group).toBe(before.assigned_group);
    expect(after.assigned_sales_agent_id).toBe(before.assigned_sales_agent_id);
    expect(after.purchase_price_excl_tax).toBe(before.purchase_price_excl_tax);
  });
});

test("profile self-service cannot change privilege-adjacent fields", async () => {
  await check("managed profile privilege guard", async () => {
    const before = await sellerA.client
      .from("profiles")
      .select("id,partner_kind,is_external,commission_rate,staff_scope")
      .eq("id", sellerA.id)
      .single();
    failOnError(before.error, "read seller profile before privilege attempts");

    await sellerA.client
      .from("profiles")
      .update({ commission_rate: 0.99 })
      .eq("id", sellerA.id)
      .select("id");
    await sellerA.client
      .from("profiles")
      .update({ partner_kind: "client", is_external: true, staff_scope: "both" })
      .eq("id", sellerA.id)
      .select("id");

    const after = await sellerA.client
      .from("profiles")
      .select("id,partner_kind,is_external,commission_rate,staff_scope")
      .eq("id", sellerA.id)
      .single();
    failOnError(after.error, "read seller profile after privilege attempts");

    expect(after.data).toEqual(before.data);
  });
});

test("vehicle photo bucket enforces owner, MIME and size boundaries without service role", async () => {
  await check("managed vehicle-photo storage boundary", async () => {
    const base = `${managedConfig.fixtures.sellerADraftId}/e2e-managed/${runId}`;
    const validPath = `${base}.png`;
    const crossOwnerPath = `${base}-seller-b.png`;
    const disallowedPath = `${base}.txt`;
    const oversizedPath = `${base}-oversized.png`;
    createdStoragePaths.push(validPath);

    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
      "base64",
    );

    const validUpload = await sellerA.client.storage
      .from(VEHICLE_BUCKET)
      .upload(validPath, onePixelPng, { contentType: "image/png", upsert: false });
    failOnError(validUpload.error, "allowed owner PNG upload");

    const crossOwnerUpload = await sellerB.client.storage
      .from(VEHICLE_BUCKET)
      .upload(crossOwnerPath, onePixelPng, { contentType: "image/png", upsert: false });
    expect(crossOwnerUpload.error).not.toBeNull();

    const disallowedUpload = await sellerA.client.storage
      .from(VEHICLE_BUCKET)
      .upload(disallowedPath, Buffer.from("not an allowed vehicle image"), {
        contentType: "text/plain",
        upsert: false,
      });
    expect(disallowedUpload.error).not.toBeNull();

    const oversized = new Uint8Array(MAX_VEHICLE_PHOTO_BYTES + 1);
    const oversizedUpload = await sellerA.client.storage
      .from(VEHICLE_BUCKET)
      .upload(oversizedPath, oversized, { contentType: "image/png", upsert: false });
    expect(oversizedUpload.error).not.toBeNull();

    const removed = await sellerA.client.storage.from(VEHICLE_BUCKET).remove([validPath]);
    failOnError(removed.error, "remove allowed owner PNG fixture");
    createdStoragePaths.splice(createdStoragePaths.indexOf(validPath), 1);
  });
});

afterAll(async () => {
  let cleanupFailed = false;

  try {
    if (createdStoragePaths.length > 0 && sellerA) {
      const removed = await sellerA.client.storage.from(VEHICLE_BUCKET).remove(createdStoragePaths);
      if (removed.error) {
        cleanupFailed = true;
        console.error(`Managed E2E cleanup storage: ${removed.error.message}`);
      }
    }
  } finally {
    evidence.cleanup = cleanupFailed ? "FAIL" : "PASS";
    evidence.finishedAt = new Date().toISOString();
    mkdirSync("test-results", { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }

  if (cleanupFailed) {
    throw new Error("Managed staging security E2E cleanup failed; inspect workflow logs.");
  }
});
