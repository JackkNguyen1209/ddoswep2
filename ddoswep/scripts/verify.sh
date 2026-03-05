#!/usr/bin/env bash
# verify.sh — Verify API health + frontend reachability.
# Reads PUBLIC_HOST, PUBLIC_PROTO, API_PORT, WEB_PORT from .env (project root)
# or from environment variables already exported by the caller (e.g. Makefile).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source .env if present; env vars already set take precedence
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_DIR/.env"
  set +a
fi

PUBLIC_HOST="${PUBLIC_HOST:-192.168.88.128}"
PUBLIC_PROTO="${PUBLIC_PROTO:-http}"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

API_URL="${PUBLIC_PROTO}://${PUBLIC_HOST}:${API_PORT}"
WEB_URL="${PUBLIC_PROTO}://${PUBLIC_HOST}:${WEB_PORT}"

ok()   { echo "  ✅  $*"; }
fail() { echo "  ❌  $*"; FAILED=$((FAILED+1)); }
FAILED=0

echo ""
echo "══════════════════════════════════════════════════"
echo "  Verify ddoswep  @ ${PUBLIC_HOST}"
echo "══════════════════════════════════════════════════"
echo ""

# API health
HEALTH=$(curl -sf --max-time 5 "${API_URL}/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"ok"'; then
  ok "API Health  ${API_URL}/health  →  $HEALTH"
else
  fail "API Health  ${API_URL}/health  → NOT REACHABLE (got: $HEALTH)"
fi

# Frontend
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "${WEB_URL}" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" -eq 200 ] 2>/dev/null; then
  ok "Frontend    ${WEB_URL}  → HTTP $HTTP_CODE"
else
  fail "Frontend    ${WEB_URL}  → HTTP $HTTP_CODE (not 200)"
fi

# API docs
DOCS_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 5 "${API_URL}/docs" 2>/dev/null || echo "000")
if [ "$DOCS_CODE" -eq 200 ] 2>/dev/null; then
  ok "API Docs    ${API_URL}/docs  → HTTP $DOCS_CODE"
else
  fail "API Docs    ${API_URL}/docs  → HTTP $DOCS_CODE"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "  ✅  All checks passed."
else
  echo "  ❌  $FAILED check(s) failed. See above."
  exit 1
fi
echo ""
