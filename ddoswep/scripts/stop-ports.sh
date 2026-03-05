#!/usr/bin/env bash
# stop-ports.sh — Safely free ports used by ddoswep.
# Reads WEB_PORT and API_PORT from .env (project root) or from environment.
# Safe: only kills processes/containers actually listening on those ports.
# Idempotent: safe to run multiple times.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Source .env so WEB_PORT/API_PORT can be customised
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_DIR/.env"
  set +a
fi

WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-8000}"
PORTS=("$WEB_PORT" "$API_PORT" "8001")

log()  { echo "  [stop] $*"; }
warn() { echo "  [warn] $*"; }

# ── 1. docker compose down (if compose file exists) ──────────────────────────
COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
fi

if [ -n "$COMPOSE_CMD" ] && [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  log "Running: $COMPOSE_CMD down (project: $PROJECT_DIR)"
  cd "$PROJECT_DIR"
  $COMPOSE_CMD down 2>/dev/null || true
fi

# ── 2. Stop containers publishing 3000/8000/8001 ─────────────────────────────
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  for PORT in "${PORTS[@]}"; do
    CIDS=$(docker ps --filter "publish=$PORT" -q 2>/dev/null || true)
    if [ -n "$CIDS" ]; then
      for CID in $CIDS; do
        CNAME=$(docker inspect --format '{{.Name}}' "$CID" 2>/dev/null | tr -d '/')
        log "Stopping container $CNAME (CID=$CID) publishing port $PORT"
        docker stop "$CID" 2>/dev/null || true
        docker rm "$CID" 2>/dev/null || true
      done
    fi
  done
fi

# ── 3. Kill local processes listening on each port ───────────────────────────
_kill_port() {
  local PORT=$1
  local PIDS=""

  # Try ss first (faster), then lsof fallback
  if command -v ss &>/dev/null; then
    PIDS=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u || true)
  fi
  if [ -z "$PIDS" ] && command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti TCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  fi

  if [ -z "$PIDS" ]; then
    log "Port $PORT — already free"
    return
  fi

  for PID in $PIDS; do
    CMD=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    log "Killing PID $PID ($CMD) on port $PORT"
    kill -15 "$PID" 2>/dev/null || true
    sleep 0.5
    kill -9 "$PID" 2>/dev/null || true
  done
}

for PORT in "${PORTS[@]}"; do
  _kill_port "$PORT"
done

# ── 4. Confirm ports are free ────────────────────────────────────────────────
echo ""
STILL_BUSY=()
for PORT in "${PORTS[@]}"; do
  BUSY=false
  if command -v ss &>/dev/null; then
    ss -tlnp "sport = :$PORT" 2>/dev/null | grep -q "LISTEN" && BUSY=true || true
  elif command -v lsof &>/dev/null; then
    lsof -ti TCP:"$PORT" -sTCP:LISTEN &>/dev/null && BUSY=true || true
  fi
  if $BUSY; then
    warn "Port $PORT STILL IN USE — may need sudo"
    STILL_BUSY+=("$PORT")
  else
    log "Port $PORT ✓ free"
  fi
done

if [ ${#STILL_BUSY[@]} -gt 0 ]; then
  echo ""
  warn "Some ports still busy: ${STILL_BUSY[*]}"
  warn "Try:  sudo bash scripts/stop-ports.sh"
  exit 1
fi

echo ""
echo "  ✅ All ports free."
