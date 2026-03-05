'use client'

import { Card } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface MetricsCardProps {
  label: string
  value: number
}

export function MetricsCard({ label, value }: MetricsCardProps) {
  const percentage = (value * 100).toFixed(2)
  const percentageNum = parseFloat(percentage)

  return (
    <Card className="bg-card border-border p-6 hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <TrendingUp className="w-5 h-5 text-primary" />
      </div>
      <div className="mb-4">
        <div className="text-4xl font-bold text-primary">{percentage}%</div>
      </div>
      <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
          style={{ width: `${percentageNum}%` }}
        ></div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {percentageNum > 90 ? '✓ Excellent' : percentageNum > 80 ? '✓ Good' : '• Fair'}
      </div>
    </Card>
  )
}
