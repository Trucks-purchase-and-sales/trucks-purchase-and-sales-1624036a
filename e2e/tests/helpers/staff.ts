import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StaffIdentity = {
  service: SupabaseClient;
  userId: string;
  email: string;
  password: string;
};

/**
 * Provisions an internal Wilmet staff identity (role "admin" -- the one
 * role accepted everywhere INTERNAL_STAFF is checked, e.g.
 * adminConvertBuyerLead), distinct from provisionSeller's "partenaire"
 * role. Partners never see /admin (src/routes/_authenticated/admin.tsx's
 * beforeLoad redirects them to /dashboard).
 */
export async function provisionStaff(
  supabaseUrl: string,
  serviceRoleKey: string,
  label: string,
): Promise<StaffIdentity> {
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const email = `e2e-staff-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Wilmet-Staff-${randomUUID()}!Aa1`;

  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "E2E", last_name: label },
  });
  if (created.error || !created.data.user) {
    throw new Error(`provision test staff (${label}): ${created.error?.message}`);
  }
  const userId = created.data.user.id;

  const profile = await service
    .from("profiles")
    .upsert(
      { id: userId, first_name: "E2E", last_name: label, email, is_active: true },
      { onConflict: "id" },
    );
  if (profile.error) {
    throw new Error(`upsert test staff profile (${label}): ${profile.error.message}`);
  }

  // Same handle_new_user default-role quirk as provisionSeller -- clear
  // before setting the intended role, or the explicit insert below can
  // hit the user_roles unique-constraint conflict found earlier this
  // session in tests/staging/security.staging.ts.
  const clearedRoles = await service.from("user_roles").delete().eq("user_id", userId);
  if (clearedRoles.error) {
    throw new Error(`clear default role (${label}): ${clearedRoles.error.message}`);
  }

  const role = await service.from("user_roles").insert({ user_id: userId, role: "admin" });
  if (role.error) throw new Error(`assign admin role (${label}): ${role.error.message}`);

  return { service, userId, email, password };
}

export async function cleanupStaff(identity: StaffIdentity) {
  await identity.service.auth.admin.deleteUser(identity.userId);
}
