'use client'

import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { vi } from '@/lib/vi'

interface Feature {
  name: string
  variance: number
}

interface Props {
  features: Feature[]
}

export function VarianceAnalysis({ features }: Props) {
  if (features.length === 0) {
    return (
      <Card className="bg-card/50 border-border p-12 text-center">
        <p className="text-muted-foreground">
          Nhấn &quot;Chạy Tối ưu hóa&quot; để xem phân tích phương sai từ dữ liệu thực.
        </p>
      </Card>
    )
  }

  const sorted = [...features].sort((a, b) => b.variance - a.variance)
  const chartData = sorted.slice(0, 30).map(f => ({
    name: f.name.length > 14 ? f.name.substring(0, 12) + '…' : f.name,
    fullName: f.name,
    variance: parseFloat(f.variance.toFixed(4)),
  }))

  const lowVariance  = features.filter(f => f.variance < 0.01)
  const highVariance = features.filter(f => f.variance >= 0.01)

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold mb-1">{vi.varianceAnalysis}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Phương sai tính từ dữ liệu thực · hiển thị top {chartData.length}/{features.length} đặc trưng
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(6), 'Variance']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
            />
            <Bar dataKey="variance" name="Phương sai" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.variance < 0.01 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-destructive/80" />
            <span className="text-muted-foreground">Phương sai &lt; 0.01 (thấp — xem xét loại)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/80" />
            <span className="text-muted-foreground">Phương sai ≥ 0.01 (bình thường)</span>
          </div>
        </div>
      </Card>

      {lowVariance.length > 0 && (
        <Card className="bg-yellow-500/5 border-yellow-500/20 p-6">
          <h4 className="text-base font-bold mb-3">
            Cảnh báo: {lowVariance.length} đặc trưng phương sai thấp (&lt; 0.01)
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {lowVariance.map((f, i) => (
              <div key={i} className="flex justify-between items-center p-2.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-sm">
                <span className="font-medium font-mono text-xs">{f.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{f.variance.toFixed(6)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="bg-green-500/5 border-green-500/20 p-6">
        <h4 className="text-base font-bold mb-3">
          {highVariance.length} đặc trưng phương sai bình thường (giữ lại)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {highVariance.slice(0, 30).map((f, i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-green-500/10 rounded border border-green-500/20 text-xs">
              <span className="font-mono truncate" title={f.name}>{f.name}</span>
              <span className="text-muted-foreground ml-1 shrink-0">{f.variance.toFixed(4)}</span>
            </div>
          ))}
          {highVariance.length > 30 && (
            <div className="col-span-full text-xs text-muted-foreground text-center py-2">
              +{highVariance.length - 30} features khác...
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
