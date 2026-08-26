# ADR-006: Direct-GitHub exception — nudge Lovable's build-artifact cache

Date: 2026-08-26 · Status: accepted

## Context

The live Wilmet app (`wilmet-proposeur-connect.lovable.app`) has been
serving a browser console error since 2026-08-25 — "Missing Supabase
environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY" — with
most buttons failing ("Un problème est survenu") and no database-backed
content loading. Ruled out first: a stalled Lovable↔GitHub pull (the
ADR-001 pattern) — Lovable's Git history shows it fully synced to
`main`'s current tip.

Three Lovable prompts were then used to diagnose and attempt a fix:

1. Asked Lovable to restore the managed Supabase Cloud runtime bindings.
   It reported success; the live bundle was unchanged.
2. Asked Lovable to confirm `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`
   were present at build time and force a fresh production build. It
   reported success; the live bundle was still byte-for-byte identical
   (same filename `client-CFJJ-lBK.js`, confirmed by Salma checking the
   browser console after each attempt).
3. Asked Lovable to investigate directly, given the first two "fixes"
   demonstrably hadn't changed anything. Its own diagnosis: production
   still serves deployment ID `4b8b6016…9437`, bundle
   `client-CFJJ-lBK.js` (205,755 bytes, SHA-256 `ad3ffda1…b20c4`) —
   confirmed not a browser/CDN cache issue (cache-busting query strings
   and no-cache headers return the same deployment ID and bytes). Root
   cause: the publish pipeline deduplicates/reuses the existing build
   artifact when it sees no *source* change, so both "fresh build"
   attempts silently republished the same stale artifact rather than
   recompiling with the corrected build-time environment variables.
   Asked whether it could force a clean rebuild bypassing this dedup:
   Lovable confirmed no such option exists in its own tooling — only
   the normal Publish action, which would repeat the same dedup.

Per ADR-002, app-code fixes are surfaced rather than made unilaterally.
This one was surfaced and Salma explicitly authorized applying it
directly on GitHub.

## Decision

Land one deliberately trivial, non-functional comment in
`src/routes/__root.tsx` (a file confirmed part of the actual rendered
app and its client bundle) to force a genuine source-content diff.
Per Lovable's own diagnosis, this should be enough for the dedup logic
to stop treating the next publish as a no-op and actually recompile —
which a config-only change (env vars, with no accompanying source
diff) evidently was not.

The file already needed a full Prettier reformat to satisfy this
repo's lint gate on the whole changed file (pre-existing drift, not
introduced by this change) — that reformatting is purely cosmetic
(whitespace/line-breaks), not functional, and was not the intent of
this change; it was already present in the file as it existed before.

## Rationale

- Zero behavior change: the added comment does nothing at runtime; the
  Prettier reformatting changes no logic, only formatting.
- Grounded directly in Lovable's own stated mechanism ("published the
  same saved revision without a source change") — this is the most
  direct, lowest-risk way to test that specific claim, and costs
  nothing (no Lovable credit; Salma triggers the actual publish
  herself via the normal UI button once this lands).
- Consistent with the ADR-001 precedent (a trivial, additive nudge
  commit to unstick a stuck Lovable-side mechanism) — the difference
  is this dedup is keyed off actual bundled source content, not just
  git history, so the nudge has to touch a real `src/` file this time
  instead of a docs-only one.
- Does not fix the underlying platform limitation (Lovable's publish
  pipeline has no cache-bypass option) — if this nudge doesn't work
  either, that's useful evidence the problem is deeper than a simple
  content-hash cache key, and Lovable support should be contacted
  next rather than spending further credits guessing.

## Consequences

- Once a fresh build is confirmed live (new bundle filename/hash,
  Supabase features actually working), the comment in `__root.tsx` can
  be removed — it has no ongoing purpose once its one job is done.
- If Lovable's own next AI-driven edit touches `__root.tsx`, watch for
  a conflict/silent revert of this comment (same risk flagged
  generally in ADR-002).
- If this does not resolve the issue, the next step is contacting
  Lovable support directly with the diagnostic trail already gathered
  (deployment ID, bundle hash, dedup mechanism) rather than further
  AI prompts, per Lovable's own admission it has no way to force this
  itself.
