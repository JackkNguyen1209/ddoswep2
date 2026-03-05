'use client'

import { Card } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react'

interface PredictionResultProps {
  prediction: {
    result: string
    confidence: number | null
    probability: number | null
  }
}

export function PredictionResult({ prediction }: PredictionResultProps) {
  const isAttack = prediction.result === 'DDoS Attack' ||
                   prediction.result === '1' ||
                   prediction.result.toLowerCase().includes('ddos') ||
                   prediction.result.toLowerCase().includes('attack')
  const confidenceNum = prediction.confidence != null ? prediction.confidence * 100 : null
  const confidence = confidenceNum != null ? confidenceNum.toFixed(2) : null
  const probability = prediction.probability != null ? (prediction.probability * 100).toFixed(2) : null

  return (
    <div className="space-y-6">
      {/* Main Result */}
      <div className={`p-8 rounded-lg border-2 ${
        isAttack
          ? 'bg-destructive/10 border-destructive/30'
          : 'bg-green-500/10 border-green-500/30'
      }`}>
        <div className="flex items-center gap-4">
          {isAttack ? (
            <AlertTriangle className="w-12 h-12 text-destructive flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-500 flex-shrink-0" />
          )}
          <div>
            <h3 className={`text-2xl font-bold ${
              isAttack ? 'text-destructive' : 'text-green-600 dark:text-green-400'
            }`}>
              {prediction.result}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isAttack 
                ? 'Suspected DDoS attack detected in network traffic'
                : 'Normal network traffic detected'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Confidence Metrics */}
      {(confidence != null || probability != null) && (
        <div className="grid md:grid-cols-2 gap-4">
          {confidence != null && (
            <Card className="bg-card/50 border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">Model Confidence</span>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="text-3xl font-bold text-primary mb-3">{confidence}%</div>
              <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </Card>
          )}
          {probability != null && (
            <Card className="bg-card/50 border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-medium">
                  {isAttack ? 'Attack Probability' : 'Normal Probability'}
                </span>
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <div className="text-3xl font-bold text-accent mb-3">{probability}%</div>
              <div className="w-full bg-accent/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-primary"
                  style={{ width: `${probability}%` }}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Interpretation */}
      <Card className={`p-6 border ${
        isAttack
          ? 'bg-destructive/5 border-destructive/20'
          : 'bg-green-500/5 border-green-500/20'
      }`}>
        <h4 className="font-semibold mb-2">Interpretation</h4>
        <p className="text-sm text-muted-foreground">
          {confidenceNum == null
            ? 'Mô hình này không trả về xác suất (ví dụ: SVM không có predict_proba).'
            : confidenceNum > 90
            ? 'High confidence prediction. Take appropriate action based on organizational DDoS response protocols.'
            : confidenceNum > 70
            ? 'Moderate confidence. Consider additional validation or monitoring before taking action.'
            : 'Low confidence prediction. Review the input data and consider manual inspection.'}
        </p>
      </Card>

      {/* Recommended Actions */}
      <Card className="bg-primary/5 border-primary/20 p-6">
        <h4 className="font-semibold mb-3">Recommended Actions</h4>
        <ul className="space-y-2 text-sm">
          {isAttack ? (
            <>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Alert security team immediately</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Begin traffic mitigation procedures</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Investigate attack source and pattern</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Log incident for analysis and reporting</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                <span>Continue normal network monitoring</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-500">✓</span>
                <span>Maintain baseline metrics</span>
              </li>
            </>
          )}
        </ul>
      </Card>
    </div>
  )
}
