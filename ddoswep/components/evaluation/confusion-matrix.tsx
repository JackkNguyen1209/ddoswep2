'use client'

import { Card } from '@/components/ui/card'

interface ConfusionMatrixProps {
  data: {
    tn: number
    fp: number
    fn: number
    tp: number
  }
}

export function ConfusionMatrix({ data }: ConfusionMatrixProps) {
  const total = data.tn + data.fp + data.fn + data.tp
  const max = Math.max(data.tn, data.fp, data.fn, data.tp)

  const Cell = ({
    value,
    label,
    color
  }: {
    value: number
    label: string
    color: string
  }) => {
    const intensity = (value / max) * 100
    return (
      <div
        className={`p-4 rounded text-center transition-all ${color}`}
        style={{
          background: `rgba(var(--${color}-rgb}), ${intensity / 100 * 0.3})`
        }}
      >
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        <div className="text-xs font-semibold text-foreground">
          {((value / total) * 100).toFixed(1)}%
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Predicted Negative</div>
          <Cell value={data.tn} label="True Negatives (TN)" color="primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Predicted Positive</div>
          <Cell value={data.fp} label="False Positives (FP)" color="destructive" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Predicted Negative</div>
          <Cell value={data.fn} label="False Negatives (FN)" color="destructive" />
        </div>
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-2">Predicted Positive</div>
          <Cell value={data.tp} label="True Positives (TP)" color="primary" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm p-4 bg-card/50 rounded-lg border border-border">
        <div>
          <span className="text-muted-foreground">Sensitivity (Recall):</span>
          <span className="ml-2 font-bold text-primary">
            {((data.tp / (data.tp + data.fn)) * 100).toFixed(2)}%
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Specificity:</span>
          <span className="ml-2 font-bold text-primary">
            {((data.tn / (data.tn + data.fp)) * 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}
