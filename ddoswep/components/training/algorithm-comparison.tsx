'use client'

import { Card } from '@/components/ui/card'
import { BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { vi } from '@/lib/vi'

interface Algorithm {
  id: string
  name: string
  icon: string
}

interface AlgorithmComparisonProps {
  algorithms: Algorithm[]
}

export function AlgorithmComparison({ algorithms }: AlgorithmComparisonProps) {
  // Mock comparison data
  const comparisonMetrics = algorithms.map((algo, idx) => ({
    name: algo.name.substring(0, 10),
    accuracy: 0.92 + Math.random() * 0.07,
    precision: 0.90 + Math.random() * 0.08,
    recall: 0.93 + Math.random() * 0.06,
    f1: 0.91 + Math.random() * 0.07,
    trainingTime: Math.floor(Math.random() * 3000) + 1000,
    modelSize: Math.floor(Math.random() * 50) + 10,
    auc: 0.94 + Math.random() * 0.05,
  }))

  const performanceData = algorithms.map((algo, idx) => ({
    name: algo.name.substring(0, 10),
    x: Math.random() * 100,
    y: 0.92 + Math.random() * 0.07,
    size: (Math.random() * 200) + 100,
  }))

  const trainingTimeData = algorithms.map((algo, idx) => ({
    name: algo.name.substring(0, 10),
    trainingTime: Math.floor(Math.random() * 3000) + 1000,
  }))

  const speedAccuracyData = algorithms.map((algo, idx) => ({
    name: algo.name.substring(0, 10),
    accuracy: 0.92 + Math.random() * 0.07,
    trainingTime: Math.floor(Math.random() * 3000) + 1000,
  }))

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">{vi.algorithmComparison}</h2>

      {/* Metrics Comparison Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card/80 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left font-bold">{vi.selectAlgorithm}</th>
                <th className="px-6 py-4 text-center font-bold">{vi.accuracy}</th>
                <th className="px-6 py-4 text-center font-bold">{vi.precision}</th>
                <th className="px-6 py-4 text-center font-bold">{vi.recall}</th>
                <th className="px-6 py-4 text-center font-bold">{vi.f1Score}</th>
                <th className="px-6 py-4 text-center font-bold">AUC-ROC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comparisonMetrics.map((metric, idx) => (
                <tr key={idx} className="hover:bg-card/60 transition-colors">
                  <td className="px-6 py-4 font-semibold">{metric.name}</td>
                  <td className="px-6 py-4 text-center">{(metric.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center">{(metric.precision * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center">{(metric.recall * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center">{(metric.f1 * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center">{(metric.auc * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Accuracy Comparison Bar Chart */}
      <Card className="bg-card border-border p-8">
        <h3 className="text-xl font-bold mb-6">{vi.accuracy} {vi.compareNow.toLowerCase()}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonMetrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" stroke="var(--color-foreground)" />
            <YAxis stroke="var(--color-foreground)" />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              labelStyle={{ color: 'var(--color-foreground)' }}
            />
            <Bar dataKey="accuracy" fill="var(--color-primary)" name={vi.accuracy} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Performance Metrics Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Precision vs Recall */}
        <Card className="bg-card border-border p-8">
          <h3 className="text-xl font-bold mb-6">{vi.precision} & {vi.recall}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={comparisonMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-foreground)" />
              <YAxis stroke="var(--color-foreground)" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-foreground)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="precision" stroke="var(--color-primary)" name={vi.precision} strokeWidth={2} />
              <Line type="monotone" dataKey="recall" stroke="var(--color-accent)" name={vi.recall} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* F1 Score Comparison */}
        <Card className="bg-card border-border p-8">
          <h3 className="text-xl font-bold mb-6">{vi.f1Score}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={comparisonMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-foreground)" />
              <YAxis stroke="var(--color-foreground)" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                labelStyle={{ color: 'var(--color-foreground)' }}
              />
              <Bar dataKey="f1" fill="var(--color-accent)" name={vi.f1Score} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Speed vs Accuracy Trade-off */}
      <Card className="bg-card border-border p-8">
        <h3 className="text-xl font-bold mb-6">{vi.accuracy} vs Tốc độ Huấn luyện</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart data={speedAccuracyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="trainingTime" name="Thời gian huấn luyện (ms)" stroke="var(--color-foreground)" />
            <YAxis dataKey="accuracy" name={vi.accuracy} stroke="var(--color-foreground)" />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
              labelStyle={{ color: 'var(--color-foreground)' }}
              cursor={{ strokeDasharray: '3 3' }}
            />
            <Scatter name="Các thuật toán" data={speedAccuracyData} fill="var(--color-primary)" />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Detailed Metrics Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {comparisonMetrics.map((metric, idx) => (
          <Card key={idx} className="bg-card/50 border-border p-6">
            <h4 className="text-lg font-bold mb-4">{algorithms[idx].name}</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{vi.accuracy}</span>
                <span className="font-semibold">{(metric.accuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${metric.accuracy * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-muted-foreground">{vi.precision}</span>
                <span className="font-semibold">{(metric.precision * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-accent h-2 rounded-full" style={{ width: `${metric.precision * 100}%` }}></div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <span className="text-muted-foreground">{vi.f1Score}</span>
                <span className="font-semibold">{(metric.f1 * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${metric.f1 * 100}%` }}></div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">Thời gian huấn luyện: <span className="font-semibold text-foreground">{metric.trainingTime}ms</span></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
