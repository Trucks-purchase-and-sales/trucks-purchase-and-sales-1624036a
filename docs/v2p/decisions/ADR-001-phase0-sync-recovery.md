# ADR-001: Phase 0 sync recovery approach (R-C nudge, not R-A reconnect)

Date: 2026-08-20 · Status: accepted

## Context

Lovable's hosted preview shows a full-page crash ("Un problème est
survenu") on public routes (e.g. `/vehicules`). Lovable → Settings →
GitHub shows the connection as healthy with no error banner. Lovable's
last commit (`b144905`) is from 2026-08-19 22:38 UTC; ~75 external commits
have landed on `main` since, including an auth-bootstrap fail-safe rewrite
(`fe0272d`) that adds `src/components/public/PublicAccountActions.tsx` —
a file that does not exist in Lovable's last-synced commit. Reproducing
`main` HEAD locally (`npm run build` + `npm run dev`) is clean on `/`,
`/auth`, and `/vehicules`. Full diagnosis in `docs/v2p/sync-status.md`.

## Decision

Treat this as R-C (stalled GitHub → Lovable pull) rather than jumping to
R-A (duplicate project + reconnect). Recover by landing one trivial,
additive, non-app-code commit on `main` (this ADR + the evidence files
alongside it) via a small PR, to nudge Lovable's next pull, then verify
whether the preview crash clears on its own once Lovable catches up to
current `main`.

## Rationale

- The crash pattern is fully explained by staleness: the exact file that
  would prevent it doesn't exist in Lovable's last-known snapshot.
- R-A is destructive relative to R-C: duplicating the project forks the
  connection and requires re-deciding what to do with ~75 already-landed
  external commits before reconnecting. R-C is non-destructive and
  directly testable — if the preview clears after the nudge, R-A was
  unnecessary.
- Per plan rule #4, the nudge lands via PR, not a direct push to `main`;
  Salma reviews/merges.

## Consequences

- If the preview does **not** clear after the nudge and a reasonable wait,
  escalate to R-A per `sync-status.md`, and separately decide how to
  reconcile the external app-code commits through Lovable prompts before
  reconnecting (per doctrine §2.5) so they aren't lost or silently
  overwritten by Lovable's next regeneration.
- Going forward, app-behavior fixes should be made through Lovable
  prompts, not further direct GitHub edits to app code, to avoid
  recreating this same drift.
