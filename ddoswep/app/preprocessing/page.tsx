'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { PreprocessingStep } from '@/components/preprocessing/preprocessing-step'
import { vi } from '@/lib/vi'
import { api, type PreprocessReport, type PreprocessTrace } from '@/lib/api'

const STEPS = [
  { title: 'Handle Missing Values', description: 'Remove or impute missing data points', icon: '📊' },
  { title: 'Encode Categorical Features', description: 'Convert categorical variables to numerical format', icon: '🔄' },
  { title: 'Feature Scaling', description: 'Normalize features using selected scaler', icon: '📏' },
  { title: 'Handle Class Imbalance', description: 'Balance dataset using undersampling', icon: '⚖️' },
  { title: 'Train-Test Split', description: 'Split data (train/test, leakage-safe)', icon: '✂️' },
]

export default function PreprocessingPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [datasetMeta, setDatasetMeta] = useState<{ columns: string[]; total_rows: number } | null>(null)

  // Config
  const [targetColumn, setTargetColumn] = useState('')
  const [missingStrategy, setMissingStrategy] = useState<'mean' | 'median' | 'most_frequent' | 'drop'>('mean')
  const [scaling, setScaling] = useState<'standard' | 'minmax' | 'robust' | 'none'>('standard')
  const [catEncoding, setCatEncoding] = useState<'onehot' | 'label'>('onehot')
  const [balance, setBalance] = useState<'none' | 'undersample'>('none')
  const [testSize, setTestSize] = useState(0.2)

  // Progress
  const [stepsDone, setStepsDone] = useState<boolean[]>([false, false, false, false, false])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<PreprocessReport | null>(null)
  const [trace, setTrace] = useState<PreprocessTrace | null>(null)
  const [processedId, setProcessedId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    const id = localStorage.getItem('dataset_id')
    const meta = localStorage.getItem('dataset_meta')
    if (id) setDatasetId(id)
    if (meta) {
      const parsed = JSON.parse(meta)
      setDatasetMeta(parsed)
      if (parsed.columns?.length) setTargetColumn(parsed.columns[parsed.columns.length - 1])
    }
  }, [])

  const runPreprocessing = async () => {
    if (!datasetId) {
      setError('Không tìm thấy dataset. Vui lòng quay lại bước Upload.')
      return
    }
    if (!targetColumn) {
      setError('Vui lòng chọn cột đích (target).')
      return
    }

    setError('')
    setLoading(true)
    setStepsDone([false, false, false, false, false])
    setCompleted(false)

    // Animate steps while waiting
    const animInterval = setInterval(() => {
      setStepsDone(prev => {
        const next = [...prev]
        const idx = next.findIndex(v => !v)
        if (idx >= 0 && idx < STEPS.length - 1) next[idx] = true
        return next
      })
    }, 600)

    try {
      const result = await api.preprocess({
        dataset_id: datasetId,
        target_column: targetColumn,
        missing_strategy: missingStrategy,
        scaling,
        categorical_encoding: catEncoding,
        balance,
        test_size: testSize,
        random_state: 42,
      })
      clearInterval(animInterval)
      setStepsDone([true, true, true, true, true])
      setReport(result.report)
      setTrace(result.trace ?? null)
      setProcessedId(result.processed_dataset_id)
      localStorage.setItem('processed_dataset_id', result.processed_dataset_id)
      localStorage.setItem('preprocess_id', result.preprocess_id)
      localStorage.setItem('target_column', targetColumn)
      setCompleted(true)
    } catch (err) {
      clearInterval(animInterval)
      const msg = err instanceof Error ? err.message : 'Lỗi tiền xử lý'
      setError(`Tiền xử lý thất bại: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/upload">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.preprocessingTitle}</h1>
            <p className="text-sm text-muted-foreground">{vi.preprocessingStep}</p>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-card border-border p-8 mb-8">
          <h2 className="text-2xl font-bold mb-2">{vi.preprocessingPageDesc}</h2>

          {datasetMeta && (
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-sm">
                <span className="text-primary font-semibold">Dataset loaded:</span>{' '}
                {datasetMeta.total_rows} records · {datasetMeta.columns?.length} columns
              </p>
              <p className="text-xs text-muted-foreground mt-1">ID: {datasetId}</p>
            </div>
          )}

          {!datasetId && (
            <Card className="bg-amber-500/10 border-amber-500/30 p-4 mb-6 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">Chưa có dataset. Vui lòng <Link href="/upload" className="underline">tải lên CSV</Link> trước.</p>
            </Card>
          )}

          {/* Config */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-semibold block mb-1">Cột đích (Target)</label>
              <select
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              >
                {datasetMeta?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Xử lý giá trị thiếu</label>
              <select
                value={missingStrategy}
                onChange={e => setMissingStrategy(e.target.value as typeof missingStrategy)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              >
                <option value="mean">Mean</option>
                <option value="median">Median</option>
                <option value="most_frequent">Most Frequent</option>
                <option value="drop">Drop rows</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Scaling</label>
              <select
                value={scaling}
                onChange={e => setScaling(e.target.value as typeof scaling)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              >
                <option value="standard">Standard Scaler</option>
                <option value="minmax">MinMax Scaler</option>
                <option value="robust">Robust Scaler</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Categorical Encoding</label>
              <select
                value={catEncoding}
                onChange={e => setCatEncoding(e.target.value as typeof catEncoding)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              >
                <option value="onehot">One-Hot Encoding</option>
                <option value="label">Label Encoding</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Cân bằng dữ liệu</label>
              <select
                value={balance}
                onChange={e => setBalance(e.target.value as typeof balance)}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              >
                <option value="none">None</option>
                <option value="undersample">Undersample</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1">Test size: {(testSize * 100).toFixed(0)}%</label>
              <input
                type="range"
                min={0.1} max={0.4} step={0.05}
                value={testSize}
                onChange={e => setTestSize(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <Card className="bg-amber-500/10 border-amber-500/30 p-4 mb-8 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">Cảnh báo Tiền xử lý</p>
              <p className="text-sm text-amber-800/80 dark:text-amber-300/80">Scaler/Encoder chỉ được fit trên tập train (train-test split trước) để tránh data leakage.</p>
            </div>
          </Card>

          <div className="space-y-4 mb-8">
            {STEPS.map((s, idx) => (
              <PreprocessingStep
                key={idx}
                icon={s.icon}
                title={s.title}
                description={s.description}
                completed={stepsDone[idx]}
                index={idx}
              />
            ))}
          </div>

          {error && (
            <Card className="bg-destructive/10 border-destructive/30 p-4 mb-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive text-sm">{error}</p>
            </Card>
          )}

          <div className="flex gap-3">
            {!completed ? (
              <Button
                onClick={runPreprocessing}
                disabled={loading || !datasetId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? vi.processingData : vi.startTraining}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-semibold">{vi.trainingComplete}</span>
              </div>
            )}
          </div>

          {completed && report && (
            <div className="mt-8 p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
              <h3 className="font-bold text-green-700 dark:text-green-300 mb-3">Sẵn sàng cho Huấn luyện</h3>
              <div className="grid md:grid-cols-2 gap-3 mb-4 text-sm">
                <div>Rows before: <span className="font-bold">{report.rows_before}</span></div>
                <div>Rows after: <span className="font-bold">{report.rows_after}</span></div>
                <div>Numeric cols: <span className="font-bold">{report.numeric_columns.length}</span></div>
                <div>Categorical cols: <span className="font-bold">{report.categorical_columns.length}</span></div>
                {report.dropped_columns.length > 0 && (
                  <div className="md:col-span-2">Dropped: <span className="font-bold text-amber-600">{report.dropped_columns.join(', ')}</span></div>
                )}
                <div className="md:col-span-2">
                  <span className="font-semibold">Processed ID:</span> <code className="text-xs text-primary">{processedId}</code>
                </div>
              </div>
              {trace && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4 text-sm">
                  <p className="font-bold text-primary mb-2">🔧 Pipeline sẽ dùng khi Huấn luyện:</p>
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div>Missing strategy: <span className="font-semibold text-primary">{trace.missing_strategy}</span></div>
                    <div>Scaling: <span className="font-semibold text-primary">{trace.scaling}</span></div>
                    <div>Encoding: <span className="font-semibold text-primary">{trace.categorical_encoding}</span></div>
                    <div>Balance: <span className="font-semibold text-primary">{trace.balance}</span></div>
                    <div>Test size: <span className="font-semibold">{(trace.train_test_split.test_size * 100).toFixed(0)}%</span></div>
                    <div>Output features (est.): <span className="font-semibold">{trace.output_feature_count_estimate}</span></div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => window.location.href = '/feature-optimization'}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Tiếp tục đến Tối ưu hóa Đặc trưng
                </Button>
                <Button onClick={() => window.location.href = '/training'} variant="outline">
                  Bỏ qua đến Huấn luyện
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
