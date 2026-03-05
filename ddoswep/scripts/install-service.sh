#!/usr/bin/env bash
# install-service.sh — Install ddoswep systemd service (auto-start on boot).
# REQUIRES: sudo / root
set -euo pipefail

SERVICE_NAME="ddoswep"
UNIT_SRC="$(cd "$(dirname "$0")/.." && pwd)/deploy/${SERVICE_NAME}.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

# ── Guard ──────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "[install-service] ERROR: This script must be run as root."
  echo "  Run:  sudo bash scripts/install-service.sh"
  exit 1
fi

if [ ! -f "$UNIT_SRC" ]; then
  echo "[install-service] ERROR: Service unit not found: $UNIT_SRC"
  exit 1
fi

# ── Install ────────────────────────────────────────────────────────────────
echo "[install-service] Copying $UNIT_SRC → $UNIT_DST"
cp "$UNIT_SRC" "$UNIT_DST"
chmod 644 "$UNIT_DST"

echo "[install-service] Reloading systemd daemon..."
systemctl daemon-reload

echo "[install-service] Enabling $SERVICE_NAME (auto-start on boot)..."
systemctl enable "$SERVICE_NAME"

echo "[install-service] (Re)starting $SERVICE_NAME..."
systemctl restart "$SERVICE_NAME"

sleep 3
echo ""
echo "══════════════════════════════════════"
systemctl status "$SERVICE_NAME" --no-pager -l || true
echo "══════════════════════════════════════"
echo ""
echo "  ✅  Service installed and started."
echo ""
echo "  Useful commands:"
echo "    systemctl status  $SERVICE_NAME"
echo "    systemctl stop    $SERVICE_NAME"
echo "    systemctl disable $SERVICE_NAME   # remove from boot"
echo "    journalctl -u $SERVICE_NAME -f    # follow logs"
echo ""
