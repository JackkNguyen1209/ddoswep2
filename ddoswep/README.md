# DDoS Detection ML Lab

Next.js (App Router) frontend + FastAPI backend for training and evaluating ML models on DDoS datasets.

---

## Quick Start — Production (Docker)

```bash
cd /home/ubuntu/ddoswep

# Build + start (stops any conflicting services first)
make up
```

Prints when ready:

```
╔═════════════════════════════════════════════╗
║  ✅  UI:         http://localhost:3000      ║
║  ✅  API Docs:   http://localhost:8000/docs ║
║  ✅  API Health: http://localhost:8000/health ║
╚═════════════════════════════════════════════╝
```

No `.env` required for production. Access via `localhost` only.

> **Truy cập từ máy khác**: Nếu cần truy cập từ máy ngoài, xem file `.env.example` để cấu hình `PUBLIC_HOST`.

---

## Quick Start — Local Dev (no Docker)

```bash
# Install all deps (pnpm + pip)
make install

# Start FE + BE together (auto-stops conflicting services first)
make dev

# Or separately:
make dev-api   # FastAPI only (API_PORT)
make dev-web   # Next.js only (WEB_PORT)
```

If `API_PORT` is busy, `make dev` auto-falls back to 8001 and updates the URL.

---

## Auto-Start on Boot (systemd)

```bash
# Install as a systemd service (runs production Docker Compose on boot)
sudo bash scripts/install-service.sh
```

After install:
```bash
systemctl status ddoswep
journalctl -u ddoswep -f     # follow logs

systemctl stop    ddoswep    # stop
systemctl disable ddoswep    # remove from boot
```

---

## All Makefile Targets

| Target | Description |
|---|---|
| `make install` | Install pnpm + pip deps |
| `make dev` | Local dev: FE + BE (no Docker) |
| `make dev-api` | FastAPI only |
| `make dev-web` | Next.js only |
| `make up` | Docker Compose (production) |
| `make down` | Stop Docker Compose |
| `make logs` | Tail Docker Compose logs |
| `make status` | Show containers + port usage |
| `make verify` | Curl health + frontend check |

---

## Scripts

| Script | Description |
|---|---|
| `scripts/stop-ports.sh` | Safely free ports 3000, 8000, 8001 |
| `scripts/compose.sh` | docker compose wrapper (handles both `docker compose` and `docker-compose`) |
| `scripts/dev-up.sh` | Alias for `make dev` |
| `scripts/prod-up.sh` | Alias for `make up` |
| `scripts/verify.sh` | Health + reachability checks |
| `scripts/install-service.sh` | Install systemd auto-start (needs sudo) |

---

## Verify After Start

```bash
# Automated verify
bash scripts/verify.sh

# Manual checks
curl http://localhost:8000/health
# Expected: {"status":"ok","allowed_origins":[...]}

curl -sI http://localhost:3000 | head -3
# Expected: HTTP/1.1 200 OK
```

---

## Full Pipeline Flow

```
Upload CSV  →  Preprocess  →  Feature Report  →  Train  →  Evaluation  →  Predict
  /upload      /preprocessing  /feature-opt      /training  /evaluation   /prediction
```

---

## Environment Variables

All user-facing configuration lives in a single `.env` file (copy from `.env.example`).
Docker Compose, Makefile, and scripts all read from it automatically.

### `.env` (single source of truth)

| Variable | Default | Description |
|---|---|---|
| `PUBLIC_HOST` | `192.168.88.128` | VM IP or hostname |
| `PUBLIC_PROTO` | `http` | `http` or `https` |
| `WEB_PORT` | `3000` | Frontend port |
| `API_PORT` | `8000` | Backend API port |
| `MAX_UPLOAD_MB` | `200` | Max CSV upload size |
| `MAX_CAT_CATEGORIES` | `2000` | Max unique values per categorical column |

### Derived (computed automatically — do not set manually)

| Variable | Derived as | Used by |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `PUBLIC_PROTO://PUBLIC_HOST:API_PORT` | docker-compose web, `make dev` |
| `ALLOWED_ORIGINS` | `PUBLIC_PROTO://PUBLIC_HOST:WEB_PORT` | docker-compose api |

### Other backend-only variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `/app/data` | Storage root for datasets/models/experiments |

---

## ML Features

- **10 algorithms**: ANN, SVM, Gaussian/Multinomial/Bernoulli NB, Logistic, KNN, Decision Tree, Random Forest, Gradient Boosting
- **Leakage-safe**: train/test split before fitting any transformer
- **Stratified split** with automatic fallback for small classes
- **MultinomialNB**: auto-uses MinMaxScaler (non-negative constraint)
- **BernoulliNB**: auto-adds Binarizer step
- **Cross-validation**: optional K-Fold (3/5/10), returns mean±std metrics
- **AUC**: binary ROC, multiclass OVR macro; returns `null` + note when not computable
- **Concurrency-safe** experiments.json via filelock

---

## Troubleshooting

### Port already in use

```bash
# Safely stop everything on ports 3000/8000/8001
bash scripts/stop-ports.sh

# If still busy (e.g. another user's process):
sudo bash scripts/stop-ports.sh

# Or manually find and kill:
sudo ss -tlnp 'sport = :8000'
sudo kill -9 <PID>
```

### `next: not found` / missing node_modules

```bash
make install
# or manually:
npm install -g pnpm && pnpm install
```

### Docker build fail: "Temporary failure in name resolution"

The `docker-compose.yml` already sets `dns: [8.8.8.8, 1.1.1.1]` on both services to handle
per-container DNS at runtime. For the **build step** (when pip/npm download packages),
DNS is resolved by the Docker daemon itself.

If pip still fails to reach pypi.org during build:

```bash
# 1. Test DNS at daemon level
docker run --rm alpine ping -c 1 pypi.org

# 2. If it fails, configure Docker daemon DNS
sudo nano /etc/docker/daemon.json
```

Add or merge:
```json
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
```

```bash
# 3. Restart Docker daemon
sudo systemctl restart docker

# 4. Rebuild
make up
```

**Offline environment**: pre-build on a connected machine and export:
```bash
docker save ddos-api | gzip > ddos-api.tar.gz
# On offline machine:
docker load < ddos-api.tar.gz
```

### `fastapi==x.x from versions: none`

Fixed — `requirements.txt` uses version ranges (`fastapi>=0.110,<1.0`).

### systemd service not starting

```bash
journalctl -u ddoswep -n 50 --no-pager
# Check Docker is running:
systemctl status docker
# Reinstall service:
sudo bash scripts/install-service.sh
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/datasets/upload` | Upload CSV (max 200MB) |
| GET | `/api/datasets/{id}` | Dataset info + preview |
| POST | `/api/preprocess/fit_transform` | Leakage-safe preprocessing |
| POST | `/api/features/report` | Correlation + variance report |
| POST | `/api/train` | Train model (optional `cv_folds`) |
| GET | `/api/experiments` | List experiments |
| GET | `/api/experiments/{id}` | Experiment detail |
| POST | `/api/predict` | Run prediction |

Interactive docs: **http://\<PUBLIC_HOST\>:8000/docs** (set in `.env`)
