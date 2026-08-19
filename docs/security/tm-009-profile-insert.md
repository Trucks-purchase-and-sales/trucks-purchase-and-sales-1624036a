# TM-009 — profile self-insert integrity

## Status

**Confirmed and remediated in code; staging deployment pending PR merge.**

Assessment target: the existing Wilmet database attached to the Lovable project. No database clone or separate Supabase project was used.

## Finding

`public.profiles` had an authenticated INSERT policy:

```sql
profiles_insert_self: WITH CHECK (id = auth.uid())
```

The existing `trg_profile_self_update_guard` protects privilege-adjacent fields only on `UPDATE`. Therefore an authenticated user whose profile row is missing could recreate it and choose fields that normal self-updates cannot modify.

`public.handle_new_user()` already provisions profiles at account creation as a `SECURITY DEFINER` function owned by `postgres`. Direct browser-side profile INSERT is therefore not required for the normal signup path.

## Active exploit proof

A rollback-only probe used the existing client identity:

`e750c236-fa2c-4564-b523-4b4bcad7b88a`

Inside one transaction the existing profile was temporarily removed, the session was switched to the `authenticated` role with that user's JWT subject, and a replacement profile was inserted with attacker-chosen values:

- `partner_kind = seller`
- `staff_scope = both`
- `commission_rate = 99.99`
- `is_external = true`
- `referral_code = TM009-ELEVATED`

The insertion succeeded. The transaction was rolled back and the original profile was verified intact:

- email restored to the real account email;
- `partner_kind = client`;
- `staff_scope IS NULL`;
- `commission_rate IS NULL`;
- `is_external = false`;
- `referral_code IS NULL`.

This does not grant an application role because `public.user_roles` is a separate authorization table. It does allow self-assertion of account/business state that other application logic may trust, so the boundary must fail closed.

## Remediation

Migration `20260819003000_profile_insert_fail_closed.sql`:

1. drops `profiles_insert_self`;
2. revokes `INSERT` on `public.profiles` from `authenticated`;
3. revokes `INSERT` from `anon` as defense in depth.

A missing profile is now treated as a provisioning/integrity incident and must be repaired by trusted server/service-role administration rather than an untrusted browser.

## Rollback-only remediation verification

The candidate migration was applied inside `BEGIN ... ROLLBACK` against the Lovable database.

Assertions:

- authenticated user attempts to recreate the missing profile with privilege-adjacent fields: **BLOCKED**;
- trusted `service_role` profile insertion: **PRESERVED**;
- rollback restored the original `profiles_insert_self` policy before permanent deployment: **PASS**;
- rollback restored the authenticated INSERT grant before permanent deployment: **PASS**;
- original client profile contents restored after test: **PASS**.

No persistent application row was changed by the verification.

## Post-deployment acceptance

After merge and permanent application to the Lovable database:

- `profiles_insert_self` must be absent;
- `authenticated` and `anon` must not have INSERT privilege on `public.profiles`;
- `service_role` must retain trusted INSERT capability;
- `handle_new_user()` must remain `SECURITY DEFINER` owned by `postgres`;
- existing profile self-UPDATE guard must remain present;
- benign profile UPDATE must still work through the normal application flow;
- migration version `20260819003000` must be recorded in the existing Lovable database migration ledger.
