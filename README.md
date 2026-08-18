# Wilmet Trucks

Wilmet Trucks is a full-stack web application for the purchase, evaluation and resale workflow of used trucks, vans and industrial vehicles.

This repository is the **engineering source of truth** for the Wilmet application that is synchronized with the Lovable project. The current repository baseline preserves the application behavior that existed in Lovable and gives us a controlled starting point for the production-readiness work.

> **Status:** pre-production engineering baseline. A successful build does not mean the application is production-ready. Remaining release gates are tracked in GitHub issue `#9`.

## Product scope

The application currently contains more than the original Phase 1 seller portal. The tracked code includes:

- public vehicle catalogue and buyer-request journey;
- seller/partner vehicle opportunity workflow;
- authenticated buyer workspace;
- internal sales, manager, direction and admin interfaces;
- opportunity dossier and decision workflows;
- sale listings, matching, commissions and affiliation features;
- OCR/AI-assisted workflows;
- multilingual UI;
- Supabase authentication, database access, RLS policies and storage integration.

The codebase should therefore be treated as a business application with multiple trust boundaries and roles, not as a static Lovable prototype.

## Technology

- **Runtime / package manager:** Bun `1.3.14`
- **Application:** React 19 + TanStack Start / Router
- **Build:** Vite 8 + Nitro
- **Language:** TypeScript
- **UI:** Tailwind CSS + Radix/shadcn-style components
- **Database / Auth / Storage:** Supabase PostgreSQL
- **Validation:** Zod
- **Testing:** Bun test
- **CI:** GitHub Actions

## Repository structure

```text
.github/workflows/      Pull-request CI and secret scanning
.lovable/plan/          Historical Lovable planning artifacts
docs/                   Engineering, security, recovery and training docs
src/components/         Reusable UI and domain components
src/hooks/              Application hooks
src/i18n/               Locales and i18n initialization
src/integrations/       Supabase clients and auth integration
src/lib/                Domain logic, server functions and tests
src/routes/             TanStack routes and public API endpoints
supabase/config.toml     Supabase project reference
supabase/migrations/    Versioned database migrations
```

## Prerequisites

Install:

- Git
- Bun `1.3.14`

The CI baseline was verified with Bun `1.3.14`; use the same version locally so dependency installation and tests are reproducible.

## Local setup

```bash
git clone https://github.com/SalmaAnhm/trucks-purchase-and-sales.git
cd trucks-purchase-and-sales
bun install --frozen-lockfile
cp .env.example .env
```

Populate `.env` with values for the environment you are intentionally targeting. Never commit `.env` or real secrets.

Required configuration is documented by `.env.example`:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY   # server only; secret
```

`VITE_*` variables are embedded in the browser bundle and therefore **must never contain secrets**.

## Development commands

```bash
bun run dev          # local development
bun test             # unit tests
bun run build        # production build
bun run check        # tests + production build
bun run lint         # current lint state; existing debt is tracked separately
bun run format       # apply Prettier
bun run format:check # check formatting without modifying files
```

## Verified baseline

The last application-code baseline before repository cleanup was Lovable/GitHub commit:

```text
c21165cc647601634d7519e416c3259767b8cf4a
```

At that application state, GitHub Actions verified:

- `bun install --frozen-lockfile` succeeds;
- **40 tests pass across 8 test files, 0 failures**;
- the client, SSR and Nitro production builds succeed;
- full-history Gitleaks scanning succeeds.

See `docs/engineering/github-baseline.md` for the baseline evidence and intentionally deferred warnings.

## GitHub ↔ Lovable synchronization

The Lovable project and this repository are connected bidirectionally. GitHub commits appear in the Lovable project edit history, and Lovable edits can be committed back to the repository.

For engineering work, use this rule:

> **Git history, reviewed migrations and pull requests are authoritative. Lovable is an implementation/preview environment, not an alternative source of truth.**

Do not make an undocumented production change only in the hosted database or Lovable environment.

## Database changes

Database changes must be:

1. represented by a forward-only SQL migration under `supabase/migrations/`;
2. reviewed in a pull request;
3. verified against the intended environment;
4. accompanied by regression evidence when they affect authorization, RLS, storage or data integrity.

Never use `supabase db reset --linked` against a live/cloud project.

The application predates the migration history currently stored in Git, so full database reproducibility is still an explicit production-readiness work item. See `docs/recovery/database-reproducibility.md`.

## Contribution workflow

Do not develop directly on `main`.

1. Create a focused branch.
2. Make the smallest coherent change.
3. Add/update tests and documentation where appropriate.
4. Open a pull request.
5. Require the PR Build workflow to pass before merge.
6. Retain security/recovery evidence for release-critical changes.

Detailed conventions are in `CONTRIBUTING.md`.

## Security

Relevant engineering documentation lives in:

- `docs/security/authorization-model.md`
- `docs/security/configuration-secrets.md`
- `docs/security/upload-security.md`
- `docs/security/phase1b-verification.md`
- `docs/recovery/database-reproducibility.md`

Do not report the application as production-ready solely because these controls exist in code. Production sign-off requires end-to-end verification, recovery proof, release governance, observability and independent security retesting.

## Lovable project

Connected Lovable project ID:

```text
452845ef-b656-4272-a382-1de28e2d1f1e
```

Connected Supabase project reference recorded in `supabase/config.toml`:

```text
srjnljpjwzhtbdnhksux
```
