# ADR-002: Operating without Lovable credits

Date: 2026-08-20 · Status: accepted

## Context

Phase 0's sync recovery (ADR-001) worked: the R-C nudge commit landed on
`main`, Lovable pulled it, and the "Un problème est survenu" preview crash
cleared. The plan's §7.4 round-trip test requires confirming *both*
directions — GitHub → Lovable (confirmed) and Lovable → GitHub (a
Lovable-side edit producing a new `gpt-engineer-app[bot]` commit).

Salma reports Lovable currently has no remaining credits, so no prompt can
be submitted to Lovable right now. The agent (Sonnet, running in Claude
Code) has no browser tool or Lovable API/MCP integration available in this
environment — only git, filesystem, and shell access — so there is no
credential Salma could grant that would let the agent act inside Lovable
directly.

## Decision

1. The Lovable → GitHub leg of the §7.4 round-trip test is **deferred**,
   not failed. Phase 0's actual blocker (stale/stalled pull) is resolved
   and evidenced; the outbound direction gets verified opportunistically
   next time Salma prompts Lovable for any reason.
2. The ~75 external commits already on `main` (RLS scoping, CSP, CI,
   incident runbook, auth-bootstrap fail-safe, etc.) are **left as-is**.
   Doctrine §2.5 prefers reconciling app-behavior changes through Lovable
   prompts, but that channel is unavailable; re-doing this work through
   Lovable is not an option right now regardless of preference.
3. Going forward, until credits are restored: pipeline/docs/test/CI work
   (`pipeline/`, `tests/`, `.github/`, `docs/`) continues on GitHub as
   normal — it has no Lovable dependency. Genuine **app-code** fixes
   (schema drift, wiring defects, etc., as Phase 0.5 will surface) are
   *not* made unilaterally by the agent. Each one is surfaced to Salma so
   she can choose to wait for credits or explicitly authorize a
   documented direct-GitHub exception.

## Consequences

- Read-only/analysis work that Phase 0.5 needs (interaction map,
  wiring-scan, schema ↔ code reconciliation) can proceed now — it
  produces a defect backlog without writing app code.
- Any defect that needs an actual code fix queues until either credits
  return or Salma explicitly approves a GitHub-side exception for that
  specific item.
- Revisit this ADR once Lovable credits are restored: re-run the Lovable
  → GitHub round-trip test, and reassess whether any queued app-code
  fixes should go through Lovable at that point instead of GitHub.
