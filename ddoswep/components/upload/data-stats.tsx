'use client'

import { Card } from '@/components/ui/card'
import { BarChart3, Database, Columns3, HardDrive } from 'lucide-react'
import { vi } from '@/lib/vi'

interface DataStatsProps {
  stats: {
    totalRows: number
    totalColumns: number
    columns: string[]
    memoryUsage: string
  }
}

export function DataStats({ stats }: DataStatsProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-card border-border p-6">
        <div className="flex items-start gap-4">
          <BarChart3 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{vi.totalRows}</p>
            <p className="text-2xl font-bold">{stats.totalRows.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-6">
        <div className="flex items-start gap-4">
          <Columns3 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{vi.totalColumns}</p>
            <p className="text-2xl font-bold">{stats.totalColumns}</p>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border p-6">
        <div className="flex items-start gap-4">
          <HardDrive className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{vi.memoryUsage}</p>
            <p className="text-2xl font-bold">{stats.memoryUsage}</p>
          </div>
        </div>
      </Card>

      <Card className="bg-card/50 border-border/50 p-6">
        <p className="text-sm font-semibold text-primary mb-3">Đặc trưng:</p>
        <div className="space-y-2">
          {stats.columns.slice(0, 8).map((col, idx) => (
            <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/50"></span>
              {col}
            </div>
          ))}
          {stats.columns.length > 8 && (
            <div className="text-xs text-muted-foreground/70 pt-2">
              +{stats.columns.length - 8} cột khác
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
