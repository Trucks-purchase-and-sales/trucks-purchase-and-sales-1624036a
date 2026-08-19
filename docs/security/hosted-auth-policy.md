# Hosted Supabase Auth production policy

## Why this is a release gate

Wilmet uses Supabase Auth directly from the browser for password sign-up, sign-in and recovery. Application UI checks therefore improve UX but are not an authoritative security boundary: a caller can address Supabase Auth endpoints directly. Production sign-off requires the hosted Auth verifier to enforce the production controls independently.

Issue #25 tracks this P0 gate.

## Wilmet new-password rule

Newly created and changed passwords must contain **at least 15 characters**.

The application rule is centralized in `src/lib/password-policy.ts` and is used by sign-up and password recovery. It intentionally does not require arbitrary uppercase/lowercase/digit/symbol composition. The hosted identity provider remains responsible for non-bypassable password verification and, where available, compromised/common-password screening.

Login does **not** apply the new-password minimum before sending credentials to Supabase. This is intentional: changing the creation policy must not strand an existing legitimate account whose historical password predates the new policy. Existing users transition to the stronger rule when they create/change a password.

## Blocking hosted configuration controls

The read-only audit in `.github/workflows/supabase-auth-audit.yml` treats these as release-blocking:

- `password_min_length >= 15`;
- `mailer_autoconfirm = false`;
- `mailer_allow_unverified_email_sign_ins = false`;
- `refresh_token_rotation_enabled = true`;
- `security_update_password_require_reauthentication = true`;
- `security_captcha_enabled = true`;
- `security_manual_linking_enabled = false`;
- `external_anonymous_users_enabled = false`.

These checks are deliberately explicit and fail closed when a required Management API field is absent.

## Advisory configuration captured for review

The audit also reports, without pretending they are already enforced at the user-role layer:

- compromised-password/HIBP protection;
- secure email-change behavior;
- TOTP MFA capability;
- site URL and redirect allowlist;
- JWT/session settings;
- Auth rate-limit values;
- CAPTCHA provider;
- email/phone provider state.

MFA capability alone does not prove that privileged Wilmet users are required to enroll and use MFA. That needs a separate privileged-role enrollment/enforcement E2E check before release.

## Read-only audit workflow

The workflow uses Supabase's Management API `GET /v1/projects/{ref}/config/auth`. It requires a GitHub secret:

```text
SUPABASE_ACCESS_TOKEN
```

Use the narrowest available token that can read Auth configuration. The workflow never logs or retains the raw Management API response. `scripts/audit-supabase-auth.ts` writes a strict whitelist of non-secret configuration fields to `test-results/supabase-auth-audit.json`, and the raw response is removed from the runner even when the audit fails.

The sanitized report is retained as a 30-day workflow artifact. A release candidate should copy the reviewed result into durable release evidence rather than relying only on an expiring artifact.

## Controls still requiring provider/application verification

A passing configuration audit is necessary but not sufficient. Production sign-off still requires:

- successful/failed email-confirmation flow through the real production hostname;
- recovery/reset flow and redirect allowlist validation;
- custom production SMTP and mail-delivery verification;
- signup/sign-in/recovery abuse tests proving configured CAPTCHA/rate limits are effective;
- refresh-token/session behavior validation;
- privileged-role MFA enforcement and recovery process;
- disabled/banned-account session invalidation behavior;
- review of the password compromised/common-password control available for the actual Supabase plan.

Do not mark issue #25 complete from the application-side password change alone.
