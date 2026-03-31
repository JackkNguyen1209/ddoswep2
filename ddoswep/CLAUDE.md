# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DDoS Detection ML Lab** — A Next.js (App Router) frontend + FastAPI backend for training and evaluating ML models on DDoS datasets.

**Key Characteristics:**
- Full ML pipeline: Upload → Preprocess → Feature Optimization → Train → Evaluate → Predict → Explain
- 10 ML algorithms: ANN, SVM, Gaussian/Multinomial/Bernoulli NB, Logistic, KNN, Decision Tree, Random Forest, Gradient Boosting
- Leakage-safe preprocessing (train/test split before fitting transformers)
- 300+ Vietnamese translations (full UI localization)
- Docker support with multi-stage builds
- Concurrency-safe experiments.json via filelock

---

## Quick Start

### Development (no Docker)

```bash
# Install deps (pnpm + pip)
make install

# Start frontend + backend together (auto-stops conflicting services)
make dev

# Or separately:
make dev-api   # FastAPI on port 8000 (or 8001 if busy)
make dev-web   # Next.js on port 3000
```

### Production (Docker)

```bash
# Build + start
make up

# View logs
make logs

# Stop
make down
```

### Verification

```bash
# Automated verification
bash scripts/verify.sh

# Manual checks
curl http://localhost:8000/health
curl -sI http://localhost:3000
```

---

## Common Commands

| Command | Purpose |
|---------|---------|
| `make install` | Install pnpm + pip dependencies |
| `make dev` | Local dev: FE + BE together (no Docker) |
| `make dev-api` | FastAPI only (port 8000) |
| `make dev-web` | Next.js only (port 3000) |
| `make up` | Docker Compose production build + start |
| `make down` | Stop Docker Compose services |
| `make logs` | Follow Docker Compose logs |
| `make status` | Show running containers + port usage |
| `make verify` | Health + reachability checks |
| `pnpm install` | Install frontend deps (Next.js, React, Tailwind, shadcn/ui) |
| `pnpm run build` | Build Next.js for production |
| `pnpm run lint` | ESLint check |
| `pip install -r backend/requirements.txt` | Install backend deps (FastAPI, scikit-learn, anthropic) |
| `cd backend && bash run_tests.sh` | Run all backend tests |
| `cd backend && pytest tests/ -k <name>` | Run specific test by keyword |

---

## Architecture

### Frontend (Next.js 16 + React 19)

**File Structure:**
```
app/
  ├── page.tsx                    # Home/dashboard
  ├── upload/                     # CSV upload + preview
  ├── preprocessing/              # Data cleaning (6 steps)
  ├── feature-optimization/       # Feature selection (correlation + variance)
  ├── feature-selection/          # Feature importance ranking
  ├── training/                   # Train 1-10 algorithms + hyperparameters
  ├── evaluation/                 # Metrics, ROC, Precision-Recall curves
  ├── model-details/              # Algorithm explanations (8 components each)
  ├── explainability/             # Feature contribution + prediction explanation
  ├── prediction/                 # Predict on new data
  └── experiments/                # View/compare experiment history

components/
  ├── model-details/
  │   ├── algorithm-detail-card.tsx
  │   ├── prediction-explainer.tsx
  │   └── formula-renderer.tsx
  └── feature-optimization/
      ├── correlation-matrix.tsx
      ├── variance-analysis.tsx
      └── optimization-results.tsx

lib/
  └── vi.ts                       # 300+ Vietnamese translations
```

**Key UI Libraries:**
- shadcn/ui (Radix UI components)
- Recharts (data visualization)
- Tailwind CSS v4
- react-hook-form + Zod (form validation)
- Lucide Icons

**Environment:**
- `NEXT_PUBLIC_API_BASE_URL` — Backend API URL (derived from `.env`)

### Backend (FastAPI + scikit-learn)

**File Structure:**
```
backend/
  ├── app/
  │   ├── main.py                 # FastAPI app, CORS, all route handlers
  │   ├── ml.py                   # ML pipeline (train, evaluate, feature ops)
  │   ├── ai_explain.py           # Claude API + Ollama explanations
  │   ├── schemas.py              # Pydantic models (request/response)
  │   ├── storage.py              # Dataset/model/experiment persistence
  │   └── __init__.py
  │
  ├── requirements.txt            # FastAPI, scikit-learn, pandas, numpy, anthropic
  ├── tests/                       # Unit tests
  │   └── run_tests.sh            # Run all pytest tests
  ├── Dockerfile                  # Python 3.11 + ML libs
  └── README.md                   # Backend-specific docs
```

**Key Implementation Details:**
- **Leakage-safe:** train/test split happens before fitting transformers — transformers learn from train set only
- **Stratified split:** Automatically falls back for small classes
- **Algorithms:** Each has auto-configuration (e.g., MultinomialNB uses MinMaxScaler, BernoulliNB uses Binarizer)
- **Cross-validation:** Optional K-Fold (3/5/10), returns mean±std metrics
- **AUC:** Binary ROC, multiclass OVR macro; returns `null` when not computable
- **Concurrency:** experiments.json protected by filelock

**API Endpoints:**
```
POST   /api/datasets/upload           # Upload CSV
GET    /api/datasets/{id}             # Dataset info + preview
POST   /api/preprocess/fit_transform  # Preprocess + validate
POST   /api/features/report           # Correlation matrix + variance report
POST   /api/train                     # Train model(s)
GET    /api/experiments               # List all experiments
GET    /api/experiments/{id}          # Experiment details
POST   /api/predict                   # Predict on new data
GET    /health                        # Health check
GET    /docs                          # Interactive API docs (Swagger)
```

---

## Environment Configuration

### AI/Claude API Setup

**For AI-powered explanations** (in `/explainability` and prediction explanations):

**Option 1: Claude API (Primary, Recommended)**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."  # Get from https://console.anthropic.com
# Then start: make dev
```

**Option 2: Ollama (Fallback)**
```bash
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b  # or your preferred model
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_MODEL="qwen2.5:7b"
export AI_PRIMARY="ollama"
```

**Option 3: Fallback mode (no API keys)**
- No setup needed — uses Vietnamese template fallback
- Returns minimal explanations without AI analysis

**Development: Compare Claude vs Ollama**
```bash
export AI_COMPARE_MODE="true"
export AI_COMPARE_LOG="/tmp/ai_compare.jsonl"
# Both APIs run in parallel; Claude result returned, comparison logged
```

### `.env` (Single Source of Truth)

Copy from `.env.example` and set:

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_HOST` | Auto-detect LAN IP | VM IP or hostname |
| `PUBLIC_PROTO` | `http` | `http` or `https` |
| `WEB_PORT` | `3000` | Frontend port |
| `API_PORT` | `8000` | Backend API port |
| `MAX_UPLOAD_MB` | `200` | Max CSV upload size |
| `MAX_CAT_CATEGORIES` | `2000` | Max unique values per column |

### Derived (Auto-computed)

| Variable | Computed as |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `PUBLIC_PROTO://PUBLIC_HOST:API_PORT` |
| `ALLOWED_ORIGINS` | `PUBLIC_PROTO://PUBLIC_HOST:WEB_PORT` |

---

## Key Design Decisions

### 1. **Data Leakage Prevention**
- Train/test split happens **first**, before any transformer fitting
- Transformers (scalers, encoders) learn from train set only
- Test set is transformed using fitted train set parameters
- This ensures realistic evaluation metrics

### 2. **Multiple Algorithm Support**
- 10 algorithms available simultaneously
- Users select 1-10 to train in parallel
- Each algorithm auto-configured (e.g., MultinomialNB→MinMaxScaler)
- Results compared side-by-side in evaluation

### 3. **Feature Optimization**
- Optional step between preprocessing and training
- Reduces 60+ features to 6 best features
- ~30% faster training without accuracy loss
- Shows correlation matrix + variance analysis

### 4. **Model Explainability**
- 8-component explanation per algorithm (formula, pros/cons, when to use, etc.)
- Per-prediction explanation (feature contributions, confidence)
- Formula rendering with mathematical notation
- **AI-Powered Explanations:** Uses Claude Opus 4.6 API to generate natural language analysis
  - Controlled via `ANTHROPIC_API_KEY` environment variable
  - Falls back to Ollama (if `OLLAMA_BASE_URL` set) or template-based fallback
  - See Environment Configuration section for setup

### 5. **Localization (Vietnamese)**
- 300+ translations in `lib/vi.ts`
- Full UI in Vietnamese (no English fallback)
- Algorithm names, metrics, instructions all translated

### 6. **Concurrency Safety**
- experiments.json protected by filelock
- Safe for multiple simultaneous training jobs
- Filelock acquired before write, released after

---

## File Organization Notes

### When Modifying Existing Features:
- Frontend pages are route-based: `app/{feature}/page.tsx`
- Components in `components/{feature}/` match page structure
- API endpoints in `backend/app/endpoints/` — one file per domain
- Utility functions in `backend/app/utils/` — no leakage-safe logic in endpoints

### When Adding New Features:
- Create `app/{feature}/page.tsx` for the page
- Create `components/{feature}/` directory for components
- Create `backend/app/endpoints/{feature}.py` for routes
- Update `backend/app/main.py` to import new routes
- Add translations to `lib/vi.ts` if UI-facing
- Add Pydantic models to `backend/app/models.py`

### Data Storage:
- `data/datasets/` — uploaded CSVs
- `data/models/` — trained models (scikit-learn format)
- `data/experiments/` — experiments.json (experiment history + metadata)

---

## Docker & Deployment

### Multi-Stage Build
- Frontend stage: pnpm install → next build
- Backend stage: pip install → FastAPI ready
- Final stage: combines both, serves on ports 3000 (frontend) and 8000 (API)

### Volume Mounts (docker-compose.yml)
- `./data/datasets:/app/data/datasets`
- `./data/models:/app/data/models`
- `./data/experiments:/app/data/experiments`

### Health Checks
- Both services have health check endpoints
- Frontend: HTTP 200 on `/`
- Backend: JSON `{"status":"ok"}` on `/health`

### Auto-Start (systemd)
```bash
sudo bash scripts/install-service.sh
systemctl status ddoswep
systemctl stop ddoswep
journalctl -u ddoswep -f
```

---

## Testing

### Backend Tests
```bash
cd backend
bash run_tests.sh

# Or run pytest directly with options:
pytest tests/ -v                    # Verbose
pytest tests/ -k test_upload        # Filter by test name
pytest tests/test_training.py       # Single file
```

**Test Coverage:**
- Dataset upload validation
- Preprocessing leakage safety (train/test split order)
- Algorithm training + metrics correctness
- Prediction and explanation endpoints
- Edge cases (small classes, missing values, etc.)

### Frontend Tests
```bash
pnpm run lint                       # ESLint
# Unit tests: not yet implemented (use pnpm test if added)
```

---

## Troubleshooting

### Port Already in Use
```bash
# Safely stop services on ports 3000/8000/8001
bash scripts/stop-ports.sh

# Or manually:
sudo ss -tlnp 'sport = :8000'
sudo kill -9 <PID>
```

### `next: not found` / Missing node_modules
```bash
make install
# or: npm install -g pnpm && pnpm install
```

### Docker DNS Issues
- `docker-compose.yml` already sets `dns: [8.8.8.8, 1.1.1.1]`
- For build-time DNS, configure Docker daemon: `/etc/docker/daemon.json`
- If offline, pre-build and export: `docker save ddos-api | gzip > ddos-api.tar.gz`

### systemd Service Not Starting
```bash
journalctl -u ddoswep -n 50 --no-pager
systemctl status docker
sudo bash scripts/install-service.sh
```

### Claude API Not Available / Missing ANTHROPIC_API_KEY

The system gracefully falls back:
1. If `ANTHROPIC_API_KEY` not set → tries Ollama
2. If Ollama not available → uses Vietnamese template fallback
3. User sees basic explanations without AI analysis (still functional)

To verify which mode is active:
```bash
# Check logs:
make logs | grep -i "claude\|ollama\|fallback"

# Or directly test the explain endpoint:
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"dataset_id":"...", "experiment_id":"...", "new_data":...}'
# Look for "explanation" field in response
```

---

## Development Patterns

### Frontend Async Calls
- All API calls use `fetch` or custom hooks from `components/`
- Base URL derived from `NEXT_PUBLIC_API_BASE_URL` (set during build/dev)
- Error handling with try/catch + user feedback via toast

### Backend Request/Response
- Pydantic models for validation (in `models.py`)
- Routes return JSON responses (automatic serialization)
- CORS enabled for `ALLOWED_ORIGINS`
- Health checks return `{"status":"ok","allowed_origins":[...]}`

### ML Pipeline Flow
```
CSV Upload → Preprocess (fit on train) → Feature Report
  → Feature Optimization (optional)
  → Train (1-10 algorithms) → Evaluate (metrics + curves)
  → Predict (new data) → Explain (AI-powered + local)
```

**Data Persistence:**
- Datasets: `data/datasets/{dataset_id}.parquet`
- Models: `data/models/{experiment_id}.pkl` (scikit-learn joblib format)
- Experiments: `data/experiments/experiments.json` (metadata + metrics)

Each step saves intermediate artifacts for resuming.

### AI Explanations (backend/app/ai_explain.py)
- **Primary:** Claude Opus 4.6 via Anthropic API (requires `ANTHROPIC_API_KEY`)
- **Secondary:** Ollama local model (if `OLLAMA_BASE_URL` and `OLLAMA_MODEL` set)
- **Fallback:** Minimal Vietnamese template (no API keys needed)
- **Compare Mode:** For testing, run both Claude + Ollama in parallel and log comparison
- Used by: `/explainability` page, prediction explanation, global model analysis

---

## Development Notes

### Backend Module Breakdown
- **main.py**: Route handlers, CORS, health checks, file upload/download logic
- **ml.py**: ML pipeline orchestration — training, evaluation, feature selection, prediction
- **ai_explain.py**: Claude/Ollama integration for AI-powered explanations
- **schemas.py**: Pydantic request/response models for all endpoints
- **storage.py**: Persistence layer — dataset, model, experiment CRUD with filelock

### Common Development Tasks

**Adding a new ML algorithm:**
1. Add to `ml.py` in the `ALGORITHMS` dict with auto-configuration
2. Update frontend `lib/vi.ts` with Vietnamese name/description
3. Test with `cd backend && pytest tests/test_training.py -k <algo_name>`
4. Update CLAUDE.md if algorithm has special preprocessing needs

**Modifying preprocessing pipeline:**
1. Edit `ml.py:run_preprocess()` — ensure leakage safety (train split FIRST)
2. Test with: `pytest tests/test_preprocessing.py -v`
3. Check that transformers are fitted on train set only
4. Update `FeatureReportResponse` schema if new fields added

**Updating AI explanations:**
1. Edit `ai_explain.py` for prompt/template changes
2. Test with `AI_COMPARE_MODE=true` to compare Claude vs Ollama
3. Check `AI_COMPARE_LOG` for divergence
4. Ensure fallback template still works without API keys

**Debugging model metrics:**
1. Add logging to `ml.py:run_metrics()`
2. Use `pytest tests/ -s` to see print statements
3. Check experiments.json structure in `data/experiments/`
4. Verify dataset state in `data/datasets/` (parquet files)

---

## References

- Main README: `README.md` (English) and `README_VI.md` (Vietnamese)
- Docker docs: `DOCKER.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Backend docs: `backend/README.md`
- API docs (live): `http://localhost:8000/docs` (Swagger)
- Scripts: `scripts/` directory
  - `stop-ports.sh` — Free ports
  - `compose.sh` — docker compose wrapper
  - `setup-env.sh` — Detect IP, write .env
  - `verify.sh` — Health + reachability checks
  - `install-service.sh` — systemd auto-start
