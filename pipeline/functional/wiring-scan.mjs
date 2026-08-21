#!/usr/bin/env node
/**
 * V2P — wiring scan (Node 18+, no deps, best-effort static checks).
 * Flags common vibecoded wiring defects BEFORE the manual walkthrough:
 *   1) UI no-op handlers / dead links
 *   2) Supabase table/column references not present in the schema
 *   3) Local imports pointing at files that don't exist (post-Codex breakage)
 *
 * Config via env:
 *   SRC_DIR      default "src"
 *   TYPES_FILE   default "src/integrations/supabase/types.ts" (Supabase generated types)
 *
 * Exit 0 = no HARD failures. Non-zero = unresolved table refs or broken imports.
 * NOTE: heuristic — regex can't see everything. Confirm hits by hand; a clean
 *       run is necessary, not sufficient. Pair it with the manual walkthrough.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const SRC = process.env.SRC_DIR || 'src';
const TYPES = process.env.TYPES_FILE || 'src/integrations/supabase/types.ts';
let hardFail = 0;
const log = (s) => console.log(s);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|dist|build|\.git/.test(p)) walk(p, acc); }
    else if (/\.(t|j)sx?$/.test(e)) acc.push(p);
  }
  return acc;
}
const files = existsSync(SRC) ? walk(SRC) : [];
log(`=== V2P WIRING SCAN ===  files scanned: ${files.length}\n`);

// 1) UI no-ops / dead links
log('--- 1) UI no-op handlers & dead links ---');
const uiPatterns = [
  [/onClick=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/, 'empty onClick handler'],
  [/on(?:Submit|Change)=\{\s*\([a-zA-Z]*\)\s*=>\s*\{\s*\}\s*\}/, 'empty event handler'],
  [/(?:href|to)=["']#["']/, 'dead link (#)'],
  [/\b(?:TODO|FIXME)\b/, 'TODO/FIXME marker'],
];
let uiHits = 0;
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
    for (const [re, label] of uiPatterns)
      if (re.test(ln)) { log(`  [warn] ${f}:${i + 1}  ${label}`); uiHits++; }
  });
}
if (!uiHits) log('  none');

// 2) Supabase table/column references vs schema
log('\n--- 2) Supabase table/column references vs schema ---');
const tables = new Set(), columns = new Set(), functions = new Set();
if (existsSync(TYPES)) {
  const t = readFileSync(TYPES, 'utf8');
  for (const m of t.matchAll(/([a-zA-Z0-9_]+):\s*\{\s*Row:/g)) tables.add(m[1]);       // each table has a Row
  for (const rm of t.matchAll(/Row:\s*\{([\s\S]*?)\}/g))
    for (const cm of rm[1].matchAll(/([a-zA-Z0-9_]+)\s*:/g)) columns.add(cm[1]);
  const fnBlock = t.match(/Functions:\s*\{([\s\S]*?)\n {4}\}/);
  if (fnBlock) for (const m of fnBlock[1].matchAll(/^\s{6}([a-zA-Z0-9_]+):\s*\{/gm)) functions.add(m[1]);
  log(`  schema (best-effort parse): ${tables.size} tables, ${columns.size} distinct columns, ${functions.size} functions`);
} else {
  log(`  [info] ${TYPES} not found — skipping schema check (supply an information_schema dump instead)`);
}
if (tables.size) {
  let refHits = 0;
  const fromRe = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
  const colRe  = /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|order|filter)\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  const selRe  = /\.select\(\s*['"`]([^'"`]+)['"`]/g;
  const rpcRe  = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(fromRe))
      if (!tables.has(m[1])) { hardFail++; refHits++; log(`  [FAIL] ${f}: .from('${m[1]}') — table not in schema`); }
    if (functions.size) {
      for (const m of src.matchAll(rpcRe))
        if (!functions.has(m[1])) { hardFail++; refHits++; log(`  [FAIL] ${f}: .rpc('${m[1]}') — function not in schema`); }
    }
    if (columns.size) {
      for (const m of src.matchAll(colRe))
        if (!columns.has(m[1])) { refHits++; log(`  [warn] ${f}: filter column '${m[1]}' not found in any table`); }
      for (const m of src.matchAll(selRe))
        for (const raw of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
          const isRelationEmbed = /\(/.test(raw); // PostgREST `table(cols)` / `alias:table(cols)` embed, not a plain column
          const c = raw.split(/[\s:(]/)[0];
          if (isRelationEmbed && (tables.has(c) || columns.has(c))) continue;
          if (c !== '*' && /^[a-zA-Z0-9_]+$/.test(c) && !columns.has(c))
            log(`  [warn] ${f}: select column '${c}' not found in any table`);
        }
    }
  }
  if (!refHits) log('  all .from() table references resolve');
}

// 3) Local imports that don't resolve
log('\n--- 3) Local imports that do not resolve ---');
let impHits = 0;
const impRe = /import[^'"]*from\s*['"](\.[^'"]+)['"]/g;
const exts = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(impRe)) {
    const specifier = m[1].split('?')[0]; // strip Vite import suffixes (?url, ?raw, ?worker, ...)
    const base = resolve(dirname(f), specifier);
    if (!exts.some(e => existsSync(base + e))) { hardFail++; impHits++; log(`  [FAIL] ${f}: import '${m[1]}' does not resolve`); }
  }
}
if (!impHits) log('  all local imports resolve');

log(`\n=== RESULT: ${hardFail === 0 ? 'no hard failures' : hardFail + ' hard failure(s)'} (heuristic — confirm by hand) ===`);
process.exit(hardFail === 0 ? 0 : 1);
