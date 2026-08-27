#!/usr/bin/env bash
# V2P — scan the shipped bundle and git history for secrets that must never
# reach the client. Run from repo root. Requires: node/npm; gitleaks optional.
set -euo pipefail
OUT="${1:-secret-scan-report.txt}"
: > "$OUT"

echo "== Building app ==" | tee -a "$OUT"
npm run build 2>&1 | tail -n 5 | tee -a "$OUT"
# Nitro (TanStack Start's build-time SSR bundler) writes the actual deployable
# artifact to .output/ on most presets -- checked first since it's a superset
# of what ships (server + public/) and the canonical target for most presets.
# dist/ and build/ are plain-Vite (or older/partial-build) fallbacks: a stale
# dist/ from an earlier build can otherwise sit there and get scanned instead
# of the real current output (hit this for real diffing two TanStack Start
# apps against each other -- one had a days-old dist/ next to a fresh
# .output/, and the old detection order would have silently scanned the
# stale one).
DIST="dist"
[ -d ".output" ] && DIST=".output"
[ -d "$DIST" ] || DIST="build"

echo "== Scanning $DIST for high-risk secrets ==" | tee -a "$OUT"
# Supabase service_role (a JWT containing "service_role"), and the env var name.
PATTERNS=(
  'service_role'
  'SUPABASE_SERVICE_ROLE_KEY'
  'sk_live_' 'sk_test_' 'rk_live_'          # Stripe
  'sk-proj-' 'sk-[A-Za-z0-9]\{20,\}'        # OpenAI
  'AKIA[0-9A-Z]\{16\}'                       # AWS access key id
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'       # private keys
)
HITS=0
for p in "${PATTERNS[@]}"; do
  if grep -REn "$p" "$DIST" 2>/dev/null | tee -a "$OUT" | grep -q .; then
    echo "  [HIT] pattern: $p" | tee -a "$OUT"; HITS=$((HITS+1))
  fi
done

echo "== gitleaks (full history), if installed ==" | tee -a "$OUT"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-banner --redact -r gitleaks-report.json 2>&1 | tee -a "$OUT" || true
else
  echo "  gitleaks not installed — run in CI (see ci.yml)" | tee -a "$OUT"
fi

echo "== RESULT: $HITS bundle pattern hit(s). Review $OUT. Any hit on a real key = CRITICAL: remove + rotate. =="
[ "$HITS" -eq 0 ]
