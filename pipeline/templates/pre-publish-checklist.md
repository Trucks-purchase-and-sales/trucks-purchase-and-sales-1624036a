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

- Signed: **\_\_\_\_\_\_\_\_\_\_** · Date: **\_\_\_\_\_\_\_\_\_\_**
