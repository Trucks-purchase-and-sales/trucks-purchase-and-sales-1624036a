# Threat Model — <APP NAME>

_Date: <yyyy-mm-dd> · Author: <name> · Environment audited: staging_

## Assets & sensitivity

| Asset (table/bucket/function) | Data type | Sensitivity (PII/cred/payment/none) | Who SHOULD access |
| ----------------------------- | --------- | ----------------------------------- | ----------------- |

## Roles

| Role          | Description             | Intended access |
| ------------- | ----------------------- | --------------- |
| anon          | unauthenticated visitor |                 |
| authenticated | logged-in user          | own rows only   |
| admin         | privileged              |                 |

## Threats & current control

| Asset      | Threat                             | Realistic? | Current control   | Status (verify/ok/gap) |
| ---------- | ---------------------------------- | ---------- | ----------------- | ---------------------- |
| <table>    | anon read                          |            | RLS policy        | to verify (Phase 2)    |
| <table>    | anon write                         |            | RLS policy        | to verify              |
| <table>    | cross-user read                    |            | auth.uid() policy | to verify              |
| <function> | unauth call / privilege escalation |            | JWT check         | to verify              |
| bundle     | secret exfiltration                |            | server-side only  | to verify              |

## Open questions to resolve in Phase 2

-
