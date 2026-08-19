# Wilmet Incident Response Runbook

**System:** Wilmet Trucks  
**Repository:** `SalmaAnhm/trucks-purchase-and-sales`  
**Environment:** staging/pre-production until issue #9 release gates are closed  
**Initial version:** 2026-08-19

## 1. Purpose

This runbook defines the minimum repeatable process for detecting, containing, investigating, recovering from, and documenting a Wilmet production incident.

It is an operational control, not a claim that Wilmet is production-ready. Provider access, monitoring destinations, backup/restore proof, branch protection, hosted Supabase Auth configuration, and company escalation contacts remain separate release gates in issue #9.

The runbook follows the same engineering principle used throughout the internship:

> Do not treat an implementation claim as evidence. Preserve independent evidence of what happened, what was changed, and what was verified before returning the system to normal service.

## 2. Scope

This runbook covers incidents involving:

- unauthorized access or suspected personal/business data exposure;
- compromised runtime, Supabase, GitHub, deployment, or external-provider credentials;
- broken application deployment or unsafe code release;
- database corruption, migration failure, or unrecoverable data inconsistency;
- outage or degraded behavior of Supabase, Lovable/runtime infrastructure, or the external AI gateway;
- AI/OCR/voice cost abuse, quota pressure, or abnormal external-processing traffic;
- authentication/session compromise;
- Storage/photo access incidents;
- severe authorization/RLS regressions.

The main trust boundaries are documented in `docs/security/threat-model.md`. PostgreSQL RLS remains the canonical row-authorization boundary. The `SUPABASE_SERVICE_ROLE_KEY` is a privileged server secret because it bypasses RLS.

## 3. Non-negotiable safety rules

During an incident:

1. **Preserve evidence before making broad changes when safety permits.** Record timestamps, affected environment, Git SHA, observed requests/errors, relevant provider event IDs, and sanitized screenshots/logs.
2. **Do not copy secrets, access tokens, customer payloads, OCR content, or sensitive personal data into GitHub issues, PRs, chat, or the evidence pack.** Redact evidence.
3. **Do not run `supabase db reset --linked` against staging/production.** Recovery must use reviewed, isolated, and forward-safe procedures.
4. **Do not weaken RLS, authentication, rate limiting, or input validation to restore availability.** Prefer safe degradation or temporary feature shutdown.
5. **Do not rewrite already-applied migration history.** Use a reviewed forward-only corrective migration when schema/security state must change.
6. **Do not trust the browser or UI as proof of authorization.** Verify the database/server boundary.
7. **Do not declare recovery because the page loads.** Re-test the original failure and the relevant security/functional invariant.
8. **Do not make undocumented provider-console changes.** Record what changed, who approved it, and the verification evidence.

## 4. Incident roles

CCSG must assign named people before production. Until then, the runbook uses role names rather than invented contacts.

| Role | Responsibility |
| --- | --- |
| Incident Lead | Owns severity, coordinates response, approves containment/recovery decisions, keeps the timeline. |
| Technical Responder | Investigates application/runtime/database behavior and implements reviewed containment/remediation. |
| Security Reviewer | Challenges authorization/security assumptions and verifies evidence independently where possible. |
| Data/Privacy Owner | Determines whether personal-data exposure may require legal/privacy escalation or notification. |
| Client/Business Contact | Coordinates client-facing impact and business decisions. |
| Provider Owner | Holds access to GitHub, Lovable, Supabase, monitoring, email, AI provider, and other provider consoles. |

A single person may hold multiple roles in a small internship/staging context, but production approval and independent security verification should not rely solely on the same tool/person that generated the change.

## 5. Severity model

### SEV-1 — Critical

Use when there is credible evidence of one or more of:

- active unauthorized access to sensitive/customer/financial data;
- exposed or compromised `service_role` or equivalent privileged credential;
- destructive database corruption or loss affecting critical records;
- broad authorization/RLS bypass;
- active account takeover affecting privileged internal/admin users;
- uncontrolled production behavior where continued operation can materially increase harm.

**Default action:** contain first, even if availability is reduced.

### SEV-2 — High

Use for serious but bounded impact, for example:

- a broken deployment blocking a critical buyer/seller/internal journey;
- scoped authorization defect with no evidence of broad exploitation;
- sustained third-party outage affecting a critical function;
- severe AI cost abuse or rate-limit bypass without confirmed data exposure;
- recovery risk where data remains intact but safe operation is uncertain.

### SEV-3 — Moderate

Use for limited degradation with a safe workaround and no credible sensitive-data exposure or integrity loss.

Severity may be raised at any time as evidence changes.

## 6. Incident lifecycle

### Phase A — Detect and declare

Record immediately:

- incident ID, e.g. `INC-YYYYMMDD-NN`;
- UTC timestamp first observed;
- reporter/detection source;
- affected environment and public/runtime URL;
- current Git `main` SHA and deployed/Lovable SHA if known;
- affected feature/role/data class;
- initial severity and reason;
- whether the incident is ongoing.

Create a private incident record appropriate to CCSG policy. Do not put sensitive evidence in a public/shared issue.

### Phase B — Contain

Choose the smallest action that stops harm without destroying evidence.

Examples:

- disable an optional AI/OCR/voice feature when it is the affected boundary;
- stop or roll back a broken application deployment to a known-good reviewed Git revision;
- revoke/rotate a compromised credential through the owning provider;
- invalidate affected sessions when session compromise is credible and provider controls support it;
- temporarily disable a vulnerable route/operation rather than weakening its authorization;
- freeze risky write operations during suspected database corruption;
- use rate-limit/feature controls to stop abuse rather than bypassing validation.

Record every containment action and timestamp.

### Phase C — Investigate

Build a testable hypothesis and collect evidence.

Check, as relevant:

- Git commit/PR history and release timing;
- GitHub Actions results and artifacts;
- Lovable/runtime deployment state;
- server/API errors and request metadata;
- Supabase Auth/session events available to the operator;
- PostgreSQL catalog, RLS policies, grants, triggers, migration ledger, and relevant data integrity checks;
- Storage policy/object ownership state;
- rate-limit/quota-pressure logs;
- external AI/provider availability and usage dashboards;
- whether the original behavior reproduces with an anonymous, authenticated, scoped, or privileged identity.

Prefer read-only inspection first. For database experiments, use isolated environments or `BEGIN ... ROLLBACK` when appropriate.

### Phase D — Eradicate / remediate

For application-owned changes:

1. define the root cause and acceptance criteria;
2. create one focused branch;
3. implement the smallest coherent fix;
4. add regression evidence that would fail before the fix where practical;
5. open a PR;
6. require CI/security checks;
7. deploy separately from merge;
8. verify the actual runtime/database state.

For provider-owned configuration:

1. record the exact provider setting changed;
2. avoid recording secret values;
3. retain a redacted screenshot/config snapshot when appropriate;
4. re-query or retest the provider behavior after the change.

### Phase E — Recover

Recovery must restore both service and security invariants.

Before returning to normal service:

- the original failure no longer reproduces;
- relevant authorization/security checks pass;
- critical affected user journey passes;
- database/catalog state is consistent when DB changes were involved;
- monitoring shows no continuing abnormal pattern;
- temporary containment controls are either intentionally retained or safely removed;
- deployment/runtime state matches the reviewed Git revision;
- any rotated secrets are updated only in approved secret stores and stale credentials are revoked;
- evidence is retained.

### Phase F — Post-incident review

Document:

- impact and affected period;
- root cause;
- contributing conditions;
- detection gap;
- containment/remediation timeline;
- evidence used to prove recovery;
- what control failed or was missing;
- follow-up issue(s), owner, and target date;
- whether the threat model, tests, monitoring, recovery docs, or release checklist must change.

Do not close the incident while a serious unresolved condition is being silently treated as accepted risk. Accepted risk must be explicit and owned.

## 7. Scenario playbooks

### 7.1 Suspected data exposure or authorization bypass

Examples: cross-seller read, out-of-scope staff access, child-resource access escaping the parent, exposed commission data, public access to private Storage.

**Contain**

- disable the vulnerable operation/route if exploitation may continue;
- do not broaden access to make legitimate UI flows work;
- if a signed-link/storage capability is involved, stop issuing new affected links and review the relevant Storage boundary;
- consider session invalidation for affected identities if account compromise is suspected.

**Investigate**

- identify the parent business object and intended actor scope;
- inspect actual deployed RLS/policies/grants, not only migration text;
- reproduce with least-privileged identities;
- determine which rows/data classes were potentially reachable;
- preserve sanitized request/DB evidence.

**Recover**

- enforce authorization at the database/server boundary;
- add a regression/real-JWT test for the exploit path;
- deploy and re-test the original access attempt;
- involve the Data/Privacy Owner if personal data may have been exposed.

### 7.2 Compromised credential or secret

Examples: Supabase service-role credential, provider API token, GitHub token, deployment credential, SMTP/AI provider key.

**Contain**

- revoke/rotate the affected credential at the provider as the first security boundary;
- remove/replace it in the approved runtime secret store;
- redeploy/restart only as required for the new credential to take effect;
- if a repository revision ever contained the secret, do not assume deleting the file fixes exposure.

**Investigate**

- identify where the credential was exposed and its privilege scope;
- review provider/audit logs available for suspicious use;
- run full-history Gitleaks and inspect likely exposure windows;
- determine whether related sessions/secondary credentials also require revocation.

**Recover**

- prove the old credential no longer works;
- prove the application works with the rotated credential;
- verify no secret value was committed to evidence/docs;
- create follow-up controls if the exposure path can recur.

### 7.3 Broken deployment or unsafe release

**Contain**

- stop further promotion;
- identify the last known-good reviewed Git commit;
- revert/redeploy application code through the controlled release path when possible;
- if a database migration is involved, do not destructively reset or rewrite applied history.

**Investigate**

- compare deployed SHA to GitHub `main` and the intended release SHA;
- inspect PR Build results and deployment/runtime errors;
- determine whether the failure is code, configuration, migration, or provider state.

**Recover**

- application-only failure: deploy the reviewed known-good revision or a focused corrective PR;
- database failure: use a reviewed forward-only corrective migration and verify catalog/data invariants;
- re-run affected critical journey and security checks before normal service.

### 7.4 Database corruption, migration failure, or data inconsistency

**Contain**

- stop risky writes if continuing them can increase corruption;
- capture migration ledger, catalog state, timestamps, and relevant integrity evidence;
- avoid destructive linked reset commands.

**Investigate**

- distinguish data corruption from migration-ledger drift or application logic failure;
- inspect exact applied migrations and database catalog;
- compare against the reviewed repository and recovery baseline when available;
- use an isolated environment for destructive recovery experiments.

**Recover**

- follow `docs/recovery/database-reproducibility.md` and the approved restore procedure;
- restore/reconstruct in isolation first when practical;
- compare tables, functions, RLS, grants, policies, triggers, and required Storage/reference configuration;
- run critical smoke/security checks;
- retain restore evidence.

**Important:** Wilmet's full historical baseline/isolated restore proof is still an open P0 gate, so this playbook cannot yet claim a proven RPO/RTO.

### 7.5 Supabase, Lovable/runtime, or external-service outage

**Contain / degrade safely**

- determine which trust boundary is unavailable;
- fail closed for security decisions that cannot be made reliably;
- disable optional AI/OCR/voice processing if its provider is unstable;
- do not return fake success for persistence operations;
- do not bypass Auth/RLS because the normal path is unavailable.

**Investigate**

- verify provider status/health using approved provider evidence;
- inspect application/server error rates and affected routes;
- confirm whether failed operations were persisted, partially persisted, or rejected.

**Recover**

- verify provider recovery;
- run critical buyer/seller/internal smoke flows;
- reconcile any queued/ambiguous business operations before retrying them;
- confirm deterministic user-facing success/failure semantics.

### 7.6 AI/OCR/voice cost abuse or quota pressure

**Contain**

- keep optional AI features closed unless explicitly enabled;
- disable the affected optional feature if abuse is ongoing;
- retain authenticated-user quotas as the authoritative control;
- do not weaken MIME, byte, request, or rate limits to restore service.

**Investigate**

- inspect `[ai-abuse] quota pressure` warnings and sanitized request metadata;
- determine whether the abuse is account-scoped, IP-correlated, automated, or caused by a limiter/provider failure;
- verify whether the limiter failed closed with 503 or produced intended 429 responses;
- inspect external-provider usage/cost evidence without copying sensitive prompts/content.

**Recover**

- prove valid enabled traffic still works;
- prove abusive traffic reaches deterministic 429/413/415/503 boundaries as applicable;
- rotate provider credentials only if compromise is suspected, not merely because usage was high;
- feed the incident into quota/monitoring thresholds and issue #24 runtime evidence.

## 8. Authentication/session compromise considerations

Authentication incidents require provider-level evidence in addition to application behavior.

- Hosted Supabase Auth configuration is tracked separately in issue #25.
- Application password validation does not prove provider password/session policy.
- Session/token revocation behavior must be verified against the actual hosted project before the production runbook can claim a guaranteed invalidation procedure.
- For privileged-account compromise, contain access at the provider/account boundary and verify the user cannot continue meaningful access with existing sessions/tokens.

Never document or test this by exposing real user tokens in GitHub artifacts.

## 9. Evidence checklist

Retain sanitized evidence appropriate to severity:

- incident timeline;
- affected environment and Git/deployment SHA;
- issue/PR IDs for remediation;
- relevant CI run IDs and artifacts;
- redacted runtime/provider error evidence;
- migration/catalog verification when database state changed;
- real-JWT/browser/runtime retest result when authorization or user journeys were affected;
- credential rotation confirmation without secret values;
- recovery/restore evidence when data integrity was affected;
- monitoring evidence that the abnormal condition stopped;
- final root-cause and post-incident review.

Evidence should show the lifecycle:

`detected -> reproduced -> contained -> fixed -> deployed -> independently retested -> closed`

## 10. Return-to-service checklist

An Incident Lead may recommend normal service only when all applicable items are true:

- [ ] active harm is contained;
- [ ] root cause is understood well enough to avoid unsafe recovery;
- [ ] remediation/rollback is reviewed and deployed;
- [ ] original failure is re-tested and no longer reproduces;
- [ ] relevant authorization/security invariant passes;
- [ ] affected critical user journey passes;
- [ ] database integrity/catalog state is verified when applicable;
- [ ] compromised credentials/sessions are revoked or otherwise proven unusable when applicable;
- [ ] monitoring shows no continuing abnormal behavior;
- [ ] temporary controls are documented;
- [ ] evidence is retained;
- [ ] privacy/client escalation decision is recorded when applicable;
- [ ] follow-up actions have owners.

## 11. Break-glass changes

A break-glass change is allowed only when delay would materially increase harm and the normal reviewed path cannot respond fast enough.

Minimum requirements:

1. Incident Lead records why normal process is insufficient.
2. Scope the emergency change to the smallest reversible containment action.
3. Preserve the pre-change state/evidence.
4. Do not perform destructive database reset/history rewriting.
5. Record exact provider/config/code change and actor.
6. As soon as containment is stable, reconcile the change back into reviewed Git/configuration documentation.
7. Run the normal regression/security checks.
8. Obtain post-change review and close the bypass path.

For GitHub `main`, the intended release-governance model is PR-only changes with required CI and no routine bypass. If emergency repository-rule bypass is ever used, it must be incident-scoped and recorded.

## 12. Open operational dependencies before production

This runbook intentionally does not invent unresolved company/provider details. Issue #9 must retain or resolve at least:

- named CCSG Incident Lead / security / privacy / client contacts;
- monitoring and alert-routing destination plus on-call ownership;
- uptime checks and alert thresholds;
- branch protection/repository rules and documented break-glass authority;
- protected staging E2E credentials and real-JWT evidence;
- hosted Supabase Auth management evidence and privileged MFA policy;
- authoritative database baseline and isolated restore evidence;
- backup retention, backup owner, RPO, and RTO;
- provider support/escalation contacts;
- legal/privacy notification decision process;
- AI provider usage/cost alerting and issue #24 runtime verification.

Until these are resolved, the runbook is **implemented documentation**, not fully verified production incident-response capability.

## 13. Exercise and maintenance

Before production sign-off, run at least one tabletop/drill against this document using a safe staging scenario such as:

- simulated compromised service credential (no real secret disclosure);
- broken application deployment;
- failed AI provider / quota-pressure condition;
- isolated database recovery exercise after the baseline exists.

Record what was ambiguous or impossible and update the runbook through a reviewed PR.

Revisit this document after any material architecture, provider, authentication, recovery, or monitoring change.
