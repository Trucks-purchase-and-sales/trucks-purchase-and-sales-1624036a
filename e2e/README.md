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

The manual GitHub workflow also requires an explicit staging confirmation. Current tests are read-only smoke checks. Future authenticated/mutating journeys must add stronger fixture and cleanup guards before they are enabled.

## Current coverage

The initial smoke slice verifies that a real browser can reach:

1. the public landing shell;
2. the partner authentication boundary;
3. the buyer-request wizard entry.

It intentionally does not yet claim the seller/buyer/admin critical journeys are complete.

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

Never put Wilmet credentials in this document or the repository. Authenticated browser journeys must use protected CI secrets and disposable/test identities.
