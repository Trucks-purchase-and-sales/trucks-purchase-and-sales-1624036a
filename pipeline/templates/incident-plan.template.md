# Incident Response Plan — <APP NAME>

## Detection

- Sources: Sentry alerts, uptime check, user report, security scan.

## Severity & first move

| Severity | Example                  | First action                                        |
| -------- | ------------------------ | --------------------------------------------------- |
| SEV1     | data leak / unauth write | take feature offline / revoke key, then investigate |
| SEV2     | broken critical journey  | roll back to last green release                     |

## Roles

- Incident lead: <name> · Comms: <name> · Fixer: <name>

## Runbook

1. Contain (disable route / rotate key / restrict policy).
2. Assess blast radius (Supabase logs, affected tables/users).
3. Notify per obligations (GDPR/CCPA if PII).
4. Remediate + retest with the probe suite.
5. Post-mortem within 48h; add a regression test so it can't recur.
