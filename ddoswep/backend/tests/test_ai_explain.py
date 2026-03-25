"""
Comprehensive test suite for ai_explain.py

Kịch bản kiểm thử:
  A. Unit tests – ai_local_explain
  B. Unit tests – ai_global_narrative
  C. Unit tests – ai_model_details
  D. Unit tests – _fallback_local
  E. Integration tests – run_local_explain (ml.py)
  F. Integration tests – run_global_explain (ml.py)
  G. Integration tests – run_details_vi (ml.py)
  H. Edge cases – lỗi API, API key thiếu, JSON xấu
"""

import json
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch, PropertyMock

# ── Path setup ────────────────────────────────────────────────────────────────
# Allow running from any directory
_BACKEND = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(_BACKEND))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_anthropic_response(text: str):
    """Build a mock anthropic Messages response containing one TextBlock."""
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.content = [block]
    return response


def _make_client_mock(text: str):
    """Return a mock Anthropic client whose messages.create() returns `text`."""
    client = MagicMock()
    client.messages.create.return_value = _make_anthropic_response(text)
    return client


def _make_contributions(n: int = 3):
    """Return a list of mock LocalContribution objects."""
    from app.schemas import LocalContribution
    contribs = []
    features = [
        ("syn_flag_count",  "Số cờ SYN",       150.0),
        ("flow_bytes/s",    "Tốc độ bytes/giây", 9999.5),
        ("packet_rate",     "Tốc độ gói tin",   1200.0),
        ("ack_flag_count",  "Số cờ ACK",         80.0),
        ("duration",        "Thời gian kết nối",  0.002),
    ]
    for i in range(n):
        orig, vi, val = features[i % len(features)]
        contribs.append(LocalContribution(
            feature_original=orig,
            feature_vi=vi,
            input_value=val,
            direction="toward_ddos" if i % 2 == 0 else "toward_benign",
            impact=round(0.9 - i * 0.15, 4),
            comparison={
                "DDoS":   {"mean": val * 1.1, "std": val * 0.1},
                "BENIGN": {"mean": val * 0.1, "std": val * 0.05},
            },
        ))
    return contribs


def _make_perturb_info(n: int = 3):
    return [
        {"perturb_label": "BENIGN", "perturb_mean": 2.5, "prob_delta_pct": 35.0 - i * 5}
        for i in range(n)
    ]


def _make_global_features(n: int = 5):
    from app.schemas import GlobalFeatureImportance
    names = ["syn_flag_count", "packet_rate", "flow_bytes/s", "ack_flag_count", "duration"]
    return [
        GlobalFeatureImportance(name=names[i % len(names)], score=round(0.4 - i * 0.06, 4))
        for i in range(n)
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# A. ai_local_explain – unit tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAiLocalExplain(unittest.TestCase):

    # ── A1: Trường hợp cơ bản – AI trả về text hợp lệ ──────────────────────
    def test_A1_returns_list_of_strings(self):
        """ai_local_explain trả về List[str] khi AI hoạt động."""
        ai_text = (
            "Lưu lượng mạng này được xác định là tấn công DDoS với xác suất 95.3%.\n"
            "Đặc trưng syn_flag_count có giá trị bất thường, cao hơn mức bình thường.\n"
            "Mức độ tin cậy rất cao, cần hành động ngay lập tức.\n"
            "Khuyến nghị: chặn IP nguồn và ghi nhận vào hệ thống SIEM."
        )
        mock_client = _make_client_mock(ai_text)
        contribs = _make_contributions(3)
        perturb = _make_perturb_info(3)

        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain(
                pred_label="DDoS",
                probability=0.953,
                top_contributions=contribs,
                ddos_label="DDoS",
                perturb_info=perturb,
                class_stats={},
            )

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        for line in result:
            self.assertIsInstance(line, str)
            self.assertTrue(line.strip())  # không có dòng rỗng

    # ── A2: Claude được gọi với đúng tham số ────────────────────────────────
    def test_A2_calls_claude_with_correct_params(self):
        """Verify messages.create được gọi với model và thinking đúng."""
        mock_client = _make_client_mock("Phân tích: bình thường.")
        contribs = _make_contributions(2)

        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            ai_local_explain(
                pred_label="BENIGN",
                probability=0.12,
                top_contributions=contribs,
                ddos_label="DDoS",
                perturb_info=[],
                class_stats={},
            )

        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args[1]
        self.assertEqual(call_kwargs["model"], "claude-opus-4-6")
        self.assertEqual(call_kwargs["thinking"], {"type": "adaptive"})
        self.assertIn("max_tokens", call_kwargs)
        # Prompt phải đề cập BENIGN / bình thường
        prompt_text = call_kwargs["messages"][0]["content"]
        self.assertIn("BENIGN", prompt_text)

    # ── A3: Trường hợp DDoS – prompt phải nói TẤN CÔNG ─────────────────────
    def test_A3_ddos_label_in_prompt(self):
        """Khi pred_label == ddos_label, prompt phải có 'TẤN CÔNG DDOS'."""
        mock_client = _make_client_mock("Tấn công phát hiện.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            ai_local_explain("DDoS", 0.99, _make_contributions(1), "DDoS", [], {})

        prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
        self.assertIn("TẤN CÔNG DDOS", prompt)

    # ── A4: Trường hợp BENIGN – prompt phải nói bình thường ─────────────────
    def test_A4_benign_label_in_prompt(self):
        """Khi pred_label != ddos_label, prompt phải có 'lưu lượng bình thường'."""
        mock_client = _make_client_mock("Bình thường.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            ai_local_explain("BENIGN", 0.05, _make_contributions(1), "DDoS", [], {})

        prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
        self.assertIn("lưu lượng bình thường", prompt)

    # ── A5: Không có ANTHROPIC_API_KEY → fallback ───────────────────────────
    def test_A5_no_api_key_returns_fallback(self):
        """Khi _client() trả về None, phải fallback về _fallback_local."""
        with patch("app.ai_explain._client", return_value=None):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain(
                "DDoS", 0.9, _make_contributions(2), "DDoS", _make_perturb_info(2), {}
            )
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        # Fallback phải đề cập TẤN CÔNG DDOS
        combined = " ".join(result)
        self.assertIn("TẤN CÔNG DDOS", combined)

    # ── A6: API key không set (env var) → fallback ──────────────────────────
    def test_A6_missing_env_var_triggers_fallback(self):
        """Khi ANTHROPIC_API_KEY không có trong env → _client() trả None."""
        env_without_key = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            # Cần reload module để _client() đọc lại env
            import importlib
            import app.ai_explain as mod
            importlib.reload(mod)
            client = mod._client()
        self.assertIsNone(client)

    # ── A7: API lỗi → fallback, không crash ─────────────────────────────────
    def test_A7_api_error_falls_back_gracefully(self):
        """Khi messages.create() ném exception, phải fallback không crash."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = RuntimeError("API timeout")
        contribs = _make_contributions(2)
        perturb = _make_perturb_info(2)

        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", 0.8, contribs, "DDoS", perturb, {})

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

    # ── A8: probability=None → không crash ──────────────────────────────────
    def test_A8_probability_none_no_crash(self):
        """probability=None không được gây crash."""
        mock_client = _make_client_mock("Phân tích không có xác suất.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", None, _make_contributions(1), "DDoS", [], {})
        self.assertIsInstance(result, list)

    # ── A9: top_contributions rỗng → không crash ────────────────────────────
    def test_A9_empty_contributions_no_crash(self):
        """Danh sách contributions rỗng không được gây crash."""
        mock_client = _make_client_mock("Không có đặc trưng nào nổi bật.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", 0.7, [], "DDoS", [], {})
        self.assertIsInstance(result, list)

    # ── A10: Kết quả không phải template cứng ───────────────────────────────
    def test_A10_result_is_not_hardcoded_template(self):
        """Kết quả phải là text từ AI, không phải chuỗi template cứng."""
        ai_text = "Đây là phân tích AI hoàn toàn động: lưu lượng SYN flood điển hình."
        mock_client = _make_client_mock(ai_text)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", 0.95, _make_contributions(3), "DDoS",
                                       _make_perturb_info(3), {})
        combined = "\n".join(result)
        self.assertIn("SYN flood", combined)  # nội dung AI thật sự hiện diện


# ═══════════════════════════════════════════════════════════════════════════════
# B. ai_global_narrative – unit tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAiGlobalNarrative(unittest.TestCase):

    def test_B1_returns_string(self):
        """ai_global_narrative trả về str."""
        mock_client = _make_client_mock("Các đặc trưng lưu lượng mạng quan trọng nhất...")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            result = ai_global_narrative("Random Forest", _make_global_features(5), "feature_importances")
        self.assertIsInstance(result, str)
        self.assertTrue(result.strip())

    def test_B2_contains_algorithm_in_prompt(self):
        """Prompt phải chứa tên thuật toán."""
        mock_client = _make_client_mock("Narrative text.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            ai_global_narrative("XGBoost", _make_global_features(3), "permutation")
        prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
        self.assertIn("XGBoost", prompt)
        self.assertIn("permutation", prompt)

    def test_B3_contains_feature_names_in_prompt(self):
        """Prompt phải liệt kê các feature names."""
        mock_client = _make_client_mock("Feature analysis.")
        features = _make_global_features(3)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            ai_global_narrative("SVM", features, "coef")
        prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
        self.assertIn(features[0].name, prompt)

    def test_B4_no_api_key_returns_fallback_string(self):
        """Không có API key → trả về chuỗi fallback (không phải None, không crash)."""
        with patch("app.ai_explain._client", return_value=None):
            from app.ai_explain import ai_global_narrative
            result = ai_global_narrative("RF", _make_global_features(3), "permutation")
        self.assertIsInstance(result, str)
        self.assertTrue(result.strip())

    def test_B5_api_error_returns_fallback(self):
        """Lỗi API → fallback string, không crash."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = ConnectionError("network error")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            result = ai_global_narrative("DT", _make_global_features(2), "feature_importances")
        self.assertIsInstance(result, str)
        self.assertTrue(result.strip())

    def test_B6_result_is_not_old_english_template(self):
        """Kết quả không phải chuỗi 'Computed from ...' kiểu cũ."""
        ai_text = "Đặc trưng syn_flag_count chiếm ưu thế với 45% tầm quan trọng."
        mock_client = _make_client_mock(ai_text)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            result = ai_global_narrative("RF", _make_global_features(5), "feature_importances")
        self.assertNotIn("Computed from", result)
        self.assertIn("syn_flag_count", result)  # nội dung AI thật


# ═══════════════════════════════════════════════════════════════════════════════
# C. ai_model_details – unit tests
# ═══════════════════════════════════════════════════════════════════════════════

VALID_AI_DETAILS = {
    "sections": [
        {
            "heading": "Nguyên lý hoạt động",
            "paragraphs": ["Random Forest xây dựng nhiều cây quyết định song song."],
            "bullets": ["Bootstrap sampling", "Feature subsampling", "Majority voting"],
        },
        {
            "heading": "Ưu điểm trong phát hiện DDoS",
            "paragraphs": [],
            "bullets": ["Robust với imbalanced data", "Feature importance sẵn có"],
        },
        {
            "heading": "Phân tích cấu hình hiện tại",
            "paragraphs": ["100 cây với max_depth=10 phù hợp cho dataset mạng lớn."],
            "bullets": [],
        },
    ],
    "how_used_in_pipeline": ["Bước 1: Chuẩn hóa dữ liệu", "Bước 2: Xây dựng 100 cây", "Bước 3: Bầu chọn"],
    "limitations_for_ddos": ["Chậm hơn với số cây lớn", "Khó giải thích từng quyết định"],
    "hyperparams_meanings": {
        "n_estimators": "Số lượng cây quyết định trong rừng",
        "max_depth": "Độ sâu tối đa của mỗi cây",
    },
}


class TestAiModelDetails(unittest.TestCase):

    def test_C1_returns_dict_on_success(self):
        """ai_model_details trả về dict hợp lệ khi AI thành công."""
        mock_client = _make_client_mock(json.dumps(VALID_AI_DETAILS))
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {"n_estimators": 100, "max_depth": 10})
        self.assertIsInstance(result, dict)
        self.assertIn("sections", result)
        self.assertIn("how_used_in_pipeline", result)
        self.assertIn("limitations_for_ddos", result)
        self.assertIn("hyperparams_meanings", result)

    def test_C2_sections_structure(self):
        """Mỗi section phải có heading, paragraphs, bullets."""
        mock_client = _make_client_mock(json.dumps(VALID_AI_DETAILS))
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        for sec in result["sections"]:
            self.assertIn("heading", sec)
            self.assertIn("paragraphs", sec)
            self.assertIn("bullets", sec)

    def test_C3_handles_markdown_fenced_json(self):
        """Xử lý đúng khi Claude trả về JSON trong markdown code fence."""
        wrapped = "```json\n" + json.dumps(VALID_AI_DETAILS) + "\n```"
        mock_client = _make_client_mock(wrapped)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        self.assertIsInstance(result, dict)
        self.assertIn("sections", result)

    def test_C4_handles_backtick_fence_without_json_label(self):
        """Xử lý đúng với ``` không có nhãn 'json'."""
        wrapped = "```\n" + json.dumps(VALID_AI_DETAILS) + "\n```"
        mock_client = _make_client_mock(wrapped)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        self.assertIsInstance(result, dict)

    def test_C5_returns_none_when_no_api_key(self):
        """Không có API key → trả về None (caller dùng fallback template)."""
        with patch("app.ai_explain._client", return_value=None):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        self.assertIsNone(result)

    def test_C6_returns_none_on_api_error(self):
        """Lỗi API → trả về None (không crash)."""
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("rate limit")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        self.assertIsNone(result)

    def test_C7_returns_none_on_invalid_json(self):
        """Claude trả JSON lỗi → trả None, không crash."""
        mock_client = _make_client_mock("{ này không phải JSON hợp lệ }")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {})
        self.assertIsNone(result)

    def test_C8_hyperparams_in_prompt(self):
        """Prompt phải chứa tên và giá trị hyperparams."""
        mock_client = _make_client_mock(json.dumps(VALID_AI_DETAILS))
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            ai_model_details("rf", "Random Forest", {"n_estimators": 100})
        prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
        self.assertIn("n_estimators", prompt)
        self.assertIn("100", prompt)

    def test_C9_all_algorithms_build_different_prompts(self):
        """Mỗi thuật toán phải có prompt khác nhau (chứa tên algo)."""
        for algo, name in [("svm", "SVM"), ("ann", "ANN"), ("knn", "KNN"), ("dt", "Decision Tree")]:
            mock_client = _make_client_mock(json.dumps(VALID_AI_DETAILS))
            with patch("app.ai_explain._client", return_value=mock_client):
                from app.ai_explain import ai_model_details
                ai_model_details(algo, name, {})
            prompt = mock_client.messages.create.call_args[1]["messages"][0]["content"]
            self.assertIn(name, prompt, f"Tên algo '{name}' phải có trong prompt")

    def test_C10_hyperparams_meanings_format(self):
        """hyperparams_meanings phải là dict str→str."""
        mock_client = _make_client_mock(json.dumps(VALID_AI_DETAILS))
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {"n_estimators": 100})
        meanings = result["hyperparams_meanings"]
        self.assertIsInstance(meanings, dict)
        for k, v in meanings.items():
            self.assertIsInstance(k, str)
            self.assertIsInstance(v, str)


# ═══════════════════════════════════════════════════════════════════════════════
# D. _fallback_local – unit tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestFallbackLocal(unittest.TestCase):

    def test_D1_ddos_label_in_output(self):
        """Fallback phải nêu 'TẤN CÔNG DDOS' khi là tấn công."""
        from app.ai_explain import _fallback_local
        result = _fallback_local("DDoS", 0.95, _make_contributions(2), "DDoS", _make_perturb_info(2))
        combined = "\n".join(result)
        self.assertIn("TẤN CÔNG DDOS", combined)

    def test_D2_benign_label_in_output(self):
        """Fallback phải nêu 'BÌNH THƯỜNG' khi là lưu lượng bình thường."""
        from app.ai_explain import _fallback_local
        result = _fallback_local("BENIGN", 0.05, _make_contributions(2), "DDoS", [])
        combined = "\n".join(result)
        self.assertIn("BÌNH THƯỜNG", combined)

    def test_D3_probability_shown_when_present(self):
        """Fallback phải hiển thị xác suất khi có."""
        from app.ai_explain import _fallback_local
        result = _fallback_local("DDoS", 0.876, _make_contributions(1), "DDoS", [])
        combined = "\n".join(result)
        self.assertIn("87.6%", combined)

    def test_D4_no_crash_when_probability_none(self):
        """Fallback không crash khi probability=None."""
        from app.ai_explain import _fallback_local
        result = _fallback_local("DDoS", None, _make_contributions(1), "DDoS", [])
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

    def test_D5_lists_top_features(self):
        """Fallback phải liệt kê các feature trong output."""
        from app.ai_explain import _fallback_local
        contribs = _make_contributions(3)
        result = _fallback_local("DDoS", 0.9, contribs, "DDoS", _make_perturb_info(3))
        combined = "\n".join(result)
        self.assertIn(contribs[0].feature_vi, combined)

    def test_D6_perturb_pct_shown(self):
        """Fallback phải hiển thị % thay đổi xác suất từ perturb_info."""
        from app.ai_explain import _fallback_local
        result = _fallback_local("DDoS", 0.9, _make_contributions(2), "DDoS", _make_perturb_info(2))
        combined = "\n".join(result)
        self.assertIn("%", combined)


# ═══════════════════════════════════════════════════════════════════════════════
# E. run_local_explain integration – ml.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestRunLocalExplainIntegration(unittest.TestCase):
    """Kiểm tra run_local_explain trong ml.py gọi ai_local_explain đúng cách."""

    def test_E1_ai_local_explain_is_called(self):
        """run_local_explain phải gọi ai_local_explain (không gọi _generate_vietnamese_explanation)."""
        from app import ml

        ai_lines = ["AI phân tích: đây là tấn công DDoS.", "Khuyến nghị: chặn ngay IP nguồn."]

        with patch.object(ml, "ai_local_explain", return_value=ai_lines) as mock_ai, \
             patch.object(ml, "load_model") as mock_load_model, \
             patch.object(ml, "load_model_meta") as mock_load_meta, \
             patch.object(ml, "run_global_explain") as mock_global:

            # Setup mock model
            import numpy as np

            pipeline = MagicMock()
            pipeline.predict.return_value = np.array([1])
            pipeline.predict_proba.return_value = np.array([[0.05, 0.95]])
            # Classifier: configure coef_ as numpy array (triggers logistic_coef branch)
            # coef_ shape (1, 2) matches n_transformed=2 and x_transformed length=2
            clf_mock = MagicMock()
            clf_mock.coef_ = np.array([[0.7, 0.3]])
            pipeline.named_steps = {"preprocessor": MagicMock(), "classifier": clf_mock}
            pipeline.named_steps["preprocessor"].transform.return_value = np.array([[1.0, 2.0]])

            le = MagicMock()
            le.inverse_transform.return_value = ["DDoS"]
            le.classes_ = ["BENIGN", "DDoS"]

            mock_load_model.return_value = {
                "pipeline": pipeline,
                "label_encoder": le,
                "target_column": "label",
                "raw_feature_names": ["syn_flag_count", "packet_rate"],
            }
            mock_load_meta.return_value = {
                "model_id": "test_model",
                "algorithm": "rf",
                "algorithm_name": "Random Forest",
                "raw_feature_names": ["syn_flag_count", "packet_rate"],
                "numeric_cols": ["syn_flag_count", "packet_rate"],
                "categorical_cols": [],
                "categorical_encoding": "onehot",
                "scaling": "standard",
                "missing_strategy": "mean",
                "raw_to_transformed_idx": {"syn_flag_count": [0], "packet_rate": [1]},
                "n_transformed": 2,
                "label_classes": ["BENIGN", "DDoS"],
                "class_stats": {
                    "BENIGN": {"syn_flag_count": {"mean": 2.0, "std": 1.0}},
                    "DDoS":   {"syn_flag_count": {"mean": 150.0, "std": 20.0}},
                },
                "preprocess_id": None,
                "selection_id": None,
            }

            result = ml.run_local_explain(
                "test_model",
                {"syn_flag_count": 150.0, "packet_rate": 1200.0},
            )

        mock_ai.assert_called_once()
        self.assertEqual(result.vietnamese_explanation, ai_lines)

    def test_E2_response_schema_valid(self):
        """run_local_explain trả về LocalExplainResponse hợp lệ."""
        from app import ml
        from app.schemas import LocalExplainResponse

        ai_lines = ["Phân tích AI.", "Kết luận: tấn công."]

        with patch.object(ml, "ai_local_explain", return_value=ai_lines), \
             patch.object(ml, "load_model") as mock_load_model, \
             patch.object(ml, "load_model_meta") as mock_load_meta:

            import numpy as np
            clf_mock2 = MagicMock()
            clf_mock2.coef_ = np.array([[0.8]])  # shape (1, 1) matches n_transformed=1
            pipeline = MagicMock()
            pipeline.predict.return_value = np.array([1])
            pipeline.predict_proba.return_value = np.array([[0.1, 0.9]])
            pipeline.named_steps = {"preprocessor": MagicMock(), "classifier": clf_mock2}
            pipeline.named_steps["preprocessor"].transform.return_value = np.array([[1.0]])

            le = MagicMock()
            le.inverse_transform.return_value = ["DDoS"]
            le.classes_ = ["BENIGN", "DDoS"]

            mock_load_model.return_value = {
                "pipeline": pipeline, "label_encoder": le,
                "target_column": "label", "raw_feature_names": ["syn_flag_count"],
            }
            mock_load_meta.return_value = {
                "model_id": "m1", "algorithm": "rf", "algorithm_name": "RF",
                "raw_feature_names": ["syn_flag_count"],
                "numeric_cols": ["syn_flag_count"], "categorical_cols": [],
                "categorical_encoding": "onehot", "scaling": "standard",
                "missing_strategy": "mean",
                "raw_to_transformed_idx": {"syn_flag_count": [0]},
                "n_transformed": 1, "label_classes": ["BENIGN", "DDoS"],
                "class_stats": {"DDoS": {"syn_flag_count": {"mean": 150.0, "std": 20.0}}},
                "preprocess_id": None, "selection_id": None,
            }

            result = ml.run_local_explain("m1", {"syn_flag_count": 150.0})

        self.assertIsInstance(result, LocalExplainResponse)
        self.assertIsInstance(result.vietnamese_explanation, list)
        self.assertEqual(result.vietnamese_explanation, ai_lines)
        self.assertIsNotNone(result.prediction)


# ═══════════════════════════════════════════════════════════════════════════════
# F. run_global_explain integration – ml.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestRunGlobalExplainIntegration(unittest.TestCase):

    def _make_meta_with_global(self, has_cache: bool = False):
        meta = {
            "model_id": "test_model",
            "algorithm": "rf",
            "algorithm_name": "Random Forest",
            "raw_feature_names": ["syn_flag_count", "packet_rate"],
            "numeric_cols": ["syn_flag_count", "packet_rate"],
            "raw_to_transformed_idx": {"syn_flag_count": [0], "packet_rate": [1]},
        }
        if has_cache:
            meta["global_importance"] = {
                "method": "feature_importances",
                "top_features": [
                    {"name": "syn_flag_count", "score": 0.45},
                    {"name": "packet_rate",    "score": 0.30},
                ],
                "notes": "AI đã phân tích: syn_flag_count là quan trọng nhất.",
            }
        return meta

    def test_F1_ai_global_narrative_called_for_new_model(self):
        """Với model chưa cache, ai_global_narrative phải được gọi."""
        from app import ml
        import numpy as np

        ai_narrative = "Phân tích AI: syn_flag_count chiếm 45% tầm quan trọng."

        pipeline = MagicMock()
        clf = MagicMock()
        clf.feature_importances_ = np.array([0.45, 0.30])
        pipeline.named_steps = {"classifier": clf}

        with patch.object(ml, "ai_global_narrative", return_value=ai_narrative) as mock_narr, \
             patch.object(ml, "load_model") as mock_load_model, \
             patch.object(ml, "load_model_meta", return_value=self._make_meta_with_global(False)), \
             patch.object(ml, "load_test_sample", return_value=(None, None)), \
             patch.object(ml, "save_model_meta"):

            mock_load_model.return_value = {
                "pipeline": pipeline, "label_encoder": None,
                "raw_feature_names": ["syn_flag_count", "packet_rate"],
            }

            result = ml.run_global_explain("test_model")

        mock_narr.assert_called_once()
        self.assertEqual(result.notes, ai_narrative)

    def test_F2_notes_contains_ai_content(self):
        """notes trong response phải là text từ AI, không phải 'Computed from...'."""
        from app import ml
        import numpy as np

        pipeline = MagicMock()
        clf = MagicMock()
        clf.feature_importances_ = np.array([0.45, 0.30])
        pipeline.named_steps = {"classifier": clf}

        ai_text = "Đặc trưng syn_flag_count là quan trọng nhất trong phát hiện DDoS."

        with patch.object(ml, "ai_global_narrative", return_value=ai_text), \
             patch.object(ml, "load_model") as mock_load, \
             patch.object(ml, "load_model_meta", return_value=self._make_meta_with_global(False)), \
             patch.object(ml, "load_test_sample", return_value=(None, None)), \
             patch.object(ml, "save_model_meta"):

            mock_load.return_value = {
                "pipeline": pipeline, "label_encoder": None,
                "raw_feature_names": ["syn_flag_count", "packet_rate"],
            }
            result = ml.run_global_explain("test_model")

        self.assertNotIn("Computed from", result.notes)
        self.assertIn("syn_flag_count", result.notes)

    def test_F3_cached_result_served_without_new_ai_call(self):
        """Nếu đã cache với AI notes (không phải 'Computed from'), không gọi ai_global_narrative lại."""
        from app import ml

        with patch.object(ml, "ai_global_narrative") as mock_narr, \
             patch.object(ml, "load_model_meta", return_value=self._make_meta_with_global(True)), \
             patch.object(ml, "load_model"):

            result = ml.run_global_explain("test_model")

        mock_narr.assert_not_called()
        self.assertIn("AI đã phân tích", result.notes)

    def test_F4_old_english_cache_triggers_ai_upgrade(self):
        """Cache cũ với notes 'Computed from...' phải được upgrade bằng AI."""
        from app import ml

        meta_old_cache = {
            "model_id": "test_model",
            "algorithm": "rf",
            "algorithm_name": "Random Forest",
            "raw_feature_names": ["syn_flag_count", "packet_rate"],
            "global_importance": {
                "method": "feature_importances",
                "top_features": [
                    {"name": "syn_flag_count", "score": 0.45},
                    {"name": "packet_rate",    "score": 0.30},
                ],
                "notes": "Computed from feature_importances; top 2 raw features.",
            },
        }
        ai_upgraded = "AI phân tích: syn_flag_count là đặc trưng quan trọng nhất."

        with patch.object(ml, "ai_global_narrative", return_value=ai_upgraded) as mock_narr, \
             patch.object(ml, "load_model_meta", return_value=meta_old_cache), \
             patch.object(ml, "save_model_meta") as mock_save:

            result = ml.run_global_explain("test_model")

        # AI phải được gọi để upgrade
        mock_narr.assert_called_once()
        # Cache phải được lưu lại
        mock_save.assert_called_once()
        # Kết quả phải là AI content, không phải template cũ
        self.assertEqual(result.notes, ai_upgraded)
        self.assertNotIn("Computed from", result.notes)

    def test_F5_empty_notes_cache_triggers_ai_upgrade(self):
        """Cache với notes rỗng cũng phải được upgrade bằng AI."""
        from app import ml

        meta_empty_notes = {
            "model_id": "test_model",
            "algorithm": "rf",
            "algorithm_name": "Random Forest",
            "raw_feature_names": ["syn_flag_count"],
            "global_importance": {
                "method": "feature_importances",
                "top_features": [{"name": "syn_flag_count", "score": 1.0}],
                "notes": "",
            },
        }
        ai_new = "AI: syn_flag_count duy nhất nhưng rất quan trọng."

        with patch.object(ml, "ai_global_narrative", return_value=ai_new) as mock_narr, \
             patch.object(ml, "load_model_meta", return_value=meta_empty_notes), \
             patch.object(ml, "save_model_meta"):

            result = ml.run_global_explain("test_model")

        mock_narr.assert_called_once()
        self.assertEqual(result.notes, ai_new)


# ═══════════════════════════════════════════════════════════════════════════════
# G. run_details_vi integration – ml.py
# ═══════════════════════════════════════════════════════════════════════════════

class TestRunDetailsViIntegration(unittest.TestCase):

    def _base_meta(self):
        return {
            "model_id": "m1",
            "algorithm": "rf",
            "algorithm_name": "Random Forest",
            "hyperparams": {"n_estimators": 100, "max_depth": 10},
        }

    def test_G1_ai_model_details_called_when_no_cache(self):
        """Khi chưa cache, ai_model_details phải được gọi."""
        from app import ml

        with patch.object(ml, "ai_model_details", return_value=VALID_AI_DETAILS) as mock_ai, \
             patch.object(ml, "load_model_meta", return_value=self._base_meta()), \
             patch.object(ml, "save_model_meta"):

            ml.run_details_vi("m1")

        mock_ai.assert_called_once_with("rf", "Random Forest", {"n_estimators": 100, "max_depth": 10})

    def test_G2_sections_from_ai_not_template(self):
        """sections phải đến từ AI, không phải _ALGO_DETAILS_VI."""
        from app import ml
        from app.schemas import ModelDetailsVI

        with patch.object(ml, "ai_model_details", return_value=VALID_AI_DETAILS), \
             patch.object(ml, "load_model_meta", return_value=self._base_meta()), \
             patch.object(ml, "save_model_meta"):

            result = ml.run_details_vi("m1")

        self.assertIsInstance(result, ModelDetailsVI)
        headings = [s.heading for s in result.sections]
        self.assertIn("Nguyên lý hoạt động", headings)
        self.assertIn("Ưu điểm trong phát hiện DDoS", headings)
        self.assertIn("Phân tích cấu hình hiện tại", headings)

    def test_G3_hyperparams_meanings_from_ai(self):
        """meaning_vi trong hyperparams_table phải đến từ AI."""
        from app import ml

        with patch.object(ml, "ai_model_details", return_value=VALID_AI_DETAILS), \
             patch.object(ml, "load_model_meta", return_value=self._base_meta()), \
             patch.object(ml, "save_model_meta"):

            result = ml.run_details_vi("m1")

        hp_map = {hp.name: hp.meaning_vi for hp in result.hyperparams_table}
        self.assertEqual(hp_map["n_estimators"], "Số lượng cây quyết định trong rừng")
        self.assertEqual(hp_map["max_depth"],    "Độ sâu tối đa của mỗi cây")

    def test_G4_ai_result_cached_in_meta(self):
        """Sau khi AI thành công, kết quả phải được lưu vào model meta."""
        from app import ml

        with patch.object(ml, "ai_model_details", return_value=VALID_AI_DETAILS), \
             patch.object(ml, "load_model_meta", return_value=self._base_meta()), \
             patch.object(ml, "save_model_meta") as mock_save:

            ml.run_details_vi("m1")

        mock_save.assert_called_once()
        saved_meta = mock_save.call_args[0][1]
        self.assertIn("ai_details_vi", saved_meta)
        self.assertEqual(saved_meta["ai_details_vi"], VALID_AI_DETAILS)

    def test_G5_cached_ai_not_called_again(self):
        """Nếu đã cache ai_details_vi, không gọi ai_model_details lại."""
        from app import ml

        meta_with_cache = {**self._base_meta(), "ai_details_vi": VALID_AI_DETAILS}

        with patch.object(ml, "ai_model_details") as mock_ai, \
             patch.object(ml, "load_model_meta", return_value=meta_with_cache), \
             patch.object(ml, "save_model_meta"):

            result = ml.run_details_vi("m1")

        mock_ai.assert_not_called()

    def test_G6_fallback_to_template_when_ai_returns_none(self):
        """Khi ai_model_details trả None (no API key), fallback về _ALGO_DETAILS_VI."""
        from app import ml
        from app.schemas import ModelDetailsVI

        with patch.object(ml, "ai_model_details", return_value=None), \
             patch.object(ml, "load_model_meta", return_value=self._base_meta()), \
             patch.object(ml, "save_model_meta"):

            result = ml.run_details_vi("m1")

        self.assertIsInstance(result, ModelDetailsVI)
        self.assertGreater(len(result.sections), 0)

    def test_G7_all_algorithms_fallback_correctly(self):
        """Tất cả 10 thuật toán phải fallback đúng khi AI không khả dụng."""
        from app import ml

        algos = ["logistic", "rf", "dt", "ann", "svm", "knn",
                 "nb-gaussian", "nb-multinomial", "nb-bernoulli", "xgb"]

        for algo in algos:
            meta = {
                "model_id": "m", "algorithm": algo,
                "algorithm_name": algo.upper(), "hyperparams": {},
            }
            with patch.object(ml, "ai_model_details", return_value=None), \
                 patch.object(ml, "load_model_meta", return_value=meta), \
                 patch.object(ml, "save_model_meta"):
                try:
                    result = ml.run_details_vi("m")
                    self.assertIsNotNone(result, f"Fallback cho {algo} phải trả kết quả")
                except Exception as e:
                    self.fail(f"run_details_vi crash với algo={algo}: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# H. Edge cases
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases(unittest.TestCase):

    def test_H1_ai_local_explain_strips_blank_lines(self):
        """Dòng trống trong AI response phải bị loại bỏ."""
        ai_text = "\n\nPhân tích đầu tiên.\n\n\nPhân tích thứ hai.\n\n"
        mock_client = _make_client_mock(ai_text)
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", 0.9, _make_contributions(1), "DDoS", [], {})
        for line in result:
            self.assertTrue(line.strip(), "Không được có dòng rỗng trong kết quả")

    def test_H2_ai_global_narrative_strips_whitespace(self):
        """Kết quả ai_global_narrative phải được strip."""
        mock_client = _make_client_mock("  \n  Phân tích đặc trưng.  \n  ")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            result = ai_global_narrative("RF", _make_global_features(1), "feature_importances")
        self.assertEqual(result, result.strip())

    def test_H3_ai_model_details_handles_partial_json(self):
        """JSON thiếu trường 'hyperparams_meanings' không crash."""
        partial = {
            "sections": [{"heading": "Test", "paragraphs": [], "bullets": []}],
            "how_used_in_pipeline": ["Bước 1"],
            "limitations_for_ddos": ["Giới hạn 1"],
            # "hyperparams_meanings" bị thiếu
        }
        mock_client = _make_client_mock(json.dumps(partial))
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_model_details
            result = ai_model_details("rf", "Random Forest", {"n_estimators": 100})
        self.assertIsInstance(result, dict)
        # Caller phải xử lý thiếu key với .get()
        self.assertEqual(result.get("hyperparams_meanings", {}), {})

    def test_H4_no_thinking_blocks_in_result(self):
        """Thinking blocks từ Claude không được lẫn vào kết quả text."""
        thinking_block = MagicMock()
        thinking_block.type = "thinking"
        thinking_block.thinking = "<suy nghĩ nội bộ không nên hiển thị>"
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Phân tích thực sự: đây là DDoS."

        mock_client = MagicMock()
        mock_client.messages.create.return_value = MagicMock(content=[thinking_block, text_block])

        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            result = ai_local_explain("DDoS", 0.9, _make_contributions(1), "DDoS", [], {})

        combined = "\n".join(result)
        self.assertNotIn("suy nghĩ nội bộ", combined)  # thinking block bị lọc
        self.assertIn("Phân tích thực sự", combined)   # text block được giữ

    def test_H5_multiple_text_blocks_only_first_used(self):
        """Khi Claude trả về nhiều text block, _call lấy block đầu tiên."""
        block1 = MagicMock(); block1.type = "text"; block1.text = "Block 1."
        block2 = MagicMock(); block2.type = "text"; block2.text = "Block 2."
        mock_client = MagicMock()
        mock_client.messages.create.return_value = MagicMock(content=[block1, block2])

        with patch("app.ai_explain._client", return_value=mock_client):
            from app import ai_explain
            result = ai_explain._call(mock_client, "test prompt")

        self.assertEqual(result, "Block 1.")

    def test_H6_thinking_type_adaptive_not_budget(self):
        """Phải dùng adaptive thinking, không phải budget_tokens (deprecated)."""
        mock_client = _make_client_mock("OK.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_global_narrative
            ai_global_narrative("RF", _make_global_features(2), "permutation")

        call_kwargs = mock_client.messages.create.call_args[1]
        thinking_cfg = call_kwargs.get("thinking", {})
        self.assertEqual(thinking_cfg.get("type"), "adaptive")
        self.assertNotIn("budget_tokens", thinking_cfg)

    def test_H7_model_is_claude_opus_4_6(self):
        """Phải dùng đúng model claude-opus-4-6."""
        mock_client = _make_client_mock("OK.")
        with patch("app.ai_explain._client", return_value=mock_client):
            from app.ai_explain import ai_local_explain
            ai_local_explain("DDoS", 0.9, _make_contributions(1), "DDoS", [], {})

        model_used = mock_client.messages.create.call_args[1]["model"]
        self.assertEqual(model_used, "claude-opus-4-6")

    def test_H8_contributions_perturb_count_mismatch(self):
        """contributions nhiều hơn perturb_info → không crash (IndexError)."""
        with patch("app.ai_explain._client", return_value=None):
            from app.ai_explain import _fallback_local
            # 5 contributions nhưng chỉ 2 perturb entries
            result = _fallback_local("DDoS", 0.9, _make_contributions(5), "DDoS", _make_perturb_info(2))
        self.assertIsInstance(result, list)


# ═══════════════════════════════════════════════════════════════════════════════
# Entrypoint
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    test_classes = [
        TestAiLocalExplain,
        TestAiGlobalNarrative,
        TestAiModelDetails,
        TestFallbackLocal,
        TestRunLocalExplainIntegration,
        TestRunGlobalExplainIntegration,
        TestRunDetailsViIntegration,
        TestEdgeCases,
    ]

    for cls in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Exit với code khác 0 nếu có test fail
    sys.exit(0 if result.wasSuccessful() else 1)
