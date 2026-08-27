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

## If a real restore test isn't possible with the access you have

Not every Lovable-managed app grants direct Supabase account access
(see this pipeline's own dry-run notes on Wilmet, where this was
exactly the case). If so, don't fake this section — document the
actual mechanism available (e.g. a platform-level in-place restore
panel), why an end-to-end restore test isn't safe/possible with
current access, and treat it as a named residual risk rather than a
checked box.
