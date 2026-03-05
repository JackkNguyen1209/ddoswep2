'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { api, type ModelMeta } from '@/lib/api'

interface PredictionFormProps {
  modelId?: string | null
  onPredict: (data: Record<string, unknown>) => void
}

/** Numeric input cell */
function NumericField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (name: string, v: string) => void
}) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1 truncate" title={name}>
        {name}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="0"
      />
    </div>
  )
}

export function PredictionForm({ modelId, onPredict }: PredictionFormProps) {
  const [meta, setMeta] = useState<ModelMeta | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [metaError, setMetaError] = useState('')
  const [formData, setFormData] = useState<Record<string, string>>({})

  const loadMeta = useCallback(async (mid: string) => {
    setLoadingMeta(true)
    setMetaError('')
    try {
      const m = await api.getModelMeta(mid)
      setMeta(m)
      // Pre-fill with zeros (user must enter real values)
      const defaults: Record<string, string> = {}
      m.raw_feature_names.forEach((f) => { defaults[f] = '0' })
      setFormData(defaults)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải meta'
      setMetaError(msg)
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  useEffect(() => {
    const mid = modelId ?? (typeof window !== 'undefined' ? localStorage.getItem('model_id') : null)
    if (mid) loadMeta(mid)
  }, [modelId, loadMeta])

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(formData)) {
      const n = parseFloat(v)
      parsed[k] = isNaN(n) ? v : n
    }
    onPredict(parsed)
  }

  if (loadingMeta) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Đang tải danh sách đặc trưng từ model...</span>
      </div>
    )
  }

  if (metaError || !meta) {
    return (
      <div className="space-y-4">
        {metaError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{metaError}</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Không tải được danh sách đặc trưng. Nhập thủ công dạng JSON bên dưới:
        </p>
        <FallbackJsonForm onPredict={onPredict} />
      </div>
    )
  }

  const features = meta.raw_feature_names

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
          {features.length} đặc trưng · {meta.algorithm}
        </span>
        <span className="text-xs text-muted-foreground">scaling: {meta.scaling}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
        {features.map((f) => (
          <NumericField
            key={f}
            name={f}
            value={formData[f] ?? '0'}
            onChange={handleChange}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Tất cả {features.length} đặc trưng đều bắt buộc (model sẽ trả 422 nếu thiếu bất kỳ cột nào).
      </p>

      <Button
        type="submit"
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
      >
        Dự đoán & Giải thích
      </Button>
    </form>
  )
}

/** Fallback for when meta cannot be loaded */
function FallbackJsonForm({ onPredict }: { onPredict: (d: Record<string, unknown>) => void }) {
  const [raw, setRaw] = useState('{}')
  const [err, setErr] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const parsed = JSON.parse(raw)
      setErr('')
      onPredict(parsed)
    } catch {
      setErr('JSON không hợp lệ')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="w-full h-32 px-3 py-2 rounded-lg bg-input border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder='{"feature1": 0.5, "feature2": 1.0, ...}'
      />
      {err && <p className="text-destructive text-xs">{err}</p>}
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
        Dự đoán
      </Button>
    </form>
  )
}
