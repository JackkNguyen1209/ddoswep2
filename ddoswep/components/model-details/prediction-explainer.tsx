'use client'

import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { vi } from '@/lib/vi'

export function PredictionExplainer() {
  // Mock data for feature contributions
  const featureData = [
    { name: 'Tần số Gói tin', contribution: 92 },
    { name: 'Kích thước Gói tin', contribution: 85 },
    { name: 'Tỷ lệ Lỗi', contribution: 78 },
    { name: 'Thời gian Phản hồi', contribution: 65 },
    { name: 'Số cổng Đích', contribution: 45 },
    { name: 'TTL', contribution: 32 },
    { name: 'Flags TCP', contribution: 28 },
    { name: 'Payload Độ dài', contribution: 15 }
  ]

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border p-6">
        <h2 className="text-2xl font-bold mb-6">{vi.predictionExplanation}</h2>

        <div className="space-y-6">
          {/* Feature Contributions */}
          <div>
            <h3 className="text-lg font-bold mb-4">{vi.featureContribution}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={featureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <Tooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="contribution" fill="hsl(var(--primary))" name={vi.featureContribution} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Confidence Score */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">{vi.confidenceScore}</p>
              <p className="text-4xl font-bold text-primary mb-2">92.3%</p>
              <p className="text-sm text-foreground">Độ tin cậy cao rằng đây là một tấn công DDoS</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground mb-2">{vi.modelAccuracy}</p>
              <p className="text-4xl font-bold text-primary mb-2">96.8%</p>
              <p className="text-sm text-foreground">Độ chính xác mô hình trên tập kiểm tra</p>
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
            <h4 className="font-bold mb-3">{vi.whyThisPrediction}</h4>
            <div className="space-y-3 text-sm text-foreground">
              <p>
                Mô hình dự đoán <span className="font-bold text-primary">TẤN CÔNG DDoS</span> dựa trên các lý do sau:
              </p>
              <ul className="space-y-2 ml-4 list-disc">
                <li>
                  <span className="font-semibold">Tần số Gói tin (92% đóng góp):</span> Gói tin đến với tần số bất thường cao, điều này là đặc điểm của DDoS
                </li>
                <li>
                  <span className="font-semibold">Kích thước Gói tin (85% đóng góp):</span> Mô hình nhận dạng các gói tin có kích thước không phù hợp
                </li>
                <li>
                  <span className="font-semibold">Tỷ lệ Lỗi (78% đóng góp):</span> Có nhiều lỗi truyền dẫn cao hơn bình thường
                </li>
                <li>
                  <span className="font-semibold">Thời gian Phản hồi (65% đóng góp):</span> Phản hồi chậm hơn dự kiến
                </li>
              </ul>
              <p className="mt-4">
                Tổng hợp các đặc trưng này, mô hình có độ tin cậy <span className="font-bold text-primary">92.3%</span> rằng đây là một tấn công DDoS.
              </p>
            </div>
          </div>

          {/* Model Details */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-card border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">{vi.trainingTime}</p>
              <p className="text-lg font-bold text-foreground">2.34 giây</p>
              <p className="text-xs text-muted-foreground mt-1">trên GPU</p>
            </Card>
            <Card className="bg-card border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">{vi.testsetAccuracy}</p>
              <p className="text-lg font-bold text-foreground">96.8%</p>
              <p className="text-xs text-muted-foreground mt-1">F1-Score: 0.94</p>
            </Card>
            <Card className="bg-card border-border p-4">
              <p className="text-xs text-muted-foreground mb-2">Đặc trưng Sử dụng</p>
              <p className="text-lg font-bold text-foreground">18/42</p>
              <p className="text-xs text-muted-foreground mt-1">Tối ưu hóa tính năng</p>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  )
}
