import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SellerIdentity = {
  service: SupabaseClient;
  userId: string;
  email: string;
  password: string;
};

export async function provisionSeller(
  supabaseUrl: string,
  serviceRoleKey: string,
  label: string,
): Promise<SellerIdentity> {
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const email = `e2e-pw-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Wilmet-PW-${randomUUID()}!Aa1`;

  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "E2E", last_name: label },
  });
  if (created.error || !created.data.user) {
    throw new Error(`provision test seller (${label}): ${created.error?.message}`);
  }
  const userId = created.data.user.id;

  const profile = await service.from("profiles").upsert(
    {
      id: userId,
      first_name: "E2E",
      last_name: label,
      email,
      is_active: true,
      partner_kind: "seller",
      city: "E2E staging",
      country: "BE",
    },
    { onConflict: "id" },
  );
  if (profile.error) {
    throw new Error(`upsert test seller profile (${label}): ${profile.error.message}`);
  }

  // handle_new_user auto-assigns a default role on insert; clear it before
  // setting the intended one, otherwise the explicit insert below can hit
  // the user_roles unique-constraint conflict found earlier this session
  // in tests/staging/security.staging.ts.
  const clearedRoles = await service.from("user_roles").delete().eq("user_id", userId);
  if (clearedRoles.error) {
    throw new Error(`clear default role (${label}): ${clearedRoles.error.message}`);
  }

  const role = await service.from("user_roles").insert({ user_id: userId, role: "partenaire" });
  if (role.error) throw new Error(`assign partenaire role (${label}): ${role.error.message}`);

  return { service, userId, email, password };
}

export async function cleanupSeller(identity: SellerIdentity) {
  // vehicle_opportunities rows don't cascade-delete with their owning
  // user -- remove them explicitly before deleting the identity itself.
  await identity.service
    .from("vehicle_opportunities")
    .delete()
    .eq("partenaire_id", identity.userId);
  await identity.service.auth.admin.deleteUser(identity.userId);
}
