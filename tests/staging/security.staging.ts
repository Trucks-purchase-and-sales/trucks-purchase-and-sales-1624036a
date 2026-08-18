import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUIRED_ENV = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const MUTATION_GUARD = "E2E_ALLOW_STAGING_MUTATIONS";
const TARGET_GUARD = "E2E_TARGET_LABEL";
const EXPECTED_TARGET = "wilmet-staging";
const VEHICLE_BUCKET = "vehicle-photos";
const MAX_VEHICLE_PHOTO_BYTES = 10 * 1024 * 1024;

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
      `${MUTATION_GUARD}=true is required because this suite creates and deletes disposable staging fixtures.`,
    );
  }

  if (process.env[TARGET_GUARD] !== EXPECTED_TARGET) {
    throw new Error(
      `${TARGET_GUARD} must be exactly ${EXPECTED_TARGET}; refusing to mutate an unlabelled target.`,
    );
  }
}

requireExplicitStagingMutationOptIn();

const supabaseUrl = requiredEnv("E2E_SUPABASE_URL");
const anonKey = requiredEnv("E2E_SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

const service = createClient(supabaseUrl, serviceRoleKey, clientOptions);

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const evidencePath = "test-results/staging-security-e2e.json";

type CheckResult = {
  name: string;
  result: "PASS" | "FAIL";
  detail?: string;
};

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
  suite: "Wilmet real-JWT staging security E2E",
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

function expectRejected(error: { message: string } | null, context: string) {
  if (!error) throw new Error(`${context}: operation unexpectedly succeeded`);
}

type TestIdentity = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

const createdUserIds: string[] = [];
const createdOpportunityIds: string[] = [];
const createdStoragePaths: string[] = [];

let sellerA: TestIdentity;
let sellerB: TestIdentity;
let purchaseAgent: TestIdentity;
let salesOnlyAgent: TestIdentity;
let externalAgent: TestIdentity;
let sellerAOpportunityId: string;
let sellerBOpportunityId: string;

async function provisionIdentity(input: {
  label: string;
  role: "partenaire" | "sales_agent" | "external_agent";
  partnerKind?: "seller" | null;
  staffScope?: "purchase" | "sales" | "both" | null;
  isExternal?: boolean;
}): Promise<TestIdentity> {
  const email = `e2e-${runId}-${input.label}@example.test`;
  const password = `Wilmet-E2E-${crypto.randomUUID()}!Aa1`;

  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "E2E",
      last_name: input.label,
    },
  });
  failOnError(created.error, `create auth identity ${input.label}`);

  const user = created.data.user;
  if (!user) throw new Error(`create auth identity ${input.label}: no user returned`);
  createdUserIds.push(user.id);

  const profile = await service.from("profiles").upsert(
    {
      id: user.id,
      first_name: "E2E",
      last_name: input.label,
      email,
      is_active: true,
      partner_kind: input.partnerKind ?? null,
      staff_scope: input.staffScope ?? null,
      is_external: input.isExternal ?? false,
      city: "E2E staging",
      country: "BE",
    },
    { onConflict: "id" },
  );
  failOnError(profile.error, `upsert profile ${input.label}`);

  const removeExistingRoles = await service
    .from("user_roles")
    .delete()
    .eq("user_id", user.id);
  failOnError(removeExistingRoles.error, `clear roles ${input.label}`);

  const role = await service.from("user_roles").insert({
    user_id: user.id,
    role: input.role,
  });
  failOnError(role.error, `assign role ${input.role} to ${input.label}`);

  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  failOnError(signedIn.error, `sign in ${input.label}`);
  if (!signedIn.data.session?.access_token) {
    throw new Error(`sign in ${input.label}: no real Auth session returned`);
  }

  return { id: user.id, email, password, client };
}

async function createSellerDraft(
  seller: TestIdentity,
  label: string,
  includePrivilegedAttempt = false,
): Promise<string> {
  const payload: Record<string, unknown> = {
    partenaire_id: seller.id,
    status: "brouillon",
    brand: `E2E-${runId}`,
    model: label,
    year: 2024,
    city: "E2E staging",
    country: "BE",
  };

  if (includePrivilegedAttempt) {
    payload.owner_side = "partenaire";
    payload.assigned_sales_agent_id = externalAgent.id;
    payload.assigned_group = "sales";
    payload.purchase_price_excl_tax = 999999;
    payload.reference_number = "E2E-CALLER-CONTROLLED";
  }

  const result = await seller.client
    .from("vehicle_opportunities")
    .insert(payload)
    .select(
      "id,status,owner_side,assigned_sales_agent_id,assigned_group,purchase_price_excl_tax,reference_number",
    )
    .single();
  failOnError(result.error, `create ${label} seller draft`);

  const row = result.data;
  if (!row?.id) throw new Error(`create ${label} seller draft: no id returned`);
  createdOpportunityIds.push(row.id);

  if (includePrivilegedAttempt) {
    expect(row.status).toBe("brouillon");
    expect(row.owner_side).toBe("wilmet");
    expect(row.assigned_sales_agent_id).toBeNull();
    expect(row.assigned_group).toBeNull();
    expect(row.purchase_price_excl_tax).toBeNull();
    expect(row.reference_number).toBeNull();
  }

  return row.id;
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

async function getOpportunityAsService(id: string) {
  const result = await service
    .from("vehicle_opportunities")
    .select("*")
    .eq("id", id)
    .single();
  failOnError(result.error, `service read vehicle opportunity ${id}`);
  return result.data;
}

beforeAll(async () => {
  sellerA = await provisionIdentity({
    label: "seller-a",
    role: "partenaire",
    partnerKind: "seller",
  });
  sellerB = await provisionIdentity({
    label: "seller-b",
    role: "partenaire",
    partnerKind: "seller",
  });
  purchaseAgent = await provisionIdentity({
    label: "purchase-agent",
    role: "sales_agent",
    staffScope: "purchase",
  });
  salesOnlyAgent = await provisionIdentity({
    label: "sales-only-agent",
    role: "sales_agent",
    staffScope: "sales",
  });
  externalAgent = await provisionIdentity({
    label: "external-agent",
    role: "external_agent",
    staffScope: "purchase",
    isExternal: true,
  });

  sellerAOpportunityId = await createSellerDraft(sellerA, "seller-a-draft", true);
  sellerBOpportunityId = await createSellerDraft(sellerB, "seller-b-draft");
});

test("real JWTs keep seller drafts private across identities and staff", async () => {
  await check("seller draft isolation", async () => {
    expect(await rowVisible(sellerA.client, sellerAOpportunityId)).toBe(true);
    expect(await rowVisible(sellerA.client, sellerBOpportunityId)).toBe(false);
    expect(await rowVisible(purchaseAgent.client, sellerAOpportunityId)).toBe(false);
    expect(await rowVisible(externalAgent.client, sellerAOpportunityId)).toBe(false);
  });
});

test("seller insert boundary strips routing and commercial fields", async () => {
  await check("seller insert privileged-field stripping", async () => {
    const row = await getOpportunityAsService(sellerAOpportunityId);
    expect(row.status).toBe("brouillon");
    expect(row.owner_side).toBe("wilmet");
    expect(row.assigned_sales_agent_id).toBeNull();
    expect(row.assigned_group_id).toBeNull();
    expect(row.assigned_group).toBeNull();
    expect(row.purchase_price_excl_tax).toBeNull();
    expect(row.reference_number).toBeNull();
    expect(row.submitted_at).toBeNull();
  });
});

test("seller cannot create an already-submitted opportunity directly", async () => {
  await check("seller insert must start as draft", async () => {
    const attempted = await sellerA.client
      .from("vehicle_opportunities")
      .insert({
        partenaire_id: sellerA.id,
        status: "envoyee",
        brand: `E2E-${runId}`,
        model: "illegal-submitted-insert",
      })
      .select("id");

    if (!attempted.error && attempted.data?.[0]?.id) {
      createdOpportunityIds.push(attempted.data[0].id);
    }
    expectRejected(attempted.error, "seller submitted insert");
  });
});

test("submission hands the opportunity to the purchase pool with real JWT scoping", async () => {
  await check("seller submission and purchase-pool scoping", async () => {
    const submitted = await sellerA.client
      .from("vehicle_opportunities")
      .update({ status: "envoyee", owner_side: "wilmet" })
      .eq("id", sellerAOpportunityId)
      .select("id,status,owner_side,assigned_sales_agent_id,assigned_group_id,assigned_group")
      .single();
    failOnError(submitted.error, "seller submit opportunity");

    expect(submitted.data.status).toBe("envoyee");
    expect(submitted.data.owner_side).toBe("wilmet");
    expect(submitted.data.assigned_group).toBe("purchase");
    expect(submitted.data.assigned_group_id).toBeNull();
    expect(submitted.data.assigned_sales_agent_id).toBeNull();

    expect(await rowVisible(purchaseAgent.client, sellerAOpportunityId)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, sellerAOpportunityId)).toBe(false);
    expect(await rowVisible(externalAgent.client, sellerAOpportunityId)).toBe(false);
    expect(await rowVisible(sellerB.client, sellerAOpportunityId)).toBe(false);
  });
});

test("submitted seller cannot tamper with staff-controlled workflow state", async () => {
  await check("seller submitted-row tamper resistance", async () => {
    await sellerA.client
      .from("vehicle_opportunities")
      .update({
        status: "acceptee",
        assigned_group: "sales",
        assigned_sales_agent_id: sellerA.id,
        purchase_price_excl_tax: 1,
      })
      .eq("id", sellerAOpportunityId)
      .select("id");

    const row = await getOpportunityAsService(sellerAOpportunityId);
    expect(row.status).toBe("envoyee");
    expect(row.owner_side).toBe("wilmet");
    expect(row.assigned_group).toBe("purchase");
    expect(row.assigned_sales_agent_id).toBeNull();
    expect(row.purchase_price_excl_tax).toBeNull();
  });
});

test("requested-information hand-back returns control then re-submits to Wilmet", async () => {
  await check("seller requested-information hand-back", async () => {
    const handedBack = await service
      .from("vehicle_opportunities")
      .update({
        status: "informations_demandees",
        owner_side: "partenaire",
        handover_message: "E2E: please add missing information",
      })
      .eq("id", sellerAOpportunityId);
    failOnError(handedBack.error, "service hand opportunity back to seller");

    const responded = await sellerA.client
      .from("vehicle_opportunities")
      .update({
        additional_comments: "E2E response supplied",
        status: "envoyee",
        owner_side: "partenaire",
      })
      .eq("id", sellerAOpportunityId)
      .select("id,status,owner_side,assigned_group,assigned_group_id,assigned_sales_agent_id")
      .single();
    failOnError(responded.error, "seller re-submit requested information");

    expect(responded.data.status).toBe("envoyee");
    expect(responded.data.owner_side).toBe("wilmet");
    expect(responded.data.assigned_group).toBe("purchase");
    expect(responded.data.assigned_group_id).toBeNull();
    expect(responded.data.assigned_sales_agent_id).toBeNull();
  });
});

test("internal and external role scoping is enforced with real Auth sessions", async () => {
  await check("sales/external real-JWT scope matrix", async () => {
    const submitB = await sellerB.client
      .from("vehicle_opportunities")
      .update({ status: "envoyee", owner_side: "wilmet" })
      .eq("id", sellerBOpportunityId)
      .select("id,status,assigned_group")
      .single();
    failOnError(submitB.error, "submit seller B opportunity");
    expect(submitB.data.assigned_group).toBe("purchase");

    expect(await rowVisible(purchaseAgent.client, sellerBOpportunityId)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, sellerBOpportunityId)).toBe(false);
    expect(await rowVisible(externalAgent.client, sellerBOpportunityId)).toBe(false);

    const assignExternal = await service
      .from("vehicle_opportunities")
      .update({
        assigned_sales_agent_id: externalAgent.id,
        assigned_group: "purchase",
      })
      .eq("id", sellerBOpportunityId);
    failOnError(assignExternal.error, "assign opportunity to external agent");

    expect(await rowVisible(externalAgent.client, sellerBOpportunityId)).toBe(true);
    expect(await rowVisible(salesOnlyAgent.client, sellerBOpportunityId)).toBe(false);
  });
});

test("profile self-service allows benign fields but rejects privilege-adjacent changes", async () => {
  await check("profile self-update guard with real JWT", async () => {
    const benign = await sellerA.client
      .from("profiles")
      .update({ city: "E2E benign self edit" })
      .eq("id", sellerA.id)
      .select("id,city")
      .single();
    failOnError(benign.error, "benign profile self update");
    expect(benign.data.city).toBe("E2E benign self edit");

    const commissionAttempt = await sellerA.client
      .from("profiles")
      .update({ commission_rate: 0.99 })
      .eq("id", sellerA.id)
      .select("id");
    expectRejected(commissionAttempt.error, "commission self update");

    const roleMetadataAttempt = await sellerA.client
      .from("profiles")
      .update({ partner_kind: "client", is_external: true })
      .eq("id", sellerA.id)
      .select("id");
    expectRejected(roleMetadataAttempt.error, "partner/external metadata self update");

    const serviceRead = await service
      .from("profiles")
      .select("partner_kind,is_external,commission_rate")
      .eq("id", sellerA.id)
      .single();
    failOnError(serviceRead.error, "verify protected profile fields");
    expect(serviceRead.data.partner_kind).toBe("seller");
    expect(serviceRead.data.is_external).toBe(false);
    expect(serviceRead.data.commission_rate).toBeNull();
  });
});

test("vehicle photo bucket enforces ownership, MIME allowlist and 10 MiB limit", async () => {
  await check("vehicle-photo storage boundary with real JWT", async () => {
    const validPath = `${sellerAOpportunityId}/e2e/${runId}.png`;
    const disallowedPath = `${sellerAOpportunityId}/e2e/${runId}.txt`;
    const oversizedPath = `${sellerAOpportunityId}/e2e/${runId}-oversized.png`;
    const crossOwnerPath = `${sellerAOpportunityId}/e2e/${runId}-seller-b.png`;
    createdStoragePaths.push(validPath, disallowedPath, oversizedPath, crossOwnerPath);

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
    expectRejected(crossOwnerUpload.error, "cross-owner vehicle photo upload");

    const disallowedUpload = await sellerA.client.storage
      .from(VEHICLE_BUCKET)
      .upload(disallowedPath, Buffer.from("not an allowed vehicle image"), {
        contentType: "text/plain",
        upsert: false,
      });
    expectRejected(disallowedUpload.error, "disallowed MIME upload");

    const oversized = new Uint8Array(MAX_VEHICLE_PHOTO_BYTES + 1);
    const oversizedUpload = await sellerA.client.storage
      .from(VEHICLE_BUCKET)
      .upload(oversizedPath, oversized, { contentType: "image/png", upsert: false });
    expectRejected(oversizedUpload.error, "oversized vehicle photo upload");
  });
});

afterAll(async () => {
  let cleanupFailed = false;

  try {
    if (createdStoragePaths.length > 0) {
      const removed = await service.storage.from(VEHICLE_BUCKET).remove(createdStoragePaths);
      if (removed.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup storage: ${removed.error.message}`);
      }
    }

    if (createdOpportunityIds.length > 0) {
      const removedRows = await service
        .from("vehicle_opportunities")
        .delete()
        .in("id", createdOpportunityIds);
      if (removedRows.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup opportunities: ${removedRows.error.message}`);
      }
    }

    if (createdUserIds.length > 0) {
      const removeRoles = await service.from("user_roles").delete().in("user_id", createdUserIds);
      if (removeRoles.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup roles: ${removeRoles.error.message}`);
      }

      const removeProfiles = await service.from("profiles").delete().in("id", createdUserIds);
      if (removeProfiles.error) {
        cleanupFailed = true;
        console.error(`E2E cleanup profiles: ${removeProfiles.error.message}`);
      }

      for (const userId of createdUserIds) {
        const removedUser = await service.auth.admin.deleteUser(userId);
        if (removedUser.error) {
          cleanupFailed = true;
          console.error(`E2E cleanup auth user ${userId}: ${removedUser.error.message}`);
        }
      }
    }
  } finally {
    evidence.cleanup = cleanupFailed ? "FAIL" : "PASS";
    evidence.finishedAt = new Date().toISOString();
    mkdirSync("test-results", { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }

  if (cleanupFailed) {
    throw new Error("Staging security E2E cleanup was not fully successful; inspect workflow logs.");
  }
});
