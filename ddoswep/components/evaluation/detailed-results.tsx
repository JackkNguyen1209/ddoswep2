'use client'

import { Card } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DetailedResultsProps {
  metrics: {
    accuracy: number
    precision: number
    recall: number
    f1Score: number
    auc: number
    specificity: number
  }
  confusionMatrix: {
    tn: number
    fp: number
    fn: number
    tp: number
  }
}

export function DetailedResults({ metrics, confusionMatrix }: DetailedResultsProps) {
  // Calculate metrics from confusion matrix
  const total = confusionMatrix.tp + confusionMatrix.tn + confusionMatrix.fp + confusionMatrix.fn
  const sensitivity = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fn)
  const specificity = confusionMatrix.tn / (confusionMatrix.tn + confusionMatrix.fp)
  const ppv = confusionMatrix.tp / (confusionMatrix.tp + confusionMatrix.fp)
  const npv = confusionMatrix.tn / (confusionMatrix.tn + confusionMatrix.fn)
  const falsePositiveRate = confusionMatrix.fp / (confusionMatrix.fp + confusionMatrix.tn)
  const falseNegativeRate = confusionMatrix.fn / (confusionMatrix.fn + confusionMatrix.tp)

  // Data for ROC curve
  const rocData = [
    { fpr: 0, tpr: 0 },
    { fpr: 0.02, tpr: 0.85 },
    { fpr: 0.05, tpr: 0.92 },
    { fpr: 0.1, tpr: 0.95 },
    { fpr: 0.15, tpr: 0.96 },
    { fpr: 0.2, tpr: 0.97 },
    { fpr: 0.3, tpr: 0.98 },
    { fpr: 0.5, tpr: 0.99 },
    { fpr: 1, tpr: 1 },
  ]

  // Data for PR curve
  const prData = [
    { recall: 0, precision: 1 },
    { recall: 0.2, precision: 0.98 },
    { recall: 0.4, precision: 0.97 },
    { recall: 0.6, precision: 0.96 },
    { recall: 0.8, precision: 0.94 },
    { recall: 1, precision: 0.90 },
  ]

  // Metrics comparison
  const metricsData = [
    { name: 'Độ chính xác', value: metrics.accuracy, color: '#3b82f6' },
    { name: 'Độ nhạy', value: sensitivity, color: '#06b6d4' },
    { name: 'Độ đặc hiệu', value: specificity, color: '#8b5cf6' },
    { name: 'Precision', value: metrics.precision, color: '#ec4899' },
  ]

  const rocMetrics = [
    { label: 'Độ nhạy (TPR)', value: sensitivity, percentage: (sensitivity * 100).toFixed(1) },
    { label: 'Độ đặc hiệu (TNR)', value: specificity, percentage: (specificity * 100).toFixed(1) },
    { label: 'Lỗi dương tính (FPR)', value: falsePositiveRate, percentage: (falsePositiveRate * 100).toFixed(1) },
    { label: 'Lỗi âm tính (FNR)', value: falseNegativeRate, percentage: (falseNegativeRate * 100).toFixed(1) },
  ]

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold">Kết quả Chi tiết</h2>

      {/* ROC and PR Curves */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ROC Curve */}
        <Card className="bg-card border-border p-8">
          <h3 className="text-xl font-bold mb-6">Đường cong ROC</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={rocData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="fpr" label={{ value: 'Tỷ lệ dương tính giả (FPR)', position: 'insideBottomRight', offset: -5 }} stroke="var(--color-foreground)" />
              <YAxis label={{ value: 'Tỷ lệ dương tính thực (TPR)', angle: -90, position: 'insideLeft' }} stroke="var(--color-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
              <Line type="monotone" dataKey="tpr" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              <Line type="linear" dataKey="fpr" stroke="var(--color-muted-foreground)" strokeWidth={1} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-foreground">
              <span className="font-semibold">AUC-ROC: {(metrics.auc * 100).toFixed(1)}%</span>
              <br />
              Diện tích dưới đường cong cho thấy chất lượng tổng thể của mô hình.
            </p>
          </div>
        </Card>

        {/* PR Curve */}
        <Card className="bg-card border-border p-8">
          <h3 className="text-xl font-bold mb-6">Đường cong Precision-Recall</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={prData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="recall" label={{ value: 'Độ nhạy (Recall)', position: 'insideBottomRight', offset: -5 }} stroke="var(--color-foreground)" />
              <YAxis label={{ value: 'Độ chính xác (Precision)', angle: -90, position: 'insideLeft' }} stroke="var(--color-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
              <Line type="monotone" dataKey="precision" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-accent/10 rounded-lg">
            <p className="text-sm text-foreground">
              <span className="font-semibold">AP (Average Precision): {(metrics.precision * 100).toFixed(1)}%</span>
              <br />
              Diện tích dưới đường cong Precision-Recall.
            </p>
          </div>
        </Card>
      </div>

      {/* Detailed Metrics Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-8">
          <h3 className="text-xl font-bold mb-6">Chi tiết Chỉ số</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/80 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left font-bold">Chỉ số</th>
                  <th className="px-6 py-3 text-center font-bold">Giá trị</th>
                  <th className="px-6 py-3 text-left font-bold">Giải thích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">Độ nhạy (TPR)</td>
                  <td className="px-6 py-4 text-center font-bold">{(sensitivity * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Tỷ lệ tấn công DDoS được phát hiện đúng</td>
                </tr>
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">Độ đặc hiệu (TNR)</td>
                  <td className="px-6 py-4 text-center font-bold">{(specificity * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Tỷ lệ lưu lượng bình thường được xác định đúng</td>
                </tr>
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">Precision (PPV)</td>
                  <td className="px-6 py-4 text-center font-bold">{(ppv * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Trong những cảnh báo, tỷ lệ nào là chính xác</td>
                </tr>
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">NPV</td>
                  <td className="px-6 py-4 text-center font-bold">{(npv * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Trong những trường hợp âm tính, tỷ lệ nào là đúng</td>
                </tr>
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">Tỷ lệ dương tính giả (FPR)</td>
                  <td className="px-6 py-4 text-center font-bold">{(falsePositiveRate * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Tỷ lệ cảnh báo sai cho lưu lượng bình thường</td>
                </tr>
                <tr className="hover:bg-card/50">
                  <td className="px-6 py-4 font-semibold">Tỷ lệ âm tính giả (FNR)</td>
                  <td className="px-6 py-4 text-center font-bold">{(falseNegativeRate * 100).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-muted-foreground">Tỷ lệ tấn công không được phát hiện</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Confusion Matrix Breakdown */}
      <Card className="bg-card border-border p-8">
        <h3 className="text-xl font-bold mb-6">Phân tích Ma trận Nhầm lẫn</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Dương tính Thực (TP)</p>
              <p className="text-3xl font-bold text-green-500">{confusionMatrix.tp}</p>
              <p className="text-xs text-muted-foreground mt-2">Tấn công được phát hiện đúng</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Âm tính Thực (TN)</p>
              <p className="text-3xl font-bold text-blue-500">{confusionMatrix.tn}</p>
              <p className="text-xs text-muted-foreground mt-2">Lưu lượng bình thường được xác định đúng</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Dương tính Giả (FP)</p>
              <p className="text-3xl font-bold text-red-500">{confusionMatrix.fp}</p>
              <p className="text-xs text-muted-foreground mt-2">Cảnh báo sai</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">Âm tính Giả (FN)</p>
              <p className="text-3xl font-bold text-orange-500">{confusionMatrix.fn}</p>
              <p className="text-xs text-muted-foreground mt-2">Tấn công không được phát hiện</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics Radar Chart */}
      <Card className="bg-card border-border p-8">
        <h3 className="text-xl font-bold mb-6">Biểu đồ Hiệu suất Tổng hợp</h3>
        <div className="grid md:grid-cols-2 gap-8">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metricsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-foreground)" />
              <YAxis stroke="var(--color-foreground)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
              <Bar dataKey="value" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>

          <div className="space-y-3">
            {metricsData.map((metric, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{metric.name}</span>
                  <span className="font-bold">{(metric.value * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-border rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${metric.value * 100}%`, backgroundColor: metric.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
