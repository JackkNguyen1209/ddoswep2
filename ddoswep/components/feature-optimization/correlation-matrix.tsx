'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/vi'

interface CorrelationPair {
  feature_a: string
  feature_b: string
  corr: number
}

interface Props {
  pairs?: CorrelationPair[]
}

function getColor(value: number): string {
  const abs = Math.abs(value)
  if (abs > 0.95) return 'bg-red-500/40 text-red-700 dark:text-red-300'
  if (abs > 0.8) return 'bg-orange-500/30 text-orange-700 dark:text-orange-300'
  if (abs > 0.6) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
  return 'bg-primary/10 text-foreground'
}

export function CorrelationMatrix({ pairs }: Props) {
  if (!pairs || pairs.length === 0) {
    return (
      <Card className="bg-card/50 border-border p-12 text-center">
        <p className="text-muted-foreground">
          Nhấn &quot;Chạy Tối ưu hóa&quot; để xem ma trận tương quan từ dữ liệu thực.
        </p>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border p-6">
      <h3 className="text-lg font-bold mb-4">{vi.correlationMatrix}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Top {pairs.length} cặp đặc trưng có tương quan cao nhất — tính từ dữ liệu thực.
      </p>

      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]" title={p.feature_a}>
                  {p.feature_a}
                </span>
                <span className="text-muted-foreground text-xs">↔</span>
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]" title={p.feature_b}>
                  {p.feature_b}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <Badge className={`text-xs font-bold ${getColor(p.corr)}`} variant="outline">
                {(p.corr * 100).toFixed(1)}%
              </Badge>
            </div>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${
                  Math.abs(p.corr) > 0.95 ? 'bg-red-500' :
                  Math.abs(p.corr) > 0.8  ? 'bg-orange-500' :
                  Math.abs(p.corr) > 0.6  ? 'bg-yellow-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.abs(p.corr) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/60" />
          <span className="text-muted-foreground">&gt;95% — rất cao, nên bỏ một</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/50" />
          <span className="text-muted-foreground">80–95% — cao</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500/40" />
          <span className="text-muted-foreground">60–80% — trung bình</span>
        </div>
      </div>
    </Card>
  )
}
