'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, AlertCircle, Loader2, Lightbulb } from 'lucide-react'
import { PredictionForm } from '@/components/prediction/prediction-form'
import { PredictionResult } from '@/components/prediction/prediction-result'
import { api, type LocalExplainResponse } from '@/lib/api'

export default function PredictionPage() {
  const [modelId, setModelId] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<{
    result: string
    confidence: number | null
    probability: number | null
  } | null>(null)
  const [explain, setExplain] = useState<LocalExplainResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const mid = localStorage.getItem('model_id')
    if (mid) setModelId(mid)
  }, [])

  const handlePredict = async (data: Record<string, unknown>) => {
    if (!modelId) {
      setError('Chưa có model. Vui lòng huấn luyện một mô hình trước.')
      return
    }

    setError('')
    setLoading(true)
    setPrediction(null)
    setExplain(null)

    try {
      // Predict + Explain in parallel
      const [result, explainResult] = await Promise.all([
        api.predict(modelId, data),
        api.explainLocal(modelId, data).catch(() => null),
      ])

      const prob = result.probability
      const isAttack = String(result.prediction).toLowerCase().includes('attack') ||
                       String(result.prediction) === '1' ||
                       String(result.prediction).toLowerCase().includes('ddos')
      setPrediction({
        result: String(result.prediction),
        confidence: prob ?? null,
        probability: prob != null ? (isAttack ? prob : 1 - prob) : null,
      })
      if (explainResult) setExplain(explainResult)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi prediction'
      setError(`Dự đoán thất bại: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const directionColor = (dir: string) =>
    dir === 'toward_ddos' ? 'text-red-600 dark:text-red-400' :
    dir === 'toward_benign' ? 'text-green-600 dark:text-green-400' :
    dir === 'positive' ? 'text-amber-600' : 'text-blue-600'

  const directionLabel = (dir: string) =>
    dir === 'toward_ddos' ? '↑ DDoS' :
    dir === 'toward_benign' ? '↓ Bình thường' :
    dir === 'positive' ? '↑ tăng' : '↓ giảm'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/feature-selection">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Dự đoán & Giải thích</h1>
            <p className="text-sm text-muted-foreground">Dự đoán + tại sao mô hình đưa ra kết luận đó</p>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!modelId && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Chưa có model. Vui lòng <Link href="/training" className="underline">huấn luyện mô hình</Link> trước.
            </p>
          </Card>
        )}

        {modelId && (
          <Card className="bg-card/50 border-border p-4 mb-6">
            <p className="text-xs text-muted-foreground">
              Model ID: <code className="text-primary">{modelId}</code>
            </p>
          </Card>
        )}

        {/* Input form */}
        <Card className="bg-card border-border p-8 mb-6">
          <h2 className="text-2xl font-bold mb-2">Nhập dữ liệu lưu lượng mạng</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Điền các đặc trưng để nhận dự đoán + giải thích tại sao mô hình đưa ra kết luận đó.
          </p>
                      <PredictionForm modelId={modelId} onPredict={handlePredict} />
          {loading && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Đang dự đoán và giải thích...</span>
            </div>
          )}
        </Card>

        {error && (
          <Card className="bg-destructive/10 border-destructive/30 p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-destructive text-sm">{error}</p>
          </Card>
        )}

        {/* Prediction result */}
        {prediction && (
          <Card className="bg-card border-border p-8 mb-6">
            <h3 className="text-xl font-bold mb-4">Kết quả Dự đoán</h3>
            <PredictionResult prediction={prediction} />
          </Card>
        )}

        {/* Explain local */}
        {explain && (
          <div className="space-y-6">
            {/* Vietnamese explanation box */}
            <Card className={`border p-6 ${
              explain.prediction.toLowerCase().includes('ddos') || explain.prediction === '1'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold mb-2">🤖 Vì sao mô hình đưa ra kết luận này?</h3>
                  <div className="space-y-1">
                    {explain.vietnamese_explanation.map((line, i) => (
                      <p key={i} className={`text-sm ${line.startsWith('  ') ? 'pl-4' : ''} ${
                        line.startsWith('🔴') ? 'font-bold text-red-700 dark:text-red-300' :
                        line.startsWith('🟢') ? 'font-bold text-green-700 dark:text-green-300' :
                        line.startsWith('📊') || line.startsWith('📈') ? 'font-semibold mt-2' : ''
                      }`}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Top contributions table */}
            <Card className="bg-card border-border p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                📊 Top {explain.top_contributions.length} đặc trưng ảnh hưởng nhất
                <Badge variant="outline" className="text-xs">{explain.method}</Badge>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 text-muted-foreground font-medium">Đặc trưng</th>
                      <th className="pb-2 pr-4 text-muted-foreground font-medium">Giá trị đầu vào</th>
                      <th className="pb-2 pr-4 text-muted-foreground font-medium">Ảnh hưởng</th>
                      <th className="pb-2 pr-4 text-muted-foreground font-medium">Hướng</th>
                      <th className="pb-2 text-muted-foreground font-medium">So sánh (mean)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explain.top_contributions.map((c, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <span className="font-medium">{c.feature_vi}</span>
                          <span className="text-xs text-muted-foreground block">{c.feature_original}</span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {typeof c.input_value === 'number' ? c.input_value.toFixed(4) : String(c.input_value)}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 rounded-full bg-primary/60"
                              style={{ width: `${Math.min(c.impact * 200, 80)}px` }}
                            />
                            <span className="text-xs font-mono">{c.impact.toFixed(4)}</span>
                          </div>
                        </td>
                        <td className={`py-2 pr-4 font-semibold text-xs ${directionColor(c.direction)}`}>
                          {directionLabel(c.direction)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {Object.entries(c.comparison).map(([cls, stats]) => (
                            <span key={cls} className="mr-2">
                              {cls}: {stats.mean.toFixed(2)}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pipeline trace */}
            <Card className="bg-card/50 border-border p-4">
              <p className="text-xs text-muted-foreground font-semibold mb-2">🔧 Pipeline đã dùng:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Scaling: <span className="text-primary font-semibold">{explain.trace.scaling}</span></div>
                <div>Encoding: <span className="text-primary font-semibold">{explain.trace.encoding}</span></div>
                {explain.trace.used_preprocess_id && (
                  <div className="col-span-2">Preprocess ID: <code className="text-green-600">{explain.trace.used_preprocess_id}</code></div>
                )}
                {explain.trace.used_selection_id && (
                  <div className="col-span-2">Selection ID: <code className="text-amber-600">{explain.trace.used_selection_id}</code></div>
                )}
                <div className="col-span-2 text-muted-foreground">{explain.trace.note}</div>
              </div>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          <Link href="/explainability">
            <Button variant="outline">Xem Feature Importance tổng thể</Button>
          </Link>
          <Link href="/experiments">
            <Button variant="outline">Danh sách Experiments</Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
