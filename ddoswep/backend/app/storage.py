"""Filesystem-based storage helpers (concurrency-safe via filelock)."""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from filelock import FileLock

DATA_DIR = Path(os.getenv("DATA_DIR", str(Path(__file__).resolve().parents[2] / "data")))
DATASETS_DIR = DATA_DIR / "datasets"
MODELS_DIR = DATA_DIR / "models"
PREPROCESS_DIR = DATA_DIR / "preprocess"
SELECTIONS_DIR = DATA_DIR / "selections"
EXPERIMENTS_FILE = DATA_DIR / "experiments" / "experiments.json"
_LOCK_FILE = DATA_DIR / "experiments" / "experiments.lock"


def _ensure_dirs() -> None:
    for d in [DATASETS_DIR, MODELS_DIR, PREPROCESS_DIR, SELECTIONS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    EXPERIMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)


_ensure_dirs()


# ── Dataset ──────────────────────────────────────────────────────────────────

def save_dataset(dataset_id: str, df: pd.DataFrame) -> Path:
    path = DATASETS_DIR / f"{dataset_id}.parquet"
    df.to_parquet(path, index=False)
    return path


def load_dataset(dataset_id: str) -> pd.DataFrame:
    path = DATASETS_DIR / f"{dataset_id}.parquet"
    if not path.exists():
        path = DATASETS_DIR / f"{dataset_id}.csv"
        if not path.exists():
            raise FileNotFoundError(f"Dataset {dataset_id} not found")
        return pd.read_csv(path)
    return pd.read_parquet(path)


def dataset_exists(dataset_id: str) -> bool:
    return (DATASETS_DIR / f"{dataset_id}.parquet").exists() or (
        DATASETS_DIR / f"{dataset_id}.csv"
    ).exists()


# ── Preprocess Meta Artifact ──────────────────────────────────────────────────

def save_preprocess_meta(preprocess_id: str, meta: Dict[str, Any]) -> None:
    with open(PREPROCESS_DIR / f"{preprocess_id}.json", "w") as f:
        json.dump(meta, f, indent=2, default=str)


def load_preprocess_meta(preprocess_id: str) -> Dict[str, Any]:
    path = PREPROCESS_DIR / f"{preprocess_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Preprocess meta {preprocess_id} not found")
    with open(path) as f:
        return json.load(f)


def preprocess_exists(preprocess_id: str) -> bool:
    return (PREPROCESS_DIR / f"{preprocess_id}.json").exists()


def save_preprocess_artifact(preprocess_id: str, obj: Any) -> None:
    """Save the reference ColumnTransformer (schema-only, fitted on full X) as joblib."""
    joblib.dump(obj, PREPROCESS_DIR / f"{preprocess_id}.joblib")


def load_preprocess_artifact(preprocess_id: str) -> Any:
    path = PREPROCESS_DIR / f"{preprocess_id}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Preprocess artifact joblib {preprocess_id} not found")
    return joblib.load(path)


def preprocess_artifact_exists(preprocess_id: str) -> bool:
    return (PREPROCESS_DIR / f"{preprocess_id}.joblib").exists()


# ── Feature Selection Artifact ────────────────────────────────────────────────

def save_selection(selection_id: str, data: Dict[str, Any]) -> None:
    with open(SELECTIONS_DIR / f"{selection_id}.json", "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_selection(selection_id: str) -> Dict[str, Any]:
    path = SELECTIONS_DIR / f"{selection_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Selection {selection_id} not found")
    with open(path) as f:
        return json.load(f)


def selection_exists(selection_id: str) -> bool:
    return (SELECTIONS_DIR / f"{selection_id}.json").exists()


# ── Model ─────────────────────────────────────────────────────────────────────

def save_model(model_id: str, payload: Any) -> Path:
    path = MODELS_DIR / f"{model_id}.joblib"
    joblib.dump(payload, path)
    return path


def load_model(model_id: str) -> Any:
    path = MODELS_DIR / f"{model_id}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Model {model_id} not found")
    return joblib.load(path)


def save_test_sample(model_id: str, X_sample: pd.DataFrame, y_sample: np.ndarray) -> None:
    """Save test sample to separate files to keep model joblib lean."""
    X_sample.to_parquet(MODELS_DIR / f"{model_id}_test_sample.parquet", index=False)
    np.save(MODELS_DIR / f"{model_id}_test_sample_y.npy", y_sample)


def load_test_sample(model_id: str) -> Tuple[Optional[pd.DataFrame], Optional[np.ndarray]]:
    x_path = MODELS_DIR / f"{model_id}_test_sample.parquet"
    y_path = MODELS_DIR / f"{model_id}_test_sample_y.npy"
    if not x_path.exists() or not y_path.exists():
        return None, None
    return pd.read_parquet(x_path), np.load(y_path, allow_pickle=True)


def test_sample_exists(model_id: str) -> bool:
    return (
        (MODELS_DIR / f"{model_id}_test_sample.parquet").exists()
        and (MODELS_DIR / f"{model_id}_test_sample_y.npy").exists()
    )


def save_model_meta(model_id: str, meta: Dict[str, Any]) -> None:
    with open(MODELS_DIR / f"{model_id}.json", "w") as f:
        json.dump(meta, f, indent=2, default=str)


def load_model_meta(model_id: str) -> Dict[str, Any]:
    path = MODELS_DIR / f"{model_id}.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


# ── Experiments (concurrency-safe) ───────────────────────────────────────────

def _load_experiments_unsafe() -> List[Dict[str, Any]]:
    if not EXPERIMENTS_FILE.exists():
        return []
    with open(EXPERIMENTS_FILE, "r") as f:
        return json.load(f)


def _save_experiments_unsafe(experiments: List[Dict[str, Any]]) -> None:
    with open(EXPERIMENTS_FILE, "w") as f:
        json.dump(experiments, f, indent=2, default=str)


def append_experiment(record: Dict[str, Any]) -> None:
    with FileLock(str(_LOCK_FILE), timeout=10):
        experiments = _load_experiments_unsafe()
        experiments.append(record)
        _save_experiments_unsafe(experiments)


def list_experiments() -> List[Dict[str, Any]]:
    with FileLock(str(_LOCK_FILE), timeout=10):
        return _load_experiments_unsafe()


def get_experiment(experiment_id: str) -> Optional[Dict[str, Any]]:
    with FileLock(str(_LOCK_FILE), timeout=10):
        for exp in _load_experiments_unsafe():
            if exp.get("id") == experiment_id:
                return exp
    return None
