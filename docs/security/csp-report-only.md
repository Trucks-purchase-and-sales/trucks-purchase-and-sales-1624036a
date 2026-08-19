# Wilmet CSP report-only baseline

**Status:** implementation candidate; runtime observation still required  
**Environment:** Wilmet Lovable staging / pre-release  
**Date:** 2026-08-19

## Purpose

Wilmet already sends baseline browser hardening headers, but an enforcing Content Security Policy has intentionally been deferred until the application's real browser dependencies are inventoried. This document records the first CSP step: a **report-only** policy that cannot block production behavior.

The security objective is to reduce XSS/content-injection impact without guessing a policy that silently breaks authentication, TanStack hydration, Lovable preview behavior, Supabase traffic, fonts, or vehicle media.

## Source inventory used for the initial policy

Repository inspection confirmed these current browser-relevant dependencies:

| Category | Current evidence | Initial report-only treatment |
| --- | --- | --- |
| Application JS/CSS/assets | TanStack/Vite application assets served by Wilmet | `'self'` |
| Google Fonts stylesheet | `fonts.googleapis.com` in `src/routes/__root.tsx` | allow in `style-src` |
| Google Fonts files | `fonts.gstatic.com` | allow in `font-src` |
| Supabase Auth/PostgREST/Realtime | client created from the configured Supabase URL | allow `https://*.supabase.co` and `wss://*.supabase.co` in `connect-src` |
| Supabase Storage/media | signed/private vehicle media can be served from Supabase | allow Supabase in `img-src` / `media-src` |
| Local previews/uploads | image/audio preview paths may use `blob:` / `data:` | allow only in relevant media/image/worker directives |
| Social preview image | current root metadata references an `r2.dev` image | allow `https://*.r2.dev` in `img-src` |
| Lovable runtime telemetry | application can call Lovable-injected `window.__lovableEvents` | **not guessed into the allowlist**; report-only observation must identify any actual network origin before enforcement |

No browser-side need was identified for a permissive `*` source.

## Initial policy principles

The first policy uses:

- `default-src 'self'` as the fallback;
- `base-uri 'self'`;
- `object-src 'none'`;
- `form-action 'self'`;
- same-origin scripts, with no permanent `unsafe-inline` decision made yet;
- Google Fonts only for external stylesheet/font delivery;
- explicit Supabase browser connectivity/media allowances;
- local `data:` / `blob:` only where current UI behavior may require them.

`style-src` temporarily includes `'unsafe-inline'` because the current React/UI stack may use inline style attributes. This is a report-only baseline and should be revisited after runtime observation.

## Deliberately unresolved decisions

### Script hydration

TanStack Start may emit inline hydration/runtime script content. The report-only policy intentionally does **not** add `'unsafe-inline'` to `script-src`. Staging observation must determine whether nonces/hashes or another supported framework mechanism are required before enforcement.

### Framing

`frame-ancestors` is intentionally omitted. The project must first verify whether Lovable preview, internal review workflows, authentication, or future hosting relies on embedding. A framing policy should be a deliberate release decision, not an assumed hardening header.

### Runtime reporting destination

This change does not invent a CSP reporting/monitoring service. Browser violations must first be observed during staging smoke/E2E work. Once the production monitoring destination is selected, CSP reporting can be routed there with bounded, privacy-aware handling.

## Acceptance boundary for this change

This change is complete only as an **implementation** when:

1. responses contain `Content-Security-Policy-Report-Only`;
2. responses do not contain an enforcing `Content-Security-Policy` header from this control;
3. existing response headers/HSTS behavior remain intact;
4. automated tests lock the report-only boundary and inventoried origins;
5. CI/build passes.

It is **not runtime-verified** until the header is independently observed on the Lovable staging ingress and representative browser journeys are exercised while reviewing CSP violations.

It is **not ready for enforcement** until legitimate violations are understood, the required script/style strategy is decided, framing is explicitly decided, and the policy is retested through the critical Playwright journeys.

## Next verification steps

1. Merge through protected `main` only after required CI passes.
2. Verify Lovable synchronized to the exact merge SHA.
3. Independently inspect the staging response and confirm `Content-Security-Policy-Report-Only` is present.
4. Exercise public landing/buyer flow, authentication, seller flow, vehicle media, Supabase realtime/auth behavior, and admin/staff paths.
5. Record every CSP violation and classify it as legitimate dependency, unnecessary dependency, injection/noise, or provider/runtime behavior.
6. Tighten the candidate policy rather than expanding it broadly.
7. Only then propose CSP enforcement in a separate reviewable change.
