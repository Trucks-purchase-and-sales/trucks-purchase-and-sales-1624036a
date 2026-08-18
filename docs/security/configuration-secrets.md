# Configuration and secret-management boundary

## Purpose

Wilmet must not depend on committed runtime configuration or credentials. Environment-specific values belong in the deployment platform / developer environment, not in Git history.

## Repository policy

- `.env` and `.env.*` are ignored.
- `.env.example` is the only environment template that may be committed.
- The template contains variable names only; it must never contain real credentials.
- `VITE_*` values are browser-visible build-time configuration and must never contain secrets.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses RLS. It must exist only in the trusted server runtime / secret store.

## Supabase variables currently required by the application

Client/browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server runtime:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)

The generated client falls back to the non-`VITE_` publishable variables during SSR. The admin client requires the service-role key only when privileged server functionality is invoked.

## Preventive control

Pull requests run Gitleaks against full Git history before merge. This supplements, rather than replaces, the deployment platform's secret store and GitHub's repository security controls.

## Existing history / rotation rule

Removing a tracked `.env` file from the current tree does **not** remove its historical versions from Git history. If any historical revision contained an actual secret (service-role key, provider API key, password, private token, etc.), deletion is not remediation by itself: the credential must be revoked/rotated at the provider. History rewriting is optional for exposure reduction after rotation, but rotation is the security boundary.

This remediation intentionally does not copy environment values into documentation, issues, PR bodies, or chat transcripts.

## Verification / acceptance criteria

1. `.env` is absent from the PR tree.
2. `.gitignore` blocks `.env` and `.env.*` while allowing `.env.example`.
3. `.env.example` contains no values.
4. Gitleaks passes on the repository history, or any hit is triaged and the affected credential is rotated before merge.
5. Unit tests and production build pass without a committed `.env`.

## Residual operational action

Deployment owners must confirm required production values exist in the Lovable Cloud / runtime secret configuration before deployment. A successful source build does not prove that production runtime secrets are configured correctly.
