'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ChevronLeft, Zap, AlertCircle, Loader2, Info } from 'lucide-react'
import { vi } from '@/lib/vi'
import { CorrelationMatrix } from '@/components/feature-optimization/correlation-matrix'
import { VarianceAnalysis } from '@/components/feature-optimization/variance-analysis'
import { OptimizationResults } from '@/components/feature-optimization/optimization-results'
import { api, type FeatureReportResponse, type FeatureApplyResponse, type FAMSResponse } from '@/lib/api'

const SLIDER_MIN = 1

export default function FeatureOptimizationPage() {
  const [minFeatures, setMinFeatures] = useState(SLIDER_MIN)
  const [running, setRunning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<FeatureReportResponse | null>(null)
  const [applyResult, setApplyResult] = useState<FeatureApplyResponse | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'correlation' | 'variance' | 'results'>('overview')

  // FAMS state
  const [famsRunning, setFamsRunning] = useState(false)
  const [famsResult, setFamsResult] = useState<FAMSResponse | null>(null)
  const [famsError, setFamsError] = useState('')
  const [famsNFeatures, setFamsNFeatures] = useState<number | ''>('')
  const [famsVarThreshold, setFamsVarThreshold] = useState(0.01)
  const [famsCorrThreshold, setFamsCorrThreshold] = useState(0.95)

  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [targetColumn, setTargetColumn] = useState('')
  const [datasetMeta, setDatasetMeta] = useState<{ columns: string[] } | null>(null)
  const [featureCount, setFeatureCount] = useState<number | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Compute feature count: all columns minus the target column
  const computeFeatureCount = (columns: string[], target: string) => {
    const count = columns.filter(c => c !== target).length
    return count > 0 ? count : columns.length
  }

  useEffect(() => {
    const id = localStorage.getItem('processed_dataset_id') || localStorage.getItem('dataset_id')
    const tc = localStorage.getItem('target_column') || ''
    const metaRaw = localStorage.getItem('dataset_meta')

    if (id) setDatasetId(id)
    if (tc) setTargetColumn(tc)

    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as { columns: string[] }
      setDatasetMeta(meta)
      if (meta.columns?.length && tc) {
        const count = computeFeatureCount(meta.columns, tc)
        setFeatureCount(count)
        setMinFeatures(Math.min(8, count))
      }
    } else if (id) {
      // No cached meta — fetch from API
      setLoadingMeta(true)
      api.getDataset(id)
        .then(ds => {
          const meta = { columns: ds.columns }
          setDatasetMeta(meta)
          if (ds.columns?.length && tc) {
            const count = computeFeatureCount(ds.columns, tc)
            setFeatureCount(count)
            setMinFeatures(Math.min(8, count))
          }
        })
        .catch(() => { /* silently ignore; user will see disabled slider */ })
        .finally(() => setLoadingMeta(false))
    }
  }, [])

  // Recalculate feature count when target column changes
  useEffect(() => {
    if (datasetMeta?.columns?.length && targetColumn) {
      const count = computeFeatureCount(datasetMeta.columns, targetColumn)
      setFeatureCount(count)
      setMinFeatures(prev => Math.min(prev, count))
    }
  }, [targetColumn, datasetMeta])

  const handleOptimize = async () => {
    if (!datasetId || !targetColumn) {
      setError('Cần dataset_id và target_column. Hãy chạy bước Upload + Preprocess trước.')
      return
    }
    setError('')
    setRunning(true)
    try {
      const result = await api.featureReport(datasetId, targetColumn)
      setReport(result)
      setSelectedTab('results')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi feature report'
      setError(`Feature report thất bại: ${msg}`)
    } finally {
      setRunning(false)
    }
  }

  const handleApplyOptimization = async () => {
    if (!datasetId || !targetColumn || !report) return
    setError('')
    setApplying(true)
    try {
      const result = await api.featureApply({
        dataset_id: datasetId,
        target_column: targetColumn,
        mode: 'drop',
        features: report.recommended_drop,
      })
      setApplyResult(result)
      localStorage.setItem('selection_id', result.selection_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi áp dụng feature selection'
      setError(`Áp dụng thất bại: ${msg}`)
    } finally {
      setApplying(false)
    }
  }

  const handleFAMS = async () => {
    if (!datasetId || !targetColumn) {
      setFamsError('Cần dataset_id và target_column.')
      return
    }
    setFamsError('')
    setFamsRunning(true)
    setFamsResult(null)
    try {
      const result = await api.famsSelection({
        dataset_id: datasetId,
        target_column: targetColumn,
        n_features: famsNFeatures !== '' ? famsNFeatures : (featureCount ? Math.ceil(featureCount * 0.7) : undefined),
        variance_threshold: famsVarThreshold,
        corr_threshold: famsCorrThreshold,
      })
      setFamsResult(result)
      localStorage.setItem('selection_id', result.selection_id)
    } catch (err) {
      setFamsError(err instanceof Error ? err.message : 'FAMS thất bại')
    } finally {
      setFamsRunning(false)
    }
  }

  const varianceFeatures = report?.low_variance_features.map(f => ({
    name: f.feature,
    variance: f.variance,
  })) ?? []

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/preprocessing">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.featureSelectionPageTitle}</h1>
            <p className="text-sm text-muted-foreground">{vi.featureSelectionPageDesc}</p>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card className="bg-card border-border p-6 sticky top-24">
              <h3 className="font-bold mb-6">{vi.autoOptimize}</h3>

              <div className="space-y-6">
                {/* Feature count info */}
                {loadingMeta ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tải thông tin dataset...
                  </div>
                ) : featureCount !== null ? (
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                    <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-primary">
                      Tổng số đặc trưng hiện có: <span className="font-bold">{featureCount}</span>
                    </p>
                  </div>
                ) : !datasetId ? (
                  <div className="flex items-start gap-2 rounded-lg bg-muted border border-border px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Chưa có dataset. Hãy hoàn thành bước <strong>Upload</strong> trước.
                    </p>
                  </div>
                ) : !targetColumn ? (
                  <div className="flex items-start gap-2 rounded-lg bg-muted border border-border px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Chọn cột nhãn để tính số đặc trưng.
                    </p>
                  </div>
                ) : null}

                {/* Min features slider */}
                <div>
                  <label className="text-sm font-semibold block mb-1">
                    {vi.selectMinFeatures}:{' '}
                    <span className="text-primary">{minFeatures}</span>
                    {featureCount !== null && (
                      <span className="text-muted-foreground font-normal"> / {featureCount}</span>
                    )}
                  </label>
                  {featureCount === null || !targetColumn ? (
                    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Slider sẽ kích hoạt sau khi có dataset và cột nhãn.
                    </div>
                  ) : (
                    <>
                      <Slider
                        value={[minFeatures]}
                        onValueChange={(value) => setMinFeatures(value[0])}
                        min={SLIDER_MIN}
                        max={featureCount}
                        step={1}
                        disabled={running}
                        className="mt-3"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{SLIDER_MIN}</span>
                        <span>{featureCount}</span>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold block mb-2">{vi.targetColumn}</label>
                  <select
                    value={targetColumn}
                    onChange={e => setTargetColumn(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
                  >
                    {datasetMeta?.columns?.map(c => <option key={c} value={c}>{c}</option>)}
                    {!datasetMeta?.columns?.length && (
                      <option value={targetColumn}>{targetColumn || '(chưa có dataset)'}</option>
                    )}
                  </select>
                </div>

                <Button
                  onClick={handleOptimize}
                  disabled={running || !datasetId || !targetColumn}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {running ? vi.processingData : vi.runOptimization}
                </Button>

                {/* FAMS 5-method ensemble selection */}
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">FAMS — 3-Step Pipeline</p>
                  <p className="text-xs text-muted-foreground">
                    Pipeline tuần tự: Variance Threshold → Loại tương quan → SelectKBest Top-N (mutual info).
                    Leakage-safe: toàn bộ fitting chỉ trên train set.
                  </p>

                  {/* FAMS options */}
                  <div className="space-y-2 rounded-lg bg-muted/50 border border-border p-2.5">
                    <div>
                      <label className="text-xs font-medium block mb-1">
                        Số features giữ lại{' '}
                        <span className="text-muted-foreground font-normal">(để trống = tự động 70%)</span>
                      </label>
                      <input
                        type="number"
                        value={famsNFeatures}
                        onChange={e => setFamsNFeatures(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder={featureCount ? `auto (${Math.ceil(featureCount * 0.7)})` : 'auto'}
                        min={1}
                        max={featureCount ?? undefined}
                        className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium block mb-1">Variance min</label>
                        <select
                          value={famsVarThreshold}
                          onChange={e => setFamsVarThreshold(parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                        >
                          <option value="0.001">0.001</option>
                          <option value="0.01">0.01</option>
                          <option value="0.05">0.05</option>
                          <option value="0.1">0.1</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Corr max</label>
                        <select
                          value={famsCorrThreshold}
                          onChange={e => setFamsCorrThreshold(parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs"
                        >
                          <option value="0.85">0.85</option>
                          <option value="0.90">0.90</option>
                          <option value="0.95">0.95</option>
                          <option value="0.99">0.99</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleFAMS}
                    disabled={famsRunning || !datasetId || !targetColumn}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                  >
                    {famsRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {famsRunning ? 'Đang phân tích...' : 'Chạy FAMS'}
                  </Button>
                  {famsError && (
                    <p className="text-xs text-destructive">{famsError}</p>
                  )}
                  {famsResult && (
                    <Card className="bg-violet-500/10 border-violet-500/30 p-3 text-xs space-y-1.5">
                      <p className="font-bold text-violet-700 dark:text-violet-300">✓ FAMS 3-step hoàn tất</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                        <span className="text-muted-foreground">Giữ lại:</span>
                        <span className="font-bold text-green-600">{famsResult.kept_features.length} đặc trưng</span>
                        <span className="text-muted-foreground">Loại bỏ:</span>
                        <span className="font-bold text-destructive">{famsResult.dropped_features.length} đặc trưng</span>
                        <span className="text-muted-foreground">Bước 1 (Variance):</span>
                        <span className="font-semibold">−{famsResult.variance_removed}</span>
                        <span className="text-muted-foreground">Bước 2 (Corr):</span>
                        <span className="font-semibold">−{famsResult.correlation_removed}</span>
                        <span className="text-muted-foreground">Bước 3 (Top-N):</span>
                        <span className="font-semibold">{famsResult.n_selected} chọn</span>
                      </div>
                      <p className="text-muted-foreground break-all pt-0.5">ID: <code className="text-violet-600">{famsResult.selection_id}</code></p>
                      {famsResult.dropped_features.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {famsResult.dropped_features.slice(0, 6).map(f => (
                            <Badge key={f} variant="outline" className="text-destructive border-destructive text-[10px]">{f}</Badge>
                          ))}
                          {famsResult.dropped_features.length > 6 && (
                            <Badge variant="outline" className="text-[10px]">+{famsResult.dropped_features.length - 6} more</Badge>
                          )}
                        </div>
                      )}
                      {!applyResult && (
                        <button
                          onClick={async () => {
                            if (!datasetId || !targetColumn || !famsResult) return
                            setApplying(true)
                            try {
                              const r = await api.featureApply({
                                dataset_id: datasetId,
                                target_column: targetColumn,
                                mode: 'drop',
                                features: famsResult.dropped_features,
                              })
                              setApplyResult(r)
                              localStorage.setItem('selection_id', famsResult.selection_id)
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Áp dụng FAMS thất bại')
                            } finally {
                              setApplying(false)
                            }
                          }}
                          disabled={applying || famsResult.dropped_features.length === 0}
                          className="w-full mt-1 px-3 py-1.5 rounded bg-violet-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-violet-700 disabled:opacity-50"
                        >
                          {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Áp dụng kết quả FAMS
                        </button>
                      )}
                    </Card>
                  )}
                </div>

                {error && (
                  <Card className="bg-destructive/10 border-destructive/30 p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-destructive text-xs">{error}</p>
                  </Card>
                )}

                {report && (
                  <div className="space-y-3">
                    <Card className="bg-green-500/10 border-green-500/30 p-4">
                      <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                        ✓ {vi.completedSuccessfully}
                      </p>
                      <p className="text-xs text-green-600/80 mt-1">
                        Keep: {report.recommended_keep.length} · Drop: {report.recommended_drop.length}
                      </p>
                    </Card>
                    {report.recommended_drop.length > 0 && !applyResult && (
                      <button
                        onClick={handleApplyOptimization}
                        disabled={applying}
                        className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60"
                      >
                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {applying ? 'Đang áp dụng...' : '✅ Áp dụng tối ưu feature'}
                      </button>
                    )}
                    {applyResult && (
                      <Card className="bg-primary/10 border-primary/30 p-3">
                        <p className="text-xs font-bold text-primary mb-1">✅ Đã áp dụng Feature Selection</p>
                        <p className="text-xs">Giữ: {applyResult.trace.kept_count} · Bỏ: {applyResult.trace.dropped_count}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: <code className="text-primary">{applyResult.selection_id}</code>
                        </p>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
              {[
                { id: 'overview', label: 'Tổng quan' },
                { id: 'correlation', label: vi.featureCorrelation },
                { id: 'variance', label: vi.featureVariance },
                { id: 'results', label: vi.optimizationResults },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
                  className={`px-4 py-3 border-b-2 transition-all text-sm font-medium whitespace-nowrap ${
                    selectedTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedTab === 'overview' && (
              <div className="space-y-6">
                {report ? (
                  <>
                    <Card className="bg-card border-border p-6">
                      <h3 className="text-lg font-bold mb-4">Đặc trưng nên giữ ({report.recommended_keep.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {report.recommended_keep.slice(0, 20).map(f => (
                          <Badge key={f} variant="outline" className="text-green-600 border-green-500">{f}</Badge>
                        ))}
                        {report.recommended_keep.length > 20 && (
                          <Badge variant="outline">+{report.recommended_keep.length - 20} more</Badge>
                        )}
                      </div>
                    </Card>
                    {report.recommended_drop.length > 0 && (
                      <Card className="bg-card border-border p-6">
                        <h3 className="text-lg font-bold mb-4">Đặc trưng nên bỏ ({report.recommended_drop.length})</h3>
                        <div className="flex flex-wrap gap-2">
                          {report.recommended_drop.map(f => (
                            <Badge key={f} variant="outline" className="text-destructive border-destructive">{f}</Badge>
                          ))}
                        </div>
                      </Card>
                    )}
                    <div className="flex gap-3">
                      <Link href="/training">
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                          Tiến đến Huấn luyện
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <Card className="bg-card/50 border-border p-12 text-center">
                    <Zap className="w-12 h-12 text-primary/40 mx-auto mb-4" />
                    <p className="text-muted-foreground">Nhấn &quot;Chạy Tối ưu hóa&quot; để phân tích đặc trưng từ backend.</p>
                  </Card>
                )}
              </div>
            )}

            {selectedTab === 'correlation' && (
              <CorrelationMatrix pairs={report?.correlation_top_pairs} />
            )}

            {selectedTab === 'variance' && (
              <VarianceAnalysis features={varianceFeatures} />
            )}

            {selectedTab === 'results' && (
              report ? (
                <Card className="bg-card border-border p-6">
                  <h3 className="text-lg font-bold mb-4">Kết quả Tối ưu hóa</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                    <div>Giữ lại: <span className="font-bold text-green-600">{report.recommended_keep.length} đặc trưng</span></div>
                    <div>Loại bỏ: <span className="font-bold text-destructive">{report.recommended_drop.length} đặc trưng</span></div>
                    <div>Low variance: <span className="font-bold">{report.low_variance_features.length}</span></div>
                    <div>High corr pairs: <span className="font-bold">{report.correlation_top_pairs.filter(p => p.corr > 0.95).length}</span></div>
                  </div>
                  <Link href="/training">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Tiến đến Huấn luyện
                    </Button>
                  </Link>
                </Card>
              ) : <OptimizationResults />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
