# Lovable ↔ GitHub Sync Status — Phase 0 Diagnosis

_Date: 2026-08-20 · Diagnosed by: Sonnet (agent) · Confirmed with: Salma Anhichem_

## Decision-tree result (EXECUTION-PLAN.md §7.2)

- **Q1 — Is the connected repo a real Lovable-exported repo?** **Yes.**
  Evidence: 143 commits authored by the `gpt-engineer-app[bot]` / `lovable`
  identities going back to the initial `"Initial commit from remix"`
  (`eb1f648`, 2026-08-14), a `lovable <noreply@lovable.dev>` commit adding
  the project README, and the `@lovable.dev/vite-tanstack-config`
  devDependency. (Note: the plan's runbook assumed the bot identity would
  be `lovable-dev`; in this repo it is `gpt-engineer-app[bot]`.)
- **Q2 — does Lovable's GitHub panel show an error?** Salma checked
  Lovable → Settings → GitHub: connection shows **healthy, no banner**.
  This rules out the renamed/moved/deleted repo case and the
  suspended/uninstalled GitHub App case.
- **→ Conclusion: R-C — the GitHub → Lovable pull has stalled.**

## Timeline

- Lovable's last commit: `b144905` "Update plan", **2026-08-19 22:38:10 UTC**.
- Nothing from Lovable since. In the following ~20+ hours, dozens of
  external commits (git identity `SalmaAnhm`, PR-based workflow, CI-backed)
  landed on `main`, including a full auth-bootstrap fail-safe rewrite
  (branches `fix/functional-stabilization-auth-v2` through `-v11`, merged
  as `fe0272d`).
- Lovable's hosted preview (`id-preview--...lovable.app/vehicules`) shows
  a full-page crash: "Un problème est survenu."

## Concrete evidence this is staleness, not a new/unfixed bug

`src/components/public/PublicAccountActions.tsx` — the session-aware
header component every public route renders, including `/vehicules` —
**does not exist** in `b144905` (Lovable's last-synced commit). It was
added after that sync, specifically to stop public pages from crashing
when the browser Supabase client can't initialize:

> "Public chrome must remain usable when the lazy Supabase client cannot
> initialize (for example, a preview missing browser runtime variables) or
> when the initial session lookup rejects. In those cases we deliberately
> fall back to anonymous public controls." — `src/lib/auth-bootstrap.ts`

Local reproduction of `main` HEAD (`fe0272d`): `npm install && npm run
build` is clean (`✓ built in 4.83s`, no errors); `npm run dev` serves `/`,
`/auth`, and `/vehicules` all without error (see
`apps/wilmet/evidence/phase0-build-error.log` and
`apps/wilmet/evidence/phase0-dev-route-checks.log`).

Lovable's preview is almost certainly still serving its pre-fix `b144905`
snapshot, which does not have this fail-safe and crashes on exactly this
code path (any public page whose header tries to resolve a session while
the Supabase browser client can't initialize).

## Recovery action taken

Per §7.2 R-C: nudge the stalled pull with one trivial, additive commit to
a pipeline path GitHub owns and Lovable does not manage (`docs/v2p/`,
`apps/wilmet/`), landed on `main` via PR (never a direct push, per the
plan's rule #4). See the PR opened alongside this file.

**Prediction to verify (§7.4 round-trip test):** once this PR merges to
`main` and Lovable's next pull runs, it should pull everything currently
on `main` — including the auth-bootstrap fix — and the "Un problème est
survenu" preview crash should clear without any further app-code change.

**If it does not clear** after the nudge plus a reasonable wait, escalate
to R-A: duplicate the Lovable project and reconnect (Settings → Connectors
→ GitHub) to force a fresh, correctly-synced repo, after first deciding
whether/how to reconcile the ~75 external commits back through Lovable
prompts per doctrine §2.5.

## Resolution (2026-08-20)

PR #13 merged to `main`. Lovable pulled it and the "Un problème est
survenu" preview crash **cleared** — R-C confirmed correct. GitHub →
Lovable is healthy.

The other leg of the round-trip test (Lovable → GitHub: an edit made in
Lovable producing a new `gpt-engineer-app[bot]` commit) is **deferred**:
Salma has no remaining Lovable credits, so no prompt can currently be
submitted there. See ADR-002 for how we're operating around that
constraint. `git fetch` confirms no new Lovable-side commit has landed
since the merge (expected — nothing was prompted).

Reconciling the ~75 external commits back through Lovable prompts is not
currently possible (no credits) — resolved as "leave as-is, documented
exception," per ADR-002.

## Open items — need Salma

1. ~~After this PR merges, refresh Lovable's preview~~ — done, confirmed
   fixed.
2. ~~Decide whether to reconcile the external commits through Lovable~~ —
   moot for now; see ADR-002. Revisit once credits are restored.
3. ~~Confirm Supabase staging/prod project refs (§7.1 gate)~~ —
   **resolved**: 🟥 production is `srjnljpjwzhtbdnhksux` (`supabase/
config.toml`, the repo's own linked CLI project); 🟦 staging is
   Salma's disposable personal project (ADR-005).
4. Next time Lovable is prompted for any reason, confirm the resulting
   commit lands on GitHub `main` to close out the deferred round-trip
   leg — still genuinely unconfirmed; the ADR-006 investigation
   prompts didn't produce a landed Lovable-authored code commit, the
   eventual fix was this repo's own nudge commit instead.

## Note on a separate, earlier recovery pass (2026-08-18/19)

Before this V2P engagement, Salma ran a separate ChatGPT-assisted pass
that (among other things) reconciled a migration-ledger drift (5
already-applied migrations missing from `schema_migrations`, fixed as
history-only inserts) and captured a CI/build baseline snapshot at
commit `c21165c...` (PR #17, 40 tests passing) —
`docs/engineering/github-baseline.md`, since consolidated into
`findings-register.csv` F-021 and removed per `ADR-009`. This predates
and is independent of this document's own Phase 0 recovery narrative
above; noted here for continuity since the source file no longer
exists in the working tree (see its git history for the original).
