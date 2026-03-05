#!/usr/bin/env bash
# prod-up.sh — Build + start production via Docker Compose.
# Auto-generates .env with current LAN IP if not present.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[prod-up] No .env found — running setup-env.sh ..."
  bash scripts/setup-env.sh
  echo ""
fi

exec make up
