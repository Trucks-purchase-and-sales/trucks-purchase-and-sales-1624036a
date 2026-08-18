# Lovable → GitHub engineering baseline

## Purpose

This document freezes the application state we inherited from Lovable before continuing the structured production-readiness approach.

The goal is not to claim the application is production-ready. The goal is to establish a trustworthy answer to:

> "What exact application are we engineering from?"

## Baseline date

2026-08-19

## Connected systems

- GitHub repository: `SalmaAnhm/trucks-purchase-and-sales`
- Lovable project: `452845ef-b656-4272-a382-1de28e2d1f1e`
- Supabase project reference: `srjnljpjwzhtbdnhksux`

## Application snapshot

The application-code snapshot confirmed in both GitHub and Lovable before repository-only cleanup is:

```text
c21165cc647601634d7519e416c3259767b8cf4a
```

Lovable's edit history contains that GitHub commit and the preceding merged engineering commits. The Lovable repository view at this ref includes the application source, tests, configuration, documentation and all currently tracked Supabase migrations.

Repository-only baseline work after this snapshot may update documentation/tooling without intentionally changing application behavior.

## What is represented in Git

The synchronized tree includes, among other things:

- TanStack Start/React application routes and components;
- public API routes;
- server functions and domain logic;
- Supabase auth/client integration;
- generated Supabase TypeScript types;
- unit/regression tests;
- i18n locale files;
- CI workflow;
- `.env.example` without live values;
- Supabase project configuration;
- the currently versioned migration chain;
- security/recovery/training documentation;
- historical Lovable planning artifacts.

## What is NOT automatically represented in Git

Git does not automatically make the hosted environment reproducible. The following require separate controlled treatment:

- real environment variables and secrets;
- customer/application data;
- hosted auth users/sessions;
- storage objects;
- any database state that predates the migration history committed to the repository;
- platform configuration not expressed by tracked files/migrations;
- deployment/domain/DNS configuration.

This distinction is why database baseline/recovery proof remains a production-readiness task.

## CI evidence for the application snapshot

The PR Build workflow for PR #17 ran with Bun `1.3.14` and succeeded.

Observed results:

- frozen-lockfile dependency install succeeded;
- **40 tests passed**;
- **0 tests failed**;
- tests covered 8 files;
- production client build succeeded;
- SSR build succeeded;
- Nitro/Cloudflare-module build succeeded;
- repository secret scan succeeded.

This proves that the checked-in application is buildable and that the current regression suite passes. It does **not** prove end-to-end production behavior or production security.

## Baseline warnings intentionally not hidden

The successful build currently emits maintenance warnings that must remain visible rather than being confused with release blockers:

### 1. TanStack Start server-function API deprecation

Many server functions still use:

```text
createServerFn().inputValidator()
```

The current TanStack Start tooling warns that this API is deprecated in favor of `.validator()`.

This should be migrated in a dedicated, tested maintenance change because it touches a large number of server boundaries. It is intentionally not bulk-rewritten as part of baseline capture.

### 2. Vite tsconfig-path plugin redundancy

Vite 8 reports that `vite-tsconfig-paths` is detected while Vite now supports native tsconfig path resolution.

This should be handled as a small controlled build-tool cleanup, with a build comparison, rather than silently removed during unrelated work.

### 3. Large application chunks

The build contains comparatively large bundles around spreadsheet processing, matching/chart functionality and several application routes. This is a future performance/bundle-analysis concern, not evidence that the baseline is invalid.

## Baseline operating rules

From this point forward:

1. GitHub is the reviewed engineering source of truth.
2. `main` represents reviewed integration state, not a scratch branch.
3. Application changes should use focused branches and pull requests.
4. CI must remain green before merge.
5. Database changes must be represented by forward-only migrations.
6. Security-critical fixes require retained verification evidence.
7. Lovable can implement/preview changes, but hosted state must not become an undocumented alternative source of truth.

## Ready-to-start criteria

We can begin the planned vibe-coded-to-production-ready engineering approach once this repository-baseline PR passes CI and is merged, because then:

- the current Lovable code is already synchronized into Git;
- the repository explains how to build and test it correctly;
- the package manager/runtime used by CI is pinned;
- the workflow for future engineering changes is explicit;
- known inherited warnings are recorded instead of being mistaken for newly introduced defects;
- the difference between code-in-Git and hosted state is documented.

Production readiness itself remains governed by the release-gate tracker in GitHub issue #9.
