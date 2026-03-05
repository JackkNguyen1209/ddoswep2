'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PerformanceChartProps {
  metrics: {
    accuracy: number
    precision: number
    recall: number
    f1Score: number
    auc: number
    specificity: number
  }
}

export function PerformanceChart({ metrics }: PerformanceChartProps) {
  const data = [
    {
      name: 'Accuracy',
      value: (metrics.accuracy * 100).toFixed(2),
      actual: metrics.accuracy * 100
    },
    {
      name: 'Precision',
      value: (metrics.precision * 100).toFixed(2),
      actual: metrics.precision * 100
    },
    {
      name: 'Recall',
      value: (metrics.recall * 100).toFixed(2),
      actual: metrics.recall * 100
    },
    {
      name: 'F1 Score',
      value: (metrics.f1Score * 100).toFixed(2),
      actual: metrics.f1Score * 100
    },
    {
      name: 'AUC-ROC',
      value: (metrics.auc * 100).toFixed(2),
      actual: metrics.auc * 100
    },
    {
      name: 'Specificity',
      value: (metrics.specificity * 100).toFixed(2),
      actual: metrics.specificity * 100
    }
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="name" stroke="currentColor" style={{ fontSize: '12px' }} />
        <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgb(20, 20, 30)',
            border: '1px solid rgb(100, 100, 255)',
            borderRadius: '8px'
          }}
          formatter={(value) => `${value}%`}
        />
        <Bar dataKey="actual" fill="hsl(260, 100%, 60%)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
