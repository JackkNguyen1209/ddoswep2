'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, Zap, TrendingDown } from 'lucide-react'
import { FeatureSelectionChart } from '@/components/feature-selection/feature-selection-chart'

interface FeatureScenario {
  numFeatures: number
  accuracy: number
  trainingTime: number
  complexity: string
  description: string
}

export default function FeatureSelectionPage() {
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)

  const scenarios: FeatureScenario[] = [
    {
      numFeatures: 48,
      accuracy: 0.96,
      trainingTime: 120,
      complexity: 'High',
      description: 'All features included'
    },
    {
      numFeatures: 32,
      accuracy: 0.958,
      trainingTime: 85,
      complexity: 'Medium-High',
      description: 'Reduced feature set'
    },
    {
      numFeatures: 20,
      accuracy: 0.955,
      trainingTime: 45,
      complexity: 'Medium',
      description: 'Core features only'
    },
    {
      numFeatures: 12,
      accuracy: 0.94,
      trainingTime: 20,
      complexity: 'Low',
      description: 'Top 12 important features'
    },
    {
      numFeatures: 8,
      accuracy: 0.92,
      trainingTime: 12,
      complexity: 'Very Low',
      description: 'Minimal feature set'
    }
  ]

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/explainability">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Feature Selection</h1>
            <p className="text-sm text-muted-foreground">Optimize feature set for performance</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview */}
        <Card className="bg-card border-border p-8 mb-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-primary" />
            Feature Selection Analysis
          </h2>
          <p className="text-muted-foreground">
            Find the optimal balance between accuracy and computational efficiency by selecting the most important features.
          </p>
        </Card>

        {/* Trade-off Chart */}
        <Card className="bg-card border-border p-8 mb-8">
          <h3 className="text-xl font-bold mb-6">Accuracy vs Training Time Trade-off</h3>
          <FeatureSelectionChart scenarios={scenarios} />
        </Card>

        {/* Scenario Comparison */}
        <div>
          <h3 className="text-xl font-bold mb-6">Feature Set Scenarios</h3>
          <div className="space-y-4">
            {scenarios.map((scenario, idx) => (
              <Card
                key={idx}
                onClick={() => setSelectedScenario(idx)}
                className={`border-2 p-6 cursor-pointer transition-all ${
                  selectedScenario === idx
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold mb-2">{scenario.numFeatures} Features</h4>
                    <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Accuracy</span>
                        <div className="text-lg font-bold text-primary">
                          {(scenario.accuracy * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Training Time</span>
                        <div className="text-lg font-bold text-accent">
                          {scenario.trainingTime}s
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Complexity</span>
                        <div className="text-lg font-bold text-foreground">
                          {scenario.complexity}
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedScenario === idx && (
                    <Zap className="w-6 h-6 text-primary flex-shrink-0" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        {selectedScenario !== null && (
          <Card className="bg-primary/5 border-primary/20 p-8 mt-8">
            <h3 className="text-xl font-bold mb-4">Recommendation</h3>
            <p className="text-muted-foreground mb-6">
              {selectedScenario === 2
                ? 'The 20-feature set provides an excellent balance between accuracy (95.5%) and computational efficiency. This is recommended for production systems.'
                : selectedScenario === 3
                ? 'The 12-feature minimal set is ideal for real-time detection with minimal latency, with only a 1.6% accuracy trade-off.'
                : selectedScenario === 0
                ? 'Using all 48 features provides maximum accuracy but requires significant computational resources.'
                : 'This configuration offers different trade-offs based on your deployment constraints.'}
            </p>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Deploy with Selected Features
            </Button>
          </Card>
        )}

        {/* Next Steps */}
        <Card className="bg-card/50 border-border p-8 mt-12">
          <h3 className="text-xl font-bold mb-4">Ready to Make Predictions?</h3>
          <p className="text-muted-foreground mb-6">
            Use your optimized model to detect DDoS attacks on new network traffic data.
          </p>
          <Link href="/prediction">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Make Predictions
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  )
}
