"""FastAPI application – DDoS ML Detection backend."""
import logging
import os
import time
import uuid
from collections import deque
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

import psutil

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ml import (
    _dtype_label,
    df_to_preview,
    run_details_vi,
    run_fams_selection,
    run_feature_apply,
    run_feature_report,
    run_global_explain,
    run_hpo,
    run_local_explain,
    run_predict,
    run_preprocess,
    run_train,
)
from .schemas import (
    DatasetResponse,
    ExperimentDetail,
    ExperimentSummary,
    FAMSRequest,
    FAMSResponse,
    FeatureApplyRequest,
    FeatureApplyResponse,
    FeatureApplyTrace,
    FeatureReportRequest,
    FeatureReportResponse,
    GlobalExplainResponse,
    HPORequest,
    HPOResponse,
    LocalExplainRequest,
    LocalExplainResponse,
    MetricsResponse,
    ModelDetailsVI,
    PreprocessRequest,
    PreprocessResponse,
    PredictRequest,
    PredictResponse,
    TrainRequest,
    TrainResponse,
)
from .storage import (
    dataset_exists,
    get_experiment,
    list_experiments,
    load_dataset,
    load_model_meta,
    preprocess_exists,
    save_dataset,
    selection_exists,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── CORS ──────────────────────────────────────────────────────────────────────
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: List[str] = [o.strip() for o in _origins_env.split(",") if o.strip()] or ["*"]

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "200")) * 1024 * 1024

app = FastAPI(title="DDoS ML Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Performance instrumentation ───────────────────────────────────────────────
_START_TIME = time.time()
_stats_lock = Lock()

SLOW_MS            = int(os.getenv("SLOW_MS", "500"))
METRICS_RESET_TOKEN = os.getenv("METRICS_RESET_TOKEN", "")

# Global rolling window: (timestamp, latency_ms, status_code, method, path)
_WINDOW_MAX = 5_000
_latency_window: deque = deque(maxlen=_WINDOW_MAX)

# Per-endpoint data: key = "METHOD /path"
_MAX_ENDPOINTS = 50
_endpoint_data: Dict[str, Dict[str, Any]] = {}

# Global HTTP counters
_requests_total = 0
_in_flight      = 0
_status_2xx     = 0
_status_4xx     = 0
_status_5xx     = 0

# Error breakdown counters
_errors_by_type: Dict[str, int] = {
    "validation_422": 0, "not_found_404": 0, "server_5xx": 0, "other_4xx": 0
}
_top_exceptions: Dict[str, int] = {}

# Slow-request ring buffer
_slow_requests: deque = deque(maxlen=50)

# ML-specific latency rings + diagnostics
_predict_latency: deque            = deque(maxlen=1_000)
_predict_validation_fail           = 0
_predict_error_count               = 0
_explain_local_latency: deque      = deque(maxlen=500)
_explain_local_validation_fail     = 0
_explain_local_error_count         = 0
_explain_global_latency: deque     = deque(maxlen=200)
_explain_global_in_flight          = 0
_explain_global_cache_hit          = 0
_explain_global_cache_miss         = 0
_explain_global_error_count        = 0
_train_latency: deque              = deque(maxlen=200)
_train_in_flight                   = 0
_train_error_count                 = 0
_last_model_info: Dict[str, Any]   = {}

# IO delta snapshots
_last_net_snap: Optional[Tuple[float, int, int]]   = None
_last_disk_snap: Optional[Tuple[float, int, int]]  = None
_last_swap_snap: Optional[Tuple[float, int, int]]  = None   # (time, sin_B, sout_B)

# Per-endpoint p95 snapshot for trend calculation (updated on each /api/metrics call)
_ep_p95_snap: Dict[str, float] = {}
_ep_p95_snap_ts: float         = 0.0

# Warm-up psutil CPU (first call returns 0.0)
psutil.cpu_percent(interval=None)
try:
    psutil.cpu_percent(interval=None, percpu=True)
except Exception:
    pass


def _percentile(data: list, pct: float) -> float:
    if not data:
        return 0.0
    s = sorted(data)
    idx = int(len(s) * pct / 100)
    return round(s[min(idx, len(s) - 1)], 2)


def _ml_stats(lats: list, *, validation_fail: int = 0, error_count: int = 0,
              last_ms: Optional[float] = None, in_flight: int = 0,
              cache_hit: int = 0, cache_miss: int = 0) -> Dict[str, Any]:
    return {
        "count":           len(lats),
        "avg_ms":          round(sum(lats) / len(lats), 2) if lats else 0.0,
        "p95_ms":          _percentile(lats, 95),
        "p99_ms":          _percentile(lats, 99),
        "max_ms":          round(max(lats), 2) if lats else 0.0,
        "last_ms":         last_ms,
        "in_flight":       in_flight,
        "error_count":     error_count,
        "validation_fail": validation_fail,
        "cache_hit":       cache_hit,
        "cache_miss":      cache_miss,
    }


def _new_ep_entry() -> Dict[str, Any]:
    return {"count": 0, "err": 0,
            "lat":    deque(maxlen=500),   # pure ms for percentiles
            "lat_ts": deque(maxlen=500)}   # (ts, ms) for time-window stats


@app.middleware("http")
async def _perf_middleware(request: Request, call_next: Any) -> Any:
    global _requests_total, _in_flight
    global _status_2xx, _status_4xx, _status_5xx
    global _train_in_flight

    t0     = time.perf_counter()
    path   = request.url.path
    method = request.method

    is_predict       = path.endswith("/predict") and method == "POST"
    is_explain_local = "/explain/local" in path and method == "POST"
    is_train         = path == "/api/train" and method == "POST"

    # Capture request bytes + user-agent before call
    req_bytes: Optional[int] = None
    try:
        cl = request.headers.get("content-length")
        if cl:
            req_bytes = int(cl)
    except Exception:
        pass
    ua_raw = request.headers.get("user-agent", "")
    user_agent: Optional[str] = ua_raw[:80] if ua_raw else None

    with _stats_lock:
        _requests_total += 1
        _in_flight      += 1
        if is_train:
            _train_in_flight += 1

    exc_name: Optional[str] = None
    status   = 500
    response = None
    try:
        response = await call_next(request)
        status   = response.status_code
    except Exception as exc:
        exc_name = type(exc).__name__
        raise
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        now        = time.time()

        # Route template key — available after routing completes in call_next
        _route   = request.scope.get("route")
        route_path = _route.path if _route else path
        ep_key   = f"{method} {route_path}"

        # Response bytes
        resp_bytes: Optional[int] = None
        if response is not None:
            try:
                cl_r = response.headers.get("content-length")
                if cl_r:
                    resp_bytes = int(cl_r)
            except Exception:
                pass

        with _stats_lock:
            _in_flight -= 1
            if is_train:
                _train_in_flight -= 1

            # Per-endpoint stats (keyed by route template)
            if ep_key not in _endpoint_data:
                real_key = ep_key if len(_endpoint_data) < _MAX_ENDPOINTS else "__other__"
                if real_key not in _endpoint_data:
                    _endpoint_data[real_key] = _new_ep_entry()
                ep_key = real_key
            ep = _endpoint_data[ep_key]
            ep["count"]  += 1
            ep["lat"].append(elapsed_ms)
            ep["lat_ts"].append((now, elapsed_ms))

            # Status bucket + error breakdown
            if status == 422:
                ep["err"] += 1
                _status_4xx += 1
                _errors_by_type["validation_422"] += 1
            elif status == 404:
                ep["err"] += 1
                _status_4xx += 1
                _errors_by_type["not_found_404"] += 1
            elif status >= 500:
                ep["err"] += 1
                _status_5xx += 1
                _errors_by_type["server_5xx"] += 1
                if exc_name:
                    _top_exceptions[exc_name] = _top_exceptions.get(exc_name, 0) + 1
            elif status >= 400:
                ep["err"] += 1
                _status_4xx += 1
                _errors_by_type["other_4xx"] += 1
            else:
                _status_2xx += 1

            _latency_window.append((now, elapsed_ms, status, method, route_path))

            # Slow-request ring
            if elapsed_ms >= SLOW_MS:
                _slow_requests.append({
                    "ts":           round(now, 3),
                    "method":       method,
                    "route_path":   route_path,
                    "status":       status,
                    "latency_ms":   round(elapsed_ms, 1),
                    "error_summary": exc_name or (f"HTTP {status}" if status >= 400 else None),
                    "req_bytes":    req_bytes,
                    "resp_bytes":   resp_bytes,
                    "user_agent":   user_agent,
                })

            # ML-specific timing
            if is_predict:
                _predict_latency.append(elapsed_ms)
            if is_explain_local:
                _explain_local_latency.append(elapsed_ms)
            if is_train:
                _train_latency.append(elapsed_ms)

    return response


# ── health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "allowed_origins": ALLOWED_ORIGINS}


# ── metrics reset (protected) ─────────────────────────────────────────────────

@app.post("/api/metrics/reset")
def metrics_reset(request: Request):
    global _requests_total, _in_flight
    global _status_2xx, _status_4xx, _status_5xx
    global _predict_validation_fail, _explain_local_validation_fail
    global _predict_error_count, _explain_local_error_count
    global _explain_global_error_count, _train_error_count
    global _explain_global_cache_hit, _explain_global_cache_miss
    global _last_net_snap, _last_disk_snap, _last_swap_snap

    if not METRICS_RESET_TOKEN:
        raise HTTPException(status_code=403, detail="METRICS_RESET_TOKEN not configured")
    if request.headers.get("X-Token") != METRICS_RESET_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")

    with _stats_lock:
        _latency_window.clear()
        _endpoint_data.clear()
        _slow_requests.clear()
        _predict_latency.clear()
        _explain_local_latency.clear()
        _explain_global_latency.clear()
        _train_latency.clear()
        _top_exceptions.clear()
        for k in _errors_by_type:
            _errors_by_type[k] = 0
        _requests_total = _in_flight = 0
        _status_2xx = _status_4xx = _status_5xx = 0
        _predict_validation_fail   = _explain_local_validation_fail  = 0
        _predict_error_count       = _explain_local_error_count      = 0
        _explain_global_error_count = _train_error_count             = 0
        _explain_global_cache_hit  = _explain_global_cache_miss      = 0
        _last_net_snap  = None
        _last_disk_snap = None
        _last_swap_snap = None

    logger.info("Metrics counters reset via API")
    return {"reset": True, "ts": round(time.time(), 1)}


@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics() -> MetricsResponse:
    """Realtime server performance metrics — polled by the frontend dashboard."""
    global _last_net_snap, _last_disk_snap, _ep_p95_snap, _ep_p95_snap_ts

    now  = time.time()
    proc = psutil.Process()

    WINDOW_SEC = 900   # 15-minute rolling window for latency/endpoint stats

    # ── Atomic snapshot ───────────────────────────────────────────────────────
    with _stats_lock:
        win_lats  = [ms for ts, ms, _, _, _ in _latency_window if ts >= now - WINDOW_SEC]
        lat_1m    = [ms for ts, ms, _, _, _ in _latency_window if ts >= now - 60]
        lat_5m    = [ms for ts, ms, _, _, _ in _latency_window if ts >= now - 300]
        lat_15m   = [ms for ts, ms, _, _, _ in _latency_window if ts >= now - 900]

        predict_lats    = list(_predict_latency)
        explain_l_lats  = list(_explain_local_latency)
        explain_g_lats  = list(_explain_global_latency)
        train_lats      = list(_train_latency)

        ep_snap    = {k: {"count": v["count"], "err": v["err"],
                          "lat":    list(v["lat"]),
                          "lat_ts": list(v.get("lat_ts", []))}
                      for k, v in _endpoint_data.items()}
        total      = _requests_total
        in_flight  = _in_flight
        s2, s4, s5 = _status_2xx, _status_4xx, _status_5xx
        ebt        = dict(_errors_by_type)
        top_exc    = dict(_top_exceptions)
        slow_reqs  = list(_slow_requests)
        train_if   = _train_in_flight
        eg_if      = _explain_global_in_flight
        eg_hit     = _explain_global_cache_hit
        eg_miss    = _explain_global_cache_miss
        pv_fail    = _predict_validation_fail
        pv_err     = _predict_error_count
        el_fail    = _explain_local_validation_fail
        el_err     = _explain_local_error_count
        eg_err     = _explain_global_error_count
        tr_err     = _train_error_count
        last_model = dict(_last_model_info)

    # ── CPU ───────────────────────────────────────────────────────────────────
    cpu_pct = psutil.cpu_percent(interval=None)
    try:
        per_core: List[float] = psutil.cpu_percent(interval=None, percpu=True)
    except Exception:
        per_core = []
    try:
        ld = psutil.getloadavg()
        load1, load5, load15 = round(ld[0], 2), round(ld[1], 2), round(ld[2], 2)
    except Exception:
        load1 = load5 = load15 = None
    try:
        proc_cpu: Optional[float] = round(proc.cpu_percent(interval=None), 1)
    except Exception:
        proc_cpu = None

    # ── Memory ────────────────────────────────────────────────────────────────
    vm       = psutil.virtual_memory()
    swap     = psutil.swap_memory()
    mem_info = proc.memory_info()
    try:
        threads: Optional[int] = proc.num_threads()
    except Exception:
        threads = None
    try:
        open_fds: Optional[int] = proc.num_fds()
    except Exception:
        open_fds = None
    try:
        cached_mb: Optional[float] = round(getattr(vm, "cached", 0) / 1024 ** 2, 1)
    except Exception:
        cached_mb = None
    # swap_in / swap_out MB/s (delta between polls)
    swap_in_mb_s = swap_out_mb_s = None
    try:
        if _last_swap_snap:
            dt_s = now - _last_swap_snap[0]
            if dt_s > 0:
                swap_in_mb_s  = round((swap.sin  - _last_swap_snap[1]) / dt_s / 1024 ** 2, 3)
                swap_out_mb_s = round((swap.sout - _last_swap_snap[2]) / dt_s / 1024 ** 2, 3)
        _last_swap_snap = (now, swap.sin, swap.sout)
    except Exception:
        pass

    # ── Disk ──────────────────────────────────────────────────────────────────
    data_dir = os.getenv("DATA_DIR", "./data")
    disk_free_gb = disk_used_gb = disk_pct = inode_pct = None
    try:
        du         = psutil.disk_usage(data_dir)
        disk_free_gb = round(du.free  / 1024 ** 3, 2)
        disk_used_gb = round(du.used  / 1024 ** 3, 2)
        disk_pct     = du.percent
    except Exception:
        pass
    # inode usage via os.statvfs
    try:
        sv = os.statvfs(data_dir)
        if sv.f_files > 0:
            inode_pct = round(100.0 * (sv.f_files - sv.f_ffree) / sv.f_files, 1)
    except Exception:
        pass

    # ── IO deltas ─────────────────────────────────────────────────────────────
    read_mb_s = write_mb_s = rx_mb_s = tx_mb_s = None
    try:
        dio = psutil.disk_io_counters()
        nio = psutil.net_io_counters()
        if _last_disk_snap:
            dt = now - _last_disk_snap[0]
            if dt > 0:
                read_mb_s  = round((dio.read_bytes  - _last_disk_snap[1]) / dt / 1024 ** 2, 3)
                write_mb_s = round((dio.write_bytes - _last_disk_snap[2]) / dt / 1024 ** 2, 3)
        _last_disk_snap = (now, dio.read_bytes, dio.write_bytes)
        if _last_net_snap:
            dt = now - _last_net_snap[0]
            if dt > 0:
                rx_mb_s = round((nio.bytes_recv - _last_net_snap[1]) / dt / 1024 ** 2, 3)
                tx_mb_s = round((nio.bytes_sent - _last_net_snap[2]) / dt / 1024 ** 2, 3)
        _last_net_snap = (now, nio.bytes_recv, nio.bytes_sent)
    except Exception:
        pass

    # ── RPS ───────────────────────────────────────────────────────────────────
    rps_1m  = round(len(lat_1m)  / 60,  3)
    rps_5m  = round(len(lat_5m)  / 300, 3)
    rps_15m = round(len(lat_15m) / 900, 3)

    # ── Per-endpoint list (top 10 by count, stats over rolling window) ────────
    ep_list: List[Dict[str, Any]] = []
    new_p95_snap: Dict[str, float] = {}
    for ep_key_s, ep in sorted(ep_snap.items(), key=lambda x: -x[1]["count"])[:10]:
        parts = ep_key_s.split(" ", 1)
        ep_m  = parts[0] if len(parts) == 2 else "GET"
        ep_p  = parts[1] if len(parts) == 2 else ep_key_s
        lats      = ep["lat"]
        lat_ts_list = ep["lat_ts"]
        cnt       = ep["count"]
        # Time-windowed stats (15-min window via lat_ts)
        win_data     = [ms for ts, ms in lat_ts_list if ts >= now - WINDOW_SEC]
        last_1m_data = [ms for ts, ms in lat_ts_list if ts >= now - 60]
        last_5m_data = [ms for ts, ms in lat_ts_list if ts >= now - 300]
        last_1m_avg  = round(sum(last_1m_data) / len(last_1m_data), 2) if last_1m_data else None
        p95_1m  = _percentile(last_1m_data, 95) if last_1m_data else None
        p95_5m  = _percentile(last_5m_data, 95) if last_5m_data else None
        trend   = round(p95_1m - p95_5m, 2) if (p95_1m is not None and p95_5m is not None) else None
        use_lats = win_data if win_data else lats   # prefer windowed, fallback all
        p95_all  = _percentile(use_lats, 95)
        new_p95_snap[ep_key_s] = p95_all
        ep_list.append({
            "path":          ep_p,
            "method":        ep_m,
            "count":         cnt,
            "err":           ep["err"],
            "err_rate":      round(ep["err"] / cnt, 4) if cnt else 0,
            "p50":           _percentile(use_lats, 50),
            "p95":           p95_all,
            "p99":           _percentile(use_lats, 99),
            "avg":           round(sum(use_lats) / len(use_lats), 2) if use_lats else 0,
            "max":           round(max(use_lats), 2) if use_lats else 0,
            "last_1m_avg":   last_1m_avg,
            "trend_p95_1m":  trend,
            "in_flight":     0,   # route template resolved post-call; not tracked per-ep
        })
    _ep_p95_snap    = new_p95_snap
    _ep_p95_snap_ts = now

    # ── Error breakdown ───────────────────────────────────────────────────────
    errors_by_ep = sorted(
        [{"method": e["method"], "path": e["path"], "count": e["err"]}
         for e in ep_list if e["err"] > 0],
        key=lambda x: -x["count"]
    )[:5]
    top_exc_list = sorted(
        [{"name": k, "count": v} for k, v in top_exc.items()],
        key=lambda x: -x["count"]
    )[:5]

    # ── Global latency (rolling window) ───────────────────────────────────────
    global_lat = {
        "p50": _percentile(win_lats, 50),
        "p95": _percentile(win_lats, 95),
        "p99": _percentile(win_lats, 99),
        "avg": round(sum(win_lats) / len(win_lats), 2) if win_lats else 0.0,
    }

    # ── ML stats ─────────────────────────────────────────────────────────────
    predict_s = _ml_stats(predict_lats,
                          validation_fail=pv_fail, error_count=pv_err,
                          last_ms=round(predict_lats[-1], 2) if predict_lats else None)
    expl_local_s = _ml_stats(explain_l_lats,
                              validation_fail=el_fail, error_count=el_err,
                              last_ms=round(explain_l_lats[-1], 2) if explain_l_lats else None)
    expl_global_s = _ml_stats(explain_g_lats,
                               in_flight=eg_if, error_count=eg_err,
                               cache_hit=eg_hit, cache_miss=eg_miss,
                               last_ms=round(explain_g_lats[-1], 2) if explain_g_lats else None)
    train_s = _ml_stats(train_lats, in_flight=train_if, error_count=tr_err,
                        last_ms=round(train_lats[-1], 2) if train_lats else None)

    return MetricsResponse(
        # ── backward-compat flat fields ───────────────────────────────────────
        uptime_sec     = round(now - _START_TIME, 1),
        cpu_percent    = cpu_pct,
        ram_percent    = vm.percent,
        rss_mb         = round(mem_info.rss / 1024 ** 2, 1),
        requests_total = total,
        in_flight      = in_flight,
        errors_total   = s4 + s5,
        rps_1m         = rps_1m,
        latency_ms     = global_lat,
        endpoints      = [{"path": e["path"], "count": e["count"],
                           "errors": e["err"]} for e in ep_list],
        model_predict  = {"count": predict_s["count"],
                          "avg_ms": predict_s["avg_ms"],
                          "p95_ms": predict_s["p95_ms"]},
        # ── new nested groups ─────────────────────────────────────────────────
        system = {
            "cpu": {
                "percent":  cpu_pct,
                "per_core": per_core,
                "load1":    load1,
                "load5":    load5,
                "load15":   load15,
            },
            "memory": {
                "percent":       vm.percent,
                "used_mb":       round(vm.used      / 1024 ** 2, 1),
                "available_mb":  round(vm.available / 1024 ** 2, 1),
                "cached_mb":     cached_mb,
                "swap_used_mb":  round(swap.used    / 1024 ** 2, 1),
                "swap_in_mb_s":  swap_in_mb_s,
                "swap_out_mb_s": swap_out_mb_s,
            },
            "process": {
                "rss_mb":     round(mem_info.rss / 1024 ** 2, 1),
                "cpu_percent": proc_cpu,
                "threads":    threads,
                "open_fds":   open_fds,
            },
            "disk": {
                "data_dir_free_gb": disk_free_gb,
                "data_dir_used_gb": disk_used_gb,
                "disk_percent":     disk_pct,
                "inode_percent":    inode_pct,
                "read_mb_s":        read_mb_s,
                "write_mb_s":       write_mb_s,
            },
            "net": {"rx_mb_s": rx_mb_s, "tx_mb_s": tx_mb_s},
        },
        http = {
            "requests_total":    total,
            "in_flight":         in_flight,
            "window_sec":        WINDOW_SEC,
            "endpoints_window_sec": WINDOW_SEC,
            "rps":      {"1m": rps_1m, "5m": rps_5m, "15m": rps_15m},
            "status":   {"2xx": s2, "4xx": s4, "5xx": s5},
            "latency_ms": global_lat,
            "endpoints":  ep_list,
            "slow_requests": slow_reqs,
            "errors": {
                "by_type":        ebt,
                "by_endpoint":    errors_by_ep,
                "top_exceptions": top_exc_list,
            },
        },
        ml = {
            "predict":        predict_s,
            "explain_local":  expl_local_s,
            "explain_global": expl_global_s,
            "train":          train_s,
            "last_model": {
                "model_id":            last_model.get("model_id"),
                "algorithm":           last_model.get("algorithm"),
                "final_feature_count": last_model.get("final_feature_count"),
                "last_trained_at":     last_model.get("last_trained_at"),
            },
        },
    )


# ── datasets ──────────────────────────────────────────────────────────────────

@app.post("/api/datasets/upload", response_model=DatasetResponse)
async def upload_dataset(request: Request, file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted (.csv extension required)")

    logger.info("Uploading dataset: %s", file.filename)
    contents = await file.read()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(contents) // 1024 // 1024}MB. Max: {MAX_UPLOAD_BYTES // 1024 // 1024}MB",
        )

    try:
        import io
        import pandas as pd
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"CSV parse error: {e}")

    dataset_id = f"ds_{uuid.uuid4().hex[:16]}"
    save_dataset(dataset_id, df)
    dtypes = {col: _dtype_label(df[col].dtype) for col in df.columns}
    preview = df_to_preview(df, 100)

    logger.info("Dataset saved: %s  rows=%d  cols=%d", dataset_id, len(df), len(df.columns))
    return DatasetResponse(
        dataset_id=dataset_id, columns=df.columns.tolist(),
        total_rows=len(df), total_columns=len(df.columns),
        preview=preview, dtypes=dtypes,
    )


@app.get("/api/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: str):
    if not dataset_exists(dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    df = load_dataset(dataset_id)
    dtypes = {col: _dtype_label(df[col].dtype) for col in df.columns}
    return DatasetResponse(
        dataset_id=dataset_id, columns=df.columns.tolist(),
        total_rows=len(df), total_columns=len(df.columns),
        preview=df_to_preview(df, 100), dtypes=dtypes,
    )


# ── preprocess ────────────────────────────────────────────────────────────────

@app.post("/api/preprocess/fit_transform", response_model=PreprocessResponse)
def preprocess(req: PreprocessRequest):
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    logger.info("Preprocessing dataset %s  scaling=%s encoding=%s", req.dataset_id, req.scaling, req.categorical_encoding)
    try:
        preprocess_id, processed_id, report, trace = run_preprocess(
            dataset_id=req.dataset_id,
            target_column=req.target_column,
            missing_strategy=req.missing_strategy,
            scaling=req.scaling,
            categorical_encoding=req.categorical_encoding,
            balance=req.balance,
            test_size=req.test_size,
            random_state=req.random_state,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Preprocessing failed")
        raise HTTPException(status_code=500, detail=str(e))
    return PreprocessResponse(
        preprocess_id=preprocess_id,
        processed_dataset_id=processed_id,
        report=report,
        trace=trace,
    )


# ── features ──────────────────────────────────────────────────────────────────

@app.post("/api/features/report", response_model=FeatureReportResponse)
def feature_report(req: FeatureReportRequest):
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    try:
        return run_feature_report(req.dataset_id, req.target_column, req.selection_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Feature report failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/features/apply", response_model=FeatureApplyResponse)
def feature_apply(req: FeatureApplyRequest):
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    try:
        data = run_feature_apply(req.dataset_id, req.target_column, req.mode, req.features)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Feature apply failed")
        raise HTTPException(status_code=500, detail=str(e))

    return FeatureApplyResponse(
        selection_id=data["selection_id"],
        kept_features=data["kept_features"],
        dropped_features=data["dropped_features"],
        trace=FeatureApplyTrace(
            mode=req.mode,
            applied_to="raw_features",
            kept_count=len(data["kept_features"]),
            dropped_count=len(data["dropped_features"]),
        ),
    )


# ── FAMS feature selection ────────────────────────────────────────────────────

@app.post("/api/features/fams", response_model=FAMSResponse)
def feature_fams(req: FAMSRequest):
    """FAMS 5-method ensemble voting feature selection."""
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    if req.preprocess_id and not preprocess_exists(req.preprocess_id):
        raise HTTPException(status_code=404, detail=f"Preprocess artifact '{req.preprocess_id}' not found")
    try:
        data = run_fams_selection(
            dataset_id=req.dataset_id,
            target_column=req.target_column,
            preprocess_id=req.preprocess_id,
            n_features=req.n_features,
            variance_threshold=req.variance_threshold,
            corr_threshold=req.corr_threshold,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("FAMS selection failed")
        raise HTTPException(status_code=500, detail=str(e))
    return FAMSResponse(
        selection_id=data["selection_id"],
        kept_features=data["kept_features"],
        dropped_features=data["dropped_features"],
        votes=data["votes"],
        method_results=data["method_results"],
        n_methods=data["n_methods"],
        min_votes=data["min_votes"],
    )


# ── train ─────────────────────────────────────────────────────────────────────

@app.post("/api/train", response_model=TrainResponse)
def train(req: TrainRequest):
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    if req.preprocess_id and not preprocess_exists(req.preprocess_id):
        raise HTTPException(status_code=404, detail=f"Preprocess artifact '{req.preprocess_id}' not found")
    if req.selection_id and not selection_exists(req.selection_id):
        raise HTTPException(status_code=404, detail=f"Selection '{req.selection_id}' not found")

    logger.info("Training %s on %s  preprocess_id=%s  selection_id=%s  cv_folds=%s",
                req.algorithm, req.dataset_id, req.preprocess_id, req.selection_id, req.cv_folds)
    try:
        result = run_train(
            dataset_id=req.dataset_id,
            target_column=req.target_column,
            algorithm=req.algorithm,
            hyperparams=req.hyperparams,
            cv_folds=req.cv_folds,
            preprocess_id=req.preprocess_id,
            selection_id=req.selection_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Training failed")
        with _stats_lock:
            _train_error_count += 1
            _top_exceptions[type(e).__name__] = _top_exceptions.get(type(e).__name__, 0) + 1
        raise HTTPException(status_code=500, detail=str(e))

    # Update last-model info for the metrics dashboard
    import datetime as _dt
    with _stats_lock:
        _last_model_info.update({
            "model_id":            result.model_id,
            "algorithm":           result.trace.algorithm if result.trace else req.algorithm,
            "final_feature_count": result.trace.final_feature_count if result.trace else None,
            "last_trained_at":     _dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
    return result


# ── HPO (Optuna auto-tune) ────────────────────────────────────────────────────

@app.post("/api/train/hpo", response_model=HPOResponse)
def train_hpo(req: HPORequest):
    """Run Optuna hyperparameter optimisation, then train final model with best params."""
    if not dataset_exists(req.dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found")
    if req.preprocess_id and not preprocess_exists(req.preprocess_id):
        raise HTTPException(status_code=404, detail=f"Preprocess artifact '{req.preprocess_id}' not found")
    if req.selection_id and not selection_exists(req.selection_id):
        raise HTTPException(status_code=404, detail=f"Selection '{req.selection_id}' not found")

    logger.info("HPO %s on %s  trials=%d  cv=%d  timeout=%ss",
                req.algorithm, req.dataset_id, req.n_trials, req.cv_folds, req.timeout_sec)
    try:
        result = run_hpo(
            dataset_id=req.dataset_id,
            target_column=req.target_column,
            algorithm=req.algorithm,
            preprocess_id=req.preprocess_id,
            selection_id=req.selection_id,
            n_trials=req.n_trials,
            cv_folds=req.cv_folds,
            timeout_sec=req.timeout_sec,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("HPO failed")
        with _stats_lock:
            _train_error_count += 1
        raise HTTPException(status_code=500, detail=str(e))

    # Update last-model info in metrics dashboard
    import datetime as _dt
    tr = result.get("train_response")
    if tr:
        with _stats_lock:
            _last_model_info.update({
                "model_id":            tr.model_id,
                "algorithm":           tr.trace.algorithm if tr.trace else req.algorithm,
                "final_feature_count": tr.trace.final_feature_count if tr.trace else None,
                "last_trained_at":     _dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            })

    return HPOResponse(
        algorithm=result["algorithm"],
        best_params=result["best_params"],
        best_cv_score=result["best_cv_score"],
        n_trials_completed=result["n_trials_completed"],
        train_response=result.get("train_response"),
        all_trials=result["all_trials"],
    )


# ── experiments ───────────────────────────────────────────────────────────────

@app.get("/api/experiments", response_model=List[ExperimentSummary])
def experiments():
    return [
        ExperimentSummary(
            id=r["id"], name=r["name"], algorithm=r["algorithm"],
            accuracy=r["accuracy"], f1Score=r["f1Score"],
            trainingTime=r["trainingTime"], date=r["date"],
            featured=r.get("featured", False),
        )
        for r in list_experiments()
    ]


@app.get("/api/experiments/{experiment_id}", response_model=ExperimentDetail)
def experiment_detail(experiment_id: str):
    from .schemas import CVMetrics, ConfusionMatrixResult, Metrics, TrainTrace

    record = get_experiment(experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found")

    m = record["metrics"]
    cm = record["confusion_matrix"]
    cv_raw = record.get("cv_metrics")
    cv_result = CVMetrics(**cv_raw) if cv_raw else None

    trace_raw = record.get("trace")
    trace = TrainTrace(**trace_raw) if trace_raw else None

    return ExperimentDetail(
        experiment={
            "id": record["id"], "name": record["name"],
            "algorithm": record["algorithm"],
            "created_at": record.get("created_at", ""),
            "dataset_id": record.get("dataset_id", ""),
            "model_id": record.get("model_id", ""),
            "status": record.get("status", "ok"),
            "skip_reason": record.get("skip_reason"),
        },
        metrics=Metrics(
            accuracy=m["accuracy"], precision=m["precision"],
            recall=m["recall"], f1Score=m["f1Score"],
            auc=m.get("auc"), auc_note=m.get("auc_note"),
            specificity=m["specificity"],
        ),
        confusion_matrix=ConfusionMatrixResult(tn=cm["tn"], fp=cm["fp"], fn=cm["fn"], tp=cm["tp"]),
        hyperparams=record.get("hyperparams", {}),
        cv_metrics=cv_result,
        trace=trace,
    )


# ── predict ───────────────────────────────────────────────────────────────────

@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    global _predict_validation_fail, _predict_error_count
    try:
        result = run_predict(req.model_id, req.features)
    except FileNotFoundError:
        with _stats_lock:
            _predict_error_count += 1
        raise HTTPException(status_code=404, detail=f"Model '{req.model_id}' not found")
    except ValueError as e:
        with _stats_lock:
            _predict_validation_fail += 1
            _predict_error_count     += 1
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Prediction failed")
        with _stats_lock:
            _predict_error_count += 1
            _top_exceptions[type(e).__name__] = _top_exceptions.get(type(e).__name__, 0) + 1
        raise HTTPException(status_code=500, detail=str(e))
    return PredictResponse(prediction=result["prediction"], probability=result.get("probability"))


# ── explain ───────────────────────────────────────────────────────────────────

@app.get("/api/models/{model_id}/meta")
def model_meta(model_id: str):
    meta = load_model_meta(model_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found or has no meta")
    return {
        "raw_feature_names": meta.get("raw_feature_names", []),
        "algorithm": meta.get("algorithm", ""),
        "scaling": meta.get("scaling", ""),
        "categorical_encoding": meta.get("categorical_encoding", ""),
        "label_classes": meta.get("label_classes"),
        "class_stats": meta.get("class_stats"),
    }


@app.get("/api/models/{model_id}/explain/global", response_model=GlobalExplainResponse)
def explain_global(model_id: str, compare: bool = False):
    global _explain_global_in_flight, _explain_global_cache_hit, _explain_global_cache_miss
    global _explain_global_error_count
    meta = load_model_meta(model_id)
    if not meta:
        with _stats_lock:
            _explain_global_error_count += 1
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    has_cache = bool(meta.get("global_importance") or meta.get("global_importance_cache"))
    t0 = time.perf_counter()
    with _stats_lock:
        _explain_global_in_flight += 1
    _ok = False
    try:
        result = run_global_explain(model_id, compare=compare)
        _ok = True
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    except Exception as e:
        logger.exception("Global explain failed")
        with _stats_lock:
            _top_exceptions[type(e).__name__] = _top_exceptions.get(type(e).__name__, 0) + 1
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        with _stats_lock:
            _explain_global_in_flight -= 1
            _explain_global_latency.append(elapsed_ms)
            if not _ok:
                _explain_global_error_count += 1
            elif has_cache:
                _explain_global_cache_hit += 1
            else:
                _explain_global_cache_miss += 1
    return result


@app.post("/api/models/{model_id}/explain/local", response_model=LocalExplainResponse)
def explain_local(model_id: str, req: LocalExplainRequest, compare: bool = False):
    global _explain_local_validation_fail, _explain_local_error_count
    meta = load_model_meta(model_id)
    if not meta:
        with _stats_lock:
            _explain_local_error_count += 1
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    try:
        return run_local_explain(model_id, req.features, compare=compare)
    except FileNotFoundError:
        with _stats_lock:
            _explain_local_error_count += 1
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    except ValueError as e:
        with _stats_lock:
            _explain_local_validation_fail += 1
            _explain_local_error_count     += 1
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Local explain failed")
        with _stats_lock:
            _explain_local_error_count += 1
            _top_exceptions[type(e).__name__] = _top_exceptions.get(type(e).__name__, 0) + 1
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models/{model_id}/details_vi", response_model=ModelDetailsVI)
def model_details_vi(model_id: str, compare: bool = False):
    meta = load_model_meta(model_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found or has no meta")
    try:
        return run_details_vi(model_id, compare=compare)
    except Exception as e:
        logger.exception("Model details_vi failed")
        raise HTTPException(status_code=500, detail=str(e))
