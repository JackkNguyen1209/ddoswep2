/**
 * API client: timeout + 1 retry. Base URL from NEXT_PUBLIC_API_BASE_URL.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://192.168.88.128:8000'
const DEFAULT_TIMEOUT_MS = 60_000

async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeoutMs)
  // If caller provides a signal, abort our controller when that signal fires too
  const userSignal = init?.signal
  const onUserAbort = () => controller.abort()
  if (userSignal) userSignal.addEventListener('abort', onUserAbort)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(tid)
    if (userSignal) userSignal.removeEventListener('abort', onUserAbort)
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`, init, timeoutMs)
      if (!res.ok) {
        const body = await res.text()
        let detail = body
        try { detail = JSON.parse(body)?.detail ?? body } catch { /* ignore */ }
        throw new Error(`[${res.status}] ${detail}`)
      }
      return res.json() as Promise<T>
    } catch (err) {
      lastError = err
      if (attempt === 0 && !(err instanceof Error && err.name === 'AbortError')) {
        await new Promise(r => setTimeout(r, 600))
        continue
      }
      break
    }
  }
  throw lastError
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DatasetResponse {
  dataset_id: string
  columns: string[]
  total_rows: number
  total_columns: number
  preview: Record<string, unknown>[]
  dtypes: Record<string, string>
}

export interface PreprocessRequest {
  dataset_id: string
  target_column: string
  missing_strategy: 'drop' | 'mean' | 'median' | 'most_frequent'
  scaling: 'none' | 'standard' | 'minmax' | 'robust'
  categorical_encoding: 'onehot' | 'label'
  balance: 'none' | 'undersample'
  test_size: number
  random_state: number
}

export interface PreprocessReport {
  rows_before: number
  rows_after: number
  dropped_columns: string[]
  categorical_columns: string[]
  numeric_columns: string[]
  class_distribution_before: Record<string, number>
  class_distribution_after: Record<string, number>
  warnings: string[]
}

export interface PreprocessTrace {
  missing_strategy: string
  scaling: string
  categorical_encoding: string
  balance: string
  train_test_split: { test_size: number; random_state: number }
  numeric_columns: string[]
  categorical_columns: string[]
  output_feature_count_estimate: number
}

export interface PreprocessResponse {
  preprocess_id: string
  processed_dataset_id: string
  report: PreprocessReport
  trace: PreprocessTrace
}

export interface CorrelationPair { feature_a: string; feature_b: string; corr: number }
export interface LowVarianceFeature { feature: string; variance: number }
export interface FeatureReportResponse {
  correlation_top_pairs: CorrelationPair[]
  low_variance_features: LowVarianceFeature[]
  recommended_drop: string[]
  recommended_keep: string[]
  trace?: { based_on: string; numeric_only: boolean } | null
}

export interface ModelMeta {
  raw_feature_names: string[]
  algorithm: string
  scaling: string
  categorical_encoding: string
  label_classes?: string[]
  class_stats?: Record<string, Record<string, { mean: number; std: number }>>
}

export interface FeatureApplyRequest {
  dataset_id: string
  target_column: string
  mode: 'drop' | 'keep'
  features: string[]
}

export interface FeatureApplyResponse {
  selection_id: string
  kept_features: string[]
  dropped_features: string[]
  trace: { mode: string; applied_to: string; kept_count: number; dropped_count: number }
}

export interface TrainRequest {
  dataset_id: string
  target_column: string
  algorithm: string
  hyperparams: Record<string, unknown>
  cv_folds?: number | null
  preprocess_id?: string | null
  selection_id?: string | null
}

export interface Metrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  auc: number | null
  auc_note: string | null
  specificity: number
}

export interface ConfusionMatrix { tn: number; fp: number; fn: number; tp: number }

export interface CVMetrics {
  accuracy_mean: number
  accuracy_std: number
  f1_mean: number
  f1_std: number
  precision_mean: number
  precision_std: number
  recall_mean: number
  recall_std: number
  auc_mean: number | null
  auc_std: number | null
  cv_folds: number
  random_state: number
}

export interface TrainTrace {
  preprocess_id: string | null
  selection_id: string | null
  algorithm: string
  hyperparams: Record<string, unknown>
  scaling: string
  categorical_encoding: string
  missing_strategy: string
  final_feature_count: number
  raw_feature_names: string[]
}

export interface TrainResponse {
  experiment_id: string
  model_id: string
  algorithm: string
  training_time_sec: number
  metrics: Metrics
  confusion_matrix: ConfusionMatrix
  status: string
  skip_reason: string | null
  cv_metrics: CVMetrics | null
  trace: TrainTrace | null
}

export interface ExperimentSummary {
  id: string
  name: string
  algorithm: string
  accuracy: number
  f1Score: number
  trainingTime: number
  date: string
  featured: boolean
}

export interface ExperimentDetail {
  experiment: Record<string, unknown>
  metrics: Metrics
  confusion_matrix: ConfusionMatrix
  hyperparams: Record<string, unknown>
  cv_metrics: CVMetrics | null
  trace: TrainTrace | null
}

export interface PredictResponse {
  prediction: string | number
  probability: number | null
}

export interface FAMSRequest {
  dataset_id: string; target_column: string
  preprocess_id?: string | null
  n_features?: number | null
  variance_threshold?: number
  corr_threshold?: number
}
export interface FAMSResponse {
  selection_id: string
  kept_features: string[]       // features recommended to keep
  dropped_features: string[]    // features recommended to drop
  n_selected: number            // numeric features in kept_features
  variance_removed: number      // removed by VarianceThreshold (step 1)
  correlation_removed: number   // removed by correlation filter (step 2)
}

export interface HPORequest {
  dataset_id: string; target_column: string; algorithm: string
  preprocess_id?: string | null
  selection_id?: string | null
  n_trials?: number
  cv_folds?: number
  timeout_sec?: number | null
}
export interface HPOResponse {
  algorithm: string
  best_params: Record<string, unknown>
  best_cv_score: number
  n_trials_completed: number
  train_response: TrainResponse | null
  all_trials: Array<{ number: number; value: number; params: Record<string, unknown> }>
}

export interface AICompareData {
  claude: unknown
  ollama: unknown
  model_claude: string
  model_ollama: string
}

export interface GlobalFeatureImportance { name: string; score: number }
export interface GlobalExplainResponse {
  method: string
  top_features: GlobalFeatureImportance[]
  notes: string
  compare_data?: AICompareData
}

export interface LocalContribution {
  feature_original: string
  feature_vi: string
  input_value: unknown
  direction: string
  impact: number
  comparison: Record<string, { mean: number; std: number }>
}

export interface ExplainTrace {
  used_preprocess_id: string | null
  used_selection_id: string | null
  scaling: string
  encoding: string
  note: string
}

export interface LocalExplainResponse {
  prediction: string
  probability: number | null
  method: string
  top_contributions: LocalContribution[]
  vietnamese_explanation: string[]
  trace: ExplainTrace
  compare_data?: AICompareData
}

export interface HyperparamVI { name: string; value: string; meaning_vi: string }
export interface ModelDetailSection {
  heading: string
  paragraphs: string[]
  bullets: string[]
}
export interface ModelDetailsVI {
  title: string
  algorithm_key: string
  sections: ModelDetailSection[]
  hyperparams_table: HyperparamVI[]
  how_used_in_pipeline: string[]
  limitations_for_ddos: string[]
  compare_data?: AICompareData
}

// ── System Metrics ────────────────────────────────────────────────────────────

export interface SlowRequest {
  ts: number; method: string; route_path: string; status: number
  latency_ms: number; error_summary: string | null
  req_bytes: number | null; resp_bytes: number | null; user_agent: string | null
}

export interface EndpointStat {
  path: string; method: string; count: number; err: number; err_rate: number
  p50: number; p95: number; p99: number; avg: number; max: number
  last_1m_avg: number | null; trend_p95_1m: number | null; in_flight: number
}

export interface MlOp {
  count: number; avg_ms: number; p95_ms: number; p99_ms: number; max_ms: number
  last_ms: number | null; in_flight: number; error_count: number
  validation_fail: number; cache_hit: number; cache_miss: number
}

export interface SystemMetrics {
  // ── backward-compat flat fields ──────────────────────────────────────────
  uptime_sec: number
  cpu_percent: number
  ram_percent: number
  rss_mb: number
  requests_total: number
  in_flight: number
  errors_total: number
  rps_1m: number
  latency_ms: { p50: number; p95: number; p99?: number; avg: number }
  endpoints: Array<{ path: string; count: number; errors: number }>
  model_predict: { count: number; avg_ms: number; p95_ms: number }

  // ── system ───────────────────────────────────────────────────────────────
  system: {
    cpu: {
      percent: number; per_core: number[]
      load1: number | null; load5: number | null; load15: number | null
    }
    memory: {
      percent: number; used_mb: number; available_mb: number
      cached_mb: number | null; swap_used_mb: number | null
      swap_in_mb_s: number | null; swap_out_mb_s: number | null
    }
    process: { rss_mb: number; cpu_percent: number | null; threads: number | null; open_fds: number | null }
    disk: {
      data_dir_free_gb: number | null; data_dir_used_gb: number | null
      disk_percent: number | null; inode_percent: number | null
      read_mb_s: number | null; write_mb_s: number | null
    }
    net: { rx_mb_s: number | null; tx_mb_s: number | null }
  }

  // ── http ─────────────────────────────────────────────────────────────────
  http: {
    requests_total: number
    in_flight: number
    window_sec: number
    endpoints_window_sec: number
    rps: { '1m': number; '5m': number; '15m': number }
    status: { '2xx': number; '4xx': number; '5xx': number }
    latency_ms: { p50: number; p95: number; p99: number; avg: number }
    endpoints: EndpointStat[]
    slow_requests: SlowRequest[]
    errors: {
      by_type: { validation_422: number; not_found_404: number; server_5xx: number; other_4xx: number }
      by_endpoint: Array<{ method: string; path: string; count: number }>
      top_exceptions: Array<{ name: string; count: number }>
    }
  }

  // ── ml ───────────────────────────────────────────────────────────────────
  ml: {
    predict:        MlOp
    explain_local:  MlOp
    explain_global: MlOp
    train:          MlOp
    last_model: {
      model_id: string | null; algorithm: string | null
      final_feature_count: number | null; last_trained_at: string | null
    }
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  uploadDataset(file: File): Promise<DatasetResponse> {
    const form = new FormData()
    form.append('file', file)
    return request<DatasetResponse>('/api/datasets/upload', { method: 'POST', body: form }, 120_000)
  },

  getDataset(datasetId: string): Promise<DatasetResponse> {
    return request<DatasetResponse>(`/api/datasets/${datasetId}`)
  },

  preprocess(req: PreprocessRequest): Promise<PreprocessResponse> {
    return request<PreprocessResponse>('/api/preprocess/fit_transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 120_000)
  },

      featureReport(datasetId: string, targetColumn: string, selectionId?: string | null): Promise<FeatureReportResponse> {
        return request<FeatureReportResponse>('/api/features/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataset_id: datasetId,
            target_column: targetColumn,
            ...(selectionId ? { selection_id: selectionId } : {}),
          }),
        })
      },

  featureApply(req: FeatureApplyRequest): Promise<FeatureApplyResponse> {
    return request<FeatureApplyResponse>('/api/features/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
  },

  train(req: TrainRequest): Promise<TrainResponse> {
    return request<TrainResponse>('/api/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 300_000)
  },

  listExperiments(): Promise<ExperimentSummary[]> {
    return request<ExperimentSummary[]>('/api/experiments')
  },

  getExperiment(experimentId: string): Promise<ExperimentDetail> {
    return request<ExperimentDetail>(`/api/experiments/${experimentId}`)
  },

  predict(modelId: string, features: Record<string, unknown>): Promise<PredictResponse> {
    return request<PredictResponse>('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, features }),
    })
  },

  explainGlobal(modelId: string, compare = false): Promise<GlobalExplainResponse> {
    const qs = compare ? '?compare=true' : ''
    return request<GlobalExplainResponse>(`/api/models/${modelId}/explain/global${qs}`)
  },

  explainLocal(modelId: string, features: Record<string, unknown>, compare = false): Promise<LocalExplainResponse> {
    const qs = compare ? '?compare=true' : ''
    return request<LocalExplainResponse>(`/api/models/${modelId}/explain/local${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features }),
    }, 120_000)
  },

  modelDetailsVI(modelId: string, compare = false): Promise<ModelDetailsVI> {
    const qs = compare ? '?compare=true' : ''
    return request<ModelDetailsVI>(`/api/models/${modelId}/details_vi${qs}`)
  },

  /** Returns lightweight model metadata including raw_feature_names. */
  getModelMeta(modelId: string): Promise<ModelMeta> {
    return request<ModelMeta>(`/api/models/${modelId}/meta`)
  },

  famsSelection(req: FAMSRequest): Promise<FAMSResponse> {
    return request<FAMSResponse>('/api/features/fams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 120_000)
  },

  runHPO(req: HPORequest): Promise<HPOResponse> {
    return request<HPOResponse>('/api/train/hpo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, 600_000)
  },

  /** Realtime server performance metrics. */
  getMetrics(signal?: AbortSignal): Promise<SystemMetrics> {
    return request<SystemMetrics>('/api/metrics', signal ? { signal } : undefined, 2_000)
  },
}
