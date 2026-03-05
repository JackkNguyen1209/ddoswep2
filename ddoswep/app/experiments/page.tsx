'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Plus, Star, Loader2, AlertCircle, BarChart2, X } from 'lucide-react'
import { api, type ExperimentSummary } from '@/lib/api'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  useEffect(() => {
    api.listExperiments()
      .then(data => { setExperiments(data); setLoading(false) })
      .catch(err => { setError(err instanceof Error ? err.message : 'Load failed'); setLoading(false) })
  }, [])

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id] // max 2
      return [...prev, id]
    })
  }

  const best = experiments.length > 0 ? experiments.reduce((a, b) => a.accuracy > b.accuracy ? a : b) : null
  const compareExps = experiments.filter(e => compareIds.includes(e.id))

  const MetricRow = ({ label, a, b }: { label: string; a: number; b: number }) => {
    const winner = a >= b ? 'a' : 'b'
    return (
      <tr className="border-b border-border/50">
        <td className="px-4 py-3 text-sm text-muted-foreground">{label}</td>
        <td className={`px-4 py-3 text-center font-bold text-sm ${winner === 'a' ? 'text-primary' : ''}`}>
          {(a * 100).toFixed(2)}%{winner === 'a' && ' ✓'}
        </td>
        <td className={`px-4 py-3 text-center font-bold text-sm ${winner === 'b' ? 'text-primary' : ''}`}>
          {(b * 100).toFixed(2)}%{winner === 'b' && ' ✓'}
        </td>
      </tr>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/"><Button variant="ghost" size="sm" className="gap-2"><ChevronLeft className="w-4 h-4" />Home</Button></Link>
            <div>
              <h1 className="text-xl font-bold">Experiment History</h1>
              <p className="text-sm text-muted-foreground">Manage and compare model experiments</p>
            </div>
          </div>
          <div className="flex gap-2">
            {compareIds.length === 2 && (
              <Button
                onClick={() => setShowCompare(v => !v)}
                variant="outline"
                className="gap-2"
              >
                <BarChart2 className="w-4 h-4" />
                {showCompare ? 'Hide Compare' : 'Compare Selected'}
              </Button>
            )}
            <Link href="/training">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Plus className="w-4 h-4" />New Experiment
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}

        {error && (
          <Card className="bg-destructive/10 border-destructive/30 p-6 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-destructive">{error}</p>
          </Card>
        )}

        {!loading && experiments.length === 0 && !error && (
          <Card className="bg-card/50 border-border p-12 text-center">
            <p className="text-muted-foreground mb-4">Chưa có experiments. Hãy huấn luyện một mô hình trước.</p>
            <Link href="/training"><Button className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Tạo Experiment</Button></Link>
          </Card>
        )}

        {/* Compare panel */}
        {showCompare && compareExps.length === 2 && (
          <Card className="bg-card border-primary/30 border p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Compare: {compareExps[0].name} vs {compareExps[1].name}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowCompare(false); setCompareIds([]) }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-muted-foreground">Metric</th>
                  <th className="px-4 py-2 text-center">{compareExps[0].algorithm}</th>
                  <th className="px-4 py-2 text-center">{compareExps[1].algorithm}</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Accuracy" a={compareExps[0].accuracy} b={compareExps[1].accuracy} />
                <MetricRow label="F1 Score" a={compareExps[0].f1Score} b={compareExps[1].f1Score} />
                <tr className="border-b border-border/50">
                  <td className="px-4 py-3 text-sm text-muted-foreground">Training Time</td>
                  <td className={`px-4 py-3 text-center font-bold text-sm ${compareExps[0].trainingTime <= compareExps[1].trainingTime ? 'text-primary' : ''}`}>
                    {compareExps[0].trainingTime.toFixed(1)}s{compareExps[0].trainingTime <= compareExps[1].trainingTime && ' ✓'}
                  </td>
                  <td className={`px-4 py-3 text-center font-bold text-sm ${compareExps[1].trainingTime < compareExps[0].trainingTime ? 'text-primary' : ''}`}>
                    {compareExps[1].trainingTime.toFixed(1)}s{compareExps[1].trainingTime < compareExps[0].trainingTime && ' ✓'}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        {!loading && experiments.length > 0 && (
          <>
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-card border-border p-6">
                <p className="text-sm text-muted-foreground mb-2">Total Experiments</p>
                <p className="text-3xl font-bold">{experiments.length}</p>
              </Card>
              <Card className="bg-card border-border p-6">
                <p className="text-sm text-muted-foreground mb-2">Best Accuracy</p>
                <p className="text-3xl font-bold text-primary">{(Math.max(...experiments.map(e => e.accuracy)) * 100).toFixed(2)}%</p>
              </Card>
              <Card className="bg-card border-border p-6">
                <p className="text-sm text-muted-foreground mb-2">Avg F1 Score</p>
                <p className="text-3xl font-bold text-accent">
                  {(experiments.reduce((a, b) => a + b.f1Score, 0) / experiments.length * 100).toFixed(2)}%
                </p>
              </Card>
              <Card className="bg-card border-border p-6">
                <p className="text-sm text-muted-foreground mb-2">Fastest Training</p>
                <p className="text-3xl font-bold">{Math.min(...experiments.map(e => e.trainingTime)).toFixed(1)}s</p>
              </Card>
            </div>

            {compareIds.length > 0 && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart2 className="w-4 h-4 text-primary" />
                {compareIds.length === 1 ? 'Select 1 more to compare' : 'Click "Compare Selected" to see side-by-side'}
                <button onClick={() => setCompareIds([])} className="text-xs underline ml-2">Clear</button>
              </div>
            )}

            <Card className="bg-card border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Compare</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Experiment</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Algorithm</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Accuracy</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">F1 Score</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Training Time</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Date</th>
                      <th className="px-4 py-4 text-left font-semibold text-primary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map((exp, idx) => (
                      <tr key={exp.id} className={`border-b border-border/50 hover:bg-primary/5 transition-colors ${idx === 0 ? 'bg-primary/5' : ''}`}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={compareIds.includes(exp.id)}
                            onChange={() => toggleCompare(exp.id)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {exp.featured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                            <span className="font-semibold">{exp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{exp.algorithm}</td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className="font-bold text-primary">{(exp.accuracy * 100).toFixed(2)}%</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className="font-bold text-accent">{(exp.f1Score * 100).toFixed(2)}%</Badge>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{exp.trainingTime.toFixed(1)}s</td>
                        <td className="px-4 py-4 text-muted-foreground">{exp.date}</td>
                        <td className="px-4 py-4">
                          <Button
                            variant="ghost" size="sm" className="h-8 text-xs hover:text-primary"
                            onClick={() => { localStorage.setItem('experiment_id', exp.id); window.location.href = '/evaluation' }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {best && (
              <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 p-12 mt-12 text-center">
                <Badge className="bg-primary text-primary-foreground mb-4">Top Performer</Badge>
                <h2 className="text-3xl font-bold mb-2">{best.name}</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Achieved {(best.accuracy * 100).toFixed(1)}% accuracy with F1 score of {(best.f1Score * 100).toFixed(1)}%.
                </p>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => { localStorage.setItem('experiment_id', best.id); window.location.href = '/evaluation' }}>
                  View Details
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  )
}
