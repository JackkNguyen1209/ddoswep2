#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run_tests.sh – Chạy toàn bộ test suite cho backend
#
# Cách dùng:
#   bash run_tests.sh                  # chạy trong môi trường local (cần venv)
#   bash run_tests.sh --docker         # chạy trong Docker container
#   bash run_tests.sh --install        # cài thêm test deps rồi chạy
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOCKER_MODE=false
INSTALL_MODE=false

for arg in "$@"; do
  case $arg in
    --docker)   DOCKER_MODE=true ;;
    --install)  INSTALL_MODE=true ;;
  esac
done

# ── Chạy trong Docker ────────────────────────────────────────────────────────
if $DOCKER_MODE; then
  echo "▶ Chạy tests trong Docker container..."
  docker compose run --rm \
    -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
    api \
    bash -c "cd /app && pip install pytest pytest-cov -q && python -m pytest tests/ -v --tb=short 2>&1"
  exit $?
fi

# ── Chạy local ───────────────────────────────────────────────────────────────
if $INSTALL_MODE; then
  echo "▶ Cài đặt test dependencies..."
  pip install pytest pytest-cov -q
fi

echo "════════════════════════════════════════════════════════════"
echo "  ddoswep AI Explain – Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# Chạy bằng pytest nếu có, ngược lại dùng unittest
if command -v pytest &>/dev/null; then
  python -m pytest tests/test_ai_explain.py -v \
    --tb=short \
    --no-header \
    -p no:cacheprovider \
    2>&1
else
  echo "pytest không tìm thấy, dùng unittest..."
  python -m unittest tests.test_ai_explain -v 2>&1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Hoàn thành."
echo "════════════════════════════════════════════════════════════"
