'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { DataPreview } from '@/components/upload/data-preview'
import { DataStats } from '@/components/upload/data-stats'
import { vi } from '@/lib/vi'
import { api, type DatasetResponse } from '@/lib/api'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dataset, setDataset] = useState<DatasetResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError(vi.fileError)
      return
    }

    setError('')
    setFile(selectedFile)
    setDataset(null)
    setLoading(true)

    try {
      const result = await api.uploadDataset(selectedFile)
      setDataset(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : vi.parseError
      setError(`Upload thất bại: ${msg}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleProceed = () => {
    if (!dataset) {
      setError(vi.noValidFile)
      return
    }
    // Store only lightweight metadata — no raw data in localStorage
    localStorage.setItem('dataset_id', dataset.dataset_id)
    localStorage.setItem('dataset_meta', JSON.stringify({
      columns: dataset.columns,
      total_rows: dataset.total_rows,
      total_columns: dataset.total_columns,
      dtypes: dataset.dtypes,
    }))
    window.location.href = '/preprocessing'
  }

  const stats = dataset
    ? {
        totalRows: dataset.total_rows,
        totalColumns: dataset.total_columns,
        columns: dataset.columns,
        memoryUsage: file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '—',
      }
    : null

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.uploadPageTitle}</h1>
            <p className="text-sm text-muted-foreground">{vi.uploadPageStep}</p>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-card border-border p-8 mb-6">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer group">
                <label htmlFor="file-input" className="cursor-pointer block">
                  {loading ? (
                    <Loader2 className="w-16 h-16 text-primary/60 mx-auto mb-4 animate-spin" />
                  ) : (
                    <Upload className="w-16 h-16 text-primary/60 group-hover:text-primary mx-auto mb-4 transition-colors" />
                  )}
                  <h3 className="text-xl font-bold mb-2">{loading ? 'Đang tải lên...' : vi.dropFile}</h3>
                  <p className="text-muted-foreground mb-4">{vi.clickBrowse}</p>
                  <p className="text-sm text-muted-foreground">{vi.csvFormat}</p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              </div>
            </Card>

            {file && dataset && (
              <Card className="bg-card/50 border-primary/30 p-6 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-semibold">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB · dataset_id: <code className="text-xs text-primary">{dataset.dataset_id}</code>
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {error && (
              <Card className="bg-destructive/10 border-destructive/30 p-6 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-destructive">{error}</p>
              </Card>
            )}

            {dataset && dataset.preview.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">{vi.dataPreview}</h2>
                <DataPreview data={dataset.preview as Record<string, string>[]} />
              </div>
            )}
          </div>

          <div>
            {stats && <DataStats stats={stats} />}

            {dataset && (
              <Card className="bg-card border-border p-6 mt-6">
                <h3 className="font-bold mb-4">{vi.nextSteps}</h3>
                <Button
                  onClick={handleProceed}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-3"
                >
                  {vi.proceedPreprocessing}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setFile(null); setDataset(null) }}
                  className="w-full"
                >
                  {vi.uploadDifferent}
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
