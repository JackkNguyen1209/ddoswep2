"""ML logic: preprocess, feature report, train, evaluate, predict, explain."""
import datetime
import logging
import os
import time
import uuid
import warnings
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import (
    RFE,
    SelectFromModel,
    VarianceThreshold,
    mutual_info_classif,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import BernoulliNB, GaussianNB, MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    Binarizer,
    LabelEncoder,
    MinMaxScaler,
    OneHotEncoder,
    OrdinalEncoder,
    RobustScaler,
    StandardScaler,
)
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils import resample

from .schemas import (
    ConfusionMatrixResult,
    CVMetrics,
    ExplainTrace,
    FeatureReportResponse,
    FeatureReportTrace,
    GlobalExplainResponse,
    GlobalFeatureImportance,
    LocalContribution,
    LocalExplainResponse,
    Metrics,
    ModelDetailSection,
    ModelDetailsVI,
    HyperparamVI,
    PreprocessReport,
    PreprocessTrace,
    TrainResponse,
    TrainTrace,
)
from .storage import (
    append_experiment,
    load_dataset,
    load_model,
    load_model_meta,
    load_preprocess_meta,
    load_selection,
    load_test_sample,
    preprocess_artifact_exists,
    preprocess_exists,
    save_dataset,
    save_model,
    save_model_meta,
    save_preprocess_artifact,
    save_preprocess_meta,
    save_selection,
    save_test_sample,
    selection_exists,
)

logger = logging.getLogger(__name__)

ALGO_NAMES: Dict[str, str] = {
    "ann": "Artificial Neural Network",
    "svm": "Support Vector Machine",
    "nb-gaussian": "Gaussian Naive Bayes",
    "nb-multinomial": "Multinomial Naive Bayes",
    "nb-bernoulli": "Bernoulli Naive Bayes",
    "logistic": "Logistic Regression",
    "knn": "K-Nearest Neighbors",
    "dt": "Decision Tree",
    "rf": "Random Forest",
    "xgb": "XGBoost",
    "gb": "Gradient Boosting",
}


# ── helpers ──────────────────────────────────────────────────────────────────

def _dtype_label(dtype: np.dtype) -> str:
    if pd.api.types.is_bool_dtype(dtype):
        return "bool"
    if pd.api.types.is_integer_dtype(dtype):
        return "int"
    if pd.api.types.is_float_dtype(dtype):
        return "float"
    return "string"


def df_to_preview(df: pd.DataFrame, n: int = 100) -> List[Dict[str, Any]]:
    preview = df.head(n).copy()
    for col in preview.columns:
        if pd.api.types.is_datetime64_any_dtype(preview[col]):
            preview[col] = preview[col].astype(str)
    return preview.where(pd.notnull(preview), None).to_dict(orient="records")


def _stratified_split(X: Any, y: Any, test_size: float, random_state: int) -> Tuple:
    warn_msg = None
    try:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if len(np.unique(y)) > 1 else None,
        )
    except ValueError as e:
        warn_msg = f"Stratified split failed ({e}), using random split."
        logger.warning(warn_msg)
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
        )
    return X_tr, X_te, y_tr, y_te, warn_msg


def _compute_auc(pipeline: Any, X_test: Any, y_test: Any, classes: np.ndarray) -> Tuple[Optional[float], Optional[str]]:
    n_classes = len(classes)
    try:
        if hasattr(pipeline, "predict_proba"):
            y_prob = pipeline.predict_proba(X_test)
            if n_classes == 2:
                return round(float(roc_auc_score(y_test, y_prob[:, 1])), 4), None
            return round(float(roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro")), 4), None
        elif hasattr(pipeline, "decision_function"):
            scores = pipeline.decision_function(X_test)
            if n_classes == 2:
                return round(float(roc_auc_score(y_test, scores)), 4), None
            return round(float(roc_auc_score(y_test, scores, multi_class="ovr", average="macro")), 4), None
        return None, "classifier does not support predict_proba or decision_function"
    except Exception as ex:
        return None, str(ex)


def _build_num_pipeline(missing_strategy: str, scaling: str) -> Pipeline:
    imp_strategy = "mean" if missing_strategy == "drop" else missing_strategy
    steps: List[Tuple[str, Any]] = [("imputer", SimpleImputer(strategy=imp_strategy))]
    if scaling == "standard":
        steps.append(("scaler", StandardScaler()))
    elif scaling == "minmax":
        steps.append(("scaler", MinMaxScaler()))
    elif scaling == "robust":
        steps.append(("scaler", RobustScaler()))
    # scaling == "none": no scaler
    return Pipeline(steps)


def _build_cat_pipeline(missing_strategy: str, encoding: str) -> Pipeline:
    steps: List[Tuple[str, Any]] = [("imputer", SimpleImputer(strategy="most_frequent"))]
    if encoding == "onehot":
        steps.append(("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)))
    else:  # label
        steps.append(("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)))
    return Pipeline(steps)


def _build_preprocessor_from_config(
    numeric_cols: List[str],
    categorical_cols: List[str],
    missing_strategy: str,
    scaling: str,
    encoding: str,
    force_minmax: bool = False,
) -> Any:
    effective_scaling = "minmax" if force_minmax else scaling
    transformers = []
    if numeric_cols:
        transformers.append(("num", _build_num_pipeline(missing_strategy, effective_scaling), numeric_cols))
    if categorical_cols:
        transformers.append(("cat", _build_cat_pipeline(missing_strategy, encoding), categorical_cols))
    if not transformers:
        return "passthrough"
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _build_preprocessor_with_frozen_cats(
    numeric_cols: List[str],
    categorical_cols: List[str],
    missing_strategy: str,
    scaling: str,
    encoding: str,
    cat_categories: Optional[Dict[str, List[str]]] = None,
    force_minmax: bool = False,
) -> Any:
    """Like _build_preprocessor_from_config but uses frozen OHE categories for consistency.
    Scaler is still fitted on train (leakage-safe). Categories are from the full dataset."""
    effective_scaling = "minmax" if force_minmax else scaling
    transformers = []
    if numeric_cols:
        transformers.append(("num", _build_num_pipeline(missing_strategy, effective_scaling), numeric_cols))
    if categorical_cols:
        imp_steps: List[Tuple[str, Any]] = [("imputer", SimpleImputer(strategy="most_frequent"))]
        if encoding == "onehot":
            # Use frozen categories if available for ALL selected cat cols
            if cat_categories and all(col in cat_categories for col in categorical_cols):
                frozen = [np.array(cat_categories[col]) for col in categorical_cols]
                ohe = OneHotEncoder(categories=frozen, handle_unknown="ignore", sparse_output=False)
            else:
                ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
            imp_steps.append(("encoder", ohe))
        else:
            imp_steps.append(("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)))
        transformers.append(("cat", Pipeline(imp_steps), categorical_cols))
    if not transformers:
        return "passthrough"
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _build_feature_mapping(
    preprocessor: Any,
    numeric_cols: List[str],
    categorical_cols: List[str],
    encoding: str,
) -> Dict[str, List[int]]:
    """Map raw feature name → list of column indices in transformed output."""
    raw_to_idx: Dict[str, List[int]] = {}
    idx = 0
    for raw in numeric_cols:
        raw_to_idx[raw] = [idx]
        idx += 1
    if categorical_cols:
        if encoding == "onehot":
            try:
                cat_t = preprocessor.named_transformers_["cat"]
                ohe = cat_t.named_steps["encoder"]
                for i, raw in enumerate(categorical_cols):
                    n_cats = len(ohe.categories_[i])
                    raw_to_idx[raw] = list(range(idx, idx + n_cats))
                    idx += n_cats
            except Exception:
                for raw in categorical_cols:
                    raw_to_idx[raw] = [idx]
                    idx += 1
        else:
            for raw in categorical_cols:
                raw_to_idx[raw] = [idx]
                idx += 1
    return raw_to_idx


def _estimate_transformed_count(
    numeric_cols: List[str],
    categorical_cols: List[str],
    encoding: str,
    df: pd.DataFrame,
) -> int:
    n = len(numeric_cols)
    if encoding == "onehot":
        for col in categorical_cols:
            n += df[col].nunique()
    else:
        n += len(categorical_cols)
    return n


def _cm_to_dict(cm: np.ndarray, classes: np.ndarray) -> Tuple[int, int, int, int]:
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
    else:
        tp = int(np.diag(cm).sum())
        fn = int((cm.sum(axis=1) - np.diag(cm)).sum())
        fp = int((cm.sum(axis=0) - np.diag(cm)).sum())
        tn = int(cm.sum() - tp - fn - fp)
    return int(tn), int(fp), int(fn), int(tp)


# ── preprocess ───────────────────────────────────────────────────────────────

def run_preprocess(
    dataset_id: str,
    target_column: str,
    missing_strategy: str,
    scaling: str,
    categorical_encoding: str,
    balance: str,
    test_size: float,
    random_state: int,
) -> Tuple[str, str, PreprocessReport, PreprocessTrace]:
    """Returns (preprocess_id, processed_dataset_id, report, trace)."""
    df = load_dataset(dataset_id)
    rows_before = len(df)
    warn_msgs: List[str] = []

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset")

    y = df[target_column].copy()
    X = df.drop(columns=[target_column])

    # Drop columns with >50% missing
    drop_cols = [c for c in X.columns if X[c].isna().mean() > 0.5]
    X = X.drop(columns=drop_cols)
    if drop_cols:
        warn_msgs.append(f"Dropped {len(drop_cols)} column(s) with >50% missing: {drop_cols}")

    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

    if missing_strategy == "drop":
        mask = X.notna().all(axis=1)
        X = X[mask]
        y = y[mask]

    class_dist_before = {str(k): int(v) for k, v in y.value_counts().to_dict().items()}

    # NOTE: balance/undersample is intentionally NOT applied here.
    # It is applied in run_train AFTER the train/test split, on X_train only,
    # so the test set is never contaminated by resampling.
    class_dist_after = class_dist_before

    # Stratified split check (for report warning only; actual split in run_train)
    _, _, _, _, split_warn = _stratified_split(X.values, y.values, test_size, random_state)
    if split_warn:
        warn_msgs.append(split_warn)

    # Freeze categorical categories for consistent OHE encoding in run_train
    # Columns with too many unique values are excluded (high-cardinality guard)
    _MAX_CAT = int(os.getenv("MAX_CAT_CATEGORIES", "2000"))
    cat_categories_snapshot: Dict[str, List[str]] = {}
    for col in categorical_cols:
        uniq = sorted(str(c) for c in X[col].dropna().unique())
        if len(uniq) > _MAX_CAT:
            warn_msgs.append(
                f"Column '{col}' has {len(uniq)} unique values > MAX_CAT_CATEGORIES={_MAX_CAT}; "
                "categories not frozen (will use OHE auto-detect from train set)."
            )
            logger.warning("Column '%s': %d unique values exceeds MAX_CAT_CATEGORIES=%d; skipping freeze", col, len(uniq), _MAX_CAT)
        else:
            cat_categories_snapshot[col] = uniq

    # Save reference ColumnTransformer (schema artifact) fitted on full X
    # This freezes imputer fill-values and OHE categories from the complete dataset.
    # Scalers in run_train are still re-fitted on X_train only (leakage-safe).
    ref_pp = _build_preprocessor_from_config(
        numeric_cols, categorical_cols, missing_strategy, scaling, categorical_encoding
    )
    if ref_pp != "passthrough":
        try:
            ref_pp.fit(X)
            save_preprocess_artifact(preprocess_id := f"prep_{dataset_id}_{uuid.uuid4().hex[:8]}", ref_pp)
        except Exception as e:
            logger.warning("Could not save reference preprocessor: %s", e)
            preprocess_id = f"prep_{dataset_id}_{uuid.uuid4().hex[:8]}"
    else:
        preprocess_id = f"prep_{dataset_id}_{uuid.uuid4().hex[:8]}"

    # Save cleaned dataset
    processed_dataset_id = f"proc_{dataset_id}_{uuid.uuid4().hex[:8]}"
    processed_df = X.copy()
    processed_df[target_column] = y.values
    save_dataset(processed_dataset_id, processed_df)

    # Estimate output feature count
    output_count = _estimate_transformed_count(numeric_cols, categorical_cols, categorical_encoding, X)

    # Save preprocess meta artifact (config + frozen schema)
    preprocess_meta = {
        "preprocess_id": preprocess_id,
        "dataset_id": dataset_id,
        "processed_dataset_id": processed_dataset_id,
        "target_column": target_column,
        "missing_strategy": missing_strategy,
        "scaling": scaling,
        "categorical_encoding": categorical_encoding,
        "balance": balance,
        "test_size": test_size,
        "random_state": random_state,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "dropped_high_missing": drop_cols,
        "cat_categories_snapshot": cat_categories_snapshot,
        "rows_before": rows_before,
        "rows_after": len(X),
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    save_preprocess_meta(preprocess_id, preprocess_meta)

    report = PreprocessReport(
        rows_before=rows_before,
        rows_after=len(processed_df),
        dropped_columns=drop_cols,
        categorical_columns=categorical_cols,
        numeric_columns=numeric_cols,
        class_distribution_before=class_dist_before,
        class_distribution_after=class_dist_after,
        warnings=warn_msgs,
    )
    trace = PreprocessTrace(
        missing_strategy=missing_strategy,
        scaling=scaling,
        categorical_encoding=categorical_encoding,
        balance=balance,
        train_test_split={"test_size": test_size, "random_state": random_state},
        numeric_columns=numeric_cols,
        categorical_columns=categorical_cols,
        output_feature_count_estimate=output_count,
    )
    return preprocess_id, processed_dataset_id, report, trace


# ── feature report ────────────────────────────────────────────────────────────

def run_feature_report(
    dataset_id: str,
    target_column: str,
    selection_id: Optional[str] = None,
) -> FeatureReportResponse:
    df = load_dataset(dataset_id)
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    based_on = "raw"
    # If selection_id provided: restrict analysis to kept_features
    if selection_id and selection_exists(selection_id):
        sel = load_selection(selection_id)
        kept = [f for f in sel.get("kept_features", []) if f in df.columns and f != target_column]
        if kept:
            df = df[[*kept, target_column]]
            based_on = "selected"
            logger.info("Feature report restricted to %d kept features (selection_id=%s)", len(kept), selection_id)

    numeric_df = df.drop(columns=[target_column]).select_dtypes(include=[np.number])

    if len(numeric_df.columns) >= 2:
        corr = numeric_df.corr().abs()
        upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
        pairs = (
            upper.stack()
            .reset_index()
            .rename(columns={"level_0": "feature_a", "level_1": "feature_b", 0: "corr"})
            .sort_values("corr", ascending=False)
            .head(20)
        )
        corr_pairs = [
            {"feature_a": r["feature_a"], "feature_b": r["feature_b"], "corr": round(float(r["corr"]), 4)}
            for _, r in pairs.iterrows()
        ]
        to_drop_corr = {r["feature_b"] for _, r in pairs.iterrows() if r["corr"] >= 0.95}
    else:
        corr_pairs = []
        to_drop_corr = set()

    variances = numeric_df.var()
    low_var = variances[variances < 0.01]
    low_var_features = [{"feature": str(f), "variance": round(float(v), 6)} for f, v in low_var.items()]
    to_drop_var = set(low_var.index.tolist())

    recommended_drop = list(to_drop_corr | to_drop_var)
    recommended_keep = [c for c in numeric_df.columns if c not in recommended_drop]

    return FeatureReportResponse(
        correlation_top_pairs=corr_pairs,
        low_variance_features=low_var_features,
        recommended_drop=recommended_drop,
        recommended_keep=recommended_keep,
        trace=FeatureReportTrace(based_on=based_on, numeric_only=True),
    )


def run_feature_apply(
    dataset_id: str,
    target_column: str,
    mode: str,
    features: List[str],
) -> Dict[str, Any]:
    """Create a selection_id artifact from user's keep/drop choices."""
    df = load_dataset(dataset_id)
    all_features = [c for c in df.columns if c != target_column]

    if mode == "drop":
        dropped = [f for f in features if f in all_features]
        kept = [f for f in all_features if f not in dropped]
    else:  # keep
        kept = [f for f in features if f in all_features]
        dropped = [f for f in all_features if f not in kept]

    selection_id = f"sel_{dataset_id}_{uuid.uuid4().hex[:8]}"
    data = {
        "selection_id": selection_id,
        "dataset_id": dataset_id,
        "target_column": target_column,
        "mode": mode,
        "kept_features": kept,
        "dropped_features": dropped,
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    save_selection(selection_id, data)
    return data


# ── FAMS 5-method ensemble feature selection ─────────────────────────────────

def run_fams_selection(
    dataset_id: str,
    target_column: str,
    preprocess_id: Optional[str] = None,
    n_features: Optional[int] = None,
    variance_threshold: float = 0.01,
    corr_threshold: float = 0.95,
) -> Dict[str, Any]:
    """FAMS: 5-method ensemble voting feature selection.
    Methods: Variance Threshold, Mutual Information, RFE, Lasso L1, RF Importance.
    A feature is kept if it receives votes from >= 3 methods (majority).
    """
    # ── Load dataset ─────────────────────────────────────────────────────────
    actual_dataset_id = dataset_id
    if preprocess_id and preprocess_exists(preprocess_id):
        pmeta = load_preprocess_meta(preprocess_id)
        actual_dataset_id = pmeta.get("processed_dataset_id", dataset_id)

    df = load_dataset(actual_dataset_id)
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    X_raw = df.drop(columns=[target_column])
    y_raw = df[target_column]

    # Encode target
    le_fams = LabelEncoder()
    if y_raw.dtype == object or str(y_raw.dtype) == "category":
        y = le_fams.fit_transform(y_raw.astype(str))
    else:
        y = y_raw.values.astype(int) if np.issubdtype(y_raw.dtype, np.integer) else y_raw.values

    # ── Work on numeric columns only ─────────────────────────────────────────
    X_num = X_raw.select_dtypes(include=[np.number]).copy()
    X_num = X_num.dropna(axis=1, how="all")
    X_num = X_num.fillna(X_num.median())

    non_numeric_cols = X_raw.select_dtypes(exclude=[np.number]).columns.tolist()
    features = X_num.columns.tolist()
    n = len(features)
    if n == 0:
        raise ValueError("No numeric features found for FAMS analysis")

    k = n_features if n_features and 1 <= n_features <= n else max(2, int(n * 0.7))

    X_arr = X_num.values
    # MinMax scale for methods requiring non-negative / distance-based inputs
    from sklearn.preprocessing import MinMaxScaler as _MMS
    X_scaled = _MMS().fit_transform(X_arr)

    selected_by: Dict[str, List[str]] = {}
    scores_by: Dict[str, Dict[str, float]] = {}

    # ── Method 1: Variance Threshold ─────────────────────────────────────────
    try:
        vt = VarianceThreshold(threshold=variance_threshold)
        vt.fit(X_arr)
        m1 = [features[i] for i, s in enumerate(vt.get_support()) if s]
        selected_by["variance"] = m1
        scores_by["variance"] = {f: round(float(v), 6) for f, v in zip(features, vt.variances_)}
    except Exception as e:
        logger.warning("FAMS variance threshold failed: %s", e)
        selected_by["variance"] = features[:]
        scores_by["variance"] = {}

    # ── Method 2: Mutual Information ─────────────────────────────────────────
    try:
        mi = mutual_info_classif(X_arr, y, random_state=42)
        top_idx = np.argsort(mi)[::-1][:k]
        selected_by["mutual_info"] = [features[i] for i in sorted(top_idx)]
        scores_by["mutual_info"] = {f: round(float(s), 6) for f, s in zip(features, mi)}
    except Exception as e:
        logger.warning("FAMS mutual info failed: %s", e)
        selected_by["mutual_info"] = features[:k]
        scores_by["mutual_info"] = {}

    # ── Method 3: RFE with Random Forest ─────────────────────────────────────
    try:
        rfe_est = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
        rfe = RFE(estimator=rfe_est, n_features_to_select=k, step=max(1, int(n * 0.1)))
        rfe.fit(X_scaled, y)
        selected_by["rfe"] = [features[i] for i, s in enumerate(rfe.support_) if s]
        scores_by["rfe"] = {f: round(float(r), 4) for f, r in zip(features, rfe.ranking_)}
    except Exception as e:
        logger.warning("FAMS RFE failed: %s", e)
        selected_by["rfe"] = features[:k]
        scores_by["rfe"] = {}

    # ── Method 4: Lasso L1 regularisation ────────────────────────────────────
    try:
        lasso = LogisticRegression(C=0.1, penalty="l1", solver="liblinear", max_iter=500, random_state=42)
        lasso.fit(X_scaled, y)
        coef = np.abs(lasso.coef_)
        if coef.ndim > 1:
            coef = coef.mean(axis=0)
        top_idx = np.argsort(coef)[::-1][:k]
        selected_by["lasso"] = [features[i] for i in sorted(top_idx)]
        scores_by["lasso"] = {f: round(float(s), 6) for f, s in zip(features, coef)}
    except Exception as e:
        logger.warning("FAMS Lasso failed: %s", e)
        selected_by["lasso"] = features[:k]
        scores_by["lasso"] = {}

    # ── Method 5: Random Forest Feature Importance ───────────────────────────
    try:
        rf_est = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
        rf_est.fit(X_arr, y)
        imp = rf_est.feature_importances_
        top_idx = np.argsort(imp)[::-1][:k]
        selected_by["rf_importance"] = [features[i] for i in sorted(top_idx)]
        scores_by["rf_importance"] = {f: round(float(s), 6) for f, s in zip(features, imp)}
    except Exception as e:
        logger.warning("FAMS RF importance failed: %s", e)
        selected_by["rf_importance"] = features[:k]
        scores_by["rf_importance"] = {}

    # ── Ensemble voting ───────────────────────────────────────────────────────
    votes: Dict[str, int] = {f: 0 for f in features}
    for method_feats in selected_by.values():
        for f in method_feats:
            if f in votes:
                votes[f] += 1

    n_methods = len(selected_by)
    min_votes = max(2, (n_methods + 1) // 2)   # majority = ceil(n/2) votes
    kept_num = [f for f in features if votes[f] >= min_votes]

    # Relax threshold progressively if too few features survive
    if len(kept_num) < max(2, k // 2):
        min_votes = max(1, min_votes - 1)
        kept_num = [f for f in features if votes[f] >= min_votes]
    if len(kept_num) < 2:
        kept_num = sorted(features, key=lambda f: votes[f], reverse=True)[:k]
        min_votes = 1

    dropped_num = [f for f in features if f not in kept_num]
    # Non-numeric columns are always included in kept (we only analyse numeric ones)
    all_kept = kept_num + non_numeric_cols
    all_dropped = [c for c in X_raw.columns if c not in all_kept]

    selection_id = f"fams_{dataset_id}_{uuid.uuid4().hex[:8]}"
    sel_data = {
        "selection_id": selection_id,
        "dataset_id": dataset_id,
        "target_column": target_column,
        "mode": "keep",
        "kept_features": all_kept,
        "dropped_features": all_dropped,
        "fams_votes": votes,
        "fams_methods": list(selected_by.keys()),
        "fams_min_votes": min_votes,
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    save_selection(selection_id, sel_data)
    logger.info("FAMS: kept %d / %d numeric features (min_votes=%d)", len(kept_num), n, min_votes)

    return {
        "selection_id": selection_id,
        "kept_features": all_kept,
        "dropped_features": all_dropped,
        "votes": votes,
        "method_results": [
            {"method": m, "selected_features": feats, "scores": scores_by.get(m, {})}
            for m, feats in selected_by.items()
        ],
        "n_methods": n_methods,
        "min_votes": min_votes,
    }


# ── algorithm factory ─────────────────────────────────────────────────────────

def _build_classifier(algorithm: str, hyperparams: Dict[str, Any]) -> Any:
    hp = hyperparams or {}
    if algorithm == "ann":
        hidden = tuple([int(hp.get("neurons", 128))] * int(hp.get("layers", 3)))
        return MLPClassifier(hidden_layer_sizes=hidden, max_iter=int(hp.get("epochs", 100)),
                             batch_size=int(hp.get("batchSize", 32)), random_state=42)
    if algorithm == "svm":
        return SVC(kernel=hp.get("kernel", "rbf"), C=float(hp.get("C", 1.0)),
                   gamma=hp.get("gamma", "scale"), probability=True, random_state=42)
    if algorithm == "nb-gaussian":
        return GaussianNB()
    if algorithm == "nb-multinomial":
        return MultinomialNB(alpha=float(hp.get("alpha", 1.0)))
    if algorithm == "nb-bernoulli":
        return BernoulliNB(alpha=float(hp.get("alpha", 1.0)), fit_prior=bool(hp.get("fitPriors", True)))
    if algorithm == "logistic":
        return LogisticRegression(C=float(hp.get("C", 1.0)), solver=hp.get("solver", "lbfgs"),
                                  max_iter=int(hp.get("maxIter", 200)), random_state=42)
    if algorithm == "knn":
        return KNeighborsClassifier(n_neighbors=int(hp.get("k", 5)),
                                    metric=hp.get("metric", "euclidean"),
                                    weights=hp.get("weights", "uniform"))
    if algorithm == "dt":
        return DecisionTreeClassifier(max_depth=int(hp.get("maxDepth", 10)),
                                      min_samples_split=int(hp.get("minSamples", 2)),
                                      criterion=hp.get("criterion", "gini"), random_state=42)
    if algorithm == "rf":
        return RandomForestClassifier(n_estimators=int(hp.get("nEstimators", 100)),
                                      max_depth=int(hp.get("maxDepth", 15)),
                                      min_samples_split=int(hp.get("minSamples", 2)),
                                      random_state=42, n_jobs=-1)
    if algorithm == "xgb":
        try:
            from xgboost import XGBClassifier
            return XGBClassifier(
                n_estimators=int(hp.get("nEstimators", 100)),
                learning_rate=float(hp.get("learningRate", 0.1)),
                max_depth=int(hp.get("maxDepth", 6)),
                subsample=float(hp.get("subsample", 0.8)),
                colsample_bytree=float(hp.get("colsampleBytree", 0.8)),
                min_child_weight=int(hp.get("minChildWeight", 1)),
                random_state=42,
                n_jobs=-1,
                verbosity=0,
                eval_metric="logloss",
            )
        except ImportError:
            logger.warning("xgboost not installed; falling back to GradientBoostingClassifier")
            return GradientBoostingClassifier(
                n_estimators=int(hp.get("nEstimators", 100)),
                learning_rate=float(hp.get("learningRate", 0.1)),
                max_depth=int(hp.get("maxDepth", 5)), random_state=42,
            )
    if algorithm == "gb":
        return GradientBoostingClassifier(n_estimators=int(hp.get("nEstimators", 100)),
                                          learning_rate=float(hp.get("learningRate", 0.1)),
                                          max_depth=int(hp.get("maxDepth", 5)),
                                          subsample=float(hp.get("subsample", 1.0)),
                                          random_state=42)
    raise ValueError(f"Unknown algorithm: {algorithm}")


def _check_nb_constraints(algorithm: str) -> Tuple[bool, Optional[str], bool]:
    if algorithm == "nb-multinomial":
        return True, None, False   # force MinMaxScaler
    if algorithm == "nb-bernoulli":
        return False, None, True   # add Binarizer
    return False, None, False


# ── helpers for train ─────────────────────────────────────────────────────────

def _undersample_train(X_train: pd.DataFrame, y_train: np.ndarray, random_state: int) -> Tuple:
    """Apply random undersampling to training split only. Test set is untouched."""
    df_tmp = X_train.copy()
    df_tmp["__target__"] = y_train
    counts = df_tmp["__target__"].value_counts()
    min_count = int(counts.min())
    parts = [
        resample(df_tmp[df_tmp["__target__"] == cls], n_samples=min_count,
                 random_state=random_state, replace=False)
        for cls in counts.index
    ]
    df_tmp = pd.concat(parts).sample(frac=1, random_state=random_state)
    y_out = df_tmp["__target__"].values
    X_out = df_tmp.drop(columns=["__target__"])
    return X_out, y_out


# ── train ─────────────────────────────────────────────────────────────────────

def run_train(
    dataset_id: str,
    target_column: str,
    algorithm: str,
    hyperparams: Dict[str, Any],
    test_size: float = 0.2,
    random_state: int = 42,
    cv_folds: Optional[int] = None,
    preprocess_id: Optional[str] = None,
    selection_id: Optional[str] = None,
) -> TrainResponse:
    # ── Load preprocess config ────────────────────────────────────────────────
    scaling = "standard"
    categorical_encoding = "onehot"
    missing_strategy = "mean"
    balance = "none"
    actual_dataset_id = dataset_id
    cat_categories: Optional[Dict[str, List[str]]] = None

    if preprocess_id and preprocess_exists(preprocess_id):
        pmeta = load_preprocess_meta(preprocess_id)
        actual_dataset_id = pmeta.get("processed_dataset_id", dataset_id)
        target_column = pmeta.get("target_column", target_column)
        scaling = pmeta.get("scaling", "standard")
        categorical_encoding = pmeta.get("categorical_encoding", "onehot")
        missing_strategy = pmeta.get("missing_strategy", "mean")
        balance = pmeta.get("balance", "none")
        test_size = pmeta.get("test_size", test_size)
        random_state = pmeta.get("random_state", random_state)
        # Load frozen categories snapshot for consistent OHE encoding
        cat_categories = pmeta.get("cat_categories_snapshot")

    df = load_dataset(actual_dataset_id)
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    y_raw = df[target_column]
    X = df.drop(columns=[target_column])

    # ── Apply feature selection ───────────────────────────────────────────────
    kept_features: Optional[List[str]] = None
    if selection_id and selection_exists(selection_id):
        sel = load_selection(selection_id)
        kept_features = sel.get("kept_features")
        if kept_features:
            missing_in_data = [f for f in kept_features if f not in X.columns]
            if missing_in_data:
                raise ValueError(f"Selected features not in dataset: {missing_in_data}")
            X = X[kept_features]

    # Drop high-missing columns (guard)
    drop_cols = [c for c in X.columns if X[c].isna().mean() > 0.5]
    X = X.drop(columns=drop_cols)

    raw_feature_names = X.columns.tolist()
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

    # ── Encode target ─────────────────────────────────────────────────────────
    le: Optional[LabelEncoder] = None
    if y_raw.dtype == object or str(y_raw.dtype) == "category":
        le = LabelEncoder()
        y = le.fit_transform(y_raw.astype(str))
    else:
        y = y_raw.values.copy()

    # ── NB constraints ────────────────────────────────────────────────────────
    use_minmax, skip_reason, add_binarizer = _check_nb_constraints(algorithm)
    if skip_reason:
        return _make_skipped_response(algorithm, dataset_id, target_column, hyperparams, skip_reason)

    # ── Stratified split ──────────────────────────────────────────────────────
    X_train, X_test, y_train, y_test, split_warn = _stratified_split(X, y, test_size, random_state)

    # ── Balance (undersample) only on train split – never touches test ────────
    if balance == "undersample":
        X_train, y_train = _undersample_train(X_train, y_train, random_state)
        logger.info("Undersample applied on train split: %d rows", len(X_train))

    # ── Build pipeline using frozen categories (or auto if no preprocess_id) ──
    preprocessor = _build_preprocessor_with_frozen_cats(
        numeric_cols, categorical_cols, missing_strategy, scaling, categorical_encoding,
        cat_categories=cat_categories,
        force_minmax=use_minmax,
    )
    clf = _build_classifier(algorithm, hyperparams)

    if add_binarizer:
        full_pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("binarizer", Binarizer(threshold=0.0)),
            ("classifier", clf),
        ])
    else:
        full_pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", clf)])

    # ── CV (optional) ─────────────────────────────────────────────────────────
    cv_result: Optional[CVMetrics] = None
    if cv_folds is not None and cv_folds >= 2:
        cv_result = _run_cv(full_pipeline, X, y, cv_folds, random_state)

    # ── Fit ───────────────────────────────────────────────────────────────────
    t0 = time.time()
    full_pipeline.fit(X_train, y_train)
    training_time = round(time.time() - t0, 2)

    y_pred = full_pipeline.predict(X_test)
    classes = np.unique(np.concatenate([y_train, y_test]))
    auc, auc_note = _compute_auc(full_pipeline, X_test, y_test, classes)

    cm = confusion_matrix(y_test, y_pred, labels=classes)
    tn, fp, fn, tp = _cm_to_dict(cm, classes)

    avg = "binary" if len(classes) == 2 else "macro"
    acc = round(float(accuracy_score(y_test, y_pred)), 4)
    prec = round(float(precision_score(y_test, y_pred, average=avg, zero_division=0)), 4)
    rec = round(float(recall_score(y_test, y_pred, average=avg, zero_division=0)), 4)
    f1 = round(float(f1_score(y_test, y_pred, average=avg, zero_division=0)), 4)
    spec = round(float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0, 4)

    # ── Build feature mapping ─────────────────────────────────────────────────
    if preprocessor != "passthrough":
        raw_to_transformed_idx = _build_feature_mapping(
            preprocessor, numeric_cols, categorical_cols, categorical_encoding
        )
    else:
        raw_to_transformed_idx = {raw: [i] for i, raw in enumerate(raw_feature_names)}

    n_transformed = sum(len(v) for v in raw_to_transformed_idx.values())

    # ── Per-class feature stats (for explain comparison) ──────────────────────
    effective_scaling = "minmax" if use_minmax else scaling
    class_stats = _compute_class_stats(X_train, y_train, le, raw_feature_names, numeric_cols)

    # ── Save model ────────────────────────────────────────────────────────────
    algo_name = ALGO_NAMES.get(algorithm, algorithm)
    model_id = f"model_{uuid.uuid4().hex[:12]}"
    experiment_id = f"exp_{uuid.uuid4().hex[:12]}"

    # Save model payload (lean — no test sample embedded)
    save_model(model_id, {
        "pipeline": full_pipeline,
        "label_encoder": le,
        "target_column": target_column,
        "raw_feature_names": raw_feature_names,
    })

    # Save test sample to separate files for permutation importance (capped at 500 rows)
    n_sample = min(500, len(X_test))
    try:
        X_sample = X_test.iloc[:n_sample] if hasattr(X_test, "iloc") else pd.DataFrame(X_test[:n_sample], columns=raw_feature_names)
        save_test_sample(model_id, X_sample, y_test[:n_sample])
    except Exception as e:
        logger.warning("Could not save test sample for permutation: %s", e)

    model_meta: Dict[str, Any] = {
        "model_id": model_id,
        "algorithm": algorithm,
        "algorithm_name": algo_name,
        "hyperparams": hyperparams,
        "preprocess_id": preprocess_id,
        "selection_id": selection_id,
        "target_column": target_column,
        "raw_feature_names": raw_feature_names,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "categorical_encoding": categorical_encoding,
        "scaling": effective_scaling,
        "missing_strategy": missing_strategy,
        "n_transformed": n_transformed,
        "raw_to_transformed_idx": raw_to_transformed_idx,
        "label_classes": le.classes_.tolist() if le is not None else None,
        "class_stats": class_stats,
        "experiment_id": experiment_id,
    }
    save_model_meta(model_id, model_meta)

    train_trace = TrainTrace(
        preprocess_id=preprocess_id,
        selection_id=selection_id,
        algorithm=algo_name,
        hyperparams=hyperparams,
        scaling=effective_scaling,
        categorical_encoding=categorical_encoding,
        missing_strategy=missing_strategy,
        final_feature_count=len(raw_feature_names),
        raw_feature_names=raw_feature_names,
    )

    # ── Save experiment record ────────────────────────────────────────────────
    record: Dict[str, Any] = {
        "id": experiment_id,
        "name": f"{algo_name} {datetime.date.today().isoformat()}",
        "algorithm": algo_name,
        "accuracy": acc,
        "f1Score": f1,
        "trainingTime": training_time,
        "date": datetime.date.today().isoformat(),
        "featured": False,
        "model_id": model_id,
        "dataset_id": actual_dataset_id,
        "target_column": target_column,
        "hyperparams": hyperparams,
        "metrics": {
            "accuracy": acc, "precision": prec, "recall": rec,
            "f1Score": f1, "auc": auc, "auc_note": auc_note, "specificity": spec,
        },
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "created_at": datetime.datetime.utcnow().isoformat(),
        "status": "ok",
        "cv_folds": cv_folds,
        "cv_metrics": cv_result.model_dump() if cv_result else None,
        "split_warning": split_warn,
        "trace": train_trace.model_dump(),
    }
    append_experiment(record)

    return TrainResponse(
        experiment_id=experiment_id,
        model_id=model_id,
        algorithm=algo_name,
        training_time_sec=training_time,
        metrics=Metrics(accuracy=acc, precision=prec, recall=rec, f1Score=f1,
                        auc=auc, auc_note=auc_note, specificity=spec),
        confusion_matrix=ConfusionMatrixResult(tn=tn, fp=fp, fn=fn, tp=tp),
        status="ok",
        cv_metrics=cv_result,
        trace=train_trace,
    )


def _compute_class_stats(
    X_train: Any,
    y_train: np.ndarray,
    le: Optional[LabelEncoder],
    raw_feature_names: List[str],
    numeric_cols: List[str],
) -> Dict[str, Any]:
    X_df = X_train if isinstance(X_train, pd.DataFrame) else pd.DataFrame(X_train, columns=raw_feature_names)
    unique_classes = np.unique(y_train)
    stats: Dict[str, Any] = {}
    for cls in unique_classes:
        if le is not None:
            try:
                cls_label = str(le.inverse_transform([int(cls)])[0])
            except Exception:
                cls_label = str(cls)
        else:
            cls_label = str(cls)
        mask = (y_train == cls)
        subset = X_df[mask]
        cls_stats: Dict[str, Any] = {}
        for col in numeric_cols:
            if col in subset.columns:
                cls_stats[col] = {
                    "mean": round(float(subset[col].mean()), 4),
                    "std": round(float(subset[col].std()), 4),
                }
        stats[cls_label] = cls_stats
    return stats


def _make_skipped_response(
    algorithm: str, dataset_id: str, target_column: str,
    hyperparams: Dict[str, Any], skip_reason: str,
) -> TrainResponse:
    algo_name = ALGO_NAMES.get(algorithm, algorithm)
    experiment_id = f"exp_{uuid.uuid4().hex[:12]}"
    model_id = f"model_{uuid.uuid4().hex[:12]}"
    record = {
        "id": experiment_id, "name": f"{algo_name} {datetime.date.today().isoformat()}",
        "algorithm": algo_name, "accuracy": 0.0, "f1Score": 0.0, "trainingTime": 0.0,
        "date": datetime.date.today().isoformat(), "featured": False,
        "model_id": model_id, "dataset_id": dataset_id, "target_column": target_column,
        "hyperparams": hyperparams,
        "metrics": {"accuracy": 0, "precision": 0, "recall": 0, "f1Score": 0,
                    "auc": None, "auc_note": None, "specificity": 0},
        "confusion_matrix": {"tn": 0, "fp": 0, "fn": 0, "tp": 0},
        "created_at": datetime.datetime.utcnow().isoformat(),
        "status": "skipped_not_supported", "skip_reason": skip_reason,
    }
    append_experiment(record)
    return TrainResponse(
        experiment_id=experiment_id, model_id=model_id, algorithm=algo_name,
        training_time_sec=0.0,
        metrics=Metrics(accuracy=0, precision=0, recall=0, f1Score=0, specificity=0),
        confusion_matrix=ConfusionMatrixResult(tn=0, fp=0, fn=0, tp=0),
        status="skipped_not_supported", skip_reason=skip_reason,
    )


def _run_cv(pipeline: Any, X: Any, y: Any, n_folds: int, random_state: int) -> CVMetrics:
    avg = "binary" if len(np.unique(y)) == 2 else "macro"
    scoring = {
        "accuracy": "accuracy",
        "f1": f"f1_{avg}" if avg == "macro" else "f1",
        "precision": f"precision_{avg}" if avg == "macro" else "precision",
        "recall": f"recall_{avg}" if avg == "macro" else "recall",
    }
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=random_state)
    try:
        scores = cross_validate(pipeline, X, y, cv=cv, scoring=scoring,
                                error_score="raise", return_train_score=False)
    except Exception as e:
        logger.warning("CV failed: %s", e)
        return CVMetrics(accuracy_mean=0, accuracy_std=0, f1_mean=0, f1_std=0,
                         precision_mean=0, precision_std=0, recall_mean=0, recall_std=0,
                         cv_folds=n_folds, random_state=random_state)

    def s(key: str) -> Tuple[float, float]:
        v = scores.get(f"test_{key}", np.array([0.0]))
        return round(float(np.mean(v)), 4), round(float(np.std(v)), 4)

    acc_m, acc_s = s("accuracy")
    f1_m, f1_s = s("f1")
    p_m, p_s = s("precision")
    r_m, r_s = s("recall")
    return CVMetrics(accuracy_mean=acc_m, accuracy_std=acc_s, f1_mean=f1_m, f1_std=f1_s,
                     precision_mean=p_m, precision_std=p_s, recall_mean=r_m, recall_std=r_s,
                     cv_folds=n_folds, random_state=random_state)


# ── Optuna HPO helpers ────────────────────────────────────────────────────────

def _suggest_hyperparams(trial: Any, algorithm: str) -> Dict[str, Any]:
    """Map Optuna trial → hyperparams dict using the same keys expected by _build_classifier."""
    if algorithm == "ann":
        return {
            "layers":    trial.suggest_int("layers", 1, 4),
            "neurons":   trial.suggest_categorical("neurons", [32, 64, 128, 256]),
            "epochs":    trial.suggest_int("epochs", 50, 200),
            "batchSize": trial.suggest_categorical("batchSize", [16, 32, 64]),
        }
    if algorithm == "svm":
        return {
            "kernel": trial.suggest_categorical("kernel", ["linear", "rbf"]),
            "C":      trial.suggest_float("C", 0.01, 10.0, log=True),
            "gamma":  trial.suggest_categorical("gamma", ["scale", "auto"]),
        }
    if algorithm in ("nb-gaussian",):
        return {}
    if algorithm in ("nb-multinomial", "nb-bernoulli"):
        return {"alpha": trial.suggest_float("alpha", 0.01, 2.0)}
    if algorithm == "logistic":
        return {
            "C":       trial.suggest_float("C", 0.01, 10.0, log=True),
            "solver":  trial.suggest_categorical("solver", ["lbfgs", "liblinear"]),
            "maxIter": trial.suggest_int("maxIter", 100, 500),
        }
    if algorithm == "knn":
        return {
            "k":       trial.suggest_int("k", 3, 15),
            "metric":  trial.suggest_categorical("metric", ["euclidean", "manhattan"]),
            "weights": trial.suggest_categorical("weights", ["uniform", "distance"]),
        }
    if algorithm == "dt":
        return {
            "maxDepth":  trial.suggest_int("maxDepth", 3, 20),
            "minSamples": trial.suggest_int("minSamples", 2, 10),
            "criterion": trial.suggest_categorical("criterion", ["gini", "entropy"]),
        }
    if algorithm == "rf":
        return {
            "nEstimators": trial.suggest_int("nEstimators", 50, 300),
            "maxDepth":    trial.suggest_int("maxDepth", 5, 30),
            "minSamples":  trial.suggest_int("minSamples", 2, 10),
        }
    if algorithm in ("xgb", "gb"):
        return {
            "nEstimators":  trial.suggest_int("nEstimators", 50, 300),
            "learningRate": trial.suggest_float("learningRate", 0.01, 0.3, log=True),
            "maxDepth":     trial.suggest_int("maxDepth", 3, 10),
            "subsample":    trial.suggest_float("subsample", 0.6, 1.0),
        }
    return {}


def _build_pipeline_for_eval(
    X: Any, y: np.ndarray,
    algorithm: str, hyperparams: Dict[str, Any],
    scaling: str, categorical_encoding: str, missing_strategy: str,
    cat_categories: Optional[Dict[str, List[str]]],
    use_minmax: bool, add_binarizer: bool,
) -> Any:
    """Build a sklearn Pipeline suitable for cross-validation (no saving side-effects)."""
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist() if hasattr(X, "select_dtypes") else []
    categorical_cols = X.select_dtypes(exclude=[np.number]).columns.tolist() if hasattr(X, "select_dtypes") else []
    preprocessor = _build_preprocessor_with_frozen_cats(
        numeric_cols, categorical_cols, missing_strategy, scaling, categorical_encoding,
        cat_categories=cat_categories, force_minmax=use_minmax,
    )
    clf = _build_classifier(algorithm, hyperparams)
    if add_binarizer:
        return Pipeline([
            ("preprocessor", preprocessor),
            ("binarizer", Binarizer(threshold=0.0)),
            ("classifier", clf),
        ])
    return Pipeline([("preprocessor", preprocessor), ("classifier", clf)])


def run_hpo(
    dataset_id: str,
    target_column: str,
    algorithm: str,
    preprocess_id: Optional[str] = None,
    selection_id: Optional[str] = None,
    n_trials: int = 30,
    cv_folds: int = 3,
    timeout_sec: Optional[int] = 300,
) -> Dict[str, Any]:
    """Run Optuna hyperparameter optimisation then train the final model with the best params."""
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        raise RuntimeError("optuna is not installed. Run: pip install optuna")

    # ── Replicate run_train data-loading logic ────────────────────────────────
    scaling = "standard"
    categorical_encoding = "onehot"
    missing_strategy = "mean"
    cat_categories: Optional[Dict[str, List[str]]] = None
    actual_dataset_id = dataset_id
    actual_target = target_column

    if preprocess_id and preprocess_exists(preprocess_id):
        pmeta = load_preprocess_meta(preprocess_id)
        actual_dataset_id = pmeta.get("processed_dataset_id", dataset_id)
        actual_target = pmeta.get("target_column", target_column)
        scaling = pmeta.get("scaling", "standard")
        categorical_encoding = pmeta.get("categorical_encoding", "onehot")
        missing_strategy = pmeta.get("missing_strategy", "mean")
        cat_categories = pmeta.get("cat_categories_snapshot")

    df = load_dataset(actual_dataset_id)
    if actual_target not in df.columns:
        raise ValueError(f"Target column '{actual_target}' not found")

    y_raw = df[actual_target]
    X = df.drop(columns=[actual_target])

    if selection_id and selection_exists(selection_id):
        sel = load_selection(selection_id)
        kept = [f for f in (sel.get("kept_features") or []) if f in X.columns]
        if kept:
            X = X[kept]

    X = X.drop(columns=[c for c in X.columns if X[c].isna().mean() > 0.5])

    le_hpo: Optional[LabelEncoder] = None
    if y_raw.dtype == object or str(y_raw.dtype) == "category":
        le_hpo = LabelEncoder()
        y = le_hpo.fit_transform(y_raw.astype(str))
    else:
        y = y_raw.values.copy()

    use_minmax, _, add_binarizer = _check_nb_constraints(algorithm)
    avg = "binary" if len(np.unique(y)) == 2 else "macro"
    scoring = f"f1_{avg}" if avg == "macro" else "f1"
    cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)

    trial_log: List[Dict[str, Any]] = []

    def _objective(trial: Any) -> float:
        hp = _suggest_hyperparams(trial, algorithm)
        pipe = _build_pipeline_for_eval(
            X, y, algorithm, hp, scaling, categorical_encoding,
            missing_strategy, cat_categories, use_minmax, add_binarizer,
        )
        try:
            result = cross_validate(pipe, X, y, cv=cv, scoring=scoring, error_score=0.0)
            score = float(np.mean(result["test_score"]))
        except Exception as exc:
            logger.warning("HPO trial %d failed: %s", trial.number, exc)
            score = 0.0
        trial_log.append({"number": trial.number, "value": round(score, 4), "params": hp})
        return score

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=42),
    )
    study.optimize(_objective, n_trials=n_trials, timeout=timeout_sec, n_jobs=1)

    best_hp = dict(study.best_trial.params) if study.best_trial else {}
    best_score = round(float(study.best_value), 4) if study.best_value is not None else 0.0
    n_completed = len(study.trials)

    logger.info("HPO done: %s  best_cv_f1=%.4f  trials=%d  params=%s",
                algorithm, best_score, n_completed, best_hp)

    # ── Train final model with best hyperparams ───────────────────────────────
    final = run_train(
        dataset_id=dataset_id,
        target_column=target_column,
        algorithm=algorithm,
        hyperparams=best_hp,
        preprocess_id=preprocess_id,
        selection_id=selection_id,
        cv_folds=cv_folds,
    )

    return {
        "algorithm": algorithm,
        "best_params": best_hp,
        "best_cv_score": best_score,
        "n_trials_completed": n_completed,
        "train_response": final,
        "all_trials": trial_log,
    }


# ── strict feature validation ─────────────────────────────────────────────────

def _validate_strict_features(features: Dict[str, Any], meta: Dict[str, Any]) -> None:
    """Raise ValueError with list of missing features if any required feature absent."""
    raw_feature_names: List[str] = meta.get("raw_feature_names", [])
    if not raw_feature_names:
        return  # schema not recorded; accept anything
    missing = [f for f in raw_feature_names if f not in features]
    if missing:
        raise ValueError(
            f"Thiếu {len(missing)}/{len(raw_feature_names)} đặc trưng bắt buộc: {missing}. "
            f"Model cần đủ các cột: {raw_feature_names}"
        )


def _prepare_input_strict(features: Dict[str, Any], meta: Dict[str, Any]) -> pd.DataFrame:
    """Build DataFrame in exact column order, no silent zero-fill."""
    raw_feature_names: List[str] = meta.get("raw_feature_names", [])
    if raw_feature_names:
        return pd.DataFrame([{f: features[f] for f in raw_feature_names}])
    return pd.DataFrame([features])


# ── predict ───────────────────────────────────────────────────────────────────

def run_predict(model_id: str, features: Dict[str, Any]) -> Dict[str, Any]:
    payload = load_model(model_id)
    meta = load_model_meta(model_id)
    pipeline = payload["pipeline"]
    le: Optional[LabelEncoder] = payload.get("label_encoder")

    _validate_strict_features(features, meta)
    input_df = _prepare_input_strict(features, meta)
    pred_raw = pipeline.predict(input_df)
    pred_label = pred_raw[0]
    if le is not None:
        try:
            pred_label = le.inverse_transform([int(pred_label)])[0]
        except Exception:
            pass

    prob = None
    try:
        if hasattr(pipeline, "predict_proba"):
            probs = pipeline.predict_proba(input_df)
            prob = round(float(np.max(probs[0])), 4)
    except Exception:
        pass

    return {"prediction": str(pred_label), "probability": prob}


def _prepare_input(features: Dict[str, Any], meta: Dict[str, Any]) -> pd.DataFrame:
    raw_feature_names = meta.get("raw_feature_names", [])
    if raw_feature_names:
        row = {f: features.get(f, 0) for f in raw_feature_names}
        return pd.DataFrame([row])
    return pd.DataFrame([features])


# ── explain / global ──────────────────────────────────────────────────────────

def run_global_explain(model_id: str) -> GlobalExplainResponse:
    meta = load_model_meta(model_id)
    if meta.get("global_importance"):
        cached = meta["global_importance"]
        return GlobalExplainResponse(
            method=cached["method"],
            top_features=[GlobalFeatureImportance(**f) for f in cached["top_features"]],
            notes=cached.get("notes", ""),
        )

    payload = load_model(model_id)
    pipeline = payload["pipeline"]
    clf = pipeline.named_steps.get("classifier") or pipeline.steps[-1][1]
    raw_feature_names = meta.get("raw_feature_names", [])
    raw_to_transformed_idx: Dict[str, List[int]] = meta.get("raw_to_transformed_idx", {})

    raw_importances: Dict[str, float] = {}
    method = "fallback"

    if hasattr(clf, "feature_importances_"):
        imp = clf.feature_importances_
        for raw, idxs in raw_to_transformed_idx.items():
            raw_importances[raw] = float(np.sum([imp[i] for i in idxs if i < len(imp)]))
        method = "feature_importances"
    elif hasattr(clf, "coef_"):
        coef = np.abs(clf.coef_)
        if coef.ndim > 1:
            coef = coef.mean(axis=0)
        for raw, idxs in raw_to_transformed_idx.items():
            raw_importances[raw] = float(np.sum([coef[i] for i in idxs if i < len(coef)]))
        method = "coef"
    else:
        # Permutation importance on saved test sample (non-uniform, data-driven)
        X_test_sample, y_test_sample = load_test_sample(model_id)
        if X_test_sample is not None and y_test_sample is not None and len(X_test_sample) > 0:
            try:
                from sklearn.inspection import permutation_importance as _perm_imp
                perm = _perm_imp(
                    pipeline, X_test_sample, y_test_sample,
                    n_repeats=4, random_state=42, n_jobs=1, scoring="accuracy",
                )
                # perm.importances_mean[i] ↔ column i of X_test_sample = raw_feature_names[i]
                feat_names = (
                    list(X_test_sample.columns)
                    if hasattr(X_test_sample, "columns")
                    else raw_feature_names
                )
                for i, fname in enumerate(feat_names):
                    raw_importances[fname] = float(max(0.0, perm.importances_mean[i]))
                method = "permutation"
                logger.info("Permutation importance computed (%d repeats) for %s", 4, model_id)
            except Exception as e:
                logger.warning("Permutation importance failed, using uniform fallback: %s", e)
                for raw in raw_feature_names:
                    raw_importances[raw] = 1.0 / max(len(raw_feature_names), 1)
        else:
            logger.warning("No test sample available for permutation; using uniform fallback for %s", model_id)
            for raw in raw_feature_names:
                raw_importances[raw] = 1.0 / max(len(raw_feature_names), 1)

    total = sum(raw_importances.values())
    if total > 0:
        raw_importances = {k: v / total for k, v in raw_importances.items()}

    top_features = sorted(
        [GlobalFeatureImportance(name=k, score=round(v, 4)) for k, v in raw_importances.items()],
        key=lambda x: x.score,
        reverse=True,
    )[:20]

    result_dict = {
        "method": method,
        "top_features": [f.model_dump() for f in top_features],
        "notes": f"Computed from {method}; top {len(top_features)} raw features.",
    }
    meta["global_importance"] = result_dict
    save_model_meta(model_id, meta)

    return GlobalExplainResponse(method=method, top_features=top_features, notes=result_dict["notes"])


# ── explain / local ───────────────────────────────────────────────────────────

def run_local_explain(model_id: str, features: Dict[str, Any]) -> LocalExplainResponse:
    payload = load_model(model_id)
    meta = load_model_meta(model_id)
    pipeline = payload["pipeline"]
    le: Optional[LabelEncoder] = payload.get("label_encoder")
    clf = pipeline.named_steps.get("classifier") or pipeline.steps[-1][1]

    raw_feature_names: List[str] = meta.get("raw_feature_names", [])
    raw_to_transformed_idx: Dict[str, List[int]] = meta.get("raw_to_transformed_idx", {})
    scaling = meta.get("scaling", "standard")
    encoding = meta.get("categorical_encoding", "onehot")
    class_stats: Dict[str, Any] = meta.get("class_stats", {})
    label_classes: Optional[List[str]] = meta.get("label_classes")

    _validate_strict_features(features, meta)
    input_df = _prepare_input_strict(features, meta)

    # Predict
    pred_raw = pipeline.predict(input_df)[0]
    pred_label = str(pred_raw)
    if le is not None:
        try:
            pred_label = str(le.inverse_transform([int(pred_raw)])[0])
        except Exception:
            pass

    # Probability
    prob: Optional[float] = None
    probs: Optional[np.ndarray] = None
    pred_class_idx = 0
    try:
        probs = pipeline.predict_proba(input_df)[0]
        prob = round(float(np.max(probs)), 4)
        pred_class_idx = int(np.argmax(probs))
    except Exception:
        pass

    # Transformed features
    x_transformed: Optional[np.ndarray] = None
    try:
        preprocessor = pipeline.named_steps["preprocessor"]
        x_transformed = preprocessor.transform(input_df)[0]
    except Exception:
        pass

    # ── Determine DDoS / opposite labels before contributions loop ────────────
    ddos_label = _detect_ddos_label(pred_label, label_classes)
    # "Opposite" class: if pred=DDoS → perturb toward benign mean; if pred=benign → toward DDoS mean
    if ddos_label is not None and pred_label == ddos_label:
        # Prediction is DDoS; opposite = any non-DDoS label
        opposite_label: Optional[str] = next(
            (lbl for lbl in (label_classes or []) if str(lbl) != ddos_label), None
        )
    else:
        opposite_label = ddos_label  # Prediction is benign; opposite = DDoS

    # ── Compute contributions ─────────────────────────────────────────────────
    contributions: List[Dict[str, Any]] = []
    method = "local_permutation"

    if hasattr(clf, "coef_") and x_transformed is not None:
        method = "logistic_coef"
        coef = clf.coef_
        if coef.shape[0] == 1:
            c = coef[0]
        else:
            c = coef[min(pred_class_idx, coef.shape[0] - 1)]
        contribution_transformed = c * x_transformed
        for raw, idxs in raw_to_transformed_idx.items():
            valid = [i for i in idxs if i < len(contribution_transformed)]
            contributions.append({
                "feature_original": raw,
                "contribution_score": float(np.sum(contribution_transformed[valid])),
                "perturb_label": None,
                "perturb_mean": None,
            })
    else:
        # Local permutation: top 20 features from global
        global_resp = run_global_explain(model_id)
        top_n = [f.name for f in global_resp.top_features[:20]]

        if probs is not None:
            prob_orig = float(probs[min(pred_class_idx, len(probs) - 1)])
        else:
            prob_orig = 0.5

        for raw in top_n:
            if raw not in raw_to_transformed_idx:
                continue

            # Perturb to the OPPOSITE class mean for clearer counterfactual impact.
            # Fallback: global mean across all classes.
            feat_mean: float
            used_perturb_label: Optional[str] = None
            if (
                opposite_label is not None
                and opposite_label in class_stats
                and raw in class_stats[opposite_label]
            ):
                feat_mean = float(class_stats[opposite_label][raw]["mean"])
                used_perturb_label = opposite_label
            else:
                all_means = [cs[raw]["mean"] for cs in class_stats.values() if raw in cs]
                feat_mean = float(np.mean(all_means)) if all_means else 0.0

            perturbed = {k: v for k, v in features.items()}
            perturbed[raw] = feat_mean
            perturbed_df = _prepare_input_strict(perturbed, meta)
            try:
                if probs is not None:
                    p_probs = pipeline.predict_proba(perturbed_df)[0]
                    prob_perturbed = float(p_probs[min(pred_class_idx, len(p_probs) - 1)])
                    score = prob_orig - prob_perturbed
                else:
                    p_pred = pipeline.predict(perturbed_df)[0]
                    score = 1.0 if p_pred != pred_raw else 0.0
            except Exception:
                score = 0.0

            contributions.append({
                "feature_original": raw,
                "contribution_score": score,
                "perturb_label": used_perturb_label,
                "perturb_mean": feat_mean,
            })

    contributions.sort(key=lambda x: abs(x["contribution_score"]), reverse=True)
    top_contributions = contributions[:10]

    vi_names = _get_feature_vi_names()

    formatted: List[LocalContribution] = []
    perturb_info: List[Dict[str, Any]] = []   # parallel to formatted, for rich explanation
    for c in top_contributions:
        raw = c["feature_original"]
        score = c["contribution_score"]
        if ddos_label is None:
            direction = "positive" if score > 0 else "negative"
        elif pred_label == ddos_label:
            direction = "toward_ddos" if score > 0 else "toward_benign"
        else:
            direction = "toward_benign" if score > 0 else "toward_ddos"

        comparison = {}
        for cls_label, cs in class_stats.items():
            if raw in cs:
                comparison[cls_label] = {"mean": cs[raw].get("mean", 0), "std": cs[raw].get("std", 0)}

        input_val = features.get(raw, 0)
        formatted.append(LocalContribution(
            feature_original=raw,
            feature_vi=vi_names.get(raw, raw),
            input_value=input_val,
            direction=direction,
            impact=round(abs(score), 4),
            comparison=comparison,
        ))
        perturb_info.append({
            "perturb_label": c.get("perturb_label"),
            "perturb_mean": c.get("perturb_mean"),
            "prob_delta_pct": round(score * 100, 1),
        })

    vi_explanation = _generate_vietnamese_explanation(
        pred_label, formatted, ddos_label, prob, perturb_info
    )

    return LocalExplainResponse(
        prediction=pred_label,
        probability=prob,
        method=method,
        top_contributions=formatted,
        vietnamese_explanation=vi_explanation,
        trace=ExplainTrace(
            used_preprocess_id=meta.get("preprocess_id"),
            used_selection_id=meta.get("selection_id"),
            scaling=scaling,
            encoding=encoding,
            note=f"Top-10 contributions via {method}.",
        ),
    )


def _detect_ddos_label(pred_label: str, label_classes: Optional[List]) -> Optional[str]:
    ddos_kws = {"ddos", "attack", "1", "yes", "malicious", "anomaly", "intrusion"}
    candidates = label_classes or [pred_label]
    for lbl in candidates:
        s = str(lbl).lower()
        if s in ddos_kws or any(kw in s for kw in ["ddos", "attack", "malicious", "intrusion"]):
            return str(lbl)
    return None


def _generate_vietnamese_explanation(
    pred_label: str,
    top_contributions: List[LocalContribution],
    ddos_label: Optional[str],
    probability: Optional[float],
    perturb_info: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    lines: List[str] = []
    prob_str = f" (xác suất: {probability * 100:.1f}%)" if probability else ""

    if ddos_label and pred_label == ddos_label:
        lines.append(f"🔴 Mô hình phát hiện lưu lượng này là TẤN CÔNG DDOS{prob_str}")
    elif pred_label.lower() in ["0", "benign", "normal", "bình thường"]:
        lines.append(f"🟢 Mô hình phân loại lưu lượng này là BÌNH THƯỜNG{prob_str}")
    else:
        lines.append(f"⚠️ Kết quả phân loại: {pred_label}{prob_str}")

    if top_contributions:
        lines.append("")
        lines.append("📊 Các đặc trưng ảnh hưởng nhất đến quyết định:")
        for i, c in enumerate(top_contributions[:5], 1):
            val = c.input_value
            val_str = f"{val:.4f}" if isinstance(val, (int, float)) else str(val)
            dvi = "tăng khả năng là DDoS" if c.direction == "toward_ddos" else "giảm khả năng là DDoS"

            # Enrich with counterfactual perturb info when available
            pi = perturb_info[i - 1] if perturb_info and i - 1 < len(perturb_info) else None
            if pi and pi.get("perturb_label") is not None and pi.get("perturb_mean") is not None:
                pct = pi["prob_delta_pct"]
                plbl = pi["perturb_label"]
                pmean = pi["perturb_mean"]
                sign = "giảm" if pct > 0 else "tăng"
                pct_abs = abs(pct)
                lines.append(
                    f"  {i}. {c.feature_vi} = {val_str}"
                    f" → khi thay về mức '{plbl}' (tb: {pmean:.3f}),"
                    f" xác suất dự đoán {sign} {pct_abs:.1f}% → {dvi}"
                )
            else:
                lines.append(f"  {i}. {c.feature_vi} = {val_str} → {dvi} (impact: {c.impact:.4f})")

    has_comparison = any(c.comparison for c in top_contributions[:3])
    if has_comparison:
        lines.append("")
        lines.append("📈 So sánh với trung bình của từng lớp trong tập huấn luyện:")
        for c in top_contributions[:3]:
            if c.comparison:
                parts = [f"{lbl}: tb={v['mean']:.3f}" for lbl, v in c.comparison.items()]
                lines.append(f"  • {c.feature_vi}: {', '.join(parts)} | giá trị đầu vào: {c.input_value}")
    return lines


# ── details_vi ────────────────────────────────────────────────────────────────

def run_details_vi(model_id: str) -> ModelDetailsVI:
    meta = load_model_meta(model_id)
    algorithm = meta.get("algorithm", "")
    hyperparams = meta.get("hyperparams", {})
    algo_name = meta.get("algorithm_name", ALGO_NAMES.get(algorithm, algorithm))

    details = _ALGO_DETAILS_VI.get(algorithm, _ALGO_DETAILS_VI["rf"])
    hp_vi_map = _HYPERPARAMS_VI.get(algorithm, {})

    hp_table = [
        HyperparamVI(name=k, value=str(v), meaning_vi=hp_vi_map.get(k, k))
        for k, v in hyperparams.items()
    ]

    return ModelDetailsVI(
        title=f"{algo_name}",
        algorithm_key=algorithm,
        sections=details["sections"],
        hyperparams_table=hp_table,
        how_used_in_pipeline=details.get("how_used_in_pipeline", []),
        limitations_for_ddos=details.get("limitations_for_ddos", []),
    )


# ── Vietnamese feature name map ───────────────────────────────────────────────

def _get_feature_vi_names() -> Dict[str, str]:
    return {
        "duration": "Thời gian kết nối (giây)",
        "protocol_type": "Loại giao thức (TCP/UDP/ICMP)",
        "service": "Dịch vụ mạng",
        "flag": "Cờ kết nối TCP",
        "src_bytes": "Bytes từ nguồn",
        "dst_bytes": "Bytes đến đích",
        "land": "Kết nối nội bộ (0/1)",
        "wrong_fragment": "Số gói phân mảnh sai",
        "urgent": "Số gói khẩn cấp",
        "hot": "Số lần truy cập hot",
        "num_failed_logins": "Số lần đăng nhập thất bại",
        "logged_in": "Đã đăng nhập (0/1)",
        "num_compromised": "Số lượng bị xâm phạm",
        "root_shell": "Shell root (0/1)",
        "count": "Số kết nối trong 2 giây",
        "srv_count": "Số kết nối cùng dịch vụ",
        "serror_rate": "Tỷ lệ lỗi SYN",
        "rerror_rate": "Tỷ lệ lỗi REJ",
        "same_srv_rate": "Tỷ lệ cùng dịch vụ",
        "diff_srv_rate": "Tỷ lệ khác dịch vụ",
        "dst_host_count": "Số kết nối đến host đích",
        "dst_host_srv_count": "Số kết nối dịch vụ đến host đích",
        "dst_host_same_srv_rate": "Tỷ lệ cùng dịch vụ (host đích)",
        "dst_host_diff_srv_rate": "Tỷ lệ khác dịch vụ (host đích)",
        "dst_host_serror_rate": "Tỷ lệ lỗi SYN (host đích)",
        "flow_duration": "Thời gian luồng",
        "total_fwd_packets": "Tổng gói tin chiều xuôi",
        "total_backward_packets": "Tổng gói tin chiều ngược",
        "total_length_of_fwd_packets": "Tổng byte chiều xuôi",
        "total_length_of_bwd_packets": "Tổng byte chiều ngược",
        "fwd_packet_length_mean": "Kích thước gói trung bình (xuôi)",
        "bwd_packet_length_mean": "Kích thước gói trung bình (ngược)",
        "flow_bytes/s": "Tốc độ bytes/giây",
        "flow_packets/s": "Tốc độ gói tin/giây",
        "packet_rate": "Tốc độ gói tin",
        "byte_count": "Tổng byte",
        "source_port": "Cổng nguồn",
        "destination_port": "Cổng đích",
        "syn_flag_count": "Số cờ SYN",
        "ack_flag_count": "Số cờ ACK",
        "psh_flag_count": "Số cờ PSH",
        "rst_flag_count": "Số cờ RST",
        "fin_flag_count": "Số cờ FIN",
        "down/up_ratio": "Tỷ lệ download/upload",
        "init_win_bytes_forward": "Byte cửa sổ TCP ban đầu (xuôi)",
        "init_win_bytes_backward": "Byte cửa sổ TCP ban đầu (ngược)",
        "fwd_iat_mean": "Thời gian giữa gói TB (xuôi)",
        "bwd_iat_mean": "Thời gian giữa gói TB (ngược)",
        "active_mean": "Thời gian hoạt động TB",
        "idle_mean": "Thời gian nghỉ TB",
        "subflow_fwd_bytes": "Bytes subflow chiều xuôi",
        "subflow_bwd_bytes": "Bytes subflow chiều ngược",
    }


# ── Algorithm details (Vietnamese) ───────────────────────────────────────────

_ALGO_DETAILS_VI: Dict[str, Any] = {
    "logistic": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Logistic Regression là thuật toán phân loại tuyến tính dùng hàm sigmoid để chuyển đổi tổ hợp tuyến tính của các đặc trưng thành xác suất (0–1)."],
                bullets=["Tính tổ hợp tuyến tính: z = w₀ + w₁x₁ + ... + wₙxₙ",
                         "Áp dụng sigmoid: P = 1/(1 + e⁻ᶻ)",
                         "Phân loại: nếu P > 0.5 → lớp 1, ngược lại → lớp 0"],
            ),
            ModelDetailSection(
                heading="Ưu điểm trong phát hiện DDoS",
                bullets=["Giải thích được: mỗi hệ số w cho biết tầm quan trọng của đặc trưng",
                         "Nhanh, ít tài nguyên, phù hợp real-time",
                         "Trả về xác suất, giúp đặt ngưỡng linh hoạt"],
            ),
        ],
        "how_used_in_pipeline": [
            "Bước 1: Scaler chuẩn hóa đặc trưng số theo cấu hình người dùng",
            "Bước 2: Encoder chuyển đổi đặc trưng phân loại",
            "Bước 3: Logistic Regression học hệ số tối ưu bằng gradient descent",
            "Bước 4: Dự đoán bằng sigmoid(w·x) > threshold",
        ],
        "limitations_for_ddos": [
            "Chỉ phân loại tuyến tính; DDoS có ranh giới phi tuyến phức tạp",
            "Nhạy cảm với outlier và đặc trưng không được chuẩn hóa",
        ],
    },
    "rf": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Random Forest xây dựng nhiều cây quyết định độc lập, mỗi cây được huấn luyện trên tập con dữ liệu ngẫu nhiên (bootstrap), sau đó tổng hợp kết quả bằng cách bầu chọn đa số."],
                bullets=["Bootstrap sampling: mỗi cây dùng ~63% dữ liệu ngẫu nhiên",
                         "Feature subsampling: mỗi nút chỉ xét sqrt(n_features) đặc trưng",
                         "Voting: lớp nào được nhiều cây chọn nhất là kết quả cuối"],
            ),
            ModelDetailSection(
                heading="Ưu điểm trong phát hiện DDoS",
                bullets=["Robust, ít overfit, xử lý tốt dữ liệu mất cân bằng",
                         "Feature importance tích hợp sẵn",
                         "Hiệu quả với dữ liệu lưu lượng mạng lớn, nhiều đặc trưng"],
            ),
        ],
        "how_used_in_pipeline": [
            "Bước 1: Scaler theo cấu hình người dùng",
            "Bước 2: Xây dựng n_estimators cây quyết định song song",
            "Bước 3: Bầu chọn đa số cây → nhãn cuối cùng",
            "Bước 4: feature_importances_ dùng để giải thích",
        ],
        "limitations_for_ddos": [
            "Chậm hơn logistic với số cây lớn",
            "Khó giải thích từng quyết định đơn lẻ",
        ],
    },
    "dt": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Decision Tree phân vùng không gian đặc trưng bằng cách đặt câu hỏi nhị phân tại mỗi nút, chọn đặc trưng và ngưỡng tốt nhất theo tiêu chí Gini/Entropy."],
                bullets=["Chọn đặc trưng chia tốt nhất theo Gini impurity hoặc Information Gain",
                         "Chia đệ quy đến khi đạt max_depth hoặc nút thuần",
                         "Lá cây là nhãn dự đoán"],
            ),
        ],
        "how_used_in_pipeline": ["Chuẩn hóa (tùy chọn)", "Xây cây đệ quy", "Dự đoán theo đường từ gốc đến lá"],
        "limitations_for_ddos": ["Dễ overfit nếu max_depth quá lớn", "Bất ổn định với thay đổi nhỏ trong dữ liệu"],
    },
    "ann": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["ANN (MLPClassifier) là mạng nơ-ron nhiều lớp học biểu diễn phi tuyến phức tạp thông qua lan truyền ngược (backpropagation)."],
                bullets=["Lan truyền xuôi: x → hidden layers → output",
                         "Tính lỗi: cross-entropy loss",
                         "Lan truyền ngược: cập nhật trọng số bằng gradient descent"],
            ),
        ],
        "how_used_in_pipeline": ["Chuẩn hóa đặc trưng (quan trọng cho ANN)", "Huấn luyện qua nhiều epoch", "Dự đoán bằng softmax layer cuối"],
        "limitations_for_ddos": ["Cần nhiều dữ liệu", "Khó giải thích", "Chậm nếu mạng lớn"],
    },
    "svm": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["SVM tìm siêu phẳng tối ưu phân tách các lớp với lề (margin) lớn nhất, dùng kernel trick để xử lý dữ liệu phi tuyến."],
                bullets=["Tối đa hóa margin giữa hai lớp", "Kernel RBF/Linear/Poly xử lý phi tuyến", "probability=True: dùng Platt scaling để có xác suất"],
            ),
        ],
        "how_used_in_pipeline": ["Chuẩn hóa bắt buộc", "Tìm support vectors", "Dự đoán theo phía siêu phẳng"],
        "limitations_for_ddos": ["Rất chậm với dataset lớn", "Khó scale lên hàng triệu mẫu"],
    },
    "knn": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["KNN phân loại bằng cách tìm K điểm gần nhất trong tập huấn luyện và bầu chọn nhãn đa số."],
                bullets=["Tính khoảng cách Euclidean/Manhattan đến tất cả điểm train", "Chọn K hàng xóm gần nhất", "Bầu chọn nhãn đa số"],
            ),
        ],
        "how_used_in_pipeline": ["Chuẩn hóa bắt buộc (khoảng cách nhạy cảm với scale)", "Không có pha train", "Dự đoán O(n) với n mẫu train"],
        "limitations_for_ddos": ["Chậm khi predict với tập lớn", "Tốn bộ nhớ"],
    },
    "nb-gaussian": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Gaussian NB áp dụng định lý Bayes với giả định đặc trưng tuân theo phân phối Gaussian (chuẩn) trong mỗi lớp."],
                bullets=["Tính P(lớp|đặc trưng) = P(đặc trưng|lớp) × P(lớp)", "Giả định đặc trưng độc lập nhau", "Giả định phân phối Gaussian"],
            ),
        ],
        "how_used_in_pipeline": ["Không cần chuẩn hóa", "Học mean/variance mỗi đặc trưng theo lớp", "Dự đoán bằng xác suất posterior cao nhất"],
        "limitations_for_ddos": ["Giả định Gaussian thường không đúng với dữ liệu mạng", "Giả định độc lập giữa đặc trưng thường vi phạm"],
    },
    "nb-multinomial": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Multinomial NB phù hợp với dữ liệu đếm (count data), yêu cầu đặc trưng không âm. Pipeline tự dùng MinMaxScaler để đảm bảo điều này."],
                bullets=["Tính P(lớp|từ) cho phân phối đa thức", "Yêu cầu giá trị không âm", "MinMaxScaler tự động được áp dụng"],
            ),
        ],
        "how_used_in_pipeline": ["MinMaxScaler (tự động, bất kể cấu hình scaling)", "Học xác suất đặc trưng theo lớp", "Dự đoán bằng log-probability"],
        "limitations_for_ddos": ["Giả định phân phối đa thức; dữ liệu mạng thường liên tục"],
    },
    "nb-bernoulli": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["Bernoulli NB phù hợp với đặc trưng nhị phân. Pipeline tự thêm Binarizer(threshold=0.0) để chuyển đặc trưng liên tục thành 0/1."],
                bullets=["Mỗi đặc trưng là biến nhị phân (0/1)", "Binarizer(threshold=0.0) được thêm tự động", "Dự đoán theo xác suất Bernoulli"],
            ),
        ],
        "how_used_in_pipeline": ["Scaling theo cấu hình", "Binarizer tự động", "Huấn luyện Bernoulli NB"],
        "limitations_for_ddos": ["Mất thông tin khi binarize đặc trưng liên tục"],
    },
    "xgb": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["XGBoost (eXtreme Gradient Boosting) là thư viện boosting tối ưu hóa cao với regularization L1/L2 tích hợp, column/row subsampling và tính toán song song theo cột."],
                bullets=[
                    "Tối ưu hóa hàm mục tiêu bằng second-order gradient (Newton's method)",
                    "Regularization L1/L2 tránh overfitting",
                    "subsample: % hàng; colsample_bytree: % cột mỗi cây",
                    "Nhanh hơn sklearn GBM nhờ parallelism và histogram-based splits",
                ],
            ),
            ModelDetailSection(
                heading="Ưu điểm trong phát hiện DDoS",
                bullets=[
                    "State-of-the-art trên CICIDS2017, NSL-KDD",
                    "Feature importance đa dạng: gain, weight, cover",
                    "Xử lý missing values nội tại",
                    "Tốc độ inference nhanh",
                ],
            ),
        ],
        "how_used_in_pipeline": [
            "Bước 1: Scaler/Encoder (XGBoost không bắt buộc chuẩn hóa)",
            "Bước 2: XGBClassifier huấn luyện n_estimators cây với second-order gradient",
            "Bước 3: Dự đoán qua softmax (multiclass) hoặc sigmoid (binary)",
            "Bước 4: feature_importances_ từ gain-based importance",
        ],
        "limitations_for_ddos": [
            "Cần điều chỉnh nhiều hyperparameter (learning_rate, max_depth, subsample)",
            "Dữ liệu mất cân bằng cực độ cần scale_pos_weight hoặc resample thêm",
        ],
    },
    "gb": {
        "sections": [
            ModelDetailSection(
                heading="Nguyên lý hoạt động",
                paragraphs=["sklearn Gradient Boosting xây dựng cây quyết định tuần tự, mỗi cây học pseudo-residual từ cây trước bằng gradient descent trong không gian hàm."],
                bullets=[
                    "Cây 1: học dự đoán ban đầu (log-odds)",
                    "Cây k: học gradient loss từ cây k−1",
                    "learning_rate shrinks contribution mỗi cây",
                    "subsample < 1.0: stochastic gradient boosting giảm variance",
                ],
            ),
        ],
        "how_used_in_pipeline": [
            "Chuẩn hóa (tùy chọn — GBM không nhạy scale)",
            "Học tuần tự n_estimators cây, mỗi cây max_depth nút",
            "Feature importance từ impurity-based gain tích lũy",
        ],
        "limitations_for_ddos": [
            "Chậm hơn XGBoost với n_estimators lớn (không có parallelism)",
            "Không xử lý missing values nội tại — cần imputer",
        ],
    },
}

_HYPERPARAMS_VI: Dict[str, Dict[str, str]] = {
    "ann":    {"layers": "Số lớp ẩn", "neurons": "Số nơ-ron mỗi lớp", "epochs": "Số epoch huấn luyện", "batchSize": "Kích thước batch"},
    "svm":    {"kernel": "Loại kernel (rbf/linear/poly)", "C": "Tham số regularization (C lớn → ít regularize)", "gamma": "Hệ số kernel"},
    "logistic": {"C": "Nghịch đảo regularization (C nhỏ → regularize mạnh)", "solver": "Thuật toán tối ưu", "maxIter": "Số vòng lặp tối đa"},
    "knn":    {"k": "Số hàng xóm (K)", "metric": "Chỉ số khoảng cách", "weights": "Trọng số hàng xóm"},
    "dt":     {"maxDepth": "Độ sâu tối đa của cây", "minSamples": "Số mẫu tối thiểu để chia", "criterion": "Tiêu chí chia (gini/entropy)"},
    "rf":     {"nEstimators": "Số cây quyết định", "maxDepth": "Độ sâu tối đa mỗi cây", "minSamples": "Số mẫu tối thiểu để chia"},
    "xgb":    {"nEstimators": "Số cây boosting", "learningRate": "Tốc độ học", "maxDepth": "Độ sâu tối đa mỗi cây",
               "subsample": "Tỷ lệ hàng mỗi cây (0.5–1.0)", "colsampleBytree": "Tỷ lệ cột mỗi cây",
               "minChildWeight": "Tổng weight tối thiểu ở lá"},
    "gb":     {"nEstimators": "Số cây boosting", "learningRate": "Tốc độ học (shrinkage)", "maxDepth": "Độ sâu tối đa mỗi cây",
               "subsample": "Tỷ lệ hàng stochastic (< 1.0 giảm variance)"},
    "nb-gaussian":    {"priors": "Dùng xác suất tiên nghiệm"},
    "nb-multinomial": {"alpha": "Hệ số Laplace smoothing"},
    "nb-bernoulli":   {"alpha": "Hệ số Laplace smoothing", "fitPriors": "Học xác suất tiên nghiệm"},
}
