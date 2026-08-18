# Phase 1B — Authorization verification evidence

Date: 2026-08-18

## Scope

This evidence covers the core pipeline authorization model after the corrective migration introduced in Phase 1B.

Core tables under test:

- `vehicle_opportunities`
- `buyer_leads`
- `demand_opportunities`
- `sale_listings`

Security boundary: PostgreSQL Row Level Security (RLS).

## Code and migration state

The first Phase 1B implementation was independently reviewed and rejected because:

1. a direct `assigned_sales_agent_id = auth.uid()` match granted read access without first proving that the user had a sales role;
2. pipeline helper execution had been granted to `PUBLIC`;
3. some application-layer paths still treated `profiles.is_external` as an authorization identity.

The corrective migration is `supabase/migrations/20260818145500_phase1b_authorization_correction.sql`.

After the migration was applied to staging, live database inspection confirmed:

- direct assignment requires `sales_agent` or `external_agent`;
- `authenticated` can execute the pipeline authorization helpers;
- `service_role` can execute the helpers;
- `anon` cannot execute the helpers.

## Verification method

Tests were executed against the staging PostgreSQL database in rollback-only transactions.

To exercise RLS as a normal signed-in database role, each transaction used:

- `SET LOCAL ROLE authenticated`;
- a temporary `request.jwt.claim.sub` matching an existing staging Auth identity;
- temporary role/profile/fixture changes made before switching to `authenticated`;
- `ROLLBACK` at the end of every test.

No test fixture, role change, group membership, or data mutation was persisted.

This method validates the PostgreSQL RLS boundary and `auth.uid()` behavior. It is **not** a substitute for a later end-to-end test using a real JWT issued by Supabase Auth over the application/API path.

## Results

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| Seller reads own vehicle | allowed | visible | PASS |
| Seller reads another client's buyer lead | denied | invisible | PASS |
| Client reads own authenticated buyer lead | allowed | visible | PASS |
| Client reads seller vehicle | denied | invisible | PASS |
| Non-commercial UUID placed in direct assignment | denied read/write | read=false, write=false | PASS |
| Internal sales agent — directly assigned row | allowed | visible | PASS |
| Internal sales agent — own group row | allowed | visible | PASS |
| Internal sales agent — unassigned row in `sales` scope | allowed | visible | PASS |
| Internal sales agent — unassigned `purchase` row while scope=`sales` | denied | invisible | PASS |
| Internal sales agent — row assigned to another identity | denied | invisible | PASS |
| External agent — directly assigned row | allowed | visible | PASS |
| External agent — own-brought vehicle | allowed | visible | PASS |
| External agent — group row | denied | invisible | PASS |
| External agent — unassigned pool | denied | invisible | PASS |
| External agent — another identity's assignment | denied | invisible | PASS |
| External-agent role with `profiles.is_external=false` | role must remain authoritative | correct external scoping | PASS |
| Direction reads pipeline row | allowed | visible | PASS |
| Direction updates pipeline row | denied | 0 updated rows | PASS |
| Direction deletes pipeline row | denied | 0 deleted rows | PASS |
| Sales manager reads pipeline row | allowed | visible | PASS |
| Sales manager updates pipeline row | allowed | 1 updated row | PASS |
| Sales manager inserts pipeline row | allowed | 1 inserted row | PASS |
| Admin reads pipeline row | allowed | visible | PASS |
| Admin updates pipeline row | allowed | 1 updated row | PASS |
| Admin inserts pipeline row | allowed | 1 inserted row | PASS |

## Current assessment

The core database authorization defect identified as **B0-001** is now corrected and verified at the PostgreSQL RLS boundary for the tested cases.

B0-001 should remain **open / pending final end-to-end verification** until the same role matrix is exercised with real Supabase Auth JWTs through the application/API path.

Application-layer role cleanup is also being completed so UI/server scoping mirrors the database source of truth and `profiles.is_external` remains metadata only.
