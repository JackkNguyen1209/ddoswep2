'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import { ConfusionMatrix } from '@/components/evaluation/confusion-matrix'
import { MetricsCard } from '@/components/evaluation/metrics-card'
import { PerformanceChart } from '@/components/evaluation/performance-chart'
import { DetailedResults } from '@/components/evaluation/detailed-results'
import { vi } from '@/lib/vi'
import { api, type ExperimentDetail } from '@/lib/api'

export default function EvaluationPage() {
  const [detail, setDetail] = useState<ExperimentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const expId = localStorage.getItem('experiment_id')
    if (!expId) {
      setError('Chưa có experiment. Vui lòng huấn luyện mô hình trước.')
      setLoading(false)
      return
    }
    api.getExperiment(expId)
      .then(d => { setDetail(d); setLoading(false) })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Không tải được experiment')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
            <Link href="/training">
              <Button variant="ghost" size="sm" className="gap-2"><ChevronLeft className="w-4 h-4" />{vi.back}</Button>
            </Link>
            <h1 className="text-xl font-bold">{vi.evaluationPageTitle}</h1>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Card className="bg-destructive/10 border-destructive/30 p-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">{error}</p>
              <Link href="/training" className="text-sm underline mt-2 inline-block">Quay lại Huấn luyện</Link>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  const metrics = detail!.metrics
  const confusionMatrixData = detail!.confusion_matrix

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/training">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.evaluationPageTitle}</h1>
            <p className="text-sm text-muted-foreground">{vi.evaluationPageStep}</p>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Experiment info */}
        <Card className="bg-card/50 border-border p-4 mb-6 text-sm flex flex-wrap gap-4">
          <span><span className="text-muted-foreground">Algorithm: </span><span className="font-semibold text-primary">{String(detail!.experiment.algorithm)}</span></span>
          <span><span className="text-muted-foreground">Experiment: </span><code className="text-xs text-primary">{String(detail!.experiment.id)}</code></span>
          {detail!.experiment.status === 'skipped_not_supported' && (
            <span className="text-amber-600 font-semibold">⚠ Skipped: {String(detail!.experiment.skip_reason)}</span>
          )}
        </Card>

        {/* CV metrics banner */}
        {detail!.cv_metrics && (
          <Card className="bg-primary/5 border-primary/20 p-4 mb-6 text-sm">
            <span className="font-semibold text-primary">{detail!.cv_metrics.cv_folds}-Fold CV: </span>
            Acc {(detail!.cv_metrics.accuracy_mean * 100).toFixed(1)}% ± {(detail!.cv_metrics.accuracy_std * 100).toFixed(1)}%
            &nbsp;· F1 {(detail!.cv_metrics.f1_mean * 100).toFixed(1)}% ± {(detail!.cv_metrics.f1_std * 100).toFixed(1)}%
            &nbsp;· Precision {(detail!.cv_metrics.precision_mean * 100).toFixed(1)}% ± {(detail!.cv_metrics.precision_std * 100).toFixed(1)}%
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <MetricsCard label={vi.accuracy} value={metrics.accuracy} />
          <MetricsCard label={vi.precision} value={metrics.precision} />
          <MetricsCard label={vi.recall} value={metrics.recall} />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <MetricsCard label={vi.f1Score} value={metrics.f1Score} />
          {metrics.auc !== null ? (
            <MetricsCard label={vi.aucRoc} value={metrics.auc} />
          ) : (
            <Card className="bg-card border-border p-6">
              <div className="text-sm text-muted-foreground mb-1">{vi.aucRoc}</div>
              <div className="text-3xl font-bold text-muted-foreground">N/A</div>
              {metrics.auc_note && <div className="text-xs text-muted-foreground mt-2">{metrics.auc_note}</div>}
            </Card>
          )}
          <MetricsCard label={vi.specificity} value={metrics.specificity} />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card className="bg-card border-border p-8">
            <h2 className="text-2xl font-bold mb-6">{vi.confusionMatrix}</h2>
            <ConfusionMatrix data={confusionMatrixData} />
          </Card>

          <Card className="bg-card border-border p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              {vi.performanceComparison}
            </h2>
            <PerformanceChart metrics={{ ...metrics, auc: metrics.auc ?? 0 }} />
          </Card>
        </div>

        <DetailedResults metrics={{ ...metrics, auc: metrics.auc ?? 0 }} confusionMatrix={confusionMatrixData} />

        <Card className="bg-primary/5 border-primary/20 p-8">
          <h2 className="text-2xl font-bold mb-4">{vi.performanceSummary}</h2>
          <p className="text-muted-foreground mb-6">
            Mô hình đạt được {(metrics.accuracy * 100).toFixed(1)}% độ chính xác trên tập kiểm tra.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/explainability">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {vi.exploreExplainability}
              </Button>
            </Link>
            <Link href="/experiments">
              <Button variant="outline" className="w-full">
                {vi.saveCompareExperiments}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  )
}
