'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Feature {
  name: string
  importance: number
  type: string
}

interface FeatureImportanceProps {
  features: Feature[]
}

export function FeatureImportance({ features }: FeatureImportanceProps) {
  const sorted = [...features].sort((a, b) => b.importance - a.importance)
  const max = sorted[0].importance

  return (
    <Card className="bg-card border-border p-8">
      <div className="space-y-6">
        {sorted.map((feature, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{feature.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {feature.type}
                </Badge>
              </div>
              <span className="font-bold text-primary">
                {(feature.importance * 100).toFixed(1)}%
              </span>
            </div>

            <div className="relative h-8 bg-card/50 rounded-lg overflow-hidden border border-border/50">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-lg transition-all flex items-center px-3"
                style={{ width: `${(feature.importance / max) * 100}%` }}
              >
                {feature.importance > 0.1 && (
                  <span className="text-xs font-semibold text-primary-foreground ml-auto whitespace-nowrap">
                    {(feature.importance * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-sm text-muted-foreground mb-2">
          <span className="font-semibold text-primary">Insight:</span> Packet Rate and Byte Count are the strongest indicators of DDoS attacks. Focus data collection efforts on these metrics.
        </p>
      </div>
    </Card>
  )
}
