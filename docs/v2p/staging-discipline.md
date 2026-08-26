# Staging discipline and the promotion path — Wilmet

Written 2026-08-26, as part of Phase 6 (EXECUTION-PLAN.md §13, item 1:
"confirm staging is fully separate and is the only test target;
document promotion steps").

## What "staging" actually means for this project

Wilmet has **no separate hosted deployment** of the frontend the way a
typical staging environment implies. There is exactly one hosted
instance of the app: Lovable's, which is production. This was
confirmed, not assumed — `docs/v2p/decisions/ADR-005` records that
Salma has no separate Supabase.com account/project reachable from
Lovable, and there is no "staging" build of the frontend anywhere.

What this project calls "staging" throughout its docs and CI is a
**database-only** testing surface: 🟦 a personal, disposable Supabase
project (schema reconstructed by hand in
`apps/wilmet/staging-schema.sql`, per ADR-005), which every test
workflow in `.github/workflows/` (`pr-build.yml`, `smoke.yml`,
`k6-disposable-load-test.yml`, `disposable-staging-security-e2e.yml`)
points a freshly-started local dev server at. This is fully separate
from 🟥 production:

- Different Supabase project entirely (different URL, different keys,
  synthetic data only).
- The frontend under test is never Lovable's hosted build — it's the
  current `main` branch, run fresh inside each CI job (`bun run dev`),
  never a long-lived server anyone could point real traffic at.
- No test, probe, or load run in this repository's CI ever holds or
  uses a 🟥 production credential for anything beyond the two
  deliberately narrow, read-only exceptions below.

**The two sanctioned exceptions**, both read-only and already built,
both consistent with the plan's Rule 4 ("staging isolation... never on
the client's live data") since read-only inspection of production is
explicitly allowed elsewhere in the plan (§6: "production — read-only
inspection only; never a test target"):

- `.github/workflows/supabase-auth-audit.yml` — reads 🟥 production's
  hosted Auth configuration via the Supabase Management API
  (`GET /v1/projects/{ref}/config/auth`) using a narrowly-scoped
  `SUPABASE_ACCESS_TOKEN`. No mutation, ever.
- `.github/workflows/database-baseline-capture.yml` — dumps 🟥
  production's schema (not data: `data_included: false` in its own
  manifest) for drift comparison against `staging-schema.sql`, gated
  behind an explicit `confirm_read_only_capture` checkbox.

Everything else that touches a Supabase project directly (RLS probing,
security E2E, k6 load) is hard-wired to 🟦 the disposable project only,
either via secrets that simply don't exist for production, or (in the
app-route k6/Playwright scripts) via an explicit target-label guard
that rejects anything that isn't `local` or a bare HTTPS
"wilmet-staging" origin — and no such origin exists to supply, which
is itself the point: there is no safe non-production hosted URL this
project could accidentally be pointed at.

## The actual promotion path (staging → production)

Because there's no separate staging deployment to "promote" a build
from, promotion here means: **how does a verified change reach the
live app at all.** Per `EXECUTION-PLAN.md` §3 and §7.2/7.4 (Phase 0's
sync diagnosis) and Rule 5:

1. **Pipeline/test/CI/docs changes** (this repo's own domain): small
   PR → CI green (`pr-build.yml`: typecheck, lint, secret scan,
   Playwright against 🟦, build) → Salma merges via the GitHub UI. This
   never touches the live app directly; it only affects what verifies
   the app.
2. **Application-behavior changes** (Lovable's domain, per Rule 5):
   made through a Lovable prompt → Lovable commits the result as a
   `gpt-engineer-app[bot]` (this repo's actual bot identity, not the
   plan's assumed `lovable-dev` — see `docs/v2p/sync-status.md`) commit
   on GitHub `main` → Salma clicks **Publish** in Lovable to push that
   build live. This is the entire "promotion" mechanism this project
   has — there is no separate approval/staging-deploy step between
   Lovable committing to `main` and Salma publishing it.
3. **Database/RLS changes:** land as a migration in
   `supabase/migrations/` (GitHub PR, reviewed like any other change),
   then applied to 🟥 production by Salma via the Supabase SQL editor —
   this repository's automation does not hold a production database
   credential capable of writing schema changes.

## Known gap in this exact path, as of this writing

Step 2 above is currently unreliable: Lovable's build pipeline has a
demonstrated bug (ADR-006) where it deduplicates against an existing
build artifact when it detects no _source_ change, so a Publish can
silently republish a stale bundle even after `main` genuinely changed.
The ADR-006 workaround (a trivial forced source diff) was applied and
merged (PR #46) but, per Salma (2026-08-26), **did not** clear the live
"Un problème est survenu" crash after publishing. This means the
promotion path's step 2 cannot currently be trusted end-to-end — a
real, open gap, parked for now rather than re-diagnosed immediately.
Anything that depends on "the live app reflects `main`" (uptime
monitoring's usefulness, the pre-publish checklist's meaning, this
document's own promotion-path description) should be read with that
caveat until it's resolved.

## Open items (Phase 6, blocked on information only I can't determine)

- **Uptime/health check wiring:** needs the confirmed 🟥 production
  URL (asked Salma directly — not guessed, per this project's own
  rule against fabricating URLs). Once known, a scheduled GitHub
  Actions workflow pinging it (matching the read-only-inspection
  precedent above) is straightforward to add.
- **Backup/restore verification:** needs 🟥 production's Supabase plan
  tier confirmed (free tier has no point-in-time recovery or scheduled
  backups to actually restore-test; Pro+ does). Asked Salma to check
  Settings → Billing on the production project.
- **Error monitoring (Sentry or equivalent):** requires adding an SDK
  to the app's own source, which is Lovable's domain per Rule 5 —
  deliberately deferred (Salma's decision, 2026-08-26) rather than
  attempted as a direct GitHub edit. Tracked alongside the ADR-006
  follow-up as a planned future Lovable prompt.
