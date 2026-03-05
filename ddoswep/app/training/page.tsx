'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, Play, Zap, X, Loader2, AlertCircle } from 'lucide-react'
import { AlgorithmSelector } from '@/components/training/algorithm-selector'
import { HyperparameterPanel } from '@/components/training/hyperparameter-panel'
import { AlgorithmComparison } from '@/components/training/algorithm-comparison'
import { vi } from '@/lib/vi'
import { api, type TrainResponse, type HPOResponse } from '@/lib/api'

const algorithms = [
  {
    id: 'ann',
    name: 'Artificial Neural Network',
    description: 'Deep learning model with multiple layers',
    icon: '🧠',
    hyperparams: {
      layers: { label: 'Hidden Layers', value: 3, min: 1, max: 5 },
      neurons: { label: 'Neurons per Layer', value: 128, min: 32, max: 512 },
      epochs: { label: 'Training Epochs', value: 100, min: 10, max: 500 },
      batchSize: { label: 'Batch Size', value: 32, min: 8, max: 128 }
    }
  },
  {
    id: 'svm',
    name: 'Support Vector Machine',
    description: 'High-dimensional classification algorithm',
    icon: '⚔️',
    hyperparams: {
      kernel: { label: 'Kernel Type', value: 'rbf', options: ['linear', 'rbf', 'poly'] },
      C: { label: 'Regularization (C)', value: 1, min: 0.1, max: 10 },
      gamma: { label: 'Kernel Coefficient', value: 'scale', options: ['scale', 'auto'] }
    }
  },
  {
    id: 'nb-gaussian',
    name: 'Gaussian Naive Bayes',
    description: 'Probabilistic classifier assuming normal distribution',
    icon: '📊',
    hyperparams: {
      priors: { label: 'Use Priors', value: true, type: 'boolean' }
    }
  },
  {
    id: 'nb-multinomial',
    name: 'Multinomial Naive Bayes',
    description: 'Fast and efficient for discrete features',
    icon: '📈',
    hyperparams: {
      alpha: { label: 'Smoothing (Alpha)', value: 1, min: 0, max: 2 }
    }
  },
  {
    id: 'nb-bernoulli',
    name: 'Bernoulli Naive Bayes',
    description: 'For binary feature vectors',
    icon: '🎲',
    hyperparams: {
      alpha: { label: 'Smoothing (Alpha)', value: 1, min: 0, max: 2 },
      fitPriors: { label: 'Fit Priors', value: true, type: 'boolean' }
    }
  },
  {
    id: 'logistic',
    name: 'Logistic Regression',
    description: 'Linear classification with probability estimates',
    icon: '📉',
    hyperparams: {
      C: { label: 'Inverse Regularization', value: 1, min: 0.1, max: 10 },
      solver: { label: 'Solver', value: 'lbfgs', options: ['lbfgs', 'liblinear', 'saga'] },
      maxIter: { label: 'Max Iterations', value: 200, min: 10, max: 500 }
    }
  },
  {
    id: 'knn',
    name: 'K-Nearest Neighbors',
    description: 'Distance-based instance-based learning',
    icon: '🎯',
    hyperparams: {
      k: { label: 'Number of Neighbors (K)', value: 5, min: 1, max: 20 },
      metric: { label: 'Distance Metric', value: 'euclidean', options: ['euclidean', 'manhattan'] },
      weights: { label: 'Weights', value: 'uniform', options: ['uniform', 'distance'] }
    }
  },
  {
    id: 'dt',
    name: 'Decision Tree',
    description: 'Tree-based model for interpretable decisions',
    icon: '🌳',
    hyperparams: {
      maxDepth: { label: 'Max Depth', value: 10, min: 1, max: 30 },
      minSamples: { label: 'Min Samples Split', value: 2, min: 2, max: 20 },
      criterion: { label: 'Split Criterion', value: 'gini', options: ['gini', 'entropy'] }
    }
  },
  {
    id: 'rf',
    name: 'Random Forest',
    description: 'Ensemble of decision trees for robust prediction',
    icon: '🌲',
    hyperparams: {
      nEstimators: { label: 'Number of Trees', value: 100, min: 10, max: 500 },
      maxDepth: { label: 'Max Depth', value: 15, min: 5, max: 50 },
      minSamples: { label: 'Min Samples Split', value: 2, min: 2, max: 20 }
    }
  },
  {
    id: 'xgb',
    name: 'XGBoost',
    description: 'eXtreme Gradient Boosting — fast, regularized, state-of-the-art',
    icon: '⚡',
    hyperparams: {
      nEstimators:     { label: 'Num Boosters', value: 100, min: 10, max: 500 },
      learningRate:    { label: 'Learning Rate', value: 0.1, min: 0.01, max: 0.5 },
      maxDepth:        { label: 'Max Depth', value: 6, min: 3, max: 12 },
      subsample:       { label: 'Row Subsample', value: 0.8, min: 0.5, max: 1.0 },
      colsampleBytree: { label: 'Col Subsample/Tree', value: 0.8, min: 0.3, max: 1.0 },
      minChildWeight:  { label: 'Min Child Weight', value: 1, min: 1, max: 10 },
    }
  },
  {
    id: 'gb',
    name: 'Gradient Boosting',
    description: 'sklearn sequential boosting — interpretable and robust',
    icon: '🚀',
    hyperparams: {
      nEstimators:  { label: 'Number of Boosters', value: 100, min: 10, max: 500 },
      learningRate: { label: 'Learning Rate', value: 0.1, min: 0.01, max: 1 },
      maxDepth:     { label: 'Max Depth', value: 5, min: 3, max: 10 },
      subsample:    { label: 'Row Subsample', value: 1.0, min: 0.5, max: 1.0 },
    }
  }
]

export default function TrainingPage() {
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>([])
  const [training, setTraining] = useState(false)
  const [trainResults, setTrainResults] = useState<TrainResponse[]>([])
  const [showComparison, setShowComparison] = useState(false)
  const [error, setError] = useState('')
  const [cvFolds, setCvFolds] = useState<number | null>(null)

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [preprocessId, setPreprocessId] = useState<string | null>(null)
  const [selectionId, setSelectionId] = useState<string | null>(null)

  // HPO state
  const [hpoRunning, setHpoRunning] = useState(false)
  const [hpoResult, setHpoResult] = useState<HPOResponse | null>(null)
  const [hpoTrials, setHpoTrials] = useState(20)
  const [hpoCvFolds, setHpoCvFolds] = useState(3)
  const [hpoError, setHpoError] = useState('')
  const [appliedHpo, setAppliedHpo] = useState<{ algoId: string; params: Record<string, unknown> } | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('processed_dataset_id') || localStorage.getItem('dataset_id')
    const tc = localStorage.getItem('target_column') || ''
    const pid = localStorage.getItem('preprocess_id')
    const sid = localStorage.getItem('selection_id')
    if (id) setDatasetId(id)
    if (tc) setTargetColumn(tc)
    if (pid) setPreprocessId(pid)
    if (sid) setSelectionId(sid)
  }, [])

  const toggleAlgorithm = (algoId: string) => {
    setSelectedAlgorithms(prev =>
      prev.includes(algoId) ? prev.filter(a => a !== algoId) : [...prev, algoId]
    )
  }

  const clearSelection = () => setSelectedAlgorithms([])

  const selectedAlgoObjects = algorithms.filter(a => selectedAlgorithms.includes(a.id))

  const getDefaultHyperparams = (algoId: string): Record<string, unknown> => {
    const algo = algorithms.find(a => a.id === algoId)
    if (!algo) return {}
    const hp: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(algo.hyperparams)) {
      hp[key] = (val as { value: unknown }).value
    }
    return hp
  }

  const handleStartTraining = async () => {
    if (!datasetId) { setError('Không tìm thấy dataset. Vui lòng upload CSV trước.'); return }
    if (!targetColumn) { setError('Không tìm thấy target column. Vui lòng chạy Preprocessing trước.'); return }
    if (selectedAlgorithms.length === 0) { setError('Vui lòng chọn ít nhất một thuật toán.'); return }

    setError('')
    setTraining(true)
    setTrainResults([])

    const results: TrainResponse[] = []
    for (const algoId of selectedAlgorithms) {
      try {
        const hp =
          appliedHpo?.algoId === algoId
            ? appliedHpo.params
            : getDefaultHyperparams(algoId)
        const result = await api.train({
          dataset_id: datasetId,
          target_column: targetColumn,
          algorithm: algoId,
          hyperparams: hp,
          cv_folds: cvFolds,
          preprocess_id: preprocessId ?? undefined,
          selection_id: selectionId ?? undefined,
        })
        results.push(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi huấn luyện'
        setError(prev => (prev ? prev + '\n' : '') + `${algoId}: ${msg}`)
      }
    }

    setTrainResults(results)
    setTraining(false)

    const successful = results.filter(r => r.status === 'ok')
    if (successful.length > 0) {
      const last = successful[successful.length - 1]
      localStorage.setItem('experiment_id', last.experiment_id)
      localStorage.setItem('model_id', last.model_id)
    }
  }

  const handleRunHPO = async () => {
    if (!datasetId || !targetColumn) { setHpoError('Cần dataset và target column.'); return }
    if (selectedAlgorithms.length !== 1) { setHpoError('Chọn đúng 1 thuật toán để auto-tune.'); return }
    setHpoError('')
    setHpoRunning(true)
    setHpoResult(null)
    try {
      const result = await api.runHPO({
        dataset_id: datasetId,
        target_column: targetColumn,
        algorithm: selectedAlgorithms[0],
        preprocess_id: preprocessId ?? undefined,
        selection_id: selectionId ?? undefined,
        n_trials: hpoTrials,
        cv_folds: hpoCvFolds,
        timeout_sec: 300,
      })
      setHpoResult(result)
      if (result.train_response) {
        setTrainResults(prev => [...prev, result.train_response!])
        localStorage.setItem('experiment_id', result.train_response.experiment_id)
        localStorage.setItem('model_id', result.train_response.model_id)
      }
    } catch (err) {
      setHpoError(err instanceof Error ? err.message : 'HPO thất bại')
    } finally {
      setHpoRunning(false)
    }
  }

  const completed = trainResults.length > 0 && !training

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/preprocessing">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.trainingPageTitle}</h1>
            <p className="text-sm text-muted-foreground">{vi.trainingPageStep}</p>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!datasetId && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Chưa có dataset. Vui lòng <Link href="/upload" className="underline">upload CSV</Link> và chạy <Link href="/preprocessing" className="underline">preprocessing</Link> trước.
            </p>
          </Card>
        )}

        {!showComparison ? (
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">{vi.selectAlgorithm}</h2>
                <p className="text-muted-foreground mb-6">{vi.selectMultiple}</p>
                {datasetId && (
                  <div className="text-xs text-muted-foreground mb-4 space-y-1">
                    <p>Dataset: <code className="text-primary">{datasetId}</code> · Target: <code className="text-primary">{targetColumn || '(none)'}</code></p>
                    {preprocessId && <p>Preprocess: <code className="text-green-600">{preprocessId}</code> ✓</p>}
                    {selectionId && <p>Feature selection: <code className="text-amber-600">{selectionId}</code> ✓</p>}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {algorithms.map(algo => (
                    <AlgorithmSelector
                      key={algo.id}
                      algorithm={algo}
                      selected={selectedAlgorithms.includes(algo.id)}
                      onSelect={() => toggleAlgorithm(algo.id)}
                    />
                  ))}
                </div>
              </div>

              {selectedAlgorithms.length > 0 && (
                <Card className="bg-primary/5 border-primary/30 p-6">
                  <h3 className="font-bold mb-4">{vi.selectedAlgorithms}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedAlgoObjects.map(algo => (
                      <div key={algo.id} className="bg-primary/20 border border-primary/40 rounded-full px-4 py-2 flex items-center gap-2">
                        <span>{algo.name}</span>
                        <button onClick={() => toggleAlgorithm(algo.id)} className="hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowComparison(true)}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {vi.compareNow}
                    </Button>
                    <Button onClick={clearSelection} variant="outline" className="flex-1">
                      {vi.clearSelection}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Training results */}
              {trainResults.length > 0 && (
                <div className="mt-6 space-y-4">
                  {trainResults.map(r => r.status === 'skipped_not_supported' ? (
                    <Card key={r.experiment_id} className="bg-amber-500/10 border-amber-500/30 p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-amber-700 dark:text-amber-300">⚠ {r.algorithm} — Skipped</h4>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">{r.skip_reason}</p>
                    </Card>
                  ) : (
                    <Card key={r.experiment_id} className="bg-green-500/10 border-green-500/30 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-green-700 dark:text-green-300">{r.algorithm}</h4>
                        <span className="text-xs text-muted-foreground">{r.training_time_sec}s</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                        <div>Accuracy: <span className="font-bold">{(r.metrics.accuracy * 100).toFixed(2)}%</span></div>
                        <div>F1: <span className="font-bold">{(r.metrics.f1Score * 100).toFixed(2)}%</span></div>
                        <div>AUC: <span className="font-bold">{r.metrics.auc !== null ? (r.metrics.auc * 100).toFixed(2) + '%' : 'N/A'}</span></div>
                      </div>
                      {r.cv_metrics && (
                        <div className="border-t border-green-500/20 pt-2 mt-2 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground">{r.cv_metrics.cv_folds}-Fold CV Results:</p>
                          {[
                            { label: 'Accuracy', mean: r.cv_metrics.accuracy_mean, std: r.cv_metrics.accuracy_std },
                            { label: 'F1', mean: r.cv_metrics.f1_mean, std: r.cv_metrics.f1_std },
                            { label: 'Precision', mean: r.cv_metrics.precision_mean, std: r.cv_metrics.precision_std },
                            { label: 'Recall', mean: r.cv_metrics.recall_mean, std: r.cv_metrics.recall_std },
                            ...(r.cv_metrics.auc_mean !== null ? [{ label: 'AUC', mean: r.cv_metrics.auc_mean!, std: r.cv_metrics.auc_std ?? 0 }] : []),
                          ].map(m => (
                            <div key={m.label} className="flex items-center gap-2 text-xs">
                              <span className="w-16 text-muted-foreground shrink-0">{m.label}</span>
                              <div className="flex-1 h-2 rounded-full bg-green-500/15 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-green-500/70"
                                  style={{ width: `${Math.min(m.mean * 100, 100).toFixed(1)}%` }}
                                />
                              </div>
                              <span className="w-28 text-right font-mono shrink-0">
                                {(m.mean * 100).toFixed(1)}% <span className="text-muted-foreground">±{(m.std * 100).toFixed(1)}%</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.trace && (
                        <div className="text-xs text-muted-foreground mt-2 border-t border-green-500/20 pt-2">
                          <span>Scale: <span className="text-primary">{r.trace.scaling}</span></span>
                          <span className="mx-2">·</span>
                          <span>Encode: <span className="text-primary">{r.trace.categorical_encoding}</span></span>
                          {r.trace.selection_id && <><span className="mx-2">·</span><span className="text-amber-600">Feature selection ✓</span></>}
                          <span className="mx-2">·</span>
                          <span>{r.trace.final_feature_count} features</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Exp: <code className="text-primary">{r.experiment_id}</code>
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {selectedAlgorithms.length > 0 ? (
                  <>
                    {selectedAlgorithms.length === 1 && (
                      <HyperparameterPanel algorithm={selectedAlgoObjects[0]} />
                    )}
                    {selectedAlgorithms.length > 1 && (
                      <Card className="bg-card/50 border-border p-6">
                        <h3 className="font-bold mb-3">{vi.selectedAlgorithms}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedAlgorithms.length} thuật toán được chọn
                        </p>
                        <Button
                          onClick={() => setShowComparison(true)}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {vi.compareNow}
                        </Button>
                      </Card>
                    )}

                    {completed && (
                      <Card className="bg-green-500/10 border-green-500/30 p-6">
                        <div className="text-center">
                          <Zap className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <h3 className="font-bold text-green-700 dark:text-green-300">{vi.trainingComplete}</h3>
                          <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2">{vi.trainingCompleteDesc}</p>
                        </div>
                        <Button
                          onClick={() => window.location.href = '/evaluation'}
                          className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {vi.viewEvaluation}
                        </Button>
                      </Card>
                    )}

                    {error && (
                      <Card className="bg-destructive/10 border-destructive/30 p-4">
                        <p className="text-destructive text-xs whitespace-pre-wrap">{error}</p>
                      </Card>
                    )}

                    {/* CV Folds */}
                    <Card className="bg-card/50 border-border p-4">
                      <label className="text-sm font-semibold block mb-2">Cross-Validation Folds</label>
                      <select
                        value={cvFolds ?? ''}
                        onChange={e => setCvFolds(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
                      >
                        <option value="">None (single split)</option>
                        <option value="3">3-Fold CV</option>
                        <option value="5">5-Fold CV</option>
                        <option value="10">10-Fold CV</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        CV trả thêm mean±std metrics
                      </p>
                    </Card>

                    {!completed && (
                      <Button
                        onClick={handleStartTraining}
                        disabled={training || !datasetId}
                        size="lg"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        {training ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {training ? vi.trainingModel : vi.startTraining}
                      </Button>
                    )}

                    {/* Auto-tune (HPO) — only for single-algorithm selection */}
                    {selectedAlgorithms.length === 1 && (
                      <Card className="bg-card/50 border-border p-4 space-y-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" />
                          Auto-tune (Optuna HPO)
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Tự động tìm hyperparameter tốt nhất bằng Bayesian search (TPE).
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium block mb-1">Trials</label>
                            <select
                              value={hpoTrials}
                              onChange={e => setHpoTrials(parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 rounded bg-muted border border-border text-sm"
                            >
                              <option value="10">10</option>
                              <option value="20">20</option>
                              <option value="30">30</option>
                              <option value="50">50</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">CV Folds</label>
                            <select
                              value={hpoCvFolds}
                              onChange={e => setHpoCvFolds(parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 rounded bg-muted border border-border text-sm"
                            >
                              <option value="3">3-Fold</option>
                              <option value="5">5-Fold</option>
                            </select>
                          </div>
                        </div>
                        <Button
                          onClick={handleRunHPO}
                          disabled={hpoRunning || !datasetId}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2 text-sm"
                        >
                          {hpoRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          {hpoRunning ? `Đang tối ưu... (timeout 5m)` : 'Chạy Auto-tune'}
                        </Button>
                        {hpoError && (
                          <p className="text-xs text-destructive">{hpoError}</p>
                        )}
                        {hpoResult && (
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs space-y-2">
                            <p className="font-semibold text-amber-700 dark:text-amber-300">
                              HPO xong — {hpoResult.n_trials_completed} trials
                            </p>
                            <p>Best CV F1: <span className="font-bold">{(hpoResult.best_cv_score * 100).toFixed(2)}%</span></p>
                            <div className="space-y-0.5">
                              {Object.entries(hpoResult.best_params).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="text-muted-foreground">{k}</span>
                                  <span className="font-mono font-bold">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                            {appliedHpo?.algoId === selectedAlgorithms[0] ? (
                              <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold pt-1">
                                <Zap className="w-3 h-3" />
                                Đã áp dụng — Train sẽ dùng params này
                              </div>
                            ) : (
                              <button
                                onClick={() => setAppliedHpo({ algoId: selectedAlgorithms[0], params: hpoResult.best_params })}
                                className="w-full mt-1 px-2 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                              >
                                Áp dụng params vào Train
                              </button>
                            )}
                          </div>
                        )}
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="bg-card/50 border-border p-6 text-center">
                    <p className="text-muted-foreground text-sm">{vi.selectAlgorithms}</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Button onClick={() => setShowComparison(false)} variant="outline" className="mb-6 gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
            <AlgorithmComparison algorithms={selectedAlgoObjects} />
          </div>
        )}
      </div>
    </main>
  )
}
