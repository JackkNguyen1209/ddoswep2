'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'

interface AlgorithmExplanationProps {
  algorithm: string
  explanation: {
    principle: string
    howItWorks: string[]
    advantages: string[]
    disadvantages: string[]
    bestFor: string
  }
}

export function AlgorithmExplanation({
  algorithm,
  explanation
}: AlgorithmExplanationProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card
      className={`bg-card border-border p-6 cursor-pointer transition-all hover:border-primary/50 ${
        expanded ? 'ring-2 ring-primary/30' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge className="bg-primary text-primary-foreground">{algorithm}</Badge>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      <p className="text-sm font-semibold mb-3">{explanation.principle}</p>

      {expanded && (
        <div className="space-y-4 mt-4 pt-4 border-t border-border">
          <div>
            <h4 className="text-xs font-bold text-primary mb-2 uppercase">How It Works</h4>
            <ol className="space-y-1">
              {explanation.howItWorks.map((step, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-primary font-bold">{idx + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-bold text-green-500 mb-2 uppercase">Advantages</h4>
              <ul className="space-y-1">
                {explanation.advantages.map((adv, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-green-500">✓</span>
                    {adv}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-amber-500 mb-2 uppercase">Disadvantages</h4>
              <ul className="space-y-1">
                {explanation.disadvantages.map((dis, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-amber-500">✗</span>
                    {dis}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-semibold">Best For:</span> {explanation.bestFor}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
