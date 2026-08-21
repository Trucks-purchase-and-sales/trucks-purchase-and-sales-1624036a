# ADR-003: Direct-GitHub exception — auth-route crash resilience

Date: 2026-08-21 · Status: accepted

## Context

Salma reported the Lovable preview crashing to "Un problème est survenu" when
clicking "Se connecter" and "Proposer un véhicule" (both route to `/auth`),
plus "Les listes de référence sont momentanément indisponibles" on the buyer
wizard. Root cause traced in code: `src/integrations/supabase/client.ts`'s
browser Supabase client is a lazy proxy that throws on first access
(`supabase.auth...`) when `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`
aren't set. `src/routes/auth.tsx`'s `beforeLoad` and, more importantly,
`src/routes/_authenticated/route.tsx`'s `beforeLoad` (which wraps **every**
authenticated route) both called `supabase.auth.*` with no try/catch, so that
throw propagated as an uncaught route-loading error into the nearest error
boundary. Salma confirmed she's testing on the Lovable preview URL and
believes Supabase isn't actually connected there — consistent with the error
message itself ("Connect Supabase in Lovable Cloud").

Per ADR-002, app-code fixes are surfaced rather than made unilaterally while
Lovable credits are exhausted. This one was surfaced and Salma explicitly
authorized applying it directly on GitHub now.

## Decision

Wrap the Supabase session/user check in both `beforeLoad` hooks in try/catch:
- `auth.tsx`: on failure, fall through and render the sign-in form (same
  outcome as "no session") instead of crashing.
- `_authenticated/route.tsx`: on failure, redirect to `/auth` — the same
  fail-closed outcome the existing `error || !data.user` branch already
  produces, just also covering a hard throw instead of only a soft error.

This is the same defensive pattern already accepted and merged for the
public-page header (`src/lib/auth-bootstrap.ts` /
`PublicAccountActions.tsx`, see `fe0272d`), extended to the two remaining
places that had the same unguarded construction-throw exposure.

## Rationale

- Does not change security posture: both routes still fail closed (deny
  session / redirect to auth) on any failure, they just no longer crash the
  whole page while doing it.
- Zero behavior change once Supabase is actually connected — the try
  succeeds normally and every line below it runs exactly as before.
- Does not fix the underlying problem (Supabase not connected in this
  environment) — that remains a Lovable Cloud / Supabase connection issue
  only Salma can resolve from Lovable's project settings.

## Consequences

- Once Supabase is reconnected, re-verify sign-in and the authenticated
  area actually work end-to-end (this fix only prevents the crash; it
  doesn't make the underlying auth/data calls succeed).
- If Lovable's own next sync pull touches either of these two files, watch
  for a conflict/silent revert of this change (same risk flagged generally
  in ADR-002) — reconcile through a Lovable prompt once credits return if so.
