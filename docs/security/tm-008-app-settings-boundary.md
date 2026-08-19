# TM-008 — app settings exposure boundary

**Threat:** `public.app_settings` is a generic JSON settings table. A direct `USING (true)` SELECT policy plus broad Data API table grants meant any future operational setting could become readable by anonymous/authenticated clients by default.

## Verified pre-state

Before remediation, the actual private/unpublished Lovable-managed Wilmet database showed:

- `app_settings` contained `0` rows;
- policy `app_settings readable by everyone` allowed SELECT to `{anon, authenticated}` with `USING (true)`;
- both `anon` and `authenticated` had broad table grants, including SELECT and mutation privileges;
- existing admin INSERT/UPDATE policies already restricted mutations to `admin` / `platform_admin`;
- no database function depended on the table.

The synchronized source showed three distinct consumers with different trust needs:

1. the public assistant needs only assistant availability fields before sign-in;
2. authenticated application UI needs only AI feature flags;
3. the admin settings page needs the known full settings groups.

Therefore simply removing anonymous SELECT would have broken legitimate current behavior.

## Required boundary

### Database table

- `anon`: no direct `app_settings` table privileges;
- `authenticated`: only `SELECT`, `INSERT`, `UPDATE` table grants;
- authenticated SELECT rows: RLS permits only `admin` / `platform_admin`;
- existing admin INSERT/UPDATE RLS remains authoritative.

### Public projection

Anonymous callers may receive only:

- `enabled`;
- `always_on`;
- `start_hour`;
- `end_hour`.

They must never receive the raw row, unknown future keys, or unknown JSON fields.

### Authenticated AI projection

Authenticated callers may receive only:

- `enabled`;
- `ocr`;
- `voice`;
- `dossier_audit`.

AI flags fail closed when missing, malformed, or unreadable.

### Admin projection

Only authenticated `admin` / `platform_admin` callers may receive the currently supported groups:

- `lead_assignment`;
- `assistant`;
- `ai_features`.

Unknown future settings are not automatically returned.

## Chosen implementation

Migration `20260819163158_app_settings_private_boundary.sql`:

- removes the broad public SELECT policy;
- creates admin-only authenticated SELECT RLS;
- revokes all direct table privileges from `anon`;
- reduces `authenticated` table grants to `SELECT`, `INSERT`, `UPDATE`.

Application code:

- introduces pure deny-by-default settings resolvers/projections;
- moves anonymous assistant settings to a server-side service-role read of only the `assistant` row followed by field projection;
- moves authenticated AI feature settings to an authenticated server function that returns only explicit AI flags;
- protects the full `getAppSettings` function with authentication + admin role checks and known-key filtering;
- keeps admin writes behind the existing authenticated admin boundary;
- moves the server-side AI enforcement read to the existing server-only service-role client so tightening client RLS cannot accidentally disable the authoritative server guard;
- aligns UI AI defaults with fail-closed server behavior.

The service-role key remains server-only and is never returned or imported into browser code.

## Rollback-safe database proof before merge

The exact grant/RLS candidate was applied inside `BEGIN ... ROLLBACK` against the actual managed Wilmet database.

The transaction verified:

- `anon` SELECT = denied;
- `anon` INSERT/UPDATE/DELETE/TRUNCATE = denied;
- `authenticated` SELECT/INSERT/UPDATE = retained;
- `authenticated` DELETE/TRUNCATE/TRIGGER/REFERENCES = denied;
- broad readable-by-everyone policy = absent;
- admin-only SELECT policy = present.

After `ROLLBACK`:

- the original broad policy was restored;
- original anonymous SELECT was restored;
- row count remained `0`.

No live staging state changed during the pre-merge proof.

## Regression tests

`app-settings.shared.test.ts` proves:

- public assistant projections strip unknown/sensitive sentinel fields;
- invalid assistant values use safe defaults;
- AI flags accept only explicit booleans and fail closed otherwise;
- unknown future settings keys and JSON fields cannot enter the known settings projection.

Existing AI abuse tests continue to exercise the shared fail-closed AI resolver.

## Deployment acceptance

After merge, do not close TM-008 until the actual managed environment proves separately:

- migration `20260819163158` is ledgered;
- broad public SELECT policy is absent;
- admin-only SELECT policy exists;
- `anon` has no direct table privileges;
- `authenticated` has only SELECT/INSERT/UPDATE table grants;
- live row count/data are unchanged;
- source synchronization is at the merge SHA;
- public assistant projection still responds safely with assistant disabled/defaulted when no setting row exists;
- real-JWT authenticated/admin behavior remains part of the broader staging E2E release evidence where provider credentials are required.

A GitHub merge or successful build alone is not deployment evidence.
