#!/usr/bin/env node
// V2P — verify security headers on the deployed (STAGING) URL.
// Usage: TARGET_URL=https://staging.example node headers-check.mjs
const url = process.env.TARGET_URL;
if (!url) { console.error('Set TARGET_URL'); process.exit(2); }
const want = {
  'content-security-policy': 'CSP',
  'strict-transport-security': 'HSTS',
  'x-frame-options': 'X-Frame-Options',
  'x-content-type-options': 'X-Content-Type-Options',
  'referrer-policy': 'Referrer-Policy',
};
const res = await fetch(url, { redirect: 'manual' });
let missing = 0;
console.log(`=== Header check: ${url} (status ${res.status}) ===`);
for (const [h, label] of Object.entries(want)) {
  const v = res.headers.get(h);
  if (v) console.log(`  [ pass ] ${label}: ${v}`);
  else { console.log(`  [FAIL] ${label}: MISSING`); missing++; }
}
console.log(`=== ${missing === 0 ? 'PASS' : missing + ' missing header(s)'} ===`);
process.exit(missing === 0 ? 0 : 1);
