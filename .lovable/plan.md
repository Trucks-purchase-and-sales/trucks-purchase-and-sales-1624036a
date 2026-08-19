# GitHub sync diagnostic (read-only)

No files, commits, database state, or connections were changed.

## 1. Connected GitHub owner/repository

Not visible from inside the project workspace. The only Git remotes configured here are Lovable-internal:

```text
origin     https://<token>@git.private.lovable-gcp.code.storage/452845ef-b656-4272-a382-1de28e2d1f1e.git
secondary  s3://lovable-repositories/452845ef-b656-4272-a382-1de28e2d1f1e.git
```

There is no `github.com` remote in the workspace. The GitHub link is held by the Lovable platform's Git-sync record (workspace Git settings), not by this checkout, so the authoritative owner/repo path must be read there. Tracked docs still reference the pre-transfer path `SalmaAnhm/trucks-purchase-and-sales` (`README.md`, `docs/engineering/github-baseline.md`), which is documentation only and does not prove the current connection target.

## 2. Latest commit Lovable can see

Current workspace HEAD is on an edit branch:

```text
31e6115  Work in progress                                (edit/edt-0d3cc478-...)
3d7830c  Security: add CSP report-only baseline (#47)     <- last synced mainline commit
143cece  Docs: record CSP report-only inventory
1695cca  Test: cover CSP report-only boundary
b370bcb  Security: add CSP report-only baseline
```

So the newest mainline commit Lovable has ingested is `3d7830c9661c912307dd0dc265308dd5f21843a6`. `acfc0c06f621bc9d1b43333a7ada0d0b06f7ef56` is not present in this workspace's history at all.

## 3. Why Lovable is stuck at 3d7830c

Lovable does not poll GitHub; it receives webhook events from the GitHub App installation on the connected repository. A repository transfer to the `Trucks-purchase-and-sales` organization changes the repository's owner and the App installation that covers it:

- the old installation (personal account `SalmaAnhm`) no longer covers the repo, so its webhooks stop arriving;
- the new organization installation either does not exist yet or was not granted access to the transferred repository, so no webhook is delivered for commits pushed after the transfer;
- Lovable therefore keeps the last commit it successfully ingested before the transfer — `3d7830c`.

This is a connection/installation issue, not a history divergence: nothing was lost, Lovable simply has not been told about `acfc0c0`.

Note: this diagnosis is based on the observable state (no GitHub remote here, mainline frozen exactly at the pre-transfer commit) plus how Lovable's Git sync works. Confirmation requires viewing the Git-sync record and the GitHub App installation, neither of which is readable from this sandbox.

## 4. Safest no-code, no-history-loss remediation

Do not create a new repository, and do not reset or force-push anything.

Recommended order:

1. On GitHub: open `https://github.com/organizations/Trucks-purchase-and-sales/settings/installations` and confirm the **Lovable** GitHub App is installed on the organization and has repository access to the transferred repo (grant it if missing). This alone often restores webhook delivery.
2. In Lovable: open the workspace **Git settings** for this project and check the recorded repository path. If it still points at `SalmaAnhm/...`, re-point/refresh the connection to the organization path. Re-pointing to the *same* repository is non-destructive — the remote history is untouched and Lovable fast-forwards to `acfc0c0`.
3. Verify: after the refresh, the project's latest commit should read `acfc0c06f621bc9d1b43333a7ada0d0b06f7ef56`. If it does not, push a trivial no-op commit to `main` (for example a whitespace-free docs touch) to trigger a fresh webhook and confirm delivery is working.
4. Only if steps 1–3 fail: disconnect and reconnect Git sync **to the existing organization repository**. Disconnect does not delete the GitHub repo or its history; it only removes the link.

If the reconnect UI offers to create a repository, decline it — always pick the existing `Trucks-purchase-and-sales/<repo>` from the picker.

## Residual risk

Because Lovable's mainline is behind, any edit made in Lovable now branches from `3d7830c` and would need a merge (never a force-push) against `acfc0c0`. Safest is to make no Lovable edits until the sync is restored.
