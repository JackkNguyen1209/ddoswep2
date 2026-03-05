'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/vi'

interface HyperparameterPanelProps {
  algorithm: {
    id: string
    name: string
    hyperparams: Record<string, any>
  }
}

export function HyperparameterPanel({ algorithm }: HyperparameterPanelProps) {
  const [params, setParams] = useState(algorithm.hyperparams)

  const handleSliderChange = (key: string, value: number | boolean | string) => {
    setParams(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }))
  }

  return (
    <Card className="bg-card border-border p-6 sticky top-20">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Badge variant="secondary">{algorithm.id.toUpperCase()}</Badge>
        {vi.hyperparameters}
      </h3>

      <div className="space-y-6">
        {Object.entries(params).map(([key, param]: [string, any]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">{param.label}</label>
              {param.type !== 'boolean' && param.options ? (
                <span className="text-sm text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                  {param.value}
                </span>
              ) : param.min !== undefined ? (
                <span className="text-sm text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                  {param.value}
                </span>
              ) : param.type === 'boolean' ? (
                <span className="text-sm text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                  {param.value ? 'Có' : 'Không'}
                </span>
              ) : null}
            </div>

            {param.min !== undefined && (
              <Slider
                value={[param.value]}
                onValueChange={(value) => handleSliderChange(key, value[0])}
                min={param.min}
                max={param.max}
                step={1}
                className="w-full"
              />
            )}

            {param.options && (
              <div className="flex flex-wrap gap-2">
                {param.options.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => handleSliderChange(key, opt as any)}
                    className={`text-xs px-3 py-1 rounded transition-colors ${
                      param.value === opt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {param.type === 'boolean' && (
              <button
                onClick={() => handleSliderChange(key, !param.value)}
                className={`w-full text-sm px-3 py-2 rounded transition-colors ${
                  param.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {param.value ? '✓ Bật' : 'Tắt'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">{vi.tip}:</span> {vi.tipText}
        </p>
      </div>
    </Card>
  )
}
