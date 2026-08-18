# Real-JWT staging security verification

## Purpose

The existing authorization evidence in `docs/security/phase1b-verification.md` proves the PostgreSQL RLS boundary with rollback-only simulated JWT claims. That is valuable database evidence, but it is intentionally not the final release proof.

This suite adds a second layer: disposable users are created in Supabase Auth, signed in through the normal Auth API, and the resulting real access tokens exercise the live staging PostgREST and Storage boundaries.

It is tracked by issue #19 and contributes evidence to the P0 Security E2E gate in issue #9.

## Safety model

This suite performs temporary writes. It therefore refuses to run unless both guards are present:

```text
E2E_ALLOW_STAGING_MUTATIONS=true
E2E_TARGET_LABEL=wilmet-staging
```

The workflow is `workflow_dispatch` only. It is not part of normal PR CI and must not be pointed at production.

The service-role key is used only inside the test process to create and remove disposable fixtures. It must remain a server/GitHub secret and must never be exposed through `VITE_*` variables, browser code, logs, or committed files.

Every generated identity uses an `e2e-*` email and every generated opportunity is recorded for deterministic cleanup. The suite removes uploaded objects, opportunity rows, role/profile rows, and Auth users in `afterAll`, including after test failures.

## Required GitHub Actions secrets

Configure these repository or environment secrets for the Wilmet staging project:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`

These are intentionally distinct from application-facing variable names so the workflow cannot accidentally inherit a browser configuration by convention.

## What the first suite verifies

The initial `tests/staging/security.staging.ts` suite verifies:

1. two seller identities cannot read each other's drafts;
2. purchase staff and external agents cannot see seller drafts before submission;
3. a seller direct insert cannot retain routing, assignment, commercial-price, reference, or submitted-state fields;
4. a seller cannot directly create an already-submitted opportunity;
5. draft submission moves the opportunity into the Wilmet purchase pool;
6. purchase-scoped staff can see that submitted pool while sales-only and unassigned external-agent identities cannot;
7. direct seller attempts to change staff-controlled status, assignment, or purchase price do not modify the row;
8. requested-information hand-back gives the seller temporary edit control and re-submission returns control to Wilmet;
9. a directly assigned external agent can see its assigned submitted opportunity;
10. benign profile self-edit succeeds while commission/partner/external metadata self-edit is rejected;
11. the private `vehicle-photos` bucket accepts an owned allowed PNG;
12. cross-owner uploads, disallowed MIME types, and files above 10 MiB are rejected.

## Running from GitHub

Open **Actions → Staging Security E2E → Run workflow**, enable the explicit mutation confirmation, and run it against the reviewed branch/commit.

The job retains `test-results/staging-security-e2e.json` as a 30-day workflow artifact. For release evidence, copy the successful result into a dated reviewed evidence document/PR rather than relying on an expiring artifact alone.

## Running locally

Use a local `.env`/shell configuration that is excluded by `.gitignore`; never place a service-role key in `.env.example`.

Example command shape:

```bash
E2E_ALLOW_STAGING_MUTATIONS=true \
E2E_TARGET_LABEL=wilmet-staging \
E2E_SUPABASE_URL='...' \
E2E_SUPABASE_ANON_KEY='...' \
E2E_SUPABASE_SERVICE_ROLE_KEY='...' \
bun run test:staging-security
```

## What this does not close

This suite is an API-boundary E2E test, not the whole release gate. The following remain open in issue #9:

- TanStack Start server-function/browser-flow E2E for seller input validation and application routing;
- buyer request and authenticated buyer tracking journeys;
- AI assistant consent/persistence journeys;
- full dossier role matrix through the deployed app;
- ingress-level 413/429/503 checks;
- Playwright browser regression coverage;
- final independent security retest.

A passing run is therefore evidence for specific controls, not a blanket statement that Wilmet is production-ready.
