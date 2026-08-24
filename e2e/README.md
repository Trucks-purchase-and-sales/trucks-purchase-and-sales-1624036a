# Wilmet Playwright browser E2E

This directory contains Wilmet's browser-level end-to-end test harness.

It is deliberately separate from the root Bun application dependency graph so browser-test tooling cannot destabilize the frozen application lockfile. `@playwright/test` is pinned and independently locked in this directory.

## Evidence boundary

The suite distinguishes three states:

- **implemented** — test/config/workflow exists in Git;
- **CI-validated** — the package installs from its lockfile and Playwright can discover the tests;
- **staging-verified** — the browser tests actually ran against the private/unpublished Wilmet staging deployment and retained their report/artifacts.

Do not treat the first two as deployed browser evidence.

## Safety

`playwright.config.ts` refuses an unspecified target and supports only:

- `PLAYWRIGHT_TARGET_LABEL=local` for `localhost` / `127.0.0.1`;
- `PLAYWRIGHT_TARGET_LABEL=wilmet-staging` for an HTTPS staging URL.

The manual GitHub workflow (for a real HTTPS staging target) also requires an explicit staging confirmation.

`partner-auth-journey.pw.ts` is the one authenticated/mutating journey so far: it provisions a throwaway partner via the Supabase Auth admin API (service-role key, required env vars below) and deletes it in `afterAll`. It skips cleanly rather than failing when those env vars are absent, so the credential-free public-smoke tests are never blocked by it.

## Current coverage

The public smoke slice verifies that a real browser can reach:

1. the public landing shell;
2. the deployed report-only security-header baseline on the HTTPS staging response;
3. the partner authentication boundary;
4. the buyer-request wizard entry.

The header check verifies that staging delivers `Content-Security-Policy-Report-Only` rather than an enforcing CSP, retains key policy directives, and exposes the baseline `nosniff`, referrer, permissions and HSTS headers.

`partner-auth-journey.pw.ts` additionally covers: a partner logging in through the real form and reaching their dashboard; a partner being denied `/admin` and redirected to their own dashboard (authz regression check); and logout returning to the public auth boundary.

It intentionally does not yet claim the buyer/admin critical journeys, or CRUD on any core entity, are complete.

## Running in CI

`.github/workflows/pr-build.yml` runs the full suite for real (not just discovery) on every PR: it starts the app's own dev server inside the runner against Salma's personal, disposable Supabase project (see `docs/v2p/decisions/ADR-005` — never Lovable's managed backend), then runs `npm test` against it with `PLAYWRIGHT_TARGET_LABEL=local`. This requires three repo secrets: `E2E_DISPOSABLE_SUPABASE_URL`, `E2E_DISPOSABLE_SUPABASE_ANON_KEY`, `E2E_DISPOSABLE_SUPABASE_SERVICE_ROLE_KEY`.

`.github/workflows/disposable-staging-security-e2e.yml` is a separate, manually-triggered workflow for the heavier, longer-running `tests/staging/security.staging.ts` suite (not part of `e2e/` — a Bun-based suite against the same disposable project) — kept out of the automatic PR gate since it takes a couple of minutes and mutates staging fixtures directly.

## Local discovery

Install the isolated test package:

```bash
cd e2e
npm ci
```

Validate test discovery without launching a browser:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 \
PLAYWRIGHT_TARGET_LABEL=local \
npm run test:list
```

A real run requires a reachable target and Chromium:

```bash
npx playwright install chromium
PLAYWRIGHT_BASE_URL=https://<private-staging-host> \
PLAYWRIGHT_TARGET_LABEL=wilmet-staging \
npm test
```

To also exercise `partner-auth-journey.pw.ts` locally (against a dev server pointed at the disposable staging project), additionally set `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_ROLE_KEY` for that project before running `npm test`. Without them, that one file skips and the rest of the suite still runs.

Never put Wilmet credentials in this document or the repository. Authenticated browser journeys must use protected CI secrets and disposable/test identities.
