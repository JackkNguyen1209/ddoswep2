# Phòng Thí Nghiệm Phát Hiện DDoS ML

Một ứng dụng web toàn diện để xây dựng, huấn luyện, đánh giá và giải thích các mô hình học máy cho phát hiện tấn công DDoS.

## Tính Năng Chính

### 1. Quản Lý Dữ Liệu
- Tải lên các tập dữ liệu CSV trực tiếp từ giao diện người dùng
- Xem trước dữ liệu với thống kê chi tiết
- Hỗ trợ các tập dữ liệu lớn với xử lý hiệu quả

### 2. Tiền Xử Lý Dữ Liệu
- **Xử lý Giá trị Thiếu**: Điền bằng trung bình, trung vị, hoặc bỏ qua
- **Mã Hóa Danh Mục**: One-hot encoding, label encoding, target encoding
- **Chia Tỷ Lệ Đặc Trưng**: Chuẩn hóa, MinMaxScaler, RobustScaler
- **Cân Bằng Dữ Liệu**: Xử lý dữ liệu không cân bằng bằng SMOTE hoặc undersampling
- **Chia Train-Test**: Tự động chia dữ liệu 80-20

### 3. Lựa Chọn & Tối Ưu Hóa Đặc Trưng
- **Phân Tích Tương Quan**: Ma trận tương quan để xác định các đặc trưng dư thừa
- **Phân Tích Phương Sai**: Tìm các đặc trưng có phương sai cao
- **Tối Ưu Hóa Tự Động**: Chọn tự động số lượng đặc trưng tối ưu
- **Khuyến Nghị**: Đề xuất các đặc trưng nên giữ lại hoặc loại bỏ

### 4. 10 Thuật Toán Học Máy
1. **Mạng Thần Kinh Nhân Tạo (ANN)** - Mô hình học sâu phức tạp
2. **Máy Vector Hỗ Trợ (SVM)** - Phân loại không gian cao
3. **Gaussian Naive Bayes** - Phân loại xác suất nhanh
4. **Multinomial Naive Bayes** - Cho dữ liệu rời rạc
5. **Bernoulli Naive Bayes** - Cho dữ liệu nhị phân
6. **Hồi Quy Logistic** - Phân loại tuyến tính dễ diễn giải
7. **K-Nearest Neighbors** - Học dựa trên khoảng cách
8. **Cây Quyết Định** - Mô hình cây có thể giải thích
9. **Rừng Ngẫu Nhiên** - Tập hợp cây để dự đoán mạnh mẽ
10. **Gradient Boosting** - Xây dựng cây tuần tự để độ chính xác cao

### 5. Huấn Luyện & Điều Chỉnh Siêu Tham Số
- Chọn một hoặc nhiều thuật toán cùng lúc
- Điều chỉnh siêu tham số trực tiếp từ giao diện
- Bảng Hyperparameters cố định (sticky) không che các kết quả đánh giá
- So sánh hiệu suất của các thuật toán khác nhau

### 6. Đánh Giá & Trực Quan Hóa
- **Ma Trận Nhầm Lẫn** - Xem TP, TN, FP, FN
- **Chỉ Số Hiệu Suất**:
  - Độ Chính Xác (Accuracy)
  - Độ Chính Xác (Precision)
  - Độ Nhạy (Recall)
  - F1-Score
  - AUC-ROC
  - Độ Đặc Hiệu (Specificity)
- **Biểu Đồ Hiệu Suất**: ROC Curve, Precision-Recall Curve
- **So Sánh Thuật Toán**: Biểu đồ so sánh các thuật toán được chọn
- **Sơ Đồ Chi Tiết Kết Quả**: Phân tích sâu sắc về từng dự đoán

### 7. Giải Thích Mô Hình (XAI)
- **Trang Chi Tiết Mô Hình**: Giải thích chi tiết từng thuật toán
- **Công Thức Toán Học**: Công thức chính xác cho từng thuật toán
- **Nguyên Lý Hoạt Động**: Cách mỗi thuật toán hoạt động bước-bước
- **Ưu & Nhược Điểm**: Danh sách rõ ràng về ưu điểm và nhược điểm
- **Trường Hợp Sử Dụng**: Khi nào nên sử dụng mỗi thuật toán
- **Giải Thích Dự Đoán**: Tại sao mô hình đưa ra dự đoán cụ thể

### 8. Dự Đoán Mới
- Dự đoán từ một bản ghi dữ liệu mới
- Dự đoán hàng loạt từ tệp CSV
- Hiển thị mức tin cậy của dự đoán
- Giải thích đóng góp của từng đặc trưng

### 9. Lịch Sử Thí Nghiệm
- Lưu tất cả các thí nghiệm với metadata
- Theo dõi các hyperparameter được sử dụng
- So sánh các thí nghiệm khác nhau
- Xuất kết quả dưới dạng báo cáo

## Hỗ Trợ Docker

Ứng dụng được thiết kế hoàn toàn cho Docker. Xem `DOCKER.md` để biết chi tiết.

### Bắt Đầu Nhanh

```bash
# Clone repository
git clone <repo-url>
cd ddos-detection-lab

# Chạy bằng Docker Compose
docker-compose up --build

# Truy cập tại http://localhost:3000
```

## Cấu Trúc Dự Án

```
ddos-detection-lab/
├── app/
│   ├── page.tsx                      # Trang chính
│   ├── upload/page.tsx               # Tải lên dữ liệu
│   ├── preprocessing/page.tsx        # Tiền xử lý
│   ├── training/page.tsx             # Huấn luyện & điều chỉnh
│   ├── evaluation/page.tsx           # Đánh giá & trực quan hóa
│   ├── model-details/page.tsx        # Giải thích chi tiết mô hình
│   ├── feature-optimization/page.tsx # Tối ưu hóa đặc trưng
│   ├── explainability/page.tsx       # Khả năng giải thích
│   ├── prediction/page.tsx           # Dự đoán mới
│   └── experiments/page.tsx          # Lịch sử thí nghiệm
├── components/
│   ├── upload/                       # Thành phần tải lên
│   ├── preprocessing/                # Thành phần tiền xử lý
│   ├── training/                     # Thành phần huấn luyện
│   ├── evaluation/                   # Thành phần đánh giá
│   ├── model-details/                # Thành phần chi tiết mô hình
│   ├── feature-optimization/         # Thành phần tối ưu hóa đặc trưng
│   └── ui/                           # Thành phần UI shadcn
├── lib/
│   ├── vi.ts                         # Dịch Tiếng Việt toàn bộ
│   └── utils.ts                      # Hàm tiện ích
├── scripts/
│   └── ml_models.py                  # Mô hình học máy Python
├── public/                           # Tài liệu công khai
├── Dockerfile                        # Cấu hình Docker
├── docker-compose.yml                # Cấu hình Docker Compose
├── DOCKER.md                         # Hướng dẫn Docker
└── package.json
```

## Ngôn Ngữ

Ứng dụng được dịch **100% sang Tiếng Việt**, bao gồm:
- Tất cả các tên trang và tiêu đề
- Mô tả thuật toán
- Giải thích công thức
- Thông báo lỗi
- Cảnh báo và khuyến nghị
- Tất cả các nút bấm và nhãn

## Yêu Cầu Hệ Thống

- **CPU**: 2+ lõi
- **RAM**: 2GB tối thiểu, 4GB+ khuyến nghị
- **Disk**: 1GB+ cho các mô hình và tập dữ liệu
- **Docker**: Phiên bản 20.10+
- **Docker Compose**: Phiên bản 1.29+

## Công Nghệ Sử Dụng

### Frontend
- **Next.js 16** - React framework
- **React 19** - UI library
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI components
- **Recharts** - Data visualization
- **Lucide Icons** - Icons

### Backend
- **Node.js** - JavaScript runtime
- **Python 3** - ML algorithms
- **scikit-learn** - Machine learning library
- **pandas** - Data manipulation
- **NumPy** - Numerical computing
- **Matplotlib** - Visualization

## Hướng Dẫn Sử Dụng

### 1. Tải Lên Dữ Liệu
1. Truy cập trang "Tải Lên"
2. Tải lên tệp CSV chứa dữ liệu DDoS
3. Xem trước dữ liệu và thống kê
4. Nhấp "Tiếp tục" để tiến hành tiền xử lý

### 2. Tiền Xử Lý Dữ Liệu
1. Chạy quy trình tiền xử lý tự động hoặc tùy chỉnh
2. Xem các bước xử lý
3. Có tùy chọn tối ưu hóa đặc trưng
4. Tiếp tục đến huấn luyện

### 3. Lựa Chọn & Tối Ưu Hóa Đặc Trưng (Tùy chọn)
1. Phân tích tương quan và phương sai
2. Chạy tối ưu hóa tự động
3. Xem khuyến nghị
4. Chọn đặc trưng để sử dụng

### 4. Huấn Luyện Mô Hình
1. Chọn một hoặc nhiều thuật toán
2. Điều chỉnh siêu tham số nếu cần
3. Nhấp "Bắt Đầu Huấn Luyện"
4. Xem kết quả so sánh

### 5. Đánh Giá Mô Hình
1. Xem ma trận nhầm lẫn
2. Kiểm tra chỉ số hiệu suất
3. Xem các biểu đồ chi tiết
4. So sánh các thuật toán khác nhau

### 6. Hiểu Mô Hình
1. Truy cập "Chi Tiết Mô Hình"
2. Chọn thuật toán để xem chi tiết
3. Đọc giải thích nguyên lý
4. Xem công thức toán học

### 7. Dự Đoán
1. Nhập dữ liệu mới hoặc tải lên tệp
2. Xem dự đoán và mức tin cậy
3. Xem giải thích dự đoán
4. Lưu kết quả nếu cần

## Cách Cấu Trúc Của Ứng Dụng

### Trang Chính (Home)
- Giới thiệu về ứng dụng
- Danh sách các tính năng chính
- Nút bắt đầu

### Quy Trình Huấn Luyện (7 bước)
1. **Tải Lên** - Tải dữ liệu
2. **Tiền Xử Lý** - Làm sạch dữ liệu
3. **Tối Ưu Hóa** - Chọn đặc trưng tốt nhất
4. **Huấn Luyện** - Xây dựng và huấn luyện mô hình
5. **Đánh Giá** - Đánh giá hiệu suất
6. **Giải Thích** - Hiểu mô hình
7. **Dự Đoán** - Dự đoán dữ liệu mới

### Trang Bổ Sung
- **Lịch Sử Thí Nghiệm** - Quản lý các thí nghiệm đã lưu
- **Chi Tiết Mô Hình** - Giải thích chi tiết từng thuật toán

## Cảnh Báo & Khuyến Nghị

Ứng dụng cảnh báo người dùng về:
- **Dữ liệu Không Cân Bằng** - Khi một lớp chiếm số lượng lớn
- **Tương Quan Cao** - Giữa các đặc trưng (có thể lặp dư thừa)
- **Phương Sai Thấp** - Các đặc trưng không mang thông tin hữu ích
- **Rủi Ro Lỏng Thông Tin** - Khi thông tin đích có thể bị rò rỉ
- **Tăng Quá Tải** - Khi mô hình học quá khớp với dữ liệu huấn luyện

## Các Khuyến Nghị

- Sử dụng ít nhất 100 mẫu dữ liệu
- Đảm bảo dữ liệu cân bằng hoặc xử lý sự không cân bằng
- Chọn đặc trưng có độc lập cao
- Kiểm tra các siêu tham số mặc định trước khi thay đổi
- Sử dụng xác thực chéo để đánh giá mô hình

## Giấy Phép

MIT License - Sử dụng cho mục đích giáo dục

## Hỗ Trợ

Để báo cáo lỗi hoặc yêu cầu tính năng, vui lòng tạo một issue trên GitHub.

## Tác Giả

Xây dựng bằng ❤️ cho cộng đồng học máy Việt Nam
