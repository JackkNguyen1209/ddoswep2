'use client'

import { Card } from '@/components/ui/card'

interface Props {
  formula: string
  title?: string
}

export function FormulaRenderer({ formula, title }: Props) {
  return (
    <Card className="bg-card border-border p-6">
      {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 font-mono text-sm overflow-x-auto">
        {formula}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        * Công thức được đơn giản hóa. Xem tài liệu chi tiết để có phiên bản đầy đủ.
      </p>
    </Card>
  )
}
