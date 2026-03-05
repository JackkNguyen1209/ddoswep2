'use client'

import { Card } from '@/components/ui/card'
import { CheckCircle2, Circle } from 'lucide-react'

interface PreprocessingStepProps {
  icon: string
  title: string
  description: string
  completed: boolean
  index: number
}

export function PreprocessingStep({
  icon,
  title,
  description,
  completed,
  index
}: PreprocessingStepProps) {
  return (
    <Card className={`border-border p-4 transition-all ${
      completed 
        ? 'bg-primary/5 border-primary/30' 
        : 'bg-card/50 border-border/50'
    }`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex-shrink-0">
          {completed ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <Circle className="w-6 h-6 text-muted-foreground/40" />
          )}
        </div>
      </div>
    </Card>
  )
}
