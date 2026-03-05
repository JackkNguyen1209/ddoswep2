'use client'

import { Card } from '@/components/ui/card'

interface DataPreviewProps {
  data: any[]
}

export function DataPreview({ data }: DataPreviewProps) {
  if (data.length === 0) return null

  const columns = Object.keys(data[0])

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-card/50 border-b border-border">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-4 py-3 text-left font-semibold text-primary">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-primary/5 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-4 py-3 text-muted-foreground">
                    <span className="truncate inline-block max-w-xs">
                      {String(row[col]).substring(0, 50)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-card/30 border-t border-border text-sm text-muted-foreground">
        Showing first 10 rows of {data.length} total rows
      </div>
    </Card>
  )
}
