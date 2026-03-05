'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FeatureScenario {
  numFeatures: number
  accuracy: number
  trainingTime: number
  complexity: string
  description: string
}

interface FeatureSelectionChartProps {
  scenarios: FeatureScenario[]
}

export function FeatureSelectionChart({ scenarios }: FeatureSelectionChartProps) {
  const data = scenarios.map(scenario => ({
    trainingTime: scenario.trainingTime,
    accuracy: scenario.accuracy * 100,
    numFeatures: scenario.numFeatures,
    name: `${scenario.numFeatures} Features`
  }))

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          type="number"
          dataKey="trainingTime"
          name="Training Time (seconds)"
          stroke="currentColor"
          style={{ fontSize: '12px' }}
          label={{ value: 'Training Time (seconds)', position: 'bottom', offset: 10 }}
        />
        <YAxis
          type="number"
          dataKey="accuracy"
          name="Accuracy (%)"
          stroke="currentColor"
          style={{ fontSize: '12px' }}
          label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: 'rgb(20, 20, 30)',
            border: '1px solid rgb(100, 100, 255)',
            borderRadius: '8px'
          }}
          formatter={(value, name) => {
            if (name === 'accuracy') return `${(value as number).toFixed(2)}%`
            return value
          }}
          labelFormatter={(value) => `${value}s`}
        />
        <Legend />
        <Scatter
          name="Feature Sets"
          data={data}
          fill="hsl(260, 100%, 60%)"
          shape="circle"
          r={8}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
