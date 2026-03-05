'use client'

import { Card } from '@/components/ui/card'
import { Check } from 'lucide-react'

interface AlgorithmSelectorProps {
  algorithm: {
    id: string
    name: string
    description: string
    icon: string
  }
  selected: boolean
  onSelect: (id: string) => void
}

export function AlgorithmSelector({
  algorithm,
  selected,
  onSelect
}: AlgorithmSelectorProps) {
  return (
    <Card
      onClick={() => onSelect(algorithm.id)}
      className={`border-2 p-4 cursor-pointer transition-all ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-card/50 hover:border-primary/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-3xl">{algorithm.icon}</span>
        {selected && <Check className="w-5 h-5 text-primary" />}
      </div>
      <h3 className="font-semibold mb-1 text-sm">{algorithm.name}</h3>
      <p className="text-xs text-muted-foreground">{algorithm.description}</p>
    </Card>
  )
}
