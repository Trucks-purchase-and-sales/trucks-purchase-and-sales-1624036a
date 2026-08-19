# AI abuse-control contract

**Threat-model findings:** TM-004 (voice capacity/cost abuse), TM-005 (OCR capacity and request amplification)  
**Scope:** authenticated optional AI features only (`voice`, `ocr`)

## Security objective

External AI processing must never become implicitly available just because configuration is missing or degraded. When explicitly enabled, each authenticated caller is bounded by application quotas, OCR/voice payloads are validated before gateway processing, and limiter failure does not turn into unlimited access.

## Closed-by-default feature state

`ai_features` is deny-by-default on both server and UI:

- missing setting row -> disabled;
- unreadable settings -> disabled;
- malformed/non-boolean values -> disabled;
- each feature requires both `enabled: true` and its own explicit flag.

This also applies to dossier audit because it uses external AI processing.

## Application quotas

The existing database-backed `rate_limit_check` control is reused so enforcement does not depend on one application process or in-memory state.

| Feature | Scope | Window | Limit |
| --- | --- | ---: | ---: |
| Voice | authenticated user | 10 minutes | 15 requests |
| Voice | authenticated user | 24 hours | 200 requests |
| Voice | client IP | 10 minutes | 60 requests |
| OCR | authenticated user | 10 minutes | 6 requests |
| OCR | authenticated user | 24 hours | 50 requests |
| OCR | client IP | 10 minutes | 24 requests |

The user quota is authoritative for authenticated abuse control. The IP quota is a wider safety net for many accounts originating from one source. If the deployment does not expose a trustworthy client IP header, the application logs the condition and continues to enforce authenticated-user quotas instead of placing all users into one shared `unknown` IP bucket.

If the rate-limit dependency cannot make a trustworthy decision, the AI call fails closed with HTTP 503. Exhausted application quota returns HTTP 429 with `Retry-After`.

## Input budgets

### Voice

Approved MIME types:

- `audio/webm`
- `audio/mp4`
- `audio/m4a`
- `audio/ogg`
- `audio/wav`
- `audio/x-wav`
- `audio/mpeg`

Maximum decoded clip size: **6 MiB**.

### OCR

Approved MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`
- `application/pdf`

Limits:

- maximum 6 image/PDF data URLs per scan (existing schema limit);
- maximum **4 MiB decoded per image/PDF**;
- maximum **12 MiB decoded across all image/PDF inputs**;
- maximum 4 extracted text documents and 14,000 characters per document (existing schema limits).

Only base64 data URLs with an approved MIME are accepted. MIME, base64 structure, decoded size and aggregate size are checked before an OCR audit row is created or any payload is sent to the external AI gateway.

## Stable failure semantics

- malformed base64: 400;
- decoded payload over budget: 413;
- disallowed MIME: 415;
- application quota exhausted: 429 + `Retry-After`;
- limiter unavailable, missing AI gateway configuration, disabled/misconfigured feature, or gateway outage: 503.

Provider credit/quota details are logged server-side but are not exposed as internal billing information to end users.

## Operational visibility

Every limiter decision is recorded through the existing database-backed limiter buckets. When a bucket reaches at least 80% of its configured threshold, the application emits a structured `[ai-abuse] quota pressure` warning containing only the feature, bucket, scope and counters; it does not log raw IP addresses, user IDs, audio, images or OCR text.

Production observability must route these structured warnings into the chosen alerting platform before final sign-off. The code provides the alert signal; provider-level alert routing remains an operations release gate and must not be represented as configured until it is verified.

## Regression evidence

`src/lib/ai-abuse.test.ts` covers:

- missing/malformed feature configuration fails closed;
- only explicit boolean feature opt-ins are honored;
- allowed voice input succeeds through the budget parser;
- disallowed OCR MIME is rejected;
- per-file and aggregate decoded OCR limits return 413 semantics;
- malformed base64 is rejected;
- limiter dependency failure maps to fail-closed 503;
- exhausted quota maps deterministically to 429.

A deployed staging run is still required to prove real authenticated requests reach 429 and valid explicitly enabled voice/OCR flows continue to work with the production runtime/gateway configuration.
