#!/usr/bin/env node
/**
 * V2P — RLS / anon-key exposure probe (Node 18+, no deps).
 * Reproduces CVE-2025-48757 from the outside: hit Supabase's auto REST API
 * with ONLY the public anon key and confirm nothing leaks. Optionally repeat
 * with a real user's JWT to confirm rows are scoped to that user.
 *
 * Config via env:
 *   SUPABASE_URL           e.g. https://xyz.supabase.co   (STAGING)
 *   SUPABASE_ANON_KEY      public anon key
 *   PROBE_TABLES           comma-separated table names, OR use --tables <file>
 *   TEST_USER_JWT          (optional) a logged-in user's access token
 *   TEST_USER_ID           (optional) that user's id, to check row ownership
 *
 * Exit 0 = all checks passed (no leak). Non-zero = at least one failure.
 */
import { readFileSync } from 'node:fs';

const URL  = process.env.SUPABASE_URL?.replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT  = process.env.TEST_USER_JWT || null;
const UID  = process.env.TEST_USER_ID || null;

if (!URL || !ANON) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(2); }

const fileArgIdx = process.argv.indexOf('--tables');
const tables = fileArgIdx > -1
  ? readFileSync(process.argv[fileArgIdx + 1], 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : (process.env.PROBE_TABLES || '').split(',').map(s => s.trim()).filter(Boolean);

if (tables.length === 0) { console.error('No tables. Set PROBE_TABLES or --tables <file>'); process.exit(2); }

let failures = 0;
const line = (s) => console.log(s);

async function get(table, jwt) {
  const headers = { apikey: ANON };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${URL}/rest/v1/${table}?select=*&limit=5`, { headers });
  let body = [];
  try { body = await res.json(); } catch { body = []; }
  return { status: res.status, body: Array.isArray(body) ? body : [] };
}

async function tryWrite(table) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ __v2p_probe__: 'should-be-rejected' }),
  });
  return res.status;
}

line('=== V2P RLS PROBE ===');
line(`Target: ${URL}`);
line(`Tables: ${tables.join(', ')}\n`);

// Pass 1 — anonymous read: expect NO rows.
line('--- Pass 1: anonymous READ (expect 0 rows or permission error) ---');
for (const t of tables) {
  const { status, body } = await get(t, null);
  if (status < 400 && body.length > 0) {
    failures++; line(`  [FAIL] ${t}: anon read returned ${body.length} row(s) — RLS OPEN (Critical)`);
  } else {
    line(`  [ pass ] ${t}: status ${status}, ${body.length} rows`);
  }
}

// Pass 2 — anonymous write: expect rejection.
line('\n--- Pass 2: anonymous WRITE (expect 401/403) ---');
for (const t of tables) {
  const status = await tryWrite(t);
  if (status < 400) {
    failures++; line(`  [FAIL] ${t}: anon write accepted (status ${status}) — WRITABLE (Critical)`);
  } else {
    line(`  [ pass ] ${t}: write rejected (status ${status})`);
  }
}

// Pass 3 — authenticated read: expect ONLY this user's rows (if UID known).
if (JWT) {
  line('\n--- Pass 3: authenticated READ (expect only own rows) ---');
  for (const t of tables) {
    const { status, body } = await get(t, JWT);
    if (UID) {
      const foreign = body.filter(r => 'user_id' in r && String(r.user_id) !== String(UID));
      if (foreign.length > 0) {
        failures++; line(`  [FAIL] ${t}: returned ${foreign.length} row(s) not owned by test user (High)`);
      } else {
        line(`  [ pass ] ${t}: status ${status}, ${body.length} rows, all owned`);
      }
    } else {
      line(`  [ info ] ${t}: status ${status}, ${body.length} rows (set TEST_USER_ID to check ownership)`);
    }
  }
} else {
  line('\n--- Pass 3 skipped (no TEST_USER_JWT) ---');
}

line(`\n=== RESULT: ${failures === 0 ? 'PASS (no leaks)' : failures + ' FAILURE(S)'} ===`);
process.exit(failures === 0 ? 0 : 1);
