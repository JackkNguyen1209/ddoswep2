export const vi = {
  // Navigation
  back: 'Quay lại',
  getStarted: 'Bắt đầu',
  
  // Home page
  homeTitle: 'Phát hiện DDoS bằng ML Nâng cao',
  homeDescription: 'Xây dựng, huấn luyện và đánh giá các mô hình học máy để phát hiện tấn công DDoS. Khám phá 10 thuật toán khác nhau, so sánh hiệu suất và hiểu hành vi mô hình thông qua AI có thể giải thích được.',
  startBuilding: 'Bắt đầu xây dựng',
  viewExperiments: 'Xem Thí nghiệm',
  
  datasetManagement: 'Quản lý Tập dữ liệu',
  datasetDesc: 'Tải lên và khám phá các tập dữ liệu tấn công DDoS với thống kê nâng cao và trực quan hóa',
  smartPreprocessing: 'Tiền xử lý Thông minh',
  preprocessingDesc: 'Làm sạch, mã hóa, chia tỷ lệ dữ liệu tự động và chia nhỏ train-test',
  mlAlgorithms: '10 Thuật toán ML',
  algorithmsDesc: 'ANN, SVM, Naive Bayes, Logistic Regression, KNN, Decision Tree, Random Forest...',
  modelEvaluation: 'Đánh giá Mô hình',
  evaluationDesc: 'Ma trận nhầm lẫn, Đường cong ROC, Đường cong precision-recall và các chỉ số toàn diện',
  
  readyExplore: 'Sẵn sàng khám phá?',
  uploadDataset: 'Tải lên Tập dữ liệu',
  uploadDatasetDesc: 'Tải lên tập dữ liệu DDoS của bạn và bắt đầu xây dựng các mô hình ML trong vài phút',
  
  // Upload page
  uploadPageTitle: 'Tải lên Tập dữ liệu',
  uploadPageStep: 'Bước 1 của 4: Tải lên Dữ liệu',
  dropFile: 'Thả tệp CSV của bạn ở đây',
  clickBrowse: 'hoặc nhấp để duyệt máy tính của bạn',
  csvFormat: 'Tập dữ liệu DDoS trong định dạng CSV',
  fileError: 'Vui lòng tải lên tệp CSV',
  parseError: 'Lỗi phân tích cú pháp tệp CSV. Vui lòng đảm bảo nó được định dạng đúng.',
  noValidFile: 'Vui lòng tải lên một tệp CSV hợp lệ trước',
  dataPreview: 'Xem trước Dữ liệu',
  nextSteps: 'Bước tiếp theo',
  proceedPreprocessing: 'Tiếp tục đến Tiền xử lý',
  uploadDifferent: 'Tải lên Tệp khác',
  
  // Data stats
  totalRows: 'Tổng cộng Hàng',
  totalColumns: 'Tổng cộng Cột',
  memoryUsage: 'Sử dụng Bộ nhớ',
  
  // Preprocessing page
  preprocessingTitle: 'Tiền xử lý Dữ liệu',
  preprocessingStep: 'Bước 2 của 4: Tiền xử lý & Chuẩn bị',
  preprocessingPageDesc: 'Áp dụng các kỹ thuật làm sạch và tiền xử lý cho dữ liệu của bạn',
  handleMissing: 'Xử lý Giá trị Thiếu',
  encodeCategorical: 'Mã hóa Đặc trưng Phân loại',
  scaleFeatures: 'Chia tỷ lệ Đặc trưng',
  trainTestSplit: 'Chia Train-Test',
  balanceData: 'Cân bằng Dữ liệu',
  removeOutliers: 'Loại bỏ Ngoại lệ',
  
  // Training page
  trainingPageTitle: 'Huấn luyện Mô hình',
  trainingPageStep: 'Bước 3 của 4: Chọn & Huấn luyện',
  selectAlgorithm: 'Chọn Thuật toán',
  selectAlgorithmDesc: 'Chọn từ 10 thuật toán ML tiên tiến được tối ưu hóa để phát hiện DDoS',
  selectMultiple: 'Chọn nhiều thuật toán để so sánh',
  startTraining: 'Bắt đầu Huấn luyện',
  trainingModel: 'Đang huấn luyện Mô hình...',
  trainingComplete: 'Huấn luyện Hoàn tất!',
  trainingCompleteDesc: 'Mô hình được huấn luyện và sẵn sàng để đánh giá',
  viewEvaluation: 'Xem Đánh giá',
  
  // Hyperparameters
  hyperparameters: 'Siêu tham số',
  configHyperparameters: 'Cấu hình Siêu tham số',
  tip: 'Mẹo',
  tipText: 'Bắt đầu bằng giá trị mặc định để có kết quả tốt nhất. Điều chỉnh thông số dựa trên hiệu suất xác thực.',
  
  // Algorithms
  artificialNeuralNetwork: 'Mạng Thần kinh Nhân tạo',
  annDesc: 'Mô hình học sâu với nhiều lớp',
  supportVectorMachine: 'Máy Vector Hỗ trợ',
  svmDesc: 'Thuật toán phân loại không gian cao',
  gaussianNaiveBayes: 'Gaussian Naive Bayes',
  gnbDesc: 'Bộ phân loại xác suất giả định phân phối chuẩn',
  multinomialNaiveBayes: 'Multinomial Naive Bayes',
  mnbDesc: 'Nhanh và hiệu quả cho các đặc trưng rời rạc',
  bernoulliNaiveBayes: 'Bernoulli Naive Bayes',
  bnbDesc: 'Cho các vectơ đặc trưng nhị phân',
  logisticRegression: 'Hồi quy Logistic',
  lrDesc: 'Phân loại tuyến tính với ước tính xác suất',
  kNearestNeighbors: 'K-Nearest Neighbors',
  knnDesc: 'Học dựa trên khoảng cách và trường hợp',
  decisionTree: 'Cây Quyết định',
  dtDesc: 'Mô hình dựa trên cây cho quyết định có thể diễn giải',
  randomForest: 'Rừng Ngẫu nhiên',
  rfDesc: 'Tập hợp các cây quyết định để dự đoán mạnh mẽ',
  gradientBoosting: 'Gradient Boosting',
  gbDesc: 'Học tập tập hợp nâng cao với các cây tuần tự',
  
  // Evaluation page
  evaluationPageTitle: 'Đánh giá Mô hình',
  evaluationPageStep: 'Bước 4 của 4: Chỉ số Hiệu suất',
  accuracy: 'Độ chính xác',
  precision: 'Độ chính xác',
  recall: 'Độ nhạy',
  f1Score: 'Điểm F1',
  aucRoc: 'AUC-ROC',
  specificity: 'Độ đặc hiệu',
  confusionMatrix: 'Ma trận Nhầm lẫn',
  performanceComparison: 'So sánh Hiệu suất',
  performanceSummary: 'Tóm tắt Hiệu suất Mô hình',
  performanceSummaryDesc: 'Mô hình của bạn đạt được {accuracy}% độ chính xác trên tập kiểm tra. Độ chính xác và độ nhạy cao cho thấy mô hình có thể đáng tin cậy phát hiện các tấn công DDoS trong khi giảm thiểu dương tính giả.',
  exploreExplainability: 'Khám phá Khả năng Giải thích Mô hình',
  saveCompareExperiments: 'Lưu & So sánh Thí nghiệm',
  
  // Comparison features
  algorithmComparison: 'So sánh Thuật toán',
  compareSelected: 'So sánh Các Thuật toán Được chọn',
  selectedAlgorithms: 'Thuật toán Được chọn',
  clearSelection: 'Xóa Lựa chọn',
  compareNow: 'So sánh Bây giờ',
  noAlgorithmSelected: 'Chọn ít nhất 2 thuật toán để so sánh',
  
  // Explainability page
  explainabilityPageTitle: 'Khả năng Giải thích Mô hình',
  explainabilityPageStep: 'Bước 5 của 6: Khám phá & Giải thích',
  featureImportance: 'Tầm quan trọng Đặc trưng',
  algorithmPrinciples: 'Nguyên lý Thuật toán',
  
  // Feature Selection page
  featureSelectionTitle: 'Lựa chọn Đặc trưng',
  featureSelectionStep: 'Bước 6 của 6: Tối ưu hóa Đặc trưng',
  
  // Prediction page
  predictionPageTitle: 'Dự đoán',
  predictionPageStep: 'Dự đoán Tấn công DDoS',
  
  // Experiments page
  experimentsPageTitle: 'Lịch sử Thí nghiệm',
  noExperiments: 'Không có thí nghiệm nào được lưu. Huấn luyện một mô hình để bắt đầu.',
  
  // Common buttons and labels
  selectAlgorithms: 'Chọn Thuật toán',
  selectAlgorithmsPlaceholder: 'Chọn một hoặc nhiều thuật toán...',
  hiddenLayers: 'Lớp Ẩn',
  neuronsPerLayer: 'Nơ-ron trên Mỗi Lớp',
  trainingEpochs: 'Kỷ nguyên Huấn luyện',
  batchSize: 'Kích thước Lô',
  kernelType: 'Loại Kernel',
  regularizationC: 'Chính quy hóa (C)',
  kernelCoefficient: 'Hệ số Kernel',
  usePriors: 'Sử dụng Ưu tiên',
  smoothingAlpha: 'Làm mịn (Alpha)',
  fitPriors: 'Lắp Ưu tiên',
  inverseRegularization: 'Chính quy hóa Nghịch đảo',
  solver: 'Bộ giải',
  maxIterations: 'Số lần Lặp Tối đa',
  numberOfNeighbors: 'Số lượng Hàng xóm (K)',
  distanceMetric: 'Chỉ số Khoảng cách',
  weights: 'Trọng số',
  maxDepth: 'Độ sâu Tối đa',
  minSamplesSplit: 'Mẫu Tối thiểu Chia',
  splitCriterion: 'Tiêu chí Chia',
  numberOfTrees: 'Số cây',
  numberOfBoosters: 'Số Booster',
  learningRate: 'Tốc độ Học',
  
  // Success messages
  successfulTraining: 'Huấn luyện thành công!',
  successfulPrediction: 'Dự đoán thành công!',
  
  // Error messages
  errorOccurred: 'Đã xảy ra lỗi',
  tryAgain: 'Thử lại',
  
  // Model Details Page
  modelDetails: 'Chi tiết Mô hình',
  algorithmExplanation: 'Giải thích Thuật toán',
  howAlgorithmWorks: 'Thuật toán hoạt động như thế nào?',
  mathematicalFormula: 'Công thức Toán học',
  advantages: 'Ưu điểm',
  disadvantages: 'Nhược điểm',
  useCases: 'Trường hợp Sử dụng',
  predictionExplanation: 'Giải thích Dự đoán',
  whyThisPrediction: 'Tại sao lại có dự đoán này?',
  featureContribution: 'Đóng góp Đặc trưng',
  confidenceScore: 'Điểm Tin cậy',
  modelAccuracy: 'Độ chính xác Mô hình',
  trainingTime: 'Thời gian Huấn luyện',
  testsetAccuracy: 'Độ chính xác Tập kiểm tra',
  
  // Detailed Algorithms
  annExplanation: 'Mạng Thần kinh Nhân tạo (ANN) là mô hình tính toán được lấy cảm hứng từ sinh học, bao gồm các nơ-ron tương tác với nhau qua các kết nối trọng số.',
  annFormula: 'y = σ(W·x + b) - Hàm kích hoạt σ áp dụng cho đầu vào có trọng số',
  annAdvantages: 'Khả năng học các mô hình phức tạp, xử lý dữ liệu phi tuyến',
  annDisadvantages: 'Yêu cầu dữ liệu lớn, dễ tăng quá tải (overfitting), khó diễn giải',
  annUseCase: 'Dự đoán chuỗi thời gian, nhận dạng hình ảnh, xử lý ngôn ngữ tự nhiên',
  
  svmExplanation: 'Máy Vector Hỗ trợ (SVM) tìm siêu phẳng tối ưu để phân chia dữ liệu thành các lớp khác nhau với lề tối đa.',
  svmFormula: 'f(x) = sign(Σ αᵢ·yᵢ·K(xᵢ,x) + b) - Hàm kernel K chiếu dữ liệu lên không gian cao hơn',
  svmAdvantages: 'Hoạt động tốt với dữ liệu có kích thước cao, mạnh mẽ chống lại ngoại lệ',
  svmDisadvantages: 'Chậm với tập dữ liệu lớn, khó điều chỉnh, khó hiểu quyết định',
  svmUseCase: 'Phân loại nhị phân, nhận dạng mô hình, phân loại văn bản',
  
  gnbExplanation: 'Gaussian Naive Bayes giả định các đặc trưng độc lập và tuân theo phân phối chuẩn. Sử dụng định lý Bayes để tính xác suất lớp.',
  gnbFormula: 'P(Class|Features) = P(Features|Class)·P(Class) / P(Features)',
  gnbAdvantages: 'Nhanh, hiệu quả, hoạt động tốt với dữ liệu nhỏ',
  gnbDisadvantages: 'Giả định độc lập đặc trưng không luôn đúng, độ chính xác thấp',
  gnbUseCase: 'Lọc thư rác, phân loại cảm xúc, phân loại tài liệu',
  
  mnbExplanation: 'Multinomial Naive Bayes được thiết kế cho dữ liệu rời rạc như tần suất từ. Thường được sử dụng trong xử lý ngôn ngữ tự nhiên.',
  mnbFormula: 'P(Class|Features) ∝ P(Class) · ∏ P(Featureᵢ|Class)ˣⁱ',
  mnbAdvantages: 'Hoạt động tốt với dữ liệu văn bản, tính toán nhanh',
  mnbDisadvantages: 'Yêu cầu dữ liệu rời rạc, độ chính xác có thể thấp',
  mnbUseCase: 'Phân loại tài liệu, gắn thẻ chủ đề, lọc thư rác',
  
  bnbExplanation: 'Bernoulli Naive Bayes hoạt động với các vectơ đặc trưng nhị phân (0/1). Mỗi đặc trưng đại diện cho sự hiện diện hoặc vắng mặt.',
  bnbFormula: 'P(Class|Features) ∝ P(Class) · ∏ P(Featureᵢ|Class)ˣⁱ · (1-P(Featureᵢ|Class))^(1-xᵢ)',
  bnbAdvantages: 'Hiệu quả với dữ liệu thưa, tính toán nhanh',
  bnbDisadvantages: 'Yêu cầu đặc trưng nhị phân, hiệu suất kém với dữ liệu liên tục',
  bnbUseCase: 'Lọc thư rác, phát hiện gian lận, phân loại tài liệu',
  
  lrExplanation: 'Hồi quy Logistic dự đoán xác suất sự kiện xảy ra bằng cách áp dụng hàm logistic lên một kết hợp tuyến tính của các đặc trưng.',
  lrFormula: 'P(y=1|x) = 1 / (1 + e^(-w·x - b)) - Hàm logistic sigmoid',
  lrAdvantages: 'Dễ hiểu và diễn giải, nhanh để huấn luyện, có thể xác định tầm quan trọng đặc trưng',
  lrDisadvantages: 'Chỉ để phân loại tuyến tính, không hoạt động tốt với dữ liệu phi tuyến',
  lrUseCase: 'Dự đoán khả năng xảy ra, phân loại nhị phân, phân tích rủi ro',
  
  knnExplanation: 'K-Nearest Neighbors phân loại dữ liệu mới dựa trên nhãn của K hàng xóm gần nhất. Bộ phân loại dựa trên trường hợp và lành mạnh.',
  knnFormula: 'Class(x) = mode(Class(xₙ)) - Nhãn phổ biến nhất trong K hàng xóm gần nhất',
  knnAdvantages: 'Đơn giản, không cần huấn luyện, hoạt động tốt với dữ liệu phi tuyến',
  knnDisadvantages: 'Chậm dự đoán, nhạy cảm với tỷ lệ đặc trưng, yêu cầu bộ nhớ lớn',
  knnUseCase: 'Phân loại hình ảnh, hệ thống khuyến nghị, nhận dạng hình ảnh',
  
  dtExplanation: 'Cây Quyết định phân chia dữ liệu thành các tập con nhỏ hơn thông qua một chuỗi các quyết định dựa trên các quy tắc if-then-else.',
  dtFormula: 'Class = if x₁ > threshold then left_subtree else right_subtree',
  dtAdvantages: 'Dễ hiểu và giải thích, không cần chuẩn hóa dữ liệu, xử lý dữ liệu phi tuyến',
  dtDisadvantages: 'Dễ tăng quá tải, nhạy cảm với dữ liệu không cân bằng',
  dtUseCase: 'Phân loại, hồi quy, phát hiện gian lận, chẩn đoán y tế',
  
  rfExplanation: 'Rừng Ngẫu nhiên là một tập hợp của nhiều cây quyết định được huấn luyện trên các tập dữ liệu con ngẫu nhiên và tính trung bình các dự đoán.',
  rfFormula: 'Class = mode(TreesClass) - Lớp được bầu chọn bởi đa số cây',
  rfAdvantages: 'Độ chính xác cao, xử lý dữ liệu không cân bằng tốt, có thể xác định tầm quan trọng đặc trưng',
  rfDisadvantages: 'Chậm hơn cây đơn, khó diễn giải, yêu cầu bộ nhớ lớn',
  rfUseCase: 'Phân loại, hồi quy, xác định tầm quan trọng đặc trưng, phát hiện gian lận',
  
  gbExplanation: 'Gradient Boosting xây dựng các cây tuần tự, mỗi cây sửa lỗi của những cây trước đó. Sử dụng gradient descent để tối ưu hóa hàm mất mát.',
  gbFormula: 'F(x) = F₀(x) + ν·Σ fₘ(x) - Tập hợp các cây với tốc độ học ν',
  gbAdvantages: 'Độ chính xác rất cao, xử lý dữ liệu không cân bằng, có thể xác định tầm quan trọng đặc trưng',
  gbDisadvantages: 'Phức tạp, dễ tăng quá tải nếu không điều chỉnh hợp lý, chậm',
  gbUseCase: 'Dự đoán, phân loại, xác định tầm quan trọng đặc trưng, cạnh tranh máy học',
  
  // Feature Selection Page
  featureSelectionPageTitle: 'Lựa chọn và Tối ưu hóa Đặc trưng',
  featureSelectionPageDesc: 'Phân tích các đặc trưng và tối ưu hóa bộ đặc trưng để cải thiện hiệu suất mô hình',
  selectTargetColumn: 'Chọn Cột Đích',
  targetColumn: 'Cột Đích',
  featureCorrelation: 'Tương quan Đặc trưng',
  featureVariance: 'Phương sai Đặc trưng',
  correlationMatrix: 'Ma trận Tương quan',
  varianceAnalysis: 'Phân tích Phương sai',
  optimalFeatures: 'Đặc trưng Tối ưu',
  selectMinFeatures: 'Chọn Số đặc trưng Tối thiểu',
  autoOptimize: 'Tối ưu hóa Tự động',
  runOptimization: 'Chạy Tối ưu hóa',
  optimizationResults: 'Kết quả Tối ưu hóa',
  recommendedFeatures: 'Đặc trưng Được đề xuất',
  accuracyImprovement: 'Cải thiện Độ chính xác',
  featureRanking: 'Xếp hạng Đặc trưng',
  
  // Upload Feature Selection
  uploadStep2: 'Bước 2: Chọn Đặc trưng & Đích',
  selectFeatures: 'Chọn các Đặc trưng để Sử dụng',
  selectTarget: 'Chọn Cột Đích cho Phân loại',
  selectedFeatures: 'Đặc trưng Đã chọn',
  targetVariable: 'Biến Đích',
  featureCount: 'Số lượng Đặc trưng Đã chọn',
  proceed: 'Tiếp tục',
  
  // Warnings and messages
  warningDataImbalance: 'Cảnh báo: Dữ liệu không cân bằng! Hãy cân bằng dữ liệu trong tiền xử lý.',
  warningHighCorrelation: 'Cảnh báo: Tương quan cao giữa các đặc trưng. Hãy xem xét loại bỏ các đặc trưng dư thừa.',
  warningLowVariance: 'Cảnh báo: Một số đặc trưng có phương sai thấp. Chúng có thể không mang thông tin hữu ích.',
  warningDataLeakage: 'Cảnh báo: Rủi ro lỏng thông tin! Đảm bảo không có thông tin đích trong các đặc trưng.',
  warningOverfitting: 'Cảnh báo: Mô hình có thể bị tăng quá tải. Độ chính xác huấn luyện >> kiểm tra.',
  
  // Recommendations
  recommendUseFeatures: 'Đề xuất sử dụng các đặc trưng này để đạt được độ chính xác tốt nhất',
  recommendRemoveFeatures: 'Đề xuất loại bỏ các đặc trưng sau vì chúng không mang lại thông tin hữu ích',
  recommendNormalizeData: 'Đề xuất chuẩn hóa dữ liệu vì các đặc trưng có quy mô khác nhau',
  recommendHandleImbalance: 'Đề xuất xử lý sự không cân bằng trong dữ liệu',
  
  // Charts and visualizations
  accuracyVsFeatures: 'Độ chính xác so với Số lượng Đặc trưng',
  precisionVsRecall: 'Độ chính xác so với Độ nhạy',
  rocCurve: 'Đường cong ROC',
  prCurve: 'Đường cong Precision-Recall',
  confidenceDistribution: 'Phân phối Mức tin cậy',
  predictedVsActual: 'Dự đoán so với Thực tế',
  residuals: 'Phần dư',
  
  // Data preprocessing details
  missingValueHandling: 'Xử lý Giá trị Thiếu',
  meanImputation: 'Kỹ thuật Điền trung bình cộng',
  medianImputation: 'Kỹ thuật Điền trung vị',
  forwardFill: 'Điền Phía trước (cho dữ liệu chuỗi thời gian)',
  backwardFill: 'Điền Phía sau (cho dữ liệu chuỗi thời gian)',
  dropMissing: 'Bỏ các hàng có giá trị thiếu',
  
  categoricalEncoding: 'Mã hóa Danh mục',
  oneHotEncoding: 'One-Hot Encoding',
  labelEncoding: 'Label Encoding',
  targetEncoding: 'Target Encoding',
  binaryEncoding: 'Binary Encoding',
  
  featureScaling: 'Chia tỷ lệ Đặc trưng',
  standardScaler: 'Chuẩn hóa (StandardScaler)',
  minMaxScaler: 'Chia tỷ lệ Min-Max',
  robustScaler: 'Bộ chia tỷ lệ mạnh mẽ',
  normalization: 'Chuẩn hóa L2',
  
  // Training details
  crossValidation: 'Xác thực Chéo',
  stratifiedKFold: 'Stratified K-Fold',
  timeSeriesSplit: 'Chia Chuỗi thời gian',
  shuffleSplit: 'Chia Xáo trộn',
  
  // Model persistence
  saveModel: 'Lưu Mô hình',
  loadModel: 'Tải Mô hình',
  exportResults: 'Xuất Kết quả',
  
  // API and system messages
  processingData: 'Đang xử lý dữ liệu...',
  trainingInProgress: 'Huấn luyện đang diễn ra... Vui lòng chờ',
  evaluatingModel: 'Đang đánh giá mô hình...',
  generatingReport: 'Đang tạo báo cáo...',
  completedSuccessfully: 'Hoàn tất thành công!',
}
