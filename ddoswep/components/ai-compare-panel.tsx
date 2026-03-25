'use client'

import { type AICompareData } from '@/lib/api'

interface AIComparePanelProps {
  compareData: AICompareData
  /** How to render one model's result. Receives the raw value (List[str] | str | dict | null) */
  renderResult: (value: unknown, modelLabel: string) => React.ReactNode
  label?: string
}

function ModelBadge({ name, color }: { name: string; color: 'violet' | 'orange' }) {
  const cls = color === 'violet'
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30'
    : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color === 'violet' ? 'bg-violet-500' : 'bg-orange-500'}`} />
      {name}
    </span>
  )
}

export function AIComparePanel({ compareData, renderResult, label = 'So sánh AI' }: AIComparePanelProps) {
  const { claude, ollama, model_claude, model_ollama } = compareData
  const hasNeither = !claude && !ollama

  return (
    <div className="mt-4 border border-dashed border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          ⚖️ {label}
        </span>
        <ModelBadge name={model_claude ?? 'Claude'} color="violet" />
        <span className="text-muted-foreground text-xs">vs</span>
        <ModelBadge name={model_ollama ?? 'Ollama'} color="orange" />
      </div>

      {hasNeither ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Cả hai model đều không trả về kết quả.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Claude */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ModelBadge name={model_claude ?? 'Claude'} color="violet" />
              {!claude && <span className="text-xs text-muted-foreground italic">(không có kết quả)</span>}
            </div>
            <div className="text-sm">
              {claude
                ? renderResult(claude, model_claude)
                : <p className="text-muted-foreground italic text-xs">API không khả dụng hoặc lỗi.</p>}
            </div>
          </div>

          {/* Ollama */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ModelBadge name={model_ollama ?? 'Ollama'} color="orange" />
              {!ollama && <span className="text-xs text-muted-foreground italic">(không có kết quả)</span>}
            </div>
            <div className="text-sm">
              {ollama
                ? renderResult(ollama, model_ollama)
                : <p className="text-muted-foreground italic text-xs">Ollama không chạy hoặc model chưa được pull.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Render a List[str] (local explain lines) */
export function renderLines(value: unknown): React.ReactNode {
  const lines = Array.isArray(value) ? (value as string[]) : []
  if (lines.length === 0) return <p className="text-muted-foreground italic">Trống.</p>
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <p key={i} className={`${line.startsWith('  ') ? 'pl-3 text-muted-foreground' : ''}`}>
          {line}
        </p>
      ))}
    </div>
  )
}

/** Render a plain string (global narrative) */
export function renderString(value: unknown): React.ReactNode {
  if (typeof value !== 'string' || !value) return <p className="text-muted-foreground italic">Trống.</p>
  return <p className="leading-relaxed">{value}</p>
}

/** Render model details sections (dict with sections[]) */
export function renderSections(value: unknown): React.ReactNode {
  if (!value || typeof value !== 'object') return <p className="text-muted-foreground italic">Trống.</p>
  const v = value as Record<string, unknown>
  const sections = Array.isArray(v.sections) ? v.sections as Array<{
    heading: string; paragraphs: string[]; bullets: string[]
  }> : []
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i}>
          <h4 className="font-semibold text-sm mb-1">{s.heading}</h4>
          {s.paragraphs?.map((p, j) => <p key={j} className="text-xs text-muted-foreground mb-1">{p}</p>)}
          {s.bullets?.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5">
              {s.bullets.map((b, j) => <li key={j} className="text-xs text-muted-foreground">{b}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
