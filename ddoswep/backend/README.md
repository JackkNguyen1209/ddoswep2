# DDoS Detection – FastAPI Backend

## Run locally

```bash
pip install -r requirements.txt
DATA_DIR=./data uvicorn app.main:app --reload --port 8000
```

## API docs

Visit http://localhost:8000/docs

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/datasets/upload | Upload CSV, returns dataset_id + preview |
| GET  | /api/datasets/{id} | Get dataset info |
| POST | /api/preprocess/fit_transform | Preprocess (leakage-safe) |
| POST | /api/features/report | Feature correlation + variance report |
| POST | /api/train | Train model, returns metrics |
| GET  | /api/experiments | List all experiments |
| GET  | /api/experiments/{id} | Experiment detail |
| POST | /api/predict | Run prediction |
