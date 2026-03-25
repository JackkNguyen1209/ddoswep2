'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, BookOpen, Loader2, AlertCircle, GitCompare } from 'lucide-react'
import { vi } from '@/lib/vi'
import { AlgorithmDetailCard } from '@/components/model-details/algorithm-detail-card'
import { PredictionExplainer } from '@/components/model-details/prediction-explainer'
import { AIComparePanel, renderSections } from '@/components/ai-compare-panel'
import { api, type ModelDetailsVI } from '@/lib/api'

const algorithms = [
  {
    id: 'ann',
    name: vi.artificialNeuralNetwork,
    shortName: 'ANN',
    explanation: vi.annExplanation,
    formula: vi.annFormula,
    advantages: [
      vi.annAdvantages,
      'Có thể học các mối quan hệ phức tạp giữa các đặc trưng',
      'Thích ứng tốt với dữ liệu mới sau khi huấn luyện'
    ],
    disadvantages: [
      vi.annDisadvantages,
      'Cần nhiều dữ liệu để huấn luyện hiệu quả',
      'Tính toán chậm so với các thuật toán khác'
    ],
    useCase: vi.annUseCase,
    howItWorks: `
      1. Khởi tạo: Đặt các trọng số ngẫu nhiên
      2. Lan truyền Trước: Tính đầu ra dựa trên các giá trị đầu vào
      3. Tính Lỗi: So sánh đầu ra dự đoán với giá trị thực tế
      4. Lan truyền Ngược: Cập nhật trọng số dựa trên lỗi
      5. Lặp lại: Lặp lại qua nhiều epochs cho đến khi hội tụ
    `,
    complexity: 'Phức tạp cao',
    trainingTime: 'Lâu',
    interpretability: 'Thấp'
  },
  {
    id: 'svm',
    name: vi.supportVectorMachine,
    shortName: 'SVM',
    explanation: vi.svmExplanation,
    formula: vi.svmFormula,
    advantages: [
      vi.svmAdvantages,
      'Có thể xử lý nhiều lớp',
      'Hiệu quả với dữ liệu có kích thước cao'
    ],
    disadvantages: [
      vi.svmDisadvantages,
      'Không mở rộng tốt với dữ liệu rất lớn',
      'Cần chuẩn hóa dữ liệu'
    ],
    useCase: vi.svmUseCase,
    howItWorks: `
      1. Chuẩn bị: Chuẩn hóa dữ liệu đầu vào
      2. Tìm Siêu phẳng: Xác định đường/mặt phẳng tốt nhất để phân chia
      3. Tối ưu hóa Lề: Tìm siêu phẳng với lề tối đa (khoảng cách đến điểm gần nhất)
      4. Dự đoán: Xác định mặt siêu phẳng mà điểm mới nằm
      5. Độc lập: Sử dụng kernel trick để xử lý dữ liệu phi tuyến
    `,
    complexity: 'Phức tạp trung bình',
    trainingTime: 'Trung bình',
    interpretability: 'Thấp tới trung bình'
  },
  {
    id: 'gnb',
    name: vi.gaussianNaiveBayes,
    shortName: 'GNB',
    explanation: vi.gnbExplanation,
    formula: vi.gnbFormula,
    advantages: [
      vi.gnbAdvantages,
      'Xử lý tốt dữ liệu bị thiếu',
      'Yêu cầu ít tham số điều chỉnh'
    ],
    disadvantages: [
      vi.gnbDisadvantages,
      'Không xử lý tương tác đặc trưng tốt',
      'Độ chính xác thường thua các mô hình khác'
    ],
    useCase: vi.gnbUseCase,
    howItWorks: `
      1. Huấn luyện: Tính xác suất có điều kiện P(đặc trưng|lớp) từ dữ liệu
      2. Giả định: Giả sử các đặc trưng độc lập với nhau
      3. Tính Xác suất: Sử dụng định lý Bayes để tính P(lớp|đặc trưng)
      4. Dự đoán: Chọn lớp có xác suất cao nhất
      5. Phân phối: Giả định các đặc trưng tuân theo phân phối Gaussian (chuẩn)
    `,
    complexity: 'Thấp',
    trainingTime: 'Rất nhanh',
    interpretability: 'Cao'
  },
  {
    id: 'lr',
    name: vi.logisticRegression,
    shortName: 'LR',
    explanation: vi.lrExplanation,
    formula: vi.lrFormula,
    advantages: [
      vi.lrAdvantages,
      'Có thể cung cấp xác suất của dự đoán',
      'Xử lý tốt với tập dữ liệu lớn'
    ],
    disadvantages: [
      vi.lrDisadvantages,
      'Không xử lý tương tác đặc trưng tự động',
      'Cần chuẩn bị dữ liệu cẩn thận'
    ],
    useCase: vi.lrUseCase,
    howItWorks: `
      1. Thiết lập: Khởi tạo các hệ số (trọng số)
      2. Tính Xác suất: Sử dụng hàm logistic để chuyển đầu vào tuyến tính
      3. Mất mát: Tính sai số giữa dự đoán và giá trị thực
      4. Tối ưu hóa: Sử dụng gradient descent để cập nhật hệ số
      5. Hội tụ: Lặp lại cho đến khi mất mát không giảm đáng kể
    `,
    complexity: 'Thấp',
    trainingTime: 'Rất nhanh',
    interpretability: 'Cao'
  },
  {
    id: 'knn',
    name: vi.kNearestNeighbors,
    shortName: 'KNN',
    explanation: vi.knnExplanation,
    formula: vi.knnFormula,
    advantages: [
      vi.knnAdvantages,
      'Không cần huấn luyện',
      'Thích ứng nhanh với dữ liệu mới'
    ],
    disadvantages: [
      vi.knnDisadvantages,
      'Bộ nhớ yêu cầu lớn',
      'Nhạy cảm với các đặc trưng không liên quan'
    ],
    useCase: vi.knnUseCase,
    howItWorks: `
      1. Lưu trữ: Lưu tất cả dữ liệu huấn luyện
      2. Tính Khoảng cách: Tính khoảng cách từ điểm mới đến tất cả điểm huấn luyện
      3. Sắp xếp: Xác định K hàng xóm gần nhất
      4. Bầu chọn: Lấy nhãn phổ biến nhất trong K hàng xóm
      5. Dự đoán: Gán nhãn phổ biến cho điểm mới
    `,
    complexity: 'Thấp đối với huấn luyện, cao đối với dự đoán',
    trainingTime: 'Tức thì',
    interpretability: 'Cao'
  },
  {
    id: 'dt',
    name: vi.decisionTree,
    shortName: 'DT',
    explanation: vi.dtExplanation,
    formula: vi.dtFormula,
    advantages: [
      vi.dtAdvantages,
      'Xử lý dữ liệu phân loại tốt',
      'Không cần chuẩn bị dữ liệu'
    ],
    disadvantages: [
      vi.dtDisadvantages,
      'Có thể tạo cây quá phức tạp',
      'Nhạy cảm với những thay đổi nhỏ trong dữ liệu'
    ],
    useCase: vi.dtUseCase,
    howItWorks: `
      1. Chọn Đặc trưng: Tìm đặc trưng tốt nhất để chia dữ liệu
      2. Chia: Chia dữ liệu dựa trên ngưỡng đặc trưng được chọn
      3. Tái lặp: Lặp lại quy trình trên các tập con
      4. Dừng: Dừng khi điều kiện dừng được đáp ứng
      5. Dự đoán: Theo dõi đường đi từ gốc đến lá để xác định lớp
    `,
    complexity: 'Trung bình',
    trainingTime: 'Nhanh',
    interpretability: 'Rất cao'
  },
  {
    id: 'rf',
    name: vi.randomForest,
    shortName: 'RF',
    explanation: vi.rfExplanation,
    formula: vi.rfFormula,
    advantages: [
      vi.rfAdvantages,
      'Giảm tăng quá tải so với cây đơn',
      'Xử lý dữ liệu không cân bằng tốt'
    ],
    disadvantages: [
      vi.rfDisadvantages,
      'Có thể chậm với dữ liệu cực lớn',
      'Yêu cầu điều chỉnh nhiều siêu tham số'
    ],
    useCase: vi.rfUseCase,
    howItWorks: `
      1. Bootstrap: Tạo nhiều tập con dữ liệu ngẫu nhiên
      2. Xây dựng Cây: Xây dựng một cây quyết định cho mỗi tập con
      3. Dự đoán: Dự đoán từ mỗi cây độc lập
      4. Tổng hợp: Kết hợp dự đoán bằng cách bầu chọn (phân loại) hoặc lấy trung bình (hồi quy)
      5. Đầu ra: Dự đoán cuối cùng từ tập hợp các cây
    `,
    complexity: 'Trung bình',
    trainingTime: 'Nhanh đến trung bình',
    interpretability: 'Trung bình'
  },
  {
    id: 'gb',
    name: vi.gradientBoosting,
    shortName: 'GB',
    explanation: vi.gbExplanation,
    formula: vi.gbFormula,
    advantages: [
      vi.gbAdvantages,
      'Xử lý dữ liệu không cân bằng rất tốt',
      'Tạo ra độ chính xác rất cao'
    ],
    disadvantages: [
      vi.gbDisadvantages,
      'Khó điều chỉnh siêu tham số',
      'Dễ tăng quá tải nếu không cẩn thận'
    ],
    useCase: vi.gbUseCase,
    howItWorks: `
      1. Cây Đầu tiên: Xây dựng cây đầu tiên để dự đoán giá trị mục tiêu
      2. Tính Phần dư: Tính sai số (phần dư) của cây đầu tiên
      3. Cây Tiếp theo: Xây dựng cây để dự đoán các phần dư này
      4. Tối ưu hóa: Sử dụng gradient descent để điều chỉnh tốc độ học
      5. Tập hợp: Kết hợp tất cả các cây với trọng số để tạo dự đoán cuối cùng
    `,
    complexity: 'Rất phức tạp',
    trainingTime: 'Chậm',
    interpretability: 'Thấp'
  }
]

export default function ModelDetailsPage() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(algorithms[0].id)
  const [activeTab, setActiveTab] = useState<'explanation' | 'howItWorks' | 'prediction'>('explanation')
  const [modelId, setModelId] = useState<string | null>(null)
  const [detailsVI, setDetailsVI] = useState<ModelDetailsVI | null>(null)
  const [loadingVI, setLoadingVI] = useState(false)
  const [errorVI, setErrorVI] = useState('')
  const [compareVI, setCompareVI] = useState(false)

  useEffect(() => {
    const mid = localStorage.getItem('model_id')
    if (mid) setModelId(mid)
  }, [])

  const fetchDetailsVI = async () => {
    if (!modelId) return
    setLoadingVI(true)
    setErrorVI('')
    try {
      const result = await api.modelDetailsVI(modelId, compareVI)
      setDetailsVI(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi'
      setErrorVI(`Không thể tải: ${msg}`)
    } finally {
      setLoadingVI(false)
    }
  }

  const algorithm = algorithms.find(a => a.id === selectedAlgorithm) || algorithms[0]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-4 h-16">
          <Link href="/evaluation">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {vi.back}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{vi.modelDetails}</h1>
            <p className="text-sm text-muted-foreground">{vi.algorithmExplanation}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Algorithm List */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border p-4 sticky top-24">
              <h3 className="font-bold mb-4 text-sm">{vi.selectAlgorithm}</h3>
              <div className="space-y-2">
                {algorithms.map(algo => (
                  <button
                    key={algo.id}
                    onClick={() => setSelectedAlgorithm(algo.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedAlgorithm === algo.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="font-mono text-xs opacity-70">{algo.shortName}</div>
                    {algo.name}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Algorithm Details */}
          <div className="lg:col-span-3">
            <AlgorithmDetailCard algorithm={algorithm} activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>

        {/* Live model details from backend */}
        {modelId && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Chi tiết mô hình đã huấn luyện (tiếng Việt)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompareVI(v => !v)}
                  disabled={loadingVI}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    compareVI
                      ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Claude vs Ollama
                </button>
                <Button onClick={fetchDetailsVI} disabled={loadingVI} variant="outline" size="sm" className="gap-2">
                  {loadingVI ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {detailsVI ? 'Tải lại' : 'Xem chi tiết thuật toán'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Model: <code className="text-primary">{modelId}</code></p>

            {errorVI && (
              <Card className="bg-destructive/10 border-destructive/30 p-3 mb-4 flex gap-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-destructive text-xs">{errorVI}</p>
              </Card>
            )}

            {detailsVI && (
              <div className="space-y-4">
                <Card className="bg-card border-border p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xl font-bold">{detailsVI.title}</h3>
                    <Badge variant="outline">{detailsVI.algorithm_key.toUpperCase()}</Badge>
                  </div>
                  {detailsVI.compare_data && (
                    <AIComparePanel
                      compareData={detailsVI.compare_data}
                      renderResult={(v) => renderSections(v)}
                      label="So sánh giải thích thuật toán"
                    />
                  )}

                  {detailsVI.sections.map((sec, i) => (
                    <div key={i} className="mb-4">
                      <h4 className="font-semibold text-primary mb-2">{sec.heading}</h4>
                      {sec.paragraphs.map((p, j) => (
                        <p key={j} className="text-sm text-muted-foreground mb-1">{p}</p>
                      ))}
                      {sec.bullets.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {sec.bullets.map((b, j) => (
                            <li key={j} className="text-sm flex gap-2">
                              <span className="text-primary">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </Card>

                {detailsVI.hyperparams_table.length > 0 && (
                  <Card className="bg-card border-border p-6">
                    <h4 className="font-semibold mb-3">Siêu tham số đang dùng</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="pb-2 pr-4 text-muted-foreground font-medium">Tham số</th>
                          <th className="pb-2 pr-4 text-muted-foreground font-medium">Giá trị</th>
                          <th className="pb-2 text-muted-foreground font-medium">Ý nghĩa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailsVI.hyperparams_table.map((hp, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="py-2 pr-4 font-mono text-xs">{hp.name}</td>
                            <td className="py-2 pr-4 font-bold text-primary">{hp.value}</td>
                            <td className="py-2 text-muted-foreground">{hp.meaning_vi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}

                {detailsVI.how_used_in_pipeline.length > 0 && (
                  <Card className="bg-primary/5 border-primary/20 p-6">
                    <h4 className="font-semibold mb-3">Cách dùng trong Pipeline</h4>
                    <ol className="space-y-1">
                      {detailsVI.how_used_in_pipeline.map((step, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-primary font-bold">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}

                {detailsVI.limitations_for_ddos.length > 0 && (
                  <Card className="bg-amber-500/10 border-amber-500/30 p-6">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">Hạn chế khi phát hiện DDoS</h4>
                    <ul className="space-y-1">
                      {detailsVI.limitations_for_ddos.map((lim, i) => (
                        <li key={i} className="text-sm flex gap-2 text-amber-700 dark:text-amber-300">
                          <span>⚠</span>
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Static prediction explainer */}
        <div className="mt-12">
          <PredictionExplainer />
        </div>
      </div>
    </div>
  )
}
