# Lovable Cloud real-JWT fixture mode

## Why this mode exists

Wilmet uses Lovable Cloud's managed Supabase backend. The project owner can use the public backend URL and publishable client key, but Lovable Cloud does not export the underlying Supabase service-role key, database password, or Management API token.

The original staging E2E harness remains valid for directly owned Supabase deployments, where a protected service-role secret can create and delete disposable Auth identities. It cannot be the only verification path for a Lovable Cloud-managed backend.

This mode preserves the same security objective without introducing a privileged test endpoint or weakening RLS: GitHub Actions signs in a fixed set of **staging-only fixture identities through the normal Auth API** and exercises authorization with the real JWTs returned by Supabase Auth.

## Required fixture identities

Provision six dedicated accounts in Wilmet staging. They must not be real customer/staff accounts and must not be reused outside security testing.

| Fixture | Required role/profile |
| --- | --- |
| `sellerA` | `partenaire`, `partner_kind=seller`, non-external |
| `sellerB` | `partenaire`, `partner_kind=seller`, non-external |
| `purchaseAgent` | `sales_agent`, `staff_scope=purchase`, non-external |
| `salesOnlyAgent` | `sales_agent`, `staff_scope=sales`, non-external |
| `externalAgent` | `external_agent`, `staff_scope=purchase`, `is_external=true` |
| `admin` | `admin` |

The suite signs in every account and validates its own visible `profiles` and `user_roles` metadata before running any authorization test. A mis-provisioned fixture therefore fails closed instead of producing misleading evidence.

## GitHub secrets

For `lovable-cloud-fixtures` mode configure exactly:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_FIXTURE_CREDENTIALS_JSON`

The fixture secret must be valid JSON with this shape:

```json
{
  "sellerA": { "email": "<staging-only-email>", "password": "<secret>" },
  "sellerB": { "email": "<staging-only-email>", "password": "<secret>" },
  "purchaseAgent": { "email": "<staging-only-email>", "password": "<secret>" },
  "salesOnlyAgent": { "email": "<staging-only-email>", "password": "<secret>" },
  "externalAgent": { "email": "<staging-only-email>", "password": "<secret>" },
  "admin": { "email": "<staging-only-email>", "password": "<secret>" }
}
```

Never commit this JSON, paste it into issue/PR comments, or expose it through `VITE_*` variables. Store it only as a protected GitHub Actions secret.

## What the managed-cloud suite verifies

`tests/staging/lovable-cloud-fixtures.staging.ts` currently verifies:

1. all six fixture accounts obtain real Auth sessions and match the expected self-visible role/profile metadata;
2. a seller draft cannot retain caller-controlled routing, assignment, purchase-price or reference fields;
3. the draft is invisible to another seller, purchase staff, sales-only staff, external staff, and admin while remaining visible to its owner;
4. the private vehicle-photo bucket accepts an owned allowed PNG but rejects cross-owner, disallowed-MIME and over-10-MiB uploads;
5. seller submission moves the opportunity to the purchase pool;
6. purchase staff and admin can read the submitted row, while sales-only staff, unrelated external staff, and the other seller cannot;
7. a submitted seller cannot tamper with staff-controlled status, assignment or purchase price;
8. an admin JWT can assign the submitted purchase-side record to the intended external agent, after which that agent gains scope while sales-only staff still do not;
9. benign profile self-service succeeds while commission and partner/external privilege metadata changes are rejected.

All application mutations use normal authenticated JWTs. The suite contains no service-role client.

## Cleanup boundary

A submitted `vehicle_opportunities` row intentionally cannot be deleted through normal application RLS. The suite must not create a hidden cleanup bypass merely for tests.

Therefore a successful managed-cloud run writes the submitted opportunity UUID to:

`test-results/lovable-cloud-real-jwt-e2e.json`

with:

```json
"cleanup": "MANUAL_PROVIDER_CLEANUP_REQUIRED"
```

After the run, an authorized operator must delete **only the exact emitted E2E row(s)** through Lovable Cloud's supported database control plane, then run a read-only query proving that no emitted IDs remain. That cleanup evidence should be retained with the workflow artifact/release evidence.

If a failure occurs before submission, the suite attempts to remove its own draft and storage objects through the seller's normal permissions.

## Running from GitHub

1. Open **Actions → Staging Security E2E → Run workflow**.
2. Select `lovable-cloud-fixtures`.
3. Enable the explicit staging mutation confirmation.
4. Run against the reviewed canonical branch/commit.
5. Review the artifact and perform the exact-ID provider cleanup described above.

## Reusable pipeline boundary

The workflow retains two modes:

- `lovable-cloud-fixtures` — managed provider; no service-role credential is exported;
- `service-role` — directly owned Supabase project; disposable identities are created/deleted per run.

This keeps the CCSG pipeline portable across provider ownership models without reducing the authorization standard.
