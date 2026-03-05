#!/usr/bin/env bash
# setup-docker-dns.sh — Fix Docker build DNS on Ubuntu VMs where bridge NAT is broken.
# Run once as root (or with sudo) before the first `make up`.
#
# What it does:
#   1. Writes /etc/docker/daemon.json with dns: [8.8.8.8, 1.1.1.1]
#   2. Restarts Docker daemon
#   3. Installs docker-buildx plugin if missing (enables BuildKit)
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[setup-docker-dns] Must run as root. Use: sudo bash scripts/setup-docker-dns.sh"
  exit 1
fi

DAEMON_JSON=/etc/docker/daemon.json

echo "[setup-docker-dns] Configuring Docker DNS..."

# Merge dns into existing daemon.json (or create fresh)
if [[ -f "$DAEMON_JSON" ]]; then
  # Add dns key if not already present
  if ! python3 -c "import json,sys; d=json.load(open('$DAEMON_JSON')); sys.exit(0 if 'dns' in d else 1)" 2>/dev/null; then
    python3 - <<'PYEOF'
import json, os
path = "/etc/docker/daemon.json"
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    d = {}
d["dns"] = ["8.8.8.8", "1.1.1.1"]
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print(f"[setup-docker-dns] Updated {path}")
PYEOF
  else
    echo "[setup-docker-dns] daemon.json already has dns — skipping"
  fi
else
  mkdir -p /etc/docker
  cat > "$DAEMON_JSON" <<'EOF'
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
EOF
  echo "[setup-docker-dns] Created $DAEMON_JSON"
fi

echo "[setup-docker-dns] Restarting Docker daemon..."
systemctl restart docker
sleep 2
echo "[setup-docker-dns] Docker restarted."

# Install buildx if missing
if ! docker buildx version &>/dev/null 2>&1; then
  echo "[setup-docker-dns] Installing docker-buildx-plugin..."
  apt-get update -qq
  apt-get install -y -qq docker-buildx-plugin 2>/dev/null || \
    apt-get install -y -qq docker-buildx 2>/dev/null || \
    echo "[setup-docker-dns] Could not install buildx — BuildKit may still work via DOCKER_BUILDKIT=1"
else
  echo "[setup-docker-dns] docker buildx already installed."
fi

echo ""
echo "[setup-docker-dns] Done. Now run: bash scripts/prod-up.sh"
