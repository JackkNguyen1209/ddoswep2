'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Code, Zap, CheckCircle2, AlertCircle } from 'lucide-react'
import { vi } from '@/lib/vi'

interface Algorithm {
  id: string
  name: string
  shortName: string
  explanation: string
  formula: string
  advantages: string[]
  disadvantages: string[]
  useCase: string
  howItWorks: string
  complexity: string
  trainingTime: string
  interpretability: string
}

interface Props {
  algorithm: Algorithm
  activeTab: 'explanation' | 'howItWorks' | 'prediction'
  setActiveTab: (tab: 'explanation' | 'howItWorks' | 'prediction') => void
}

export function AlgorithmDetailCard({ algorithm, activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'explanation', label: vi.algorithmExplanation, icon: BookOpen },
    { id: 'howItWorks', label: vi.howAlgorithmWorks, icon: Code },
    { id: 'prediction', label: vi.whyThisPrediction, icon: Zap }
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-primary/5 border-primary/20 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">{algorithm.name}</h2>
              <p className="text-muted-foreground text-lg">{algorithm.explanation}</p>
            </div>
            <Badge className="text-lg px-4 py-2">{algorithm.shortName}</Badge>
          </div>
        </Card>

        {/* Content Tabs */}
        {activeTab === 'explanation' && (
          <div className="space-y-6">
            {/* Formula */}
            <Card className="bg-card border-border p-6">
              <h3 className="text-xl font-bold mb-4">{vi.mathematicalFormula}</h3>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                {algorithm.formula}
              </div>
            </Card>

            {/* Properties Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-card border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">Độ phức tạp</p>
                <p className="font-semibold text-foreground">{algorithm.complexity}</p>
              </Card>
              <Card className="bg-card border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">Thời gian Huấn luyện</p>
                <p className="font-semibold text-foreground">{algorithm.trainingTime}</p>
              </Card>
              <Card className="bg-card border-border p-4">
                <p className="text-xs text-muted-foreground mb-2">Khả năng Giải thích</p>
                <p className="font-semibold text-foreground">{algorithm.interpretability}</p>
              </Card>
            </div>

            {/* Advantages */}
            <Card className="bg-green-500/5 border-green-500/20 p-6">
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                {vi.advantages}
              </h4>
              <ul className="space-y-2">
                {algorithm.advantages.map((adv, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="text-foreground">{adv}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Disadvantages */}
            <Card className="bg-red-500/5 border-red-500/20 p-6">
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                {vi.disadvantages}
              </h4>
              <ul className="space-y-2">
                {algorithm.disadvantages.map((dis, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-red-500 font-bold">✕</span>
                    <span className="text-foreground">{dis}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Use Case */}
            <Card className="bg-card border-border p-6">
              <h4 className="text-lg font-bold mb-3">{vi.useCases}</h4>
              <p className="text-foreground">{algorithm.useCase}</p>
            </Card>
          </div>
        )}

        {activeTab === 'howItWorks' && (
          <Card className="bg-card border-border p-6">
            <h3 className="text-xl font-bold mb-6">{vi.howAlgorithmWorks}</h3>
            <div className="space-y-4">
              {algorithm.howItWorks.split('\n').filter(line => line.trim()).map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-foreground pt-1">{step.trim()}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'prediction' && (
          <Card className="bg-card border-border p-6">
            <h3 className="text-xl font-bold mb-6">{vi.whyThisPrediction}</h3>
            <div className="space-y-4 text-foreground">
              <p>
                Dự đoán được tạo ra thông qua quy trình sau:
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-semibold mb-2">1. Trích xuất Đặc trưng</p>
                  <p className="text-sm text-muted-foreground">Dữ liệu đầu vào được chuẩn bị và chuẩn hóa để khớp với định dạng huấn luyện</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">2. Xử lý</p>
                  <p className="text-sm text-muted-foreground">Thuật toán xử lý các đặc trưng thông qua các phép toán để tạo ra điểm dự đoán</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">3. Phân tích Đặc trưng</p>
                  <p className="text-sm text-muted-foreground">Xác định đặc trưng nào có tác động lớn nhất đến kết quả</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">4. Dự đoán</p>
                  <p className="text-sm text-muted-foreground">Đưa ra dự đoán cuối cùng dựa trên điểm số và độ tin cậy</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
