#!/usr/bin/env bash
# dev-up.sh — Start local dev (FE + BE, no Docker).
set -euo pipefail
cd "$(dirname "$0")/.."
exec make dev
