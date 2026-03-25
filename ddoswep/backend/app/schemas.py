from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


# ── Dataset ──────────────────────────────────────────────────────────────────

class DatasetResponse(BaseModel):
    dataset_id: str
    columns: List[str]
    total_rows: int
    total_columns: int
    preview: List[Dict[str, Any]]
    dtypes: Dict[str, str]


# ── Preprocess ───────────────────────────────────────────────────────────────

class PreprocessRequest(BaseModel):
    dataset_id: str
    target_column: str
    missing_strategy: str = "mean"         # drop|mean|median|most_frequent
    scaling: str = "standard"             # none|standard|minmax|robust
    categorical_encoding: str = "onehot"  # onehot|label
    balance: str = "none"                 # none|undersample
    test_size: float = 0.2
    random_state: int = 42


class PreprocessReport(BaseModel):
    rows_before: int
    rows_after: int
    dropped_columns: List[str]
    categorical_columns: List[str]
    numeric_columns: List[str]
    class_distribution_before: Dict[str, int]
    class_distribution_after: Dict[str, int]
    warnings: List[str] = Field(default_factory=list)


class PreprocessTrace(BaseModel):
    missing_strategy: str
    scaling: str
    categorical_encoding: str
    balance: str
    train_test_split: Dict[str, Any]
    numeric_columns: List[str]
    categorical_columns: List[str]
    output_feature_count_estimate: int


class PreprocessResponse(BaseModel):
    preprocess_id: str
    processed_dataset_id: str
    report: PreprocessReport
    trace: PreprocessTrace


# ── Features ─────────────────────────────────────────────────────────────────

class FeatureReportRequest(BaseModel):
    dataset_id: str
    target_column: str
    selection_id: Optional[str] = None  # if provided, report filters to kept_features


class CorrelationPair(BaseModel):
    feature_a: str
    feature_b: str
    corr: float


class LowVarianceFeature(BaseModel):
    feature: str
    variance: float


class FeatureReportTrace(BaseModel):
    based_on: str
    numeric_only: bool


class FeatureReportResponse(BaseModel):
    correlation_top_pairs: List[CorrelationPair]
    low_variance_features: List[LowVarianceFeature]
    recommended_drop: List[str]
    recommended_keep: List[str]
    trace: Optional[FeatureReportTrace] = None


class FeatureApplyRequest(BaseModel):
    dataset_id: str
    target_column: str
    mode: str = "drop"    # "drop" | "keep"
    features: List[str]   # features to drop (if mode=drop) or keep (if mode=keep)


class FeatureApplyTrace(BaseModel):
    mode: str
    applied_to: str
    kept_count: int
    dropped_count: int


class FeatureApplyResponse(BaseModel):
    selection_id: str
    kept_features: List[str]
    dropped_features: List[str]
    trace: FeatureApplyTrace


# ── Train ─────────────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    algorithm: str  # ann|svm|nb-gaussian|nb-multinomial|nb-bernoulli|logistic|knn|dt|rf|xgb
    hyperparams: Dict[str, Any] = Field(default_factory=dict)
    cv_folds: Optional[int] = None
    preprocess_id: Optional[str] = None
    selection_id: Optional[str] = None


class Metrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1Score: float
    auc: Optional[float] = None
    auc_note: Optional[str] = None
    specificity: float


class ConfusionMatrixResult(BaseModel):
    tn: int
    fp: int
    fn: int
    tp: int


class CVMetrics(BaseModel):
    accuracy_mean: float
    accuracy_std: float
    f1_mean: float
    f1_std: float
    precision_mean: float
    precision_std: float
    recall_mean: float
    recall_std: float
    auc_mean: Optional[float] = None
    auc_std: Optional[float] = None
    cv_folds: int
    random_state: int


class TrainTrace(BaseModel):
    preprocess_id: Optional[str] = None
    selection_id: Optional[str] = None
    algorithm: str
    hyperparams: Dict[str, Any]
    scaling: str
    categorical_encoding: str
    missing_strategy: str
    final_feature_count: int
    raw_feature_names: List[str]


class TrainResponse(BaseModel):
    experiment_id: str
    model_id: str
    algorithm: str
    training_time_sec: float
    metrics: Metrics
    confusion_matrix: ConfusionMatrixResult
    status: str = "ok"
    skip_reason: Optional[str] = None
    cv_metrics: Optional[CVMetrics] = None
    trace: Optional[TrainTrace] = None


# ── Experiments ───────────────────────────────────────────────────────────────

class ExperimentSummary(BaseModel):
    id: str
    name: str
    algorithm: str
    accuracy: float
    f1Score: float
    trainingTime: float
    date: str
    featured: bool = False


class ExperimentDetail(BaseModel):
    experiment: Dict[str, Any]
    metrics: Metrics
    confusion_matrix: ConfusionMatrixResult
    hyperparams: Dict[str, Any]
    cv_metrics: Optional[CVMetrics] = None
    trace: Optional[TrainTrace] = None


# ── Predict ───────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    model_id: str
    features: Dict[str, Any]


class PredictResponse(BaseModel):
    prediction: Any
    probability: Optional[float] = None


# ── Explain ───────────────────────────────────────────────────────────────────

class GlobalFeatureImportance(BaseModel):
    name: str
    score: float


class AICompareData(BaseModel):
    """Holds both Claude and Ollama results for side-by-side comparison."""
    claude: Optional[Any] = None
    ollama: Optional[Any] = None
    model_claude: str = "claude-opus-4-6"
    model_ollama: str = "qwen2.5:7b"


class GlobalExplainResponse(BaseModel):
    method: str
    top_features: List[GlobalFeatureImportance]
    notes: str
    compare_data: Optional[AICompareData] = None


class LocalContribution(BaseModel):
    feature_original: str
    feature_vi: str
    input_value: Any
    direction: str   # toward_ddos | toward_benign | positive | negative
    impact: float
    comparison: Dict[str, Any] = Field(default_factory=dict)


class ExplainTrace(BaseModel):
    used_preprocess_id: Optional[str] = None
    used_selection_id: Optional[str] = None
    scaling: str
    encoding: str
    note: str


class LocalExplainRequest(BaseModel):
    features: Dict[str, Any]


class LocalExplainResponse(BaseModel):
    prediction: str
    probability: Optional[float] = None
    method: str
    top_contributions: List[LocalContribution]
    vietnamese_explanation: List[str]
    trace: ExplainTrace
    compare_data: Optional[AICompareData] = None


# ── Model Details (Vietnamese) ────────────────────────────────────────────────

class ModelDetailSection(BaseModel):
    heading: str
    paragraphs: List[str] = Field(default_factory=list)
    bullets: List[str] = Field(default_factory=list)


class HyperparamVI(BaseModel):
    name: str
    value: str
    meaning_vi: str


class ModelDetailsVI(BaseModel):
    title: str
    algorithm_key: str
    sections: List[ModelDetailSection]
    hyperparams_table: List[HyperparamVI]
    how_used_in_pipeline: List[str]
    limitations_for_ddos: List[str]
    compare_data: Optional[AICompareData] = None


# ── FAMS Feature Selection ───────────────────────────────────────────────────

class FAMSRequest(BaseModel):
    dataset_id: str
    target_column: str
    preprocess_id: Optional[str] = None
    n_features: Optional[int] = None          # max features to keep; None = auto (70%)
    variance_threshold: float = 0.01
    corr_threshold: float = 0.95


class FAMSMethodResult(BaseModel):
    method: str
    selected_features: List[str]
    scores: Dict[str, float]


class FAMSResponse(BaseModel):
    selection_id: str
    kept_features: List[str]
    dropped_features: List[str]
    votes: Dict[str, int]           # feature -> number of methods that selected it
    method_results: List[FAMSMethodResult]
    n_methods: int
    min_votes: int                  # threshold used for final selection


# ── Optuna HPO ───────────────────────────────────────────────────────────────

class HPORequest(BaseModel):
    dataset_id: str
    target_column: str
    algorithm: str
    preprocess_id: Optional[str] = None
    selection_id: Optional[str] = None
    n_trials: int = 30
    cv_folds: int = 3
    timeout_sec: Optional[int] = 300         # wall-clock budget in seconds


class HPOResponse(BaseModel):
    algorithm: str
    best_params: Dict[str, Any]
    best_cv_score: float
    n_trials_completed: int
    train_response: Optional[TrainResponse] = None
    all_trials: List[Dict[str, Any]]


# ── System Metrics ────────────────────────────────────────────────────────────

class MetricsResponse(BaseModel):
    # ── Backward-compatible flat fields (kept for any consumer using old shape) ─
    uptime_sec: float
    cpu_percent: float
    ram_percent: float
    rss_mb: float
    requests_total: int
    in_flight: int
    errors_total: int
    rps_1m: float
    latency_ms: Dict[str, float]          # p50, p95, p99, avg
    endpoints: List[Dict[str, Any]]       # [{path, count, errors}] – legacy shape
    model_predict: Dict[str, Any]         # {count, avg_ms, p95_ms} – legacy shape

    # ── New nested groups ──────────────────────────────────────────────────────
    system: Dict[str, Any]   # cpu / memory / process / disk / net
    http: Dict[str, Any]     # requests / rps / status / latency / per-endpoint
    ml: Dict[str, Any]       # predict / explain_local / train / last_model
