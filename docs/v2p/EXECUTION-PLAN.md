# From Vibecoded to Production-Ready — Master Execution Runbook

**Project:** Wilmet (Lovable + Supabase SPA) · **Deliverable:** a reusable "Vibecoded-to-Production" (V2P) hardening pipeline, first applied to Wilmet
**Author of plan:** Salma Anhichem (internship) · **Supervisors:** Mr. Hassan Boussif, Mr. Zakaria Bouchaanana
**Executed by:** Claude Sonnet (agent, running in Claude Code with repository access)
**Status:** v1.0 — ready to execute

---

## 0. How to use this document

This file is both an **engineering plan** (defensible, reviewable by the supervisor) and an **execution runbook** (a step-by-step script the agent follows). Read it top to bottom once, then execute in order: **Phase 0 (recovery) → Phase 0.5 (functional completeness — a hard gate that requires Salma's sign-off) → Phase 1 → … → Phase 7.**

**Two audiences, one document:**
- **Salma** reviews the doctrine (§2), success criteria (§4), and deliverables (§15) with her supervisor.
- **Sonnet** executes the phases (§7–§14) and creates the artifacts in the appendices (§16).

**Where this file lives:** commit it to the repository at `docs/v2p/EXECUTION-PLAN.md` so the agent can read it in-repo and progress is tracked in Git.

**Non-negotiable working rules for the agent** (expanded in §2):
1. **Never run tests, probes, or load against the client's live/production app.** Staging only.
2. **Lovable owns the application source of truth.** App-behaviour fixes go back through Lovable, not by editing generated files on GitHub (see §3 and §7).
3. **Every claim needs evidence.** No "it's secure" — only "here is the probe, here is its output, here is the timestamp."
4. **Work in small, single-purpose branches/PRs.** Never push directly to `main`. Let CI run on every PR.
5. **Stop at 🛑 HUMAN GATES.** These require Salma's credentials, approval, or a decision the agent cannot safely make alone.

**Legend used throughout:**
- 🛑 **HUMAN GATE** — stop and get input/approval from Salma before proceeding.
- ✅ **ACCEPTANCE** — the objective, checkable condition that means the step is done.
- 📎 **EVIDENCE** — the artifact to capture into `apps/wilmet/evidence/` as proof.
- ⚙️ **REUSABLE** — this artifact is part of the portable pipeline (works on any Lovable app, not just Wilmet).

---

## 1. Context and problem statement

Wilmet was built with Lovable, which generates a React single-page app that talks **directly** to Supabase (Postgres + Auth + Storage + Edge Functions). There is no traditional backend; the browser holds the public Supabase **anon key** by design, so **Row Level Security (RLS) policies are the entire authorization boundary**. Lovable's built-in scan checks that policies *exist*, not that they *work* — a table protected only by `USING (true)` passes the scan while remaining fully open. This is the exact class of defect behind **CVE-2025-48757** (disclosed May 2025 by Matt Palmer): 303 endpoints across 170 Lovable projects were readable by anyone with the public anon key, exposing data for ~13,000 users. Lovable also does **not** provide regression testing, end-to-end testing, load/performance testing, or production monitoring/backups.

**Current state we are inheriting (must be verified in Phase 0):**
- A prior agent (ChatGPT / Codex) edited the project and left a **broken preview**.
- A GitHub repo was connected to the Lovable project, but the **sync is reported broken**.
- We do not yet know which changes are good, which are harmful, and whether the connected repo is even a valid Lovable-synced repo.

**Objective:** make Wilmet production-ready *and* leave behind a **repeatable pipeline** the team can run on the next Lovable app with only configuration changes.

---

## 2. Operating doctrine (Rules of Engagement)

These are the principles that make the work defensible in a review. The agent applies them at every step.

1. **Independent verification.** The tool that wrote the code never gets to be the only one that audits it. We re-prove every Lovable claim from the outside (probe the REST API, read the policies by hand, run our own tests).
2. **Evidence over assertion.** Each finding is recorded as *finding → severity → fix → retest*, with the raw command output attached. A green checkmark with no artifact behind it does not exist.
3. **Least privilege everywhere.** The `service_role` key never touches client code or the repo. CI uses scoped secrets. Test users have only the roles they need.
4. **Staging isolation.** All probing, load testing, and destructive tests run on a **staging** Supabase project that mirrors production, never on the client's live data.
5. **Lovable is the source of truth for app code.** Because Lovable regenerates code on each prompt, app-behaviour fixes are made *through Lovable* so they persist; the pipeline (tests, CI, scripts, docs) lives in directories Lovable does not manage. We never edit the same app file on both sides at once (that is how sync conflicts and silent reverts happen).
6. **Small, reversible changes.** One concern per branch/PR. Everything is revertible. Nothing ships that breaks an existing test.
7. **Reusability is a first-class requirement.** Anything Wilmet-specific goes in config or filled-in templates; the scripts themselves stay app-agnostic so the pipeline drops into the next project unchanged.
8. **Decisions are logged.** Any non-obvious choice (e.g., "we discarded Codex's change to X because…") gets a one-paragraph ADR in `docs/v2p/decisions/` so the supervisor can audit the reasoning.

---

## 3. Architecture and where the pipeline lives

```
                       ┌─────────────────────────────┐
                       │   Browser (React SPA)        │  ← Lovable-generated
                       │   holds PUBLIC anon key      │
                       └──────────────┬──────────────┘
                                      │ HTTPS (PostgREST / GoTrue / Storage)
                                      ▼
        ┌───────────────────────────────────────────────────┐
        │                 Supabase project                  │
        │   Postgres + RLS │ Auth │ Storage │ Edge Functions │
        └───────────────────────────────────────────────────┘

   Source of truth for APP CODE   →  Lovable  (syncs to GitHub main via lovable-dev bot)
   Source of truth for PIPELINE   →  GitHub   (tests / CI / scripts / docs Lovable won't touch)
   Source of truth for DB + RLS   →  Supabase (changes applied as versioned SQL migrations)
```

**Critical facts about Lovable ↔ GitHub sync (verified, current):**
- Two-way sync works **only on the `main` branch**. Lovable → GitHub is reliable (every prompt is a `lovable-dev` bot commit). GitHub → Lovable is the fragile direction and sometimes needs a nudge (a fresh external commit) to pull external changes back in.
- You **cannot import an existing GitHub repo into Lovable.** The connection only works by Lovable *exporting* to a new repo. If a prior agent created a separate repo and "pointed" Lovable at it, that is not a valid connection.
- **Renaming, moving, or deleting the connected repo permanently breaks sync.** The supported recovery is to **duplicate the Lovable project and reconnect** (which creates a fresh repo), not to hand-fix the broken link.
- Files pushed from outside that Lovable doesn't manage (our `tests/`, `.github/`, `docs/`, `pipeline/`) sync **into** Lovable but Lovable won't edit them — which is exactly what we want.

**Consequence for our layout:** the pipeline lives in top-level directories Lovable ignores, so regenerating app code never clobbers our tests or CI. RLS/DB changes live as migrations in `supabase/migrations/` and are applied in Supabase.

---

## 4. Definition of Done (internship-level success criteria)

The internship is complete when **all** of the following are true and evidenced:

> **Functional gate first (Phase 0.5, §7A).** The F-criteria below must be met — and Salma must personally sign off that the app works — *before* any D-criterion (the engineering work) begins.

| # | Criterion | Verified by |
|---|-----------|-------------|
| F1 | Every route is reachable and every interactive element does its intended job (or is deferred/removed with sign-off). | Interaction map, all rows resolved |
| F2 | Zero console errors and zero failed network requests on all core journeys; all table/column references resolve. | Walkthrough captures + `wiring-scan` clean |
| F3 | Create/read/edit/delete works for every core entity; the working state is pinned by seeded smoke tests. | `tests/smoke` green + evidence |
| F4 | **Salma has previewed the app and signed off that it is fully functional.** | Sign-off note in `functional-completeness.md` |
| D1 | Preview/build is green locally and in CI; no regressions from the Codex breakage remain. | CI run + `npm run build` log |
| D2 | Lovable ↔ GitHub sync is healthy (or a documented, deliberate alternative is in place). | Sync-status note + recent bidirectional commit test |
| D3 | Every `public` table has RLS enabled **and** a policy that actually restricts access (no `USING (true)` on sensitive tables). | `rls-audit.sql` output + `rls-probe` pass |
| D4 | Anonymous probe against staging returns **no** protected rows and **cannot** write. | `rls-probe` exit 0 + saved output |
| D5 | Authenticated probe returns **only** the acting user's rows. | `rls-probe` authenticated pass |
| D6 | No `service_role`/Stripe/OpenAI/other secrets in the shipped bundle or Git history. | `secret-scan` + `gitleaks` clean |
| D7 | Edge Functions validate input server-side and verify the caller. | Code review notes + tests |
| D8 | Auth hardening applied (leaked-password protection, min length, rate limits, redirect allowlist, email verification, MFA for admin). | Supabase settings screenshots |
| D9 | Security headers present (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). | `headers-check` output |
| D10 | Playwright E2E suite covers the critical journeys and runs on every PR via CI. | CI run + suite report |
| D11 | k6 load test on staging meets targets: **p95 < 500 ms, error rate < 1%** at 3× peak. | k6 summary report |
| D12 | Staging env, error/uptime monitoring, and **restore-tested** backups exist. | Monitoring dashboards + restore log |
| D13 | Incident plan + pre-publish checklist exist and were dry-run once. | Signed checklist |
| D14 | The pipeline is packaged so it applies to a **new** Lovable app via config only. | `pipeline/README.md` + a dry-run against a scratch project |
| D15 | Final report + evidence pack delivered. | `apps/wilmet/reports/final-report.md` + `evidence/` |

---

## 5. Severity rubric and findings workflow

Every issue found is logged in `apps/wilmet/findings-register.csv` (schema in Appendix K). Severity uses a simplified, defensible rubric aligned to CVSS intent:

| Severity | Definition | Example | SLA to fix |
|----------|-----------|---------|-----------|
| **Critical** | Unauthenticated read/write of sensitive data, or full account takeover. | Table with no RLS readable by anon key. | Immediately, before anything else ships |
| **High** | Authenticated privilege escalation, or sensitive data readable across tenants/users. | `USING (true)` on a per-user table. | Within the phase |
| **Medium** | Weakens defense-in-depth; exploitable only with chained conditions. | Missing HSTS; permissive redirect URLs. | Before final ship |
| **Low** | Best-practice gap, no direct exploit. | Missing Referrer-Policy. | Best effort |

**Workflow for each finding:** `discover → record (id, severity, evidence) → fix → retest → attach retest evidence → mark closed`. A finding is never "closed" without a retest artifact.

---

## 6. Repository and environment layout

The agent creates this structure. App code (Lovable's) stays at the repo root; everything below is pipeline/instance material Lovable won't touch.

```
<repo root>                      # Lovable app: src/, public/, index.html, package.json, supabase/, ...
├── docs/
│   └── v2p/
│       ├── EXECUTION-PLAN.md    # this file
│       ├── decisions/           # ADRs (one .md per non-trivial decision)
│       └── sync-status.md       # Phase 0 findings on the GitHub/Lovable connection
├── pipeline/                    # ⚙️ THE REUSABLE PRODUCT — app-agnostic, config-driven
│   ├── README.md                # "How to apply V2P to a new Lovable app" (Appendix in §14)
│   ├── pipeline.config.example.json
│   ├── functional/
│   │   └── wiring-scan.mjs      # Appendix R — static no-op/schema-drift/import scan
│   ├── security/
│   │   ├── rls-audit.sql        # Appendix A
│   │   ├── rls-probe.mjs        # Appendix B
│   │   ├── secret-scan.sh       # Appendix C
│   │   └── headers-check.mjs    # Appendix D
│   ├── testing/
│   │   ├── playwright.config.ts # Appendix G
│   │   └── journey.template.spec.ts
│   ├── load/
│   │   ├── k6-baseline.js        # Appendix H
│   │   └── k6-load.js            # Appendix H
│   └── templates/
│       ├── interaction-map.template.md    # Appendix Q
│       ├── functional-defects.template.csv# Appendix S
│       ├── threat-model.template.md      # Appendix I
│       ├── inventory.template.md         # Appendix J
│       ├── findings-register.template.csv# Appendix K
│       ├── pre-publish-checklist.md      # Appendix L
│       ├── incident-plan.template.md     # Appendix M
│       └── backup-restore-runbook.md     # Appendix N
├── tests/
│   ├── e2e/                     # Wilmet's real Playwright specs (instantiated from template)
│   └── smoke/                   # the 5 critical journeys
├── .github/workflows/
│   ├── ci.yml                   # Appendix E — lint, typecheck, semgrep, npm audit, gitleaks, build, e2e
│   └── smoke.yml                # Appendix F — smoke journeys pre-publish
└── apps/
    └── wilmet/                  # THE INSTANCE — Wilmet-specific outputs & proof
        ├── interaction-map.md   # Phase 0.5 functional traceability matrix
        ├── functional-defects.csv
        ├── inventory.md
        ├── threat-model.md
        ├── findings-register.csv
        ├── pipeline.config.json # non-secret config for Wilmet (URLs, table list, roles)
        ├── evidence/            # timestamped probe outputs, screenshots, logs, reports
        └── reports/
            ├── week1.md ... week4.md
            └── final-report.md
```

**Environments (🛑 HUMAN GATE — Salma provisions accounts/credentials):**
- **staging** — a Supabase project that mirrors production schema + RLS, seeded with synthetic data. All probing/load/E2E run here.
- **production** — the client's live app. Read-only inspection only; never a test target.
- Secrets live in `.env.local` (git-ignored) locally and in **GitHub Actions secrets** for CI. Never in the repo. `pipeline.config.json` holds only **non-secret** values (URLs, table names, role names).

---

## 7. Phase 0 — Triage and baseline recovery

**Goal:** stop the bleeding. Establish exactly what state the project is in, restore a green build, and get the Lovable ↔ GitHub relationship into a known-good posture — *without* destroying anything until we understand it.

> This phase folds into Week 1. Do it before any hardening. Do not "fix forward" on top of an unknown broken state.

### 7.1 Establish ground truth (read-only first)

**🛑 HUMAN GATE — Salma provides:** Lovable project access, the GitHub repo URL, confirmation of push access, and the Supabase project ref (staging + prod).

1. **Snapshot before touching anything.** In Lovable, note the current version-history entry (Lovable's built-in history is your undo of last resort). In GitHub, record the latest commit SHA on `main`.
2. **Clone and inspect the repo** (agent):
   ```bash
   git clone <repo-url> wilmet && cd wilmet
   git log --oneline -30 --pretty='%h %an %ad %s' --date=short
   ```
   Classify each recent commit: `lovable-dev` bot (Lovable), or a human/Codex/ChatGPT commit pushed externally. 📎 Save this log to `apps/wilmet/evidence/phase0-git-log.txt`.
3. **Diagnose the sync state** using the decision tree in 7.2. Write conclusions to `docs/v2p/sync-status.md`.
4. **Reproduce the broken preview locally:**
   ```bash
   node -v            # confirm Node 18+ (Lovable/Vite expects a modern LTS)
   npm ci || npm install
   npm run build 2>&1 | tee ../evidence-build.log
   npm run dev        # open the local preview, reproduce the failure
   ```
   📎 Save the exact error(s) to `apps/wilmet/evidence/phase0-build-error.log`.

### 7.2 GitHub ↔ Lovable sync decision tree

Work through this in order and record the answer:

- **Q1 — Is the connected repo a real Lovable-exported repo?** Check for `lovable-dev` bot commits in history and the Lovable **Settings → GitHub** panel showing this repo as connected.
  - **No lovable-dev commits / Lovable doesn't show it connected** → the prior agent likely created a *separate* repo and tried to attach it. Lovable cannot import an existing repo, so this is not a valid two-way sync. → go to **R-A**.
  - **Yes, it's the Lovable repo** → continue.
- **Q2 — Does Lovable's GitHub panel show an error?** (repo renamed/moved/deleted; GitHub App suspended or uninstalled; file > 100 MB; merge conflict).
  - **Renamed/moved/deleted** → sync is permanently broken on that link → **R-A**.
  - **App suspended/uninstalled** → Reconnect from Lovable's GitHub settings and unsuspend/reinstall the Lovable GitHub App in GitHub → **R-B**.
  - **File > 100 MB** → remove the oversized file(s) from the project and let sync retry; if stuck in history, that needs Lovable Support → **R-B**.
  - **Merge conflict / simultaneous edits** → the classic failure: app files were edited on *both* Lovable and GitHub. → **R-C**.
  - **No error, just stale** → GitHub → Lovable pull stalled → **R-C**.

**Recovery paths:**
- **R-A (broken/invalid connection):** 🛑 HUMAN GATE. First reconcile any *good* external changes (see 7.3) into Lovable via prompts, or decide to discard them. Then, from Lovable, **Duplicate the project → Settings → Connectors → GitHub → connect**, creating a fresh, correctly-synced repo. Re-point our pipeline at the new repo. Document the old repo as archived-read-only in `sync-status.md`.
- **R-B (suspended/uninstalled/oversized):** perform the specific fix, then verify with the round-trip test (7.4). No project duplication needed.
- **R-C (stalled/conflict):** resolve the conflict on `main`, then **nudge** the pull by making one trivial external commit (e.g., add a comment line to a pipeline doc) so Lovable re-syncs. Verify with 7.4.

> **Doctrine reminder:** after recovery, we stop editing app files on the GitHub side. App changes go through Lovable; pipeline files go through GitHub. This prevents R-C from recurring.

### 7.3 Assess Codex's changes — keep / fix / remove

Do not blanket-revert and do not blanket-keep. Evaluate each change on evidence.

1. **Isolate the changes.** Create a quarantine branch so nothing is lost:
   ```bash
   git checkout -b quarantine/codex-changes
   git checkout -b recovery/baseline main
   ```
2. **Diff Codex's commits against the last known-good Lovable commit.** For each changed file, decide:
   - **KEEP** — the change is correct and improves the app (rare from a broken run, but possible). If it's *app code*, re-apply it *through Lovable* so it persists in the source of truth; don't leave it as an orphan GitHub edit.
   - **FIX** — the intent was right but the implementation broke the build. Repair minimally.
   - **REMOVE** — the change is wrong, unnecessary, or duplicates something Lovable already does. Revert it.
   Record each decision in the findings register (category: *Recovery*) with a one-line rationale and an ADR for anything non-trivial.
3. **Restore a green build** on `recovery/baseline`: fix imports, TS errors, corrupted `package.json`, dependency mismatches, or deleted-but-referenced files until `npm run build` and `npm run dev` are clean.
4. Open a PR `recovery/baseline → main`. Let CI (once installed in Phase 4's stub, or a minimal build check now) confirm green. 🛑 HUMAN GATE: Salma approves the merge.

### 7.4 Verify sync round-trip

Prove the connection is healthy in both directions:
1. Make a tiny change **in Lovable** (e.g., edit copy on a page) → confirm a new `lovable-dev` commit appears on GitHub `main`.
2. Make a tiny change **on GitHub** in a pipeline file (`docs/v2p/sync-status.md`) → confirm it appears back in Lovable (nudge if needed).

✅ **ACCEPTANCE (Phase 0):** build + preview green locally; recovery merged to `main`; sync round-trip verified (or R-A alternative documented and in place); `sync-status.md`, `phase0-*` evidence, and recovery ADRs committed.

---

## 7A. Phase 0.5 — Functional completeness & wiring (the "it actually works" gate)

**Goal:** take Wilmet from *builds and previews* to *fully functional* — every route reachable, every button/link/form doing its intended job, every table/column reference resolving, every Edge Function and integration call succeeding. **None of the engineering phases (security, testing, load, ops) start until Salma has previewed the app and signed off that it works.**

**Why this is its own phase.** Phase 0 only guarantees a *green build*. A vibecoded app that compiles can still be full of dead buttons, no-op handlers, queries against columns that no longer exist, and half-finished features — especially after a broken Codex run. This phase finds and fixes those systematically, with evidence, and then **locks the working state in with smoke tests** so it can't silently regress while the rest of the internship proceeds. That last part directly answers the real worry: the surest way to keep the app working through weeks of further Lovable prompting is to pin each working journey with a test now.

**Doctrine for this phase.** Functional wiring is *app behavior*, so fixes persist best when made **through Lovable** (precise, defect-specific prompts) rather than as orphan GitHub edits that the next prompt may overwrite. The method is: **diagnose in code** (so you know exactly what's broken) → **fix through Lovable** → **verify the round-trip** → **re-check the element**. Use direct surgical code edits only when clearly faster, and immediately verify they synced. When a button's *intended* behavior is ambiguous (was it ever meant to do anything?), that is a product decision → 🛑 **HUMAN GATE** with Salma.

### 7A.1 Reconstruct the functional spec (interaction map)
Vibecoded apps ship without a spec, so build one. Produce `apps/wilmet/interaction-map.md` from the template (Appendix Q): enumerate every **route/page**; for each, every **interactive element** (button, link, form, menu, toggle); its **expected behavior**; the **data it reads/writes** (`table.column`) or the **endpoint / Edge Function / integration** it calls; and a **status** (`ok` / `broken` / `not-wired` / `unknown-intent`). This traceability matrix is the checklist the rest of the phase burns down — and it feeds straight into the Phase 1 security inventory (same assets, different lens), so it is not duplicated work.

### 7A.2 Static wiring audit (before clicking anything)
Reading the code for defects is cheaper than clicking. Run `pipeline/functional/wiring-scan.mjs` (Appendix R), then review by hand for the classic vibecoded breakages:
- **No-op / placeholder handlers:** `onClick={() => {}}`, empty submit handlers, `href="#"`, `TODO`/`alert()` stubs.
- **Dead routes:** a `<Link>`/`navigate()` to a path with no route, or a route with no component.
- **Schema drift (the big one):** Supabase calls (`.from('t')`, `.select('a,b')`, `.eq('col',…)`, `.rpc('fn')`) referencing tables/columns/functions that don't exist in the current schema. The scanner cross-checks code against Supabase's generated types (`src/integrations/supabase/types.ts`) or an `information_schema` dump.
- **Broken imports:** importing from deleted files (frequent after a bad Codex run).
- **Missing env wiring:** Supabase URL/anon key referenced but unset, so calls silently fail.
- **Left-over mock/hardcoded data** standing in for a real query.
- **Missing loading/error states**, so a failed call just looks like "the button does nothing."

Log every hit to `apps/wilmet/functional-defects.csv` (Appendix S).

### 7A.3 Schema ↔ code reconciliation
Pull the real schema and prove every reference resolves. Get the table/column/FK/enum list (Supabase → `information_schema`, or the generated types file), and cross-check every query in the code. For each mismatch, decide: the **code is wrong** (fix the query, via Lovable) or the **schema is wrong/missing** (add a migration, via Supabase). This is what turns "all table references are wired" into a *verified* statement rather than a hope. 📎 `evidence/phase0_5-schema-reconciliation.txt`.

### 7A.4 Systematic functional walkthrough (route by route, element by element)
With the interaction map as the checklist, exercise every element on **staging** with devtools open:
- Perform the intended action; record **actual vs expected**.
- Watch the **Console** (any error = defect) and the **Network** tab (any 4xx/5xx from Supabase/Edge/integration = wiring defect).
- Cover the full data lifecycle per entity: **create → read/list → edit → delete**, confirming the UI reflects each change (re-fetch/refresh works).
- Cover **navigation**: every menu item, link, and redirect lands where intended.
- Cover **forms**: validation, submit, success state, and error state all behave.

📎 Capture screenshots + console/network output into `evidence/phase0_5/<journey>/` per journey. Record pass/fail in the interaction map and defect log.

### 7A.5 Fix loop
For each defect, in priority order (core journeys first): **classify → fix through the right channel** (app behavior via Lovable; schema via migration; config/env via GitHub) **→ re-exercise the element → attach before/after evidence → mark resolved.** For ambiguous-intent elements, 🛑 confirm with Salma whether to **wire, hide, or remove**.

### 7A.6 Pin the working state with smoke tests (so it can't regress)
As each critical journey is confirmed working, immediately capture it as a Playwright smoke test in `tests/smoke/` (lightweight harness now; Phase 4 formalizes it and wires it to CI). Once a journey is green and pinned, further Lovable prompts can't silently break it without a test going red. Seed at least the **5 critical journeys** here.

### Acceptance / the gate
✅ **ACCEPTANCE (Phase 0.5):**
- Interaction map complete; every element marked `ok`, or deferred/removed **with Salma's sign-off**.
- `wiring-scan` clean: no unresolved table/column refs, no dead routes, no orphan handlers on live elements, no broken imports.
- Full walkthrough done: **zero console errors and zero failed network requests on every core journey.**
- Create/read/edit/delete works for every core entity; navigation and forms all behave.
- Smoke tests seeded and **green** for the critical journeys.
- Functional walkthrough report written (`apps/wilmet/reports/functional-completeness.md`).
- 🛑 **HUMAN GATE — Salma personally previews the app and signs off** that it is fully functional. **Only then does Phase 1 (engineering) begin.**

📎 EVIDENCE: `interaction-map.md`, `functional-defects.csv` (all resolved/deferred), `evidence/phase0_5/*`, seeded smoke tests, `functional-completeness.md` (with the sign-off note).

---

## 8. Phase 1 — Access, inventory, and threat model (Week 1)

**Goal:** know the whole attack surface on one page before attacking it. (Pillar 1a, first half.)

1. **🛑 HUMAN GATE — collect access:** Lovable project, Supabase dashboard (staging + prod), GitHub export. Confirm the staging project exists or provision it (8.4).
2. **Inventory everything** into `apps/wilmet/inventory.md` from the template (Appendix J): every table + its columns and data sensitivity (PII? credentials? payment?); every role (anon, authenticated, admin, any custom); every page/route; every Edge Function and what it does; every Storage bucket; every third-party integration (Stripe, email, OpenAI, etc.); every place a secret could live.
3. **Build the threat model** in `apps/wilmet/threat-model.md` from the template (Appendix I): for each asset, who should access it, the realistic threats (anon read/write, cross-user read, privilege escalation, secret exfiltration, function abuse), and the current control. Mark unknowns as "to verify in Phase 2."
4. **Run Lovable's built-in scan / Deep Scan** and record findings. Treat results as *input, not proof* — Lovable's scan checks policy existence, not effectiveness. Fix the obvious findings it surfaces, then move to independent verification in Phase 2.

📎 EVIDENCE: `inventory.md`, `threat-model.md`, Lovable scan screenshot, `week1.md` report.
✅ **ACCEPTANCE:** one-page threat model complete; every table/role/function/integration listed; staging identified.

### 8.4 Provision staging (if not already present)

🛑 HUMAN GATE (needs Supabase account). Create a staging Supabase project, apply the same schema + RLS as prod via migrations, and seed **synthetic** data (no real client PII). Capture the staging URL + anon key into `apps/wilmet/pipeline.config.json` (non-secret) and the staging keys into `.env.local` / CI secrets. This is the target for all probing, E2E, and load tests.

---

## 9. Phase 2 — Independent security audit (Week 2, Pillar 1a)

**Goal:** re-prove security from the outside. This is the heart of the defensibility story and directly addresses CVE-2025-48757.

### 9.1 Audit RLS by hand
Run `pipeline/security/rls-audit.sql` (Appendix A) against staging (Supabase SQL editor or `psql`). It lists: tables **without** RLS, every policy with its `USING`/`WITH CHECK` expression, and flags any `USING (true)`/`WITH CHECK (true)`. For every `public` table:
- RLS must be **enabled**; if not: `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` (as a migration).
- Every policy is read line-by-line. A per-user table must scope by `auth.uid()` (e.g., `USING (auth.uid() = user_id)`), not `true`. Lookup/reference tables get an explicit read-only policy, not "no policy" (RLS-on with zero policies denies all — intended for locked tables, but confirm the app still works).
📎 Save the full SQL output to `evidence/phase2-rls-audit.txt`.

### 9.2 Active probing (reproduce the CVE from the outside)
Run `pipeline/security/rls-probe.mjs` (Appendix B) against **staging**:
- **Anonymous pass** (anon key only, no auth): every protected table must return `[]` or a permission error — **never rows**. Any rows returned = **Critical** finding.
- **Write pass** (anon key, attempt insert): must be rejected (401/403).
- **Authenticated pass** (a real test user's JWT): must return **only that user's rows**, never other users'. Cross-user reads = **High/Critical**.
- **Cross-role pass** (test each role from `inventory.md`): confirm each role sees only what it should.
📎 Save probe output + exit codes to `evidence/phase2-rls-probe-{anon,write,auth}.txt`. Log every failure in the register with severity, then fix (policy migration), then **re-run the probe** and attach the passing output.

### 9.3 Edge Functions and secrets
- **Caller verification:** every Edge Function must verify the JWT and check permissions — Edge Functions run with `service_role` by default, so an unauthenticated or unchecked function is a privilege-escalation hole. Review each function; add auth checks where missing (via Lovable prompt so it persists).
- **Secret scan:** run `pipeline/security/secret-scan.sh` (Appendix C): build the app, grep the shipped bundle for `service_role` JWTs, `SUPABASE_SERVICE_ROLE_KEY`, Stripe (`sk_live_`/`sk_test_`/`rk_live_`), OpenAI (`sk-`, `sk-proj-`), and other tokens; run `gitleaks` over the full Git history. Any hit = **Critical**: remove from client, move server-side, and **rotate** the key in the provider dashboard (rotating without removing the exposure does nothing).
📎 `evidence/phase2-secret-scan.txt`, `evidence/phase2-gitleaks.json`.

✅ **ACCEPTANCE:** every Critical/High RLS and secret finding is fixed and retested green; edge functions verify callers; register updated with before/after evidence; `week2.md` written.

---

## 10. Phase 3 — Harden the application (Week 2, Pillar 1b)

Apply defense-in-depth. App-behaviour changes go through Lovable; config/headers/CI go through GitHub.

1. **Input validation (server-side).** In each Edge Function, validate request bodies against a schema (e.g., `zod`) and reject malformed input. Never trust the browser. Add unit tests for the validators.
2. **Auth configuration (Supabase dashboard, capture screenshots):** enable leaked-password protection; set a minimum password length; enable rate limits on auth endpoints; restrict redirect URLs to an allowlist; require email verification; require **MFA for admin roles**.
3. **HTTP security headers:** add CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a sane `Referrer-Policy` (set at the host/CDN or via meta/edge as the platform allows). Verify with `pipeline/security/headers-check.mjs` (Appendix D) against staging. 📎 `evidence/phase3-headers.txt`.
4. **Code & dependency checks** (wired into CI in Phase 4, runnable now): `semgrep` static analysis, `npm audit` (fail on high/critical), `gitleaks` secret scan. Triage and fix or document accepted risks.

✅ **ACCEPTANCE:** validation added + tested; all auth toggles set (screenshots); headers present (probe output); dependency/static findings triaged; `week2.md` updated.

---

## 11. Phase 4 — Regression and end-to-end testing (Week 3, Pillar 2a)

**Goal:** make it impossible to silently break a working feature. This is what Lovable does not do — and the reason regressions slip through when the AI regenerates code.

1. **Install Playwright** and the config (`pipeline/testing/playwright.config.ts`, Appendix G) pointed at the staging base URL.
2. **Write E2E specs** in `tests/e2e/` covering the real journeys from `inventory.md`: sign up, log in, create/edit/delete each core entity, and **role restrictions** (a normal user is *denied* admin actions — this doubles as an authz regression test). Use the journey template (Appendix G) as the pattern; instantiate per Wilmet feature.
3. **Define the 5 critical smoke journeys** in `tests/smoke/` — the ones that must never break (e.g., login, load dashboard, create the primary record, the money/critical path, logout).
4. **Wire CI** (`.github/workflows/ci.yml`, Appendix E): on every PR/push to `main`, run typecheck → lint → semgrep → `npm audit` → gitleaks → build → Playwright E2E. Add `smoke.yml` (Appendix F) to run the smoke journeys as a fast pre-publish gate.
5. **Prove the safety net:** intentionally introduce a trivial regression on a throwaway branch and confirm CI/E2E catches it; then revert. 📎 Save the failing-then-passing CI run links.

✅ **ACCEPTANCE:** E2E suite green on staging; runs automatically on every PR; smoke gate exists; regression-catch demonstrated; `week3.md` started.

---

## 12. Phase 5 — Load and performance testing (Week 3, Pillar 2b)

**Goal:** confirm it scales, not just "works." Vibecoded apps commonly ship full-table fetches (no pagination), missing indexes, no caching, and redundant requests.

1. **Baseline** with `pipeline/load/k6-baseline.js` (Appendix H): low, steady load on staging to record normal p95 and error rate.
2. **Ramp test** with `pipeline/load/k6-load.js` (Appendix H): baseline → peak → **3× peak**, measuring p95 latency and error rate. Thresholds encoded in the script: **p95 < 500 ms, error rate < 1%**.
3. **Diagnose and fix** the hotspots: add pagination/limits to list queries, add missing DB indexes (as migrations), add a caching layer where appropriate, batch redundant requests, and right-size the Supabase plan if limits are being hit. App-side query changes go through Lovable; DB indexes go as migrations.
4. **Re-test until targets are met.** 📎 Save k6 summaries before/after to `evidence/phase5-k6-{before,after}.txt`.

✅ **ACCEPTANCE:** k6 at 3× peak meets p95 < 500 ms and error < 1%; each fix has before/after numbers; `week3.md` completed.

---

## 13. Phase 6 — Production operations (Week 4, Pillar 3)

**Goal:** know about failures before the client does, and be able to recover.

1. **Staging discipline:** confirm staging is fully separate and is the only test target. Document promotion (staging → prod) steps.
2. **Error + uptime monitoring:** integrate Sentry (or equivalent) for client + Edge Function errors; add an uptime check (health endpoint / homepage ping) with alerting. 📎 dashboard screenshots.
3. **Backups with a restore test:** enable automated backups; then **actually restore** the latest backup into a scratch project and confirm data integrity. An untested backup is a hope, not a plan. 📎 `evidence/phase6-restore-test.log`.
4. **Incident plan** (`apps/wilmet/incident-plan.md` from Appendix M): who does what if something breaks or leaks — detection, roles, comms, rollback, post-mortem.
5. **Pre-publish checklist** (`apps/wilmet/pre-publish-checklist.md` from Appendix L): re-run security probes, smoke tests, and scans on every release. Dry-run it once and sign it.

✅ **ACCEPTANCE:** monitoring live; restore proven; incident plan + checklist exist and dry-run once; `week4.md` written.

---

## 14. Phase 7 — Package the pipeline for reuse (Week 4)

**This is the supervisor's headline requirement.** Wilmet must end up as *instance #1 of a reusable pipeline*, not a one-off.

1. **Make every script config-driven.** No Wilmet values hard-coded in `pipeline/`. All URLs, table lists, role names, and thresholds come from `pipeline.config.json` + env vars. Verify by grepping `pipeline/` for "wilmet" — there should be zero matches.
2. **Write `pipeline/README.md`** — the "apply V2P to a new Lovable app" guide:
   - Prereqs (Lovable project, Supabase staging, GitHub connection).
   - Step 1: copy `pipeline/`, `.github/workflows/`, and `docs/v2p/` into the new repo.
   - Step 2: fill `pipeline.config.json` and set secrets.
   - Step 3: run intake (inventory + threat model templates).
   - Step 4: run `rls-audit.sql` + `rls-probe.mjs` + `secret-scan.sh` + `headers-check.mjs`.
   - Step 5: instantiate E2E from the journey template; enable CI.
   - Step 6: run k6; apply the ops runbook + checklist.
   - A one-page **"pipeline in 6 commands"** quick-start.
3. **Dry-run the pipeline against a scratch Lovable project** (or a second sample) to prove portability — even a partial run (intake + RLS probe) demonstrates config-only reuse. 📎 record the dry-run.
4. **Version the pipeline** (tag `v2p-1.0`) so the team pins a known-good release.

✅ **ACCEPTANCE:** `pipeline/` is app-agnostic (grep-clean of "wilmet"); README enables a new-app application; dry-run recorded; tagged release.

---

## 15. Deliverables and evidence pack

Assembled in `apps/wilmet/reports/` and `apps/wilmet/evidence/`:

1. **Threat model** — `threat-model.md`.
2. **Findings register** — `findings-register.csv` (issue → severity → fix → retest, every row closed with evidence).
3. **Reusable RLS probe + audit** — `pipeline/security/rls-probe.mjs`, `rls-audit.sql` (⚙️).
4. **E2E test suite** — `tests/e2e/` + `tests/smoke/`, running in CI.
5. **Load test report** — before/after k6 summaries meeting targets.
6. **Ops artifacts** — monitoring proof, restore-test log, incident plan, pre-publish checklist.
7. **The V2P pipeline** — `pipeline/` + `pipeline/README.md`, tagged `v2p-1.0` (⚙️).
8. **Final report** — `final-report.md`: what was inherited, what was found (by severity), what was fixed with evidence, residual risks, and how to reuse the pipeline. Written for the supervisor: every claim links to an evidence file.

**Final report skeleton:** Executive summary · Inherited state (Phase 0) · Threat model summary · Findings by severity (with before/after) · Testing coverage · Performance results · Operations posture · Residual risk & recommendations · The reusable pipeline · Appendix: evidence index.

---

## 16. Appendices — ready-to-use artifacts

> The agent creates each file at the path shown. Scripts are written to be **app-agnostic**; Wilmet values come from config/env. Treat these as v1 starting points and adapt to Wilmet's real schema/routes as discovered in Phase 1.

### Appendix A — `pipeline/security/rls-audit.sql`
```sql
-- V2P RLS audit. Run in the Supabase SQL editor or via psql on STAGING.
-- 1) Tables in public with RLS DISABLED (each one is a potential CVE-2025-48757).
select tablename as table_without_rls
from pg_tables
where schemaname = 'public' and not rowsecurity
order by tablename;

-- 2) Every policy with its USING / WITH CHECK expression (read these by hand).
select tablename, policyname, cmd, roles,
       qual        as using_expr,
       with_check  as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Dangerous permissive policies: USING (true) or WITH CHECK (true).
select tablename, policyname, cmd, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- 4) Tables that have RLS enabled but ZERO policies (deny-all: confirm intended).
select t.tablename
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.rowsecurity and p.policyname is null
order by t.tablename;
```

### Appendix B — `pipeline/security/rls-probe.mjs`
```js
#!/usr/bin/env node
/**
 * V2P — RLS / anon-key exposure probe (Node 18+, no deps).
 * Reproduces CVE-2025-48757 from the outside: hit Supabase's auto REST API
 * with ONLY the public anon key and confirm nothing leaks. Optionally repeat
 * with a real user's JWT to confirm rows are scoped to that user.
 *
 * Config via env:
 *   SUPABASE_URL           e.g. https://xyz.supabase.co   (STAGING)
 *   SUPABASE_ANON_KEY      public anon key
 *   PROBE_TABLES           comma-separated table names, OR use --tables <file>
 *   TEST_USER_JWT          (optional) a logged-in user's access token
 *   TEST_USER_ID           (optional) that user's id, to check row ownership
 *
 * Exit 0 = all checks passed (no leak). Non-zero = at least one failure.
 */
import { readFileSync } from 'node:fs';

const URL  = process.env.SUPABASE_URL?.replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT  = process.env.TEST_USER_JWT || null;
const UID  = process.env.TEST_USER_ID || null;

if (!URL || !ANON) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(2); }

const fileArgIdx = process.argv.indexOf('--tables');
const tables = fileArgIdx > -1
  ? readFileSync(process.argv[fileArgIdx + 1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : (process.env.PROBE_TABLES || '').split(',').map(s => s.trim()).filter(Boolean);

if (tables.length === 0) { console.error('No tables. Set PROBE_TABLES or --tables <file>'); process.exit(2); }

let failures = 0;
const line = (s) => console.log(s);

async function get(table, jwt) {
  const headers = { apikey: ANON };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${URL}/rest/v1/${table}?select=*&limit=5`, { headers });
  let body = [];
  try { body = await res.json(); } catch { body = []; }
  return { status: res.status, body: Array.isArray(body) ? body : [] };
}

async function tryWrite(table) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ __v2p_probe__: 'should-be-rejected' }),
  });
  return res.status;
}

line('=== V2P RLS PROBE ===');
line(`Target: ${URL}`);
line(`Tables: ${tables.join(', ')}\n`);

// Pass 1 — anonymous read: expect NO rows.
line('--- Pass 1: anonymous READ (expect 0 rows or permission error) ---');
for (const t of tables) {
  const { status, body } = await get(t, null);
  if (status < 400 && body.length > 0) {
    failures++; line(`  [FAIL] ${t}: anon read returned ${body.length} row(s) — RLS OPEN (Critical)`);
  } else {
    line(`  [ pass ] ${t}: status ${status}, ${body.length} rows`);
  }
}

// Pass 2 — anonymous write: expect rejection.
line('\n--- Pass 2: anonymous WRITE (expect 401/403) ---');
for (const t of tables) {
  const status = await tryWrite(t);
  if (status < 400) {
    failures++; line(`  [FAIL] ${t}: anon write accepted (status ${status}) — WRITABLE (Critical)`);
  } else {
    line(`  [ pass ] ${t}: write rejected (status ${status})`);
  }
}

// Pass 3 — authenticated read: expect ONLY this user's rows (if UID known).
if (JWT) {
  line('\n--- Pass 3: authenticated READ (expect only own rows) ---');
  for (const t of tables) {
    const { status, body } = await get(t, JWT);
    if (UID) {
      const foreign = body.filter(r => 'user_id' in r && String(r.user_id) !== String(UID));
      if (foreign.length > 0) {
        failures++; line(`  [FAIL] ${t}: returned ${foreign.length} row(s) not owned by test user (High)`);
      } else {
        line(`  [ pass ] ${t}: status ${status}, ${body.length} rows, all owned`);
      }
    } else {
      line(`  [ info ] ${t}: status ${status}, ${body.length} rows (set TEST_USER_ID to check ownership)`);
    }
  }
} else {
  line('\n--- Pass 3 skipped (no TEST_USER_JWT) ---');
}

line(`\n=== RESULT: ${failures === 0 ? 'PASS (no leaks)' : failures + ' FAILURE(S)'} ===`);
process.exit(failures === 0 ? 0 : 1);
```

### Appendix C — `pipeline/security/secret-scan.sh`
```bash
#!/usr/bin/env bash
# V2P — scan the shipped bundle and git history for secrets that must never
# reach the client. Run from repo root. Requires: node/npm; gitleaks optional.
set -euo pipefail
OUT="${1:-secret-scan-report.txt}"
: > "$OUT"

echo "== Building app ==" | tee -a "$OUT"
npm run build 2>&1 | tail -n 5 | tee -a "$OUT"
DIST="dist"; [ -d "$DIST" ] || DIST="build"

echo "== Scanning $DIST for high-risk secrets ==" | tee -a "$OUT"
# Supabase service_role (a JWT containing "service_role"), and the env var name.
PATTERNS=(
  'service_role'
  'SUPABASE_SERVICE_ROLE_KEY'
  'sk_live_' 'sk_test_' 'rk_live_'          # Stripe
  'sk-proj-' 'sk-[A-Za-z0-9]\{20,\}'        # OpenAI
  'AKIA[0-9A-Z]\{16\}'                       # AWS access key id
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'       # private keys
)
HITS=0
for p in "${PATTERNS[@]}"; do
  if grep -REn "$p" "$DIST" 2>/dev/null | tee -a "$OUT" | grep -q .; then
    echo "  [HIT] pattern: $p" | tee -a "$OUT"; HITS=$((HITS+1))
  fi
done

echo "== gitleaks (full history), if installed ==" | tee -a "$OUT"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-banner --redact -r gitleaks-report.json 2>&1 | tee -a "$OUT" || true
else
  echo "  gitleaks not installed — run in CI (see ci.yml)" | tee -a "$OUT"
fi

echo "== RESULT: $HITS bundle pattern hit(s). Review $OUT. Any hit on a real key = CRITICAL: remove + rotate. =="
[ "$HITS" -eq 0 ]
```

### Appendix D — `pipeline/security/headers-check.mjs`
```js
#!/usr/bin/env node
// V2P — verify security headers on the deployed (STAGING) URL.
// Usage: TARGET_URL=https://staging.example node headers-check.mjs
const url = process.env.TARGET_URL;
if (!url) { console.error('Set TARGET_URL'); process.exit(2); }
const want = {
  'content-security-policy': 'CSP',
  'strict-transport-security': 'HSTS',
  'x-frame-options': 'X-Frame-Options',
  'x-content-type-options': 'X-Content-Type-Options',
  'referrer-policy': 'Referrer-Policy',
};
const res = await fetch(url, { redirect: 'manual' });
let missing = 0;
console.log(`=== Header check: ${url} (status ${res.status}) ===`);
for (const [h, label] of Object.entries(want)) {
  const v = res.headers.get(h);
  if (v) console.log(`  [ pass ] ${label}: ${v}`);
  else { console.log(`  [FAIL] ${label}: MISSING`); missing++; }
}
console.log(`=== ${missing === 0 ? 'PASS' : missing + ' missing header(s)'} ===`);
process.exit(missing === 0 ? 0 : 1);
```

### Appendix E — `.github/workflows/ci.yml`
```yaml
name: V2P CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # full history for gitleaks
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Typecheck
        run: npx tsc --noEmit || echo "::warning::typecheck issues"
      - name: Lint
        run: npm run lint --if-present
      - name: Static analysis (Semgrep)
        uses: returntocorp/semgrep-action@v1
        with: { config: "p/typescript p/react p/owasp-top-ten" }
        continue-on-error: true
      - name: Dependency audit
        run: npm audit --audit-level=high || echo "::warning::npm audit findings"
      - name: Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
      - name: Build
        run: npm run build
  e2e:
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: E2E (staging)
        env:
          BASE_URL: ${{ secrets.STAGING_BASE_URL }}
          SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: playwright-report/ }
```

### Appendix F — `.github/workflows/smoke.yml`
```yaml
name: V2P Smoke (pre-publish)
on:
  workflow_dispatch:
  push: { tags: ['release-*'] }
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci && npx playwright install --with-deps
      - name: 5 critical journeys
        env: { BASE_URL: ${{ secrets.STAGING_BASE_URL }} }
        run: npx playwright test tests/smoke
```

### Appendix G — Playwright config + journey template
`pipeline/testing/playwright.config.ts`
```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```
`pipeline/testing/journey.template.spec.ts`
```ts
import { test, expect } from '@playwright/test';
// V2P journey template — copy into tests/e2e/<feature>.spec.ts and fill in.
test.describe('<FEATURE> journey', () => {
  test('user can <do the thing>', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL ?? 'test@example.com');
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD ?? 'CHANGE_ME');
    await page.getByRole('button', { name: /log ?in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    // create → assert → edit → assert → delete → assert
  });

  test('normal user is DENIED admin action (authz regression)', async ({ page }) => {
    // log in as a non-admin, attempt an admin-only route/action, assert it is blocked
    await page.goto('/admin');
    await expect(page.getByText(/forbidden|not authorized|404/i)).toBeVisible();
  });
});
```

### Appendix H — k6 load scripts
`pipeline/load/k6-baseline.js`
```js
import http from 'k6/http';
import { check } from 'k6';
export const options = {
  vus: 5, duration: '2m',
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
};
const BASE = __ENV.BASE_URL;                 // staging app or REST endpoint
const ANON = __ENV.SUPABASE_ANON_KEY;
export default function () {
  const res = http.get(`${BASE}/rest/v1/${__ENV.PROBE_TABLE}?select=id&limit=20`,
    { headers: { apikey: ANON, Authorization: `Bearer ${__ENV.TEST_USER_JWT ?? ANON}` } });
  check(res, { 'status 200': r => r.status === 200 });
}
```
`pipeline/load/k6-load.js`
```js
import http from 'k6/http';
import { check } from 'k6';
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // baseline
    { duration: '2m', target: 50 },   // peak
    { duration: '2m', target: 150 },  // 3x peak
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.01'] },
};
const BASE = __ENV.BASE_URL, ANON = __ENV.SUPABASE_ANON_KEY;
export default function () {
  const res = http.get(`${BASE}/rest/v1/${__ENV.PROBE_TABLE}?select=id&limit=20`,
    { headers: { apikey: ANON, Authorization: `Bearer ${__ENV.TEST_USER_JWT ?? ANON}` } });
  check(res, { 'status 200': r => r.status === 200 });
}
```

### Appendix I — `pipeline/templates/threat-model.template.md`
```md
# Threat Model — <APP NAME>
_Date: <yyyy-mm-dd> · Author: <name> · Environment audited: staging_

## Assets & sensitivity
| Asset (table/bucket/function) | Data type | Sensitivity (PII/cred/payment/none) | Who SHOULD access |
|---|---|---|---|

## Roles
| Role | Description | Intended access |
|---|---|---|
| anon | unauthenticated visitor | |
| authenticated | logged-in user | own rows only |
| admin | privileged | |

## Threats & current control
| Asset | Threat | Realistic? | Current control | Status (verify/ok/gap) |
|---|---|---|---|---|
| <table> | anon read | | RLS policy | to verify (Phase 2) |
| <table> | anon write | | RLS policy | to verify |
| <table> | cross-user read | | auth.uid() policy | to verify |
| <function> | unauth call / privilege escalation | | JWT check | to verify |
| bundle | secret exfiltration | | server-side only | to verify |

## Open questions to resolve in Phase 2
- 
```

### Appendix J — `pipeline/templates/inventory.template.md`
```md
# Inventory — <APP NAME>  (one-page attack surface)
## Tables
| Table | Columns (sensitive?) | RLS enabled? | Policies |
|---|---|---|---|
## Roles
| Role | Source | Notes |
## Routes / pages
| Path | Auth required? | Role |
## Edge Functions
| Function | Purpose | Verifies caller? |
## Storage buckets
| Bucket | Public? | Policy |
## Integrations & secrets
| Integration | Key type | Where stored (must be server-side) |
```

### Appendix K — `pipeline/templates/findings-register.template.csv`
```csv
id,phase,category,title,severity,asset,evidence_before,fix,retest_evidence,status,owner,date
F-001,Phase2,RLS,"<table> readable by anon key",Critical,<table>,evidence/phase2-rls-probe-anon.txt,"Enable RLS + auth.uid() policy (migration)",evidence/phase2-rls-probe-anon-retest.txt,open,Salma,<date>
```

### Appendix L — `pipeline/templates/pre-publish-checklist.md`
```md
# Pre-Publish Checklist — <APP NAME> — release <tag>
- [ ] `rls-audit.sql` re-run, no table without RLS, no USING(true) on sensitive tables
- [ ] `rls-probe.mjs` anon+write+auth passes (exit 0), output saved to evidence/
- [ ] `secret-scan.sh` + gitleaks clean
- [ ] `headers-check.mjs` all headers present
- [ ] Playwright E2E green in CI on this commit
- [ ] 5 smoke journeys green
- [ ] k6 at 3x peak meets p95<500ms, error<1%
- [ ] Auth settings verified (leaked-pw, min length, rate limit, redirect allowlist, email verify, admin MFA)
- [ ] Backup taken; restore verified within last <N> days
- [ ] Monitoring/alerting active
- [ ] Findings register: zero open Critical/High
- Signed: __________  Date: __________
```

### Appendix M — `pipeline/templates/incident-plan.template.md`
```md
# Incident Response Plan — <APP NAME>
## Detection
- Sources: Sentry alerts, uptime check, user report, security scan.
## Severity & first move
| Severity | Example | First action |
|---|---|---|
| SEV1 | data leak / unauth write | take feature offline / revoke key, then investigate |
| SEV2 | broken critical journey | roll back to last green release |
## Roles
- Incident lead: <name> · Comms: <name> · Fixer: <name>
## Runbook
1. Contain (disable route / rotate key / restrict policy).
2. Assess blast radius (Supabase logs, affected tables/users).
3. Notify per obligations (GDPR/CCPA if PII).
4. Remediate + retest with the probe suite.
5. Post-mortem within 48h; add a regression test so it can't recur.
```

### Appendix N — `pipeline/templates/backup-restore-runbook.md`
```md
# Backup & Restore Runbook — <APP NAME>
## Backups
- Schedule: <daily> · Retention: <N days> · Location: <Supabase automated / external>
## Restore test (do this, don't assume)
1. Create a scratch Supabase project.
2. Restore the latest backup into it.
3. Run `rls-audit.sql` + a read of key tables; confirm row counts & integrity.
4. Record result + timestamp in evidence/phase6-restore-test.log.
## RPO / RTO targets
- RPO: <e.g., 24h> · RTO: <e.g., 2h>
```

### Appendix O — `pipeline/pipeline.config.example.json`
```json
{
  "app_name": "wilmet",
  "environments": {
    "staging": { "supabase_url": "https://<staging-ref>.supabase.co", "base_url": "https://<staging-app-url>" },
    "production": { "base_url": "https://<prod-app-url>", "note": "READ-ONLY. Never a test target." }
  },
  "roles": ["anon", "authenticated", "admin"],
  "probe_tables": ["<table1>", "<table2>"],
  "load_targets": { "p95_ms": 500, "error_rate": 0.01, "peak_vus": 50, "stress_multiplier": 3 },
  "secrets_are_in": ".env.local and GitHub Actions secrets — NEVER this file"
}
```
> `.env.local` (git-ignored) holds the actual keys: `SUPABASE_ANON_KEY`, `TEST_USER_JWT`, `TEST_USER_ID`, etc. Add `.env.local` to `.gitignore` in Phase 0.

### Appendix P — ADR template (`docs/v2p/decisions/ADR-000-template.md`)
```md
# ADR-<n>: <decision title>
Date: <yyyy-mm-dd> · Status: accepted
## Context
<what situation forced a choice — e.g., Codex changed X and it broke Y>
## Decision
<what we chose>
## Rationale
<why, with the evidence link>
## Consequences
<trade-offs, what to watch>
```

### Appendix Q — `pipeline/templates/interaction-map.template.md`
```md
# Interaction Map — <APP NAME>  (functional traceability matrix)
_Reconstructed spec: every interactive element, what it should do, what it's wired to, and whether it works._
_Status values: ok | broken | not-wired | unknown-intent_

## Route: <e.g. /login>
| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Evidence |
|---|---|---|---|---|---|
| "Log in" | button | authenticate, then route to /dashboard | Supabase Auth (signInWithPassword) | | |
| "Forgot password" | link | route to /reset | — | | |

## Route: <e.g. /dashboard>
| Element | Type | Expected behavior | Reads/Writes or Endpoint | Status | Evidence |
|---|---|---|---|---|---|
| "New record" | button | open form, insert row, refresh list | orders.(title,amount,user_id) | | |
| "Edit" | button | load row into form, update | orders (update by id) | | |
| "Delete" | button | delete row + refresh list | orders (delete by id) | | |
| nav "Reports" | link | route to /reports | — | | |

## Route: <...>
| Element | Type | Expected behavior | Reads/Writes or Endpoint | Status | Evidence |

## Deferred / removed (require sign-off)
| Element | Decision (wire later / hide / remove) | Approved by | Date |
|---|---|---|---|
```

### Appendix R — `pipeline/functional/wiring-scan.mjs`
```js
#!/usr/bin/env node
/**
 * V2P — wiring scan (Node 18+, no deps, best-effort static checks).
 * Flags common vibecoded wiring defects BEFORE the manual walkthrough:
 *   1) UI no-op handlers / dead links
 *   2) Supabase table/column references not present in the schema
 *   3) Local imports pointing at files that don't exist (post-Codex breakage)
 *
 * Config via env:
 *   SRC_DIR      default "src"
 *   TYPES_FILE   default "src/integrations/supabase/types.ts" (Supabase generated types)
 *
 * Exit 0 = no HARD failures. Non-zero = unresolved table refs or broken imports.
 * NOTE: heuristic — regex can't see everything. Confirm hits by hand; a clean
 *       run is necessary, not sufficient. Pair it with the manual walkthrough.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const SRC = process.env.SRC_DIR || 'src';
const TYPES = process.env.TYPES_FILE || 'src/integrations/supabase/types.ts';
let hardFail = 0;
const log = (s) => console.log(s);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|dist|build|\.git/.test(p)) walk(p, acc); }
    else if (/\.(t|j)sx?$/.test(e)) acc.push(p);
  }
  return acc;
}
const files = existsSync(SRC) ? walk(SRC) : [];
log(`=== V2P WIRING SCAN ===  files scanned: ${files.length}\n`);

// 1) UI no-ops / dead links
log('--- 1) UI no-op handlers & dead links ---');
const uiPatterns = [
  [/onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/, 'empty onClick handler'],
  [/on(?:Submit|Change)=\{\s*\([a-zA-Z]*\)\s*=>\s*\{\s*\}\s*\}/, 'empty event handler'],
  [/(?:href|to)=["']#["']/, 'dead link (#)'],
  [/\b(?:TODO|FIXME)\b/, 'TODO/FIXME marker'],
];
let uiHits = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
    for (const [re, label] of uiPatterns)
      if (re.test(ln)) { log(`  [warn] ${f}:${i + 1}  ${label}`); uiHits++; }
  });
}
if (!uiHits) log('  none');

// 2) Supabase table/column references vs schema
log('\n--- 2) Supabase table/column references vs schema ---');
const tables = new Set(), columns = new Set();
if (existsSync(TYPES)) {
  const t = readFileSync(TYPES, 'utf8');
  for (const m of t.matchAll(/([a-zA-Z0-9_]+):\s*\{\s*Row:/g)) tables.add(m[1]);       // each table has a Row
  for (const rm of t.matchAll(/Row:\s*\{([\s\S]*?)\}/g))
    for (const cm of rm[1].matchAll(/([a-zA-Z0-9_]+)\s*:/g)) columns.add(cm[1]);
  log(`  schema (best-effort parse): ${tables.size} tables, ${columns.size} distinct columns`);
} else {
  log(`  [info] ${TYPES} not found — skipping schema check (supply an information_schema dump instead)`);
}
if (tables.size) {
  let refHits = 0;
  const fromRe = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
  const colRe  = /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|order|filter)\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  const selRe  = /\.select\(\s*['"`]([^'"`]+)['"`]/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(fromRe))
      if (!tables.has(m[1])) { hardFail++; refHits++; log(`  [FAIL] ${f}: .from('${m[1]}') — table not in schema`); }
    if (columns.size) {
      for (const m of src.matchAll(colRe))
        if (!columns.has(m[1])) { refHits++; log(`  [warn] ${f}: filter column '${m[1]}' not found in any table`); }
      for (const m of src.matchAll(selRe))
        for (const c of m[1].split(',').map(s => s.trim().split(/[\s:(]/)[0]).filter(Boolean))
          if (c !== '*' && /^[a-zA-Z0-9_]+$/.test(c) && !columns.has(c))
            log(`  [warn] ${f}: select column '${c}' not found in any table`);
    }
  }
  if (!refHits) log('  all .from() table references resolve');
}

// 3) Local imports that don't resolve
log('\n--- 3) Local imports that do not resolve ---');
let impHits = 0;
const impRe = /import[^'"]*from\s*['"](\.[^'"]+)['"]/g;
const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(impRe)) {
    const base = resolve(dirname(f), m[1]);
    if (!exts.some(e => existsSync(base + e))) { hardFail++; impHits++; log(`  [FAIL] ${f}: import '${m[1]}' does not resolve`); }
  }
}
if (!impHits) log('  all local imports resolve');

log(`\n=== RESULT: ${hardFail === 0 ? 'no hard failures' : hardFail + ' hard failure(s)'} (heuristic — confirm by hand) ===`);
process.exit(hardFail === 0 ? 0 : 1);
```
> Also add a `.env`/env-var check by hand: confirm `VITE_SUPABASE_URL` / anon key (or Lovable's equivalents) are set, or Supabase calls fail silently and every data-driven element looks "dead."

### Appendix S — `pipeline/templates/functional-defects.template.csv`
```csv
id,route,element,defect_type,description,impact,fix_channel,evidence_before,retest_evidence,status,date
FD-001,/dashboard,"Delete button",no-op,"onClick empty; row not removed",blocks-core,Lovable prompt,evidence/phase0_5/dashboard-delete-before.png,evidence/phase0_5/dashboard-delete-after.png,open,<date>
FD-002,/reports,"Reports nav link",dead-route,"navigates to /reports but no route defined",blocks-core,Lovable prompt,,,open,<date>
FD-003,/orders,"list query",schema-drift,".select('total') but column renamed to amount",blocks-core,Lovable prompt,,,open,<date>
```
> `defect_type` ∈ {no-op, dead-route, schema-drift, broken-import, missing-env, mock-data, missing-error-state, integration-fail, unknown-intent}. `impact` ∈ {blocks-core, degrades, cosmetic}. `fix_channel` ∈ {Lovable prompt, migration, GitHub edit}.

---

## 17. Execution order (quick index for the agent)

1. **Phase 0** (§7): triage, restore green build, fix/keep/remove Codex changes, repair sync, round-trip test.
2. **Phase 0.5** (§7A): interaction map → static wiring scan → schema reconciliation → route-by-route walkthrough → fix loop → seed smoke tests → **🛑 Salma previews & signs off**. *Gate: engineering does not start until this passes.*
3. **Phase 1** (§8): access, inventory, threat model, staging, Lovable scan.
4. **Phase 2** (§9): RLS audit + active probing + edge/secret audit → fix Criticals/Highs → retest.
5. **Phase 3** (§10): input validation, auth config, headers, dependency/static checks.
6. **Phase 4** (§11): Playwright E2E + smoke + CI; prove regression catch (expands the Phase 0.5 smoke seed).
7. **Phase 5** (§12): k6 baseline + ramp; fix perf; hit targets.
8. **Phase 6** (§13): staging discipline, monitoring, restore-tested backups, incident plan, checklist.
9. **Phase 7** (§14): make pipeline config-driven, write README, dry-run, tag `v2p-1.0`.
10. **Deliver** (§15): findings register closed, evidence pack, final report.

**Cadence:** small PRs, CI green before merge, evidence captured at each ✅, ADR for each non-trivial call, stop at every 🛑. Report progress at the end of each phase in `apps/wilmet/reports/weekN.md`.
