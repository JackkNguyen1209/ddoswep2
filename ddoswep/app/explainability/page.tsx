'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Lightbulb, Loader2, AlertCircle, GitCompare } from 'lucide-react'
import { AIComparePanel, renderString } from '@/components/ai-compare-panel'
import { api, type GlobalExplainResponse } from '@/lib/api'

export default function ExplainabilityPage() {
  const [modelId, setModelId] = useState<string | null>(null)
  const [explainData, setExplainData] = useState<GlobalExplainResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [compareMode, setCompareMode] = useState(false)

  useEffect(() => {
    const mid = localStorage.getItem('model_id')
    if (mid) {
      setModelId(mid)
      fetchExplain(mid, false)
    }
  }, [])

  const fetchExplain = async (mid: string, compare: boolean) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.explainGlobal(mid, compare)
      setExplainData(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi'
      setError(`Không thể tải feature importance: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleCompare = () => {
    if (!modelId) return
    const next = !compareMode
    setCompareMode(next)
    fetchExplain(modelId, next)
  }

  const maxScore = explainData ? Math.max(...explainData.top_features.map(f => f.score), 0.001) : 1

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/evaluation">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Model Explainability</h1>
            <p className="text-sm text-muted-foreground">Tầm quan trọng của đặc trưng từ mô hình thực tế</p>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!modelId && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Chưa có model. Vui lòng <Link href="/training" className="underline">huấn luyện mô hình</Link> trước.
            </p>
          </Card>
        )}

        {error && (
          <Card className="bg-destructive/10 border-destructive/30 p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-destructive text-sm">{error}</p>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground mb-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tính toán feature importance...</span>
          </div>
        )}

        {explainData && (
          <div className="space-y-6">
            <Card className="bg-card border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Lightbulb className="w-6 h-6 text-primary" />
                  Feature Importance (Top {explainData.top_features.length})
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{explainData.method}</Badge>
                  <button
                    onClick={toggleCompare}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      compareMode
                        ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'
                        : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    {loading ? 'Đang tải...' : 'Claude vs Ollama'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{explainData.notes}</p>
              {explainData.compare_data && (
                <AIComparePanel
                  compareData={explainData.compare_data}
                  renderResult={(v) => renderString(v)}
                  label="So sánh phân tích AI"
                />
              )}

              <div className="space-y-3">
                {explainData.top_features.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{f.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{(f.score * 100).toFixed(2)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(f.score / maxScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {modelId && (
              <Card className="bg-card/50 border-border p-4">
                <p className="text-xs text-muted-foreground">
                  Model: <code className="text-primary">{modelId}</code>
                </p>
              </Card>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Link href="/prediction">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Dự đoán & Giải thích cụ thể
            </Button>
          </Link>
          <Link href="/model-details">
            <Button variant="outline">Chi tiết thuật toán</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
