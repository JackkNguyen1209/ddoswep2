# Load .env if it exists (copy .env.example → .env and set PUBLIC_HOST).
# Variables already in the environment take precedence over .env values.
-include .env
export

# ── Auto-detect LAN IP when PUBLIC_HOST is not set ───────────────────────────
_AUTO_IP := $(shell hostname -I 2>/dev/null | awk '{print $$1}' | tr -d '[:space:]')
ifeq ($(_AUTO_IP),)
  _AUTO_IP := 127.0.0.1
endif

# ── Defaults (used when not set in .env) ─────────────────────────────────────
PUBLIC_HOST  ?= $(_AUTO_IP)
PUBLIC_PROTO ?= http
WEB_PORT     ?= 3000
API_PORT     ?= 8000

# Derived URLs — single place, never repeated
_WEB_URL := $(PUBLIC_PROTO)://$(PUBLIC_HOST):$(WEB_PORT)
_API_URL := $(PUBLIC_PROTO)://$(PUBLIC_HOST):$(API_PORT)

.PHONY: install env up down logs dev dev-api dev-web status verify help

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ddoswep — DDoS ML Detection"
	@echo ""
	@echo "  make env         Auto-detect LAN IP and write .env (--force to overwrite)"
	@echo "  make install     Install frontend (pnpm) + backend (pip) deps"
	@echo "  make dev         Local dev: FE + BE (no Docker)"
	@echo "  make up          Production: docker compose up -d --build"
	@echo "  make down        docker compose down"
	@echo "  make logs        Follow docker compose logs"
	@echo "  make status      Show running containers + ports"
	@echo "  make verify      Curl health + check frontend"
	@echo ""
	@echo "  UI:     $(_WEB_URL)"
	@echo "  API:    $(_API_URL)"
	@echo "  Health: $(_API_URL)/health"
	@echo ""
	@echo "  Detected IP: $(_AUTO_IP)"
	@echo "  To change:   bash scripts/setup-env.sh --force"
	@echo ""

# ── Env ───────────────────────────────────────────────────────────────────────
env:
	@bash scripts/setup-env.sh $(if $(filter --force,$(MAKEFLAGS)),--force,)

# ── Install ───────────────────────────────────────────────────────────────────
install:
	@echo "── Installing frontend dependencies ──"
	@which pnpm > /dev/null 2>&1 || npm install -g pnpm
	pnpm install
	@echo ""
	@echo "── Installing backend dependencies ──"
	pip install -r backend/requirements.txt --break-system-packages 2>/dev/null || \
	  pip install -r backend/requirements.txt || \
	  echo "⚠  pip install had issues — try: pip install -r backend/requirements.txt --user"
	@echo ""
	@echo "✅ Dependencies installed."

# ── Docker (production) ───────────────────────────────────────────────────────
up:
	@if [ ! -f .env ]; then \
	  echo "── No .env found — auto-detecting IP ──"; \
	  bash scripts/setup-env.sh; \
	  echo ""; \
	fi
	@echo "── Stopping any services on ports $(WEB_PORT)/$(API_PORT)/8001 ──"
	@bash scripts/stop-ports.sh || true
	@echo ""
	@echo "── Starting production (Docker Compose) ──"
	mkdir -p data/datasets data/models data/experiments
	bash scripts/compose.sh up -d --build
	@echo ""
	@echo "⏳  Waiting for services to be healthy..."
	@sleep 12
	@echo ""
	@echo "╔══════════════════════════════════════════════════════════╗"
	@echo "║  ✅  UI:         $(_WEB_URL)"
	@echo "║  ✅  API Docs:   $(_API_URL)/docs"
	@echo "║  ✅  API Health: $(_API_URL)/health"
	@echo "╚══════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "  Flow: Upload → Preprocess → Feature → Train → Eval → Predict"
	@echo ""
	@echo "  Verify:  bash scripts/verify.sh"

down:
	bash scripts/compose.sh down
	@echo "✅ Services stopped."

logs:
	bash scripts/compose.sh logs -f

status:
	@bash scripts/compose.sh ps 2>/dev/null || true
	@echo ""
	@echo "  Ports in use:"
	@ss -tlnp "sport = :$(WEB_PORT) or sport = :$(API_PORT) or sport = :8001" 2>/dev/null | grep -v '^State' || echo "  (none)"

verify:
	@bash scripts/verify.sh

# ── Local dev (no Docker) ─────────────────────────────────────────────────────
dev:
	@echo "── Stopping any services on ports $(WEB_PORT)/$(API_PORT)/8001 ──"
	@bash scripts/stop-ports.sh || true
	@echo ""
	@echo "── Starting local dev servers ──"
	mkdir -p data/datasets data/models data/experiments
	@API_P=$(API_PORT); \
	if ss -tlnp "sport = :$$API_P" 2>/dev/null | grep -q LISTEN; then \
	  API_P=8001; \
	  echo "⚠  Port $(API_PORT) still busy — using $$API_P for API"; \
	fi; \
	ACTUAL_API_URL="$(PUBLIC_PROTO)://$(PUBLIC_HOST):$$API_P"; \
	echo ""; \
	echo "╔══════════════════════════════════════════════════════════╗"; \
	echo "║  ✅  UI:         $(_WEB_URL)"; \
	printf "║  ✅  API Health: $$ACTUAL_API_URL/health\n"; \
	echo "╚══════════════════════════════════════════════════════════╝"; \
	echo "  (Ctrl+C to stop both)"; \
	echo ""; \
	trap 'kill %1 %2 2>/dev/null; exit 0' INT TERM; \
	( DATA_DIR=./data \
	    uvicorn backend.app.main:app \
	      --host 0.0.0.0 --port $$API_P --reload \
	    2>&1 | sed 's/^/[api] /' ) & \
	( NEXT_PUBLIC_API_BASE_URL="$(PUBLIC_PROTO)://$(PUBLIC_HOST):$$API_P" \
	    pnpm exec next dev --hostname 0.0.0.0 --port $(WEB_PORT) \
	    2>&1 | sed 's/^/[web] /' ) & \
	wait

dev-api:
	@echo "Starting API only on 0.0.0.0:$(API_PORT) ..."
	mkdir -p data/datasets data/models data/experiments
	DATA_DIR=./data uvicorn backend.app.main:app \
	  --host 0.0.0.0 --port $(API_PORT) --reload

dev-web:
	@echo "Starting Next.js on 0.0.0.0:$(WEB_PORT) ..."
	NEXT_PUBLIC_API_BASE_URL=$(_API_URL) \
	  pnpm exec next dev --hostname 0.0.0.0 --port $(WEB_PORT)
