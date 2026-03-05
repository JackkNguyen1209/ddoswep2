'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import { vi } from '@/lib/vi'

export function OptimizationResults() {
  const optimalFeatures = [
    'Tần số Gói tin',
    'Kích thước Gói tin',
    'Tỷ lệ Lỗi',
    'Thời gian Phản hồi',
    'Số cổng Đích',
    'Tổng Byte'
  ]

  const removedFeatures = [
    'TTL',
    'Flags TCP',
    'Payload Độ dài'
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="bg-primary/10 border-primary/30 p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold mb-2">{vi.recommendedFeatures}</h3>
            <p className="text-foreground mb-3">
              Dựa trên phân tích tương quan, phương sai và tầm quan trọng đặc trưng, hệ thống khuyến nghị sử dụng <span className="font-bold text-primary">6 đặc trưng</span> để đạt hiệu suất tối ưu.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Độ chính xác</p>
                <p className="text-2xl font-bold text-primary">94.5%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Giảm Kích thước</p>
                <p className="text-2xl font-bold text-primary">60% → 6</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tăng Tốc độ</p>
                <p className="text-2xl font-bold text-primary">+30%</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recommended Features */}
      <Card className="bg-green-500/5 border-green-500/20 p-6">
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          Đặc trưng Được Khuyến nghị Sử dụng
        </h4>
        <div className="grid md:grid-cols-2 gap-3">
          {optimalFeatures.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <Badge className="bg-green-600 text-white">{idx + 1}</Badge>
              <span className="font-medium">{feature}</span>
              <span className="text-xs text-green-600 dark:text-green-400 ml-auto">Giữ lại</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Removed Features */}
      <Card className="bg-red-500/5 border-red-500/20 p-6">
        <h4 className="text-lg font-bold mb-4">Đặc trưng Được Khuyến nghị Loại bỏ</h4>
        <div className="space-y-3">
          {removedFeatures.map((feature, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-red-500">✕</span>
                <span className="font-medium">{feature}</span>
              </div>
              <span className="text-xs text-red-600 dark:text-red-400">Không mang lại thông tin hữu ích</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Các đặc trưng này có tương quan cao với các đặc trưng khác hoặc phương sai thấp, không cải thiện độ chính xác mô hình.
        </p>
      </Card>

      {/* Improvement Analysis */}
      <Card className="bg-card border-border p-6">
        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {vi.accuracyImprovement}
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-foreground">Tất cả 60 đặc trưng</span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-muted rounded-full h-2">
                <div className="bg-primary rounded-full h-2 w-11/12" style={{ width: '92%' }}></div>
              </div>
              <span className="font-bold text-primary text-sm">92.1%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-foreground">6 đặc trưng Tối ưu</span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-muted rounded-full h-2">
                <div className="bg-green-500 rounded-full h-2" style={{ width: '94.5%' }}></div>
              </div>
              <span className="font-bold text-green-500 text-sm">94.5%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Recommendations */}
      <Card className="bg-primary/5 border-primary/20 p-6">
        <h4 className="text-lg font-bold mb-4">Đề xuất Sử dụng</h4>
        <ul className="space-y-3 text-foreground">
          <li className="flex gap-3">
            <span className="text-primary font-bold flex-shrink-0">1.</span>
            <span>Sử dụng 6 đặc trưng được khuyến nghị để đạt cân bằng tốt giữa độ chính xác và tốc độ</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold flex-shrink-0">2.</span>
            <span>Loại bỏ các đặc trưng không cần thiết giảm tính toán và cải thiện giải thích mô hình</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold flex-shrink-0">3.</span>
            <span>Giảm 60 đặc trưng xuống 6 vẫn duy trì độ chính xác 94.5%</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold flex-shrink-0">4.</span>
            <span>Thời gian huấn luyện tăng 30% với kích thước dữ liệu nhỏ hơn</span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
