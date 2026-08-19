import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EXPECTED_TARGET = "wilmet-staging";
const BUCKET = "vehicle-photos";
const MAX_VEHICLE_PHOTO_BYTES = 10 * 1024 * 1024;
const evidencePath = "test-results/lovable-cloud-real-jwt-e2e.json";

if (process.env.E2E_ALLOW_STAGING_MUTATIONS !== "true") {
  throw new Error("E2E_ALLOW_STAGING_MUTATIONS=true is required for staging fixture mutations.");
}
if (process.env.E2E_TARGET_LABEL !== EXPECTED_TARGET) {
  throw new Error(`E2E_TARGET_LABEL must be exactly ${EXPECTED_TARGET}.`);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing staging E2E environment variable: ${name}`);
  return value;
}

const supabaseUrl = requiredEnv("E2E_SUPABASE_URL");
const anonKey = requiredEnv("E2E_SUPABASE_ANON_KEY");
const fixtureJson = requiredEnv("E2E_FIXTURE_CREDENTIALS_JSON");

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

type FixtureName =
  | "sellerA"
  | "sellerB"
  | "purchaseAgent"
  | "salesOnlyAgent"
  | "externalAgent"
  | "admin";

type FixtureCredential = { email: string; password: string };
type FixtureConfig = Record<FixtureName, FixtureCredential>;
type Identity = { id: string; client: SupabaseClient };

type CheckResult = {
  name: string;
  result: "PASS" | "FAIL";
  detail?: string;
};

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const evidence: {
  suite: string;
  runId: string;
  startedAt: string;
  finishedAt?: string;
  gitSha: string | null;
  targetHost: string;
  targetLabel: string;
  authMode: string;
  checks: CheckResult[];
  manualCleanupOpportunityIds: string[];
  cleanup: "PASS" | "MANUAL_PROVIDER_CLEANUP_REQUIRED" | "FAIL";
} = {
  suite: "Wilmet Lovable Cloud real-JWT fixture E2E",
  runId,
  startedAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA ?? null,
  targetHost: new URL(supabaseUrl).host,
  targetLabel: EXPECTED_TARGET,
  authMode: "lovable-cloud-fixtures",
  checks: [],
  manualCleanupOpportunityIds: [],
  cleanup: "PASS",
};

function parseFixtureConfig(raw: string): FixtureConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("E2E_FIXTURE_CREDENTIALS_JSON must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("E2E_FIXTURE_CREDENTIALS_JSON must be a JSON object.");
  }

  const fixtureNames: FixtureName[] = [
    "sellerA",
    "sellerB",
    "purchaseAgent",
    "salesOnlyAgent",
    "externalAgent",
    "admin",
  ];

  const config = parsed as Record<string, unknown>;
  for (const fixtureName of fixtureNames) {
    const candidate = config[fixtureName];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`Fixture ${fixtureName} is missing.`);
    }
    const credential = candidate as Record<string, unknown>;
    if (typeof credential.email !== "string" || credential.email.trim().length === 0) {
      throw new Error(`Fixture ${fixtureName} email is missing.`);
    }
    if (typeof credential.password !== "string" || credential.password.length === 0) {
      throw new Error(`Fixture ${fixtureName} password is missing.`);
    }
  }

  return config as FixtureConfig;
}

const fixtures = parseFixtureConfig(fixtureJson);

function failOnError(error: { message: string } | null, context: string) {
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

async function signInFixture(
  name: FixtureName,
  expected: {
    role: "partenaire" | "sales_agent" | "external_agent" | "admin";
    partnerKind?: "seller" | null;
    staffScope?: "purchase" | "sales" | "both" | null;
    isExternal?: boolean;
  },
): Promise<Identity> {
  const credential = fixtures[name];
  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const signedIn = await client.auth.signInWithPassword({
    email: credential.email,
    password: credential.password,
  });
  failOnError(signedIn.error, `sign in fixture ${name}`);

  const userId = signedIn.data.user?.id;
  if (!userId || !signedIn.data.session?.access_token) {
    throw new Error(`sign in fixture ${name}: no authenticated session returned`);
  }

  const profile = await client
    .from("profiles")
    .select("id,partner_kind,staff_scope,is_external,is_active")
    .eq("id", userId)
    .single();
  failOnError(profile.error, `read fixture profile ${name}`);
  expect(profile.data.id).toBe(userId);
  expect(profile.data.is_active).toBe(true);

  if (Object.hasOwn(expected, "partnerKind")) {
    expect(profile.data.partner_kind).toBe(expected.partnerKind ?? null);
  }
  if (Object.hasOwn(expected, "staffScope")) {
    expect(profile.data.staff_scope).toBe(expected.staffScope ?? null);
  }
  if (Object.hasOwn(expected, "isExternal")) {
    expect(profile.data.is_external).toBe(expected.isExternal ?? false);
  }

  const roles = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  failOnError(roles.error, `read fixture role ${name}`);
  expect(roles.data?.map((row) => row.role)).toContain(expected.role);

  return { id: userId, client };
}

async function rowVisible(client: SupabaseClient, id: string): Promise<boolean> {
  const result = await client
    .from("vehicle_opportunities")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  failOnError(result.error, `read opportunity ${id}`);
  return result.data?.id === id;
}

let sellerA: Identity;
let sellerB: Identity;
let purchaseAgent: Identity;
let salesOnlyAgent: Identity;
let externalAgent: Identity;
let admin: Identity;
let opportunityId: string | null = null;
let opportunitySubmitted = false;
let originalSellerCity: string | null = null;
const storagePaths: string[] = [];

beforeAll(async () => {
  await check("fixture identities issue real JWT sessions with expected roles", async () => {
    sellerA = await signInFixture("sellerA", {
      role: "partenaire",
      partnerKind: "seller",
      staffScope: null,
      isExternal: false,
    });
    sellerB = await signInFixture("sellerB", {
      role: "partenaire",
      partnerKind: "seller",
      staffScope: null,
      isExternal: false,
    });
    purchaseAgent = await signInFixture("purchaseAgent", {
      role: "sales_agent",
      staffScope: "purchase",
      isExternal: false,
    });
    salesOnlyAgent = await signInFixture("salesOnlyAgent", {
      role: "sales_agent",
      staffScope: "sales",
      isExternal: false,
    });
    externalAgent = await signInFixture("externalAgent", {
      role: "external_agent",
      staffScope: "purchase",
      isExternal: true,
    });
    admin = await signInFixture("admin", { role: "admin" });
  });
});

test("Lovable Cloud fixtures preserve real-JWT authorization boundaries", async () => {
  await check("seller creates a draft and privileged insert fields are stripped", async () => {
    const result = await sellerA.client
      .from("vehicle_opportunities")
      .insert({
        partenaire_id: sellerA.id,
        status: "brouillon",
        brand: `E2E-MANAGED-${runId}`,
        model: "real-jwt-fixture",
        city: "E2E staging",
        country: "BE",
        owner_side: "partenaire",
        assigned_sales_agent_id: externalAgent.id,
        assigned_group: "sales",
        purchase_price_excl_tax: 999999,
        reference_number: "E2E-CALLER-CONTROLLED",
      })
      .select(
        "id,status,owner_side,assigned_sales_agent_id,assigned_group_id,assigned_group,purchase_price_excl_tax,reference_number,submitted_at",
      )
      .single();
    failOnError(result.error, "create managed fixture seller draft");
    if (!result.data?.id) throw new Error("managed fixture draft returned no id");

    opportunityId = result.data.id;
    expect(result.data.status).toBe("brouillon");
    expect(result.data.owner_side).toBe("wilmet");
    expect(result.data.assigned_sales_agent_id).toBeNull();
    expect(result.data.assigned_group_id).toBeNull();
    expect(result.data.assigned_group).toBeNull();
    expect(result.data.purchase_price_excl_tax).toBeNull();
    expect(result.data.reference_number).toBeNull();
    expect(result.data.submitted_at).toBeNull();
  });

  if (!opportunityId) throw new Error("managed fixture opportunity was not created");

  await check("seller draft is isolated from other sellers and staff", async () => {
    expect(await rowVisible(sellerA.client, opportunityId!)).toBe(true);
    expect(await rowVisible(sellerB.client, opportunityId!)).toBe(false);
    expect(await rowVisible(purchaseAgent.client, opportunityId!)).toBe(false);
    expect(await rowVisible(salesOnlyAgent.client, opportunityId!)).toBe(false);
    expect(await rowVisible(externalAgent.client, opportunityId!)).toBe(false);
    expect(await rowVisible(admin.client, opportunityId!)).toBe(false);
  });

  await check("vehicle-photo storage enforces owner, MIME and size boundaries", async () => {
    const validPath = `${opportunityId}/managed-e2e/${runId}.png`;
    const crossOwnerPath = `${opportunityId}/managed-e2e/${runId}-seller-b.png`;
    const disallowedPath = `${opportunityId}/managed-e2e/${runId}.txt`;
    const oversizedPath = `${opportunityId}/managed-e2e/${runId}-oversized.png`;
    storagePaths.push(validPath, crossOwnerPath, disallowedPath, oversizedPath);

    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=",
      "base64",
    );

    const allowed = await sellerA.client.storage
      .from(BUCKET)
      .upload(validPath, onePixelPng, { contentType: "image/png", upsert: false });
    failOnError(allowed.error, "allowed owner PNG upload");

    const crossOwner = await sellerB.client.storage
      .from(BUCKET)
      .upload(crossOwnerPath, onePixelPng, { contentType: "image/png", upsert: false });
    expectRejected(crossOwner.error, "cross-owner photo upload");

    const disallowed = await sellerA.client.storage
      .from(BUCKET)
      .upload(disallowedPath, Buffer.from("not an allowed image"), {
        contentType: "text/plain",
        upsert: false,
      });
    expectRejected(disallowed.error, "disallowed MIME upload");

    const oversized = await sellerA.client.storage
      .from(BUCKET)
      .upload(oversizedPath, new Uint8Array(MAX_VEHICLE_PHOTO_BYTES + 1), {
        contentType: "image/png",
        upsert: false,
      });
    expectRejected(oversized.error, "oversized photo upload");

    const removed = await sellerA.client.storage.from(BUCKET).remove([validPath]);
    failOnError(removed.error, "remove allowed E2E storage object before submission");
  });

  await check("submission exposes only the purchase pool", async () => {
    const submitted = await sellerA.client
      .from("vehicle_opportunities")
      .update({ status: "envoyee", owner_side: "wilmet" })
      .eq("id", opportunityId)
      .select("id,status,owner_side,assigned_group,assigned_group_id,assigned_sales_agent_id")
      .single();
    failOnError(submitted.error, "submit managed fixture opportunity");
    opportunitySubmitted = true;

    expect(submitted.data.status).toBe("envoyee");
    expect(submitted.data.owner_side).toBe("wilmet");
    expect(submitted.data.assigned_group).toBe("purchase");
    expect(submitted.data.assigned_group_id).toBeNull();
    expect(submitted.data.assigned_sales_agent_id).toBeNull();

    expect(await rowVisible(purchaseAgent.client, opportunityId!)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, opportunityId!)).toBe(false);
    expect(await rowVisible(externalAgent.client, opportunityId!)).toBe(false);
    expect(await rowVisible(sellerB.client, opportunityId!)).toBe(false);
    expect(await rowVisible(admin.client, opportunityId!)).toBe(true);
  });

  await check("submitted seller cannot tamper with staff-controlled fields", async () => {
    await sellerA.client
      .from("vehicle_opportunities")
      .update({
        status: "acceptee",
        assigned_group: "sales",
        assigned_sales_agent_id: sellerA.id,
        purchase_price_excl_tax: 1,
      })
      .eq("id", opportunityId)
      .select("id");

    const read = await purchaseAgent.client
      .from("vehicle_opportunities")
      .select("status,owner_side,assigned_group,assigned_sales_agent_id,purchase_price_excl_tax")
      .eq("id", opportunityId)
      .single();
    failOnError(read.error, "verify submitted opportunity after seller tamper attempt");
    expect(read.data.status).toBe("envoyee");
    expect(read.data.owner_side).toBe("wilmet");
    expect(read.data.assigned_group).toBe("purchase");
    expect(read.data.assigned_sales_agent_id).toBeNull();
    expect(read.data.purchase_price_excl_tax).toBeNull();
  });

  await check("admin assignment grants only the intended external agent scope", async () => {
    const assigned = await admin.client
      .from("vehicle_opportunities")
      .update({
        assigned_sales_agent_id: externalAgent.id,
        assigned_group: "purchase",
      })
      .eq("id", opportunityId)
      .select("id,assigned_sales_agent_id,assigned_group")
      .single();
    failOnError(assigned.error, "admin assign external agent");
    expect(assigned.data.assigned_sales_agent_id).toBe(externalAgent.id);
    expect(assigned.data.assigned_group).toBe("purchase");

    expect(await rowVisible(externalAgent.client, opportunityId!)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, opportunityId!)).toBe(false);
  });

  await check("profile self-service rejects privilege-adjacent mutations", async () => {
    const current = await sellerA.client
      .from("profiles")
      .select("city,partner_kind,is_external,commission_rate")
      .eq("id", sellerA.id)
      .single();
    failOnError(current.error, "read seller profile before self-service check");
    originalSellerCity = current.data.city ?? null;

    const benign = await sellerA.client
      .from("profiles")
      .update({ city: "E2E managed benign edit" })
      .eq("id", sellerA.id)
      .select("id,city")
      .single();
    failOnError(benign.error, "benign profile self update");
    expect(benign.data.city).toBe("E2E managed benign edit");

    const commissionAttempt = await sellerA.client
      .from("profiles")
      .update({ commission_rate: 0.99 })
      .eq("id", sellerA.id)
      .select("id");
    expectRejected(commissionAttempt.error, "commission self update");

    const metadataAttempt = await sellerA.client
      .from("profiles")
      .update({ partner_kind: "client", is_external: true })
      .eq("id", sellerA.id)
      .select("id");
    expectRejected(metadataAttempt.error, "partner/external metadata self update");

    const verified = await sellerA.client
      .from("profiles")
      .select("partner_kind,is_external,commission_rate")
      .eq("id", sellerA.id)
      .single();
    failOnError(verified.error, "verify protected profile fields");
    expect(verified.data.partner_kind).toBe("seller");
    expect(verified.data.is_external).toBe(false);
    expect(verified.data.commission_rate).toBeNull();
  });
});

afterAll(async () => {
  let cleanupFailed = false;

  try {
    if (sellerA && originalSellerCity !== null) {
      const restored = await sellerA.client
        .from("profiles")
        .update({ city: originalSellerCity })
        .eq("id", sellerA.id);
      if (restored.error) {
        cleanupFailed = true;
        console.error(`E2E restore fixture profile: ${restored.error.message}`);
      }
    }

    if (sellerA && storagePaths.length > 0 && !opportunitySubmitted) {
      const removedStorage = await sellerA.client.storage.from(BUCKET).remove(storagePaths);
      if (removedStorage.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup draft storage: ${removedStorage.error.message}`);
      }
    }

    if (sellerA && opportunityId && !opportunitySubmitted) {
      const removedDraft = await sellerA.client
        .from("vehicle_opportunities")
        .delete()
        .eq("id", opportunityId);
      if (removedDraft.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup draft opportunity: ${removedDraft.error.message}`);
      }
    }

    if (opportunityId && opportunitySubmitted) {
      evidence.manualCleanupOpportunityIds.push(opportunityId);
      evidence.cleanup = "MANUAL_PROVIDER_CLEANUP_REQUIRED";
    } else if (cleanupFailed) {
      evidence.cleanup = "FAIL";
    } else {
      evidence.cleanup = "PASS";
    }
  } finally {
    evidence.finishedAt = new Date().toISOString();
    mkdirSync("test-results", { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }

  if (cleanupFailed) {
    throw new Error("Lovable Cloud E2E automatic cleanup was not fully successful; inspect logs.");
  }
});
