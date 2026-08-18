# Contributing to Wilmet Trucks

This repository is the engineering source of truth for Wilmet Trucks. The application is synchronized with Lovable, but changes must remain reviewable, reproducible and traceable in Git.

## Core rules

1. **Do not work directly on `main`.** Use a focused branch and a pull request.
2. **Do not commit secrets.** Runtime values belong in the environment/secret manager; `.env` stays untracked.
3. **Do not make database-only fixes.** Every application-owned schema/RLS/storage change must have a reviewed migration in Git.
4. **Do not weaken authorization in the UI to solve an access bug.** Authorization is enforced server-side/database-side first.
5. **Do not rewrite applied migrations.** Add a new forward-only corrective migration.
6. **Do not call a control verified because code exists.** Security-critical changes need regression evidence.

## Branch naming

Use a short purpose-based prefix:

```text
fix/...       bug fixes
feat/...      product features
security/...  security controls/remediation
reliability/... resilience/correctness
ops/...       recovery/deployment/operations
chore/...     repository/tooling maintenance
docs/...      documentation-only changes
```

## Pull requests

Keep a pull request focused enough to review safely. Its description should state:

- the problem/root cause;
- the chosen change;
- trust/security impact when relevant;
- tests or verification performed;
- database/migration impact;
- rollback/recovery considerations for operationally significant changes.

The PR Build workflow currently performs:

- full-history secret scanning with Gitleaks;
- dependency installation with the frozen Bun lockfile;
- Bun unit tests;
- production build.

The CI baseline is Bun `1.3.14`.

## Testing expectation

At minimum, run:

```bash
bun install --frozen-lockfile
bun test
bun run build
```

Or:

```bash
bun run check
```

When changing a security boundary, add a regression test that would fail before the fix whenever practical.

Examples:

- server input validation;
- authorization/RLS state transitions;
- anonymous/authenticated persistence separation;
- rate-limit/fail-closed behavior;
- security header behavior;
- consent/persistence correctness.

## Database changes

Database changes belong under `supabase/migrations/` and should be forward-only.

Before merging a security-sensitive migration:

1. inspect existing policies/functions/triggers;
2. reason about PostgreSQL policy composition, not only individual policy text;
3. verify the resulting catalog state;
4. retain evidence when it is a release gate.

Never run a destructive reset command against a linked cloud database.

The repository still has an explicit recovery task to capture and restore-test the historical schema baseline that predates the currently versioned migrations.

## Lovable synchronization

Lovable and GitHub are connected. A GitHub commit can appear in the Lovable edit history, and Lovable changes can flow back to Git.

That synchronization does not replace engineering review. After the GitHub baseline:

- branch/PR history is authoritative for reviewed changes;
- database migrations in Git are authoritative for application-owned schema evolution;
- Lovable is used as an implementation/preview environment;
- undocumented hosted-state changes are considered drift and must be reconciled.

## Known baseline debt

Do not opportunistically mix unrelated cleanup into a critical fix. The baseline currently includes known warnings such as TanStack Start's deprecated `createServerFn().inputValidator()` API and a redundant `vite-tsconfig-paths` plugin warning under Vite 8.

Handle those as deliberate, tested maintenance changes instead of broad search/replace work inside unrelated security PRs.
