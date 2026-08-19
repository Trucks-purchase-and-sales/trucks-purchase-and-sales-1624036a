# Real-JWT staging security verification

## Purpose

Wilmet needs release evidence from **real Supabase Auth sessions** rather than relying only on simulated JWT claims inside PostgreSQL rollback tests.

The first staging harness achieved that by creating disposable Auth users with a Supabase service-role key. That design is valid for a directly owned Supabase project, but it is not executable against Wilmet's current architecture: the authoritative backend is Lovable Cloud-managed and Lovable does not expose the service-role key, database password, or underlying Supabase Management API token.

The current Wilmet gate therefore uses a **managed-provider mode**: staging-only identities and stable fixtures are pre-provisioned through supported Lovable/Auth control paths, then GitHub Actions signs those users in normally with the public Supabase client boundary and exercises RLS/Storage using the real access tokens returned by Auth.

This preserves the security objective without adding a privileged application endpoint, exposing provider-admin credentials, modifying `auth.users` manually, or weakening RLS.

## Evidence boundary

Use these classifications separately:

- **implemented** — the managed-provider test/workflow exists;
- **CI-validated** — repository CI can lint/compile/discover the harness;
- **staging-verified** — the manual workflow ran against Wilmet staging with real pre-provisioned identities and retained its evidence artifact;
- **production-ready** — only after the other P0/P1 release gates also pass.

A passing managed real-JWT run is strong authorization evidence, not a blanket production-readiness claim.

## Safety model

The suite performs only bounded mutations:

- denied seller workflow-tampering attempts;
- denied profile privilege-escalation attempts;
- one allowed seller-owned test image upload followed by deletion;
- denied cross-owner/MIME/oversize upload attempts.

It does **not** create/delete Auth users or business rows during a run.

The workflow refuses to run unless both guards are present:

```text
E2E_ALLOW_STAGING_MUTATIONS=true
E2E_TARGET_LABEL=wilmet-staging
```

The workflow is `workflow_dispatch` only and must never target production.

## Required GitHub Actions configuration

The Wilmet managed-provider workflow requires:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_MANAGED_CONFIG_JSON`

No service-role key, database password, or Supabase Management API token is required.

`E2E_MANAGED_CONFIG_JSON` is a protected GitHub Actions secret because it contains staging test-account passwords. It must have this shape:

```json
{
  "identities": {
    "sellerA": { "email": "...", "password": "..." },
    "sellerB": { "email": "...", "password": "..." },
    "purchaseAgent": { "email": "...", "password": "..." },
    "salesOnlyAgent": { "email": "...", "password": "..." },
    "externalAgent": { "email": "...", "password": "..." }
  },
  "fixtures": {
    "sellerADraftId": "00000000-0000-0000-0000-000000000000",
    "sellerBDraftId": "00000000-0000-0000-0000-000000000000",
    "submittedPurchaseId": "00000000-0000-0000-0000-000000000000",
    "externalAssignedId": "00000000-0000-0000-0000-000000000000"
  }
}
```

Never commit the real JSON, passwords, access tokens, or provider credentials.

## One-time managed staging fixture contract

The identities are **test-only staging accounts**, created through the normal supported Auth path. Their roles/profile attributes are then configured through the trusted Lovable-managed control plane. Do not create a hidden provisioning endpoint in Wilmet for this purpose.

Required identities:

| Identity | Required role/profile state |
| --- | --- |
| `sellerA` | `partenaire`, `partner_kind = seller` |
| `sellerB` | `partenaire`, `partner_kind = seller` |
| `purchaseAgent` | `sales_agent`, `staff_scope = purchase` |
| `salesOnlyAgent` | `sales_agent`, `staff_scope = sales` |
| `externalAgent` | `external_agent`, purchase scope / canonical external-agent metadata |

Required stable fixtures:

1. `sellerADraftId` — draft owned by `sellerA`;
2. `sellerBDraftId` — draft owned by `sellerB`;
3. `submittedPurchaseId` — submitted/Wilmet-owned opportunity owned by `sellerA`, in the unassigned purchase pool;
4. `externalAssignedId` — non-draft opportunity directly assigned to `externalAgent` under the intended scope.

These fixtures should be clearly named/tagged as E2E staging data and excluded from business reporting where appropriate. The suite validates their expected authorization shape before relying on them.

## What the managed suite verifies

`tests/staging/managed-security.staging.ts` verifies:

1. all five pre-provisioned users sign in through normal Supabase Auth and receive distinct real sessions;
2. seller A can see seller A's draft while seller B, purchase staff and the external agent cannot;
3. seller B can see seller B's own draft;
4. purchase-scoped staff can see the submitted purchase-pool fixture while sales-only, unrelated external-agent and unrelated seller identities cannot;
5. the directly assigned external agent can see its assigned fixture while a sales-only identity cannot;
6. a submitted seller cannot alter staff-controlled status, assignment or purchase-price fields;
7. seller self-service cannot change privilege-adjacent profile fields;
8. the private vehicle-photo bucket allows an owned PNG and rejects cross-owner, wrong-MIME and oversized uploads;
9. the allowed storage fixture is removed using the same least-privileged seller identity.

The workflow retains `test-results/staging-managed-real-jwt.json` as evidence.

## What remains separate

This managed real-JWT suite intentionally does not replace:

- browser-level seller/buyer/admin journeys — Playwright;
- anonymous buyer persistence and authenticated tracking;
- AI assistant consent/persistence behavior;
- ingress-level public API `413` / `429` / fail-closed `503` probes;
- hosted Auth policy/configuration evidence from Lovable's supported control plane;
- database baseline/recovery proof;
- final independent security retest.

Those remain separate release gates because collapsing unrelated evidence into one privileged test harness would weaken the independence and clarity of the production-readiness process.

## Direct-owned Supabase variant

The earlier service-role-based suites remain in `tests/staging/` as useful evidence and as a possible pattern for a future CCSG project whose Supabase control plane is directly owned. They are **not the Wilmet runtime gate** while Wilmet remains on a Lovable Cloud-managed backend that intentionally withholds those provider-admin credentials.

This distinction is reusable: the CCSG pipeline should choose its identity-provisioning strategy based on the application's actual managed-provider capabilities rather than assuming every Supabase-backed Lovable application exposes the same administrative credentials.
