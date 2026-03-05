#!/usr/bin/env bash
# compose.sh — docker compose wrapper: picks "docker compose" or "docker-compose".
# Enables BuildKit so `network: host` in build stage works (fixes DNS in pip/npm).
# Usage: scripts/compose.sh [args...]
set -euo pipefail

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

if docker compose version &>/dev/null 2>&1; then
  exec docker compose "$@"
elif command -v docker-compose &>/dev/null; then
  exec docker-compose "$@"
else
  echo "[compose.sh] ERROR: neither 'docker compose' nor 'docker-compose' found." >&2
  exit 1
fi
