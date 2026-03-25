"""AI-powered Vietnamese analysis using Claude Opus + Ollama (parallel compare mode).

Primary:   Claude API  (ANTHROPIC_API_KEY)
Secondary: Ollama      (OLLAMA_BASE_URL, OLLAMA_MODEL)
Fallback:  minimal Vietnamese template

Environment variables:
  ANTHROPIC_API_KEY   – Claude API key (required for Claude path)
  OLLAMA_BASE_URL     – Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL        – Ollama model name (default: qwen2.5:7b)
  AI_COMPARE_MODE     – "true" to run Claude + Ollama in parallel and log comparison
  AI_COMPARE_LOG      – Path to comparison JSONL log (default: /tmp/ai_compare.jsonl)
  AI_PRIMARY          – "claude" (default) or "ollama" — which result to return
"""
import json
import logging
import os
import concurrent.futures
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

MODEL = "claude-opus-4-6"

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
COMPARE_MODE = os.environ.get("AI_COMPARE_MODE", "false").lower() == "true"
COMPARE_LOG = os.environ.get("AI_COMPARE_LOG", "/tmp/ai_compare.jsonl")
AI_PRIMARY = os.environ.get("AI_PRIMARY", "claude").lower()  # "claude" | "ollama"


# ── Claude client ─────────────────────────────────────────────────────────────

def _client():
    """Return an Anthropic client, or None if unavailable."""
    try:
        import anthropic  # noqa: PLC0415
    except ImportError:
        logger.warning("anthropic package not installed; Claude analysis unavailable")
        return None
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        logger.warning("ANTHROPIC_API_KEY not set; Claude analysis unavailable")
        return None
    return anthropic.Anthropic(api_key=key)


def _call(client, prompt: str, max_tokens: int = 1024) -> str:
    """Call Claude and return the text response."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    return next((b.text for b in response.content if b.type == "text"), "").strip()


# ── Ollama client ─────────────────────────────────────────────────────────────

def _call_ollama(prompt: str, max_tokens: int = 1024) -> Optional[str]:
    """Call local Ollama API. Returns None if unavailable or on error."""
    try:
        import requests  # noqa: PLC0415
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": 0.7,
                    "top_p": 0.9,
                },
            },
            timeout=120,
        )
        if resp.ok:
            text = resp.json().get("response", "").strip()
            return text if text else None
        logger.warning("Ollama returned HTTP %s", resp.status_code)
    except Exception as exc:
        logger.warning("Ollama call failed: %s", exc)
    return None


def _ollama_available() -> bool:
    """Quick check if Ollama server is reachable."""
    try:
        import requests  # noqa: PLC0415
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return resp.ok
    except Exception:
        return False


# ── Comparison logger ─────────────────────────────────────────────────────────

def _log_comparison(func_name: str, prompt_summary: str,
                    claude_result: Any, ollama_result: Any) -> None:
    """Append one JSONL record to the comparison log file."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "function": func_name,
        "model_claude": MODEL,
        "model_ollama": OLLAMA_MODEL,
        "prompt_preview": prompt_summary[:200],
        "claude": claude_result,
        "ollama": ollama_result,
    }
    try:
        with open(COMPARE_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        logger.debug("Comparison logged → %s", COMPARE_LOG)
    except Exception as exc:
        logger.warning("Failed to write comparison log: %s", exc)


# ── Parallel runner ───────────────────────────────────────────────────────────

def _run_parallel(
    func_name: str,
    prompt: str,
    max_tokens: int,
    claude_client,
    parse_fn=None,
) -> tuple:
    """
    Run Claude and Ollama in parallel.
    Returns (claude_raw, ollama_raw) — both may be None on failure.
    Logs comparison if COMPARE_MODE is on.
    parse_fn: optional callable to post-process raw string (e.g. json.loads).
    """
    def call_claude():
        if claude_client is None:
            return None
        try:
            return _call(claude_client, prompt, max_tokens)
        except Exception as exc:
            logger.error("Claude call failed in %s: %s", func_name, exc)
            return None

    def call_ollama():
        try:
            return _call_ollama(prompt, max_tokens)
        except Exception as exc:
            logger.error("Ollama call failed in %s: %s", func_name, exc)
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_claude = executor.submit(call_claude)
        f_ollama = executor.submit(call_ollama)
        claude_raw = f_claude.result()
        ollama_raw = f_ollama.result()

    if COMPARE_MODE:
        _log_comparison(func_name, prompt, claude_raw, ollama_raw)

    return claude_raw, ollama_raw


def _pick_result(claude_raw: Optional[str], ollama_raw: Optional[str]) -> Optional[str]:
    """Select which result to use based on AI_PRIMARY setting."""
    if AI_PRIMARY == "ollama":
        return ollama_raw or claude_raw
    return claude_raw or ollama_raw  # default: Claude primary


# ── Local explain ─────────────────────────────────────────────────────────────

def ai_local_explain(
    pred_label: str,
    probability: Optional[float],
    top_contributions: List[Any],
    ddos_label: Optional[str],
    perturb_info: List[Dict[str, Any]],
    class_stats: Dict[str, Any],
) -> List[str]:
    """Generate AI Vietnamese explanation lines for a single prediction.

    Replaces the hard-coded template in _generate_vietnamese_explanation.
    Falls back to a minimal template if all AI is unavailable.
    """
    c = _client()
    has_ollama = COMPARE_MODE or (c is None and _ollama_available())

    # If neither Claude nor Ollama available → immediate fallback
    if c is None and not has_ollama:
        return _fallback_local(pred_label, probability, top_contributions, ddos_label, perturb_info)

    is_ddos = bool(ddos_label and pred_label == ddos_label)
    prob_pct = f"{probability * 100:.1f}%" if probability is not None else "không rõ"

    feat_lines: List[str] = []
    for i, contrib in enumerate(top_contributions[:5]):
        pi = perturb_info[i] if i < len(perturb_info) else {}

        cmp_parts: List[str] = []
        for cls_lbl, stats in (contrib.comparison or {}).items():
            cmp_parts.append(f"lớp '{cls_lbl}': mean={stats['mean']:.3f}, std={stats['std']:.3f}")

        delta = ""
        if pi.get("perturb_label") is not None and pi.get("prob_delta_pct") is not None:
            sign = "giảm" if float(pi["prob_delta_pct"]) > 0 else "tăng"
            delta = (
                f" → nếu thay bằng mean lớp '{pi['perturb_label']}', "
                f"xác suất {sign} {abs(float(pi['prob_delta_pct'])):.1f}%"
            )

        feat_lines.append(
            f"  • {contrib.feature_vi} ({contrib.feature_original})"
            f" = {contrib.input_value}"
            f", impact={contrib.impact:.4f}"
            f", hướng={contrib.direction}"
            + (f", so sánh: {'; '.join(cmp_parts)}" if cmp_parts else "")
            + delta
        )

    prompt = f"""Bạn là chuyên gia an ninh mạng phân tích kết quả mô hình ML phát hiện tấn công DDoS.

**Kết quả dự đoán:**
- Nhãn: {pred_label} ({"TẤN CÔNG DDOS" if is_ddos else "lưu lượng bình thường"})
- Xác suất tin cậy: {prob_pct}

**Các đặc trưng ảnh hưởng mạnh nhất đến quyết định:**
{chr(10).join(feat_lines) if feat_lines else "  (không có dữ liệu đặc trưng)"}

Viết phân tích tiếng Việt theo 4 điểm sau (mỗi điểm 1-2 câu, không dùng markdown, không dùng số thứ tự):

Kết luận tổng thể về lưu lượng mạng này.
Giải thích tại sao mô hình đưa ra kết quả này dựa trên các đặc trưng nổi bật nhất.
Đánh giá mức độ tin cậy và rủi ro.
Khuyến nghị cụ thể cho kỹ sư vận hành mạng.

Viết tự nhiên, súc tích, phù hợp kỹ sư mạng Việt Nam đọc trực tiếp trên màn hình giám sát."""

    if COMPARE_MODE:
        claude_raw, ollama_raw = _run_parallel(
            "ai_local_explain", prompt, 1024, c
        )
        raw = _pick_result(claude_raw, ollama_raw)
    else:
        # Single path: Claude first, Ollama as secondary fallback
        raw = None
        if c is not None:
            try:
                raw = _call(c, prompt, max_tokens=1024)
            except Exception as exc:
                logger.error("ai_local_explain Claude failed: %s", exc)
        if raw is None:
            raw = _call_ollama(prompt, max_tokens=1024)

    if raw:
        return [ln for ln in raw.split("\n") if ln.strip()]

    return _fallback_local(pred_label, probability, top_contributions, ddos_label, perturb_info)


# ── Global explain narrative ──────────────────────────────────────────────────

def ai_global_narrative(
    algorithm_name: str,
    top_features: List[Any],
    method: str,
) -> str:
    """Generate AI Vietnamese narrative about global feature importance.

    Replaces the static notes string in run_global_explain.
    """
    c = _client()
    has_ollama = COMPARE_MODE or (c is None and _ollama_available())

    if c is None and not has_ollama:
        return (
            f"Phân tích tầm quan trọng đặc trưng toàn cục bằng phương pháp {method}. "
            f"Top {len(top_features)} đặc trưng ảnh hưởng nhất đến quyết định của mô hình."
        )

    feat_lines = [
        f"  {i + 1}. {f.name}: điểm quan trọng = {f.score:.4f}"
        for i, f in enumerate(top_features[:10])
    ]

    prompt = f"""Bạn là chuyên gia ML phân tích mô hình phát hiện DDoS.

Thuật toán: {algorithm_name}
Phương pháp tính tầm quan trọng đặc trưng: {method}

Top {len(feat_lines)} đặc trưng quan trọng nhất:
{chr(10).join(feat_lines)}

Viết đúng 4-6 câu tiếng Việt phân tích (không dùng markdown, không dùng số thứ tự):

1. Đặc trưng nào quan trọng nhất và tại sao điều đó hợp lý trong bối cảnh phát hiện DDoS.
2. Nhóm đặc trưng nào chiếm ưu thế (ví dụ: thống kê lưu lượng, cờ TCP, thời gian, v.v.).
3. Phân tích phân phối điểm quan trọng — phẳng hay tập trung vào vài đặc trưng.
4. Khuyến nghị thực tế: nên theo dõi đặc trưng nào khi giám sát mạng.

Viết liền mạch, không ngắt đoạn, phù hợp hiển thị trực tiếp trên dashboard."""

    if COMPARE_MODE:
        claude_raw, ollama_raw = _run_parallel(
            "ai_global_narrative", prompt, 512, c
        )
        result = _pick_result(claude_raw, ollama_raw)
    else:
        result = None
        if c is not None:
            try:
                result = _call(c, prompt, max_tokens=512)
            except Exception as exc:
                logger.error("ai_global_narrative Claude failed: %s", exc)
        if result is None:
            result = _call_ollama(prompt, max_tokens=512)

    if result:
        return result

    return (
        f"Phân tích tầm quan trọng đặc trưng bằng phương pháp {method}. "
        f"Top {len(top_features)} đặc trưng ảnh hưởng nhất đến quyết định của mô hình {algorithm_name}."
    )


# ── Model details ─────────────────────────────────────────────────────────────

def ai_model_details(
    algorithm: str,
    algorithm_name: str,
    hyperparams: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Generate AI Vietnamese model details as a dict matching ModelDetailsVI schema.

    Returns None if AI is unavailable so the caller can fall back to static templates.
    """
    c = _client()
    has_ollama = COMPARE_MODE or (c is None and _ollama_available())

    if c is None and not has_ollama:
        return None

    hp_lines = "\n".join(f"  - {k}: {v}" for k, v in hyperparams.items()) if hyperparams else "  (mặc định)"

    prompt = f"""Bạn là chuyên gia ML giải thích mô hình phát hiện DDoS cho kỹ sư mạng Việt Nam.

Thuật toán: {algorithm_name} (mã: {algorithm})
Tham số hiện tại:
{hp_lines}

Trả về JSON hợp lệ (không có markdown, không có text bên ngoài JSON) theo cấu trúc sau:

{{
  "sections": [
    {{
      "heading": "Nguyên lý hoạt động",
      "paragraphs": ["<giải thích cách thuật toán hoạt động, 2-3 câu cụ thể cho {algorithm_name}>"],
      "bullets": ["<điểm kỹ thuật quan trọng 1>", "<điểm kỹ thuật quan trọng 2>", "<điểm kỹ thuật quan trọng 3>"]
    }},
    {{
      "heading": "Ưu điểm trong phát hiện DDoS",
      "paragraphs": [],
      "bullets": ["<ưu điểm thực tế 1>", "<ưu điểm thực tế 2>", "<ưu điểm thực tế 3>"]
    }},
    {{
      "heading": "Phân tích cấu hình hiện tại",
      "paragraphs": ["<nhận xét cụ thể về các tham số đang dùng và ảnh hưởng đến hiệu suất phát hiện DDoS>"],
      "bullets": []
    }}
  ],
  "how_used_in_pipeline": [
    "<bước 1: tiền xử lý dữ liệu>",
    "<bước 2: xây dựng/huấn luyện mô hình>",
    "<bước 3: dự đoán>",
    "<bước 4: đánh giá/giải thích>"
  ],
  "limitations_for_ddos": [
    "<hạn chế cụ thể 1 trong bối cảnh phát hiện DDoS>",
    "<hạn chế cụ thể 2>"
  ],
  "hyperparams_meanings": {{
    "<tên tham số>": "<giải thích ngắn tiếng Việt, 1 câu>"
  }}
}}

Điền nội dung thực tế và cụ thể cho {algorithm_name}, không dùng placeholder, không dùng dấu ngoặc nhọn rỗng."""

    def _parse_json(raw: Optional[str]) -> Optional[Dict]:
        if not raw:
            return None
        raw = raw.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            return json.loads(raw.strip())
        except Exception:
            return None

    if COMPARE_MODE:
        claude_raw, ollama_raw = _run_parallel(
            "ai_model_details", prompt, 2048, c
        )
        raw = _pick_result(claude_raw, ollama_raw)
        # Also log parsed versions for easier comparison
        if COMPARE_MODE:
            _log_comparison(
                "ai_model_details_parsed",
                prompt[:200],
                _parse_json(claude_raw),
                _parse_json(ollama_raw),
            )
        return _parse_json(raw)
    else:
        raw = None
        if c is not None:
            try:
                raw = _call(c, prompt, max_tokens=2048)
            except Exception as exc:
                logger.error("ai_model_details Claude failed: %s", exc)
        if raw is None:
            raw = _call_ollama(prompt, max_tokens=2048)

        result = _parse_json(raw)
        if result is None:
            logger.error("ai_model_details: failed to parse JSON from AI response")
        return result


# ── Compare functions (always run both Claude + Ollama in parallel) ───────────

def ai_local_explain_compare(
    pred_label: str,
    probability: Optional[float],
    top_contributions: List[Any],
    ddos_label: Optional[str],
    perturb_info: List[Dict[str, Any]],
    class_stats: Dict[str, Any],
) -> Dict[str, Any]:
    """Run Claude and Ollama in parallel for local explain. Always returns both."""
    c = _client()

    is_ddos = bool(ddos_label and pred_label == ddos_label)
    prob_pct = f"{probability * 100:.1f}%" if probability is not None else "không rõ"

    feat_lines: List[str] = []
    for i, contrib in enumerate(top_contributions[:5]):
        pi = perturb_info[i] if i < len(perturb_info) else {}
        cmp_parts: List[str] = []
        for cls_lbl, stats in (contrib.comparison or {}).items():
            cmp_parts.append(f"lớp '{cls_lbl}': mean={stats['mean']:.3f}, std={stats['std']:.3f}")
        delta = ""
        if pi.get("perturb_label") is not None and pi.get("prob_delta_pct") is not None:
            sign = "giảm" if float(pi["prob_delta_pct"]) > 0 else "tăng"
            delta = (
                f" → nếu thay bằng mean lớp '{pi['perturb_label']}', "
                f"xác suất {sign} {abs(float(pi['prob_delta_pct'])):.1f}%"
            )
        feat_lines.append(
            f"  • {contrib.feature_vi} ({contrib.feature_original})"
            f" = {contrib.input_value}"
            f", impact={contrib.impact:.4f}"
            f", hướng={contrib.direction}"
            + (f", so sánh: {'; '.join(cmp_parts)}" if cmp_parts else "")
            + delta
        )

    prompt = f"""Bạn là chuyên gia an ninh mạng phân tích kết quả mô hình ML phát hiện tấn công DDoS.

**Kết quả dự đoán:**
- Nhãn: {pred_label} ({"TẤN CÔNG DDOS" if is_ddos else "lưu lượng bình thường"})
- Xác suất tin cậy: {prob_pct}

**Các đặc trưng ảnh hưởng mạnh nhất đến quyết định:**
{chr(10).join(feat_lines) if feat_lines else "  (không có dữ liệu đặc trưng)"}

Viết phân tích tiếng Việt theo 4 điểm sau (mỗi điểm 1-2 câu, không dùng markdown, không dùng số thứ tự):

Kết luận tổng thể về lưu lượng mạng này.
Giải thích tại sao mô hình đưa ra kết quả này dựa trên các đặc trưng nổi bật nhất.
Đánh giá mức độ tin cậy và rủi ro.
Khuyến nghị cụ thể cho kỹ sư vận hành mạng.

Viết tự nhiên, súc tích, phù hợp kỹ sư mạng Việt Nam đọc trực tiếp trên màn hình giám sát."""

    claude_raw, ollama_raw = _run_parallel("ai_local_explain_compare", prompt, 1024, c)

    def _to_lines(raw: Optional[str]) -> Optional[List[str]]:
        if not raw:
            return None
        return [ln for ln in raw.split("\n") if ln.strip()] or None

    return {
        "claude": _to_lines(claude_raw),
        "ollama": _to_lines(ollama_raw),
        "model_claude": MODEL,
        "model_ollama": OLLAMA_MODEL,
    }


def ai_global_narrative_compare(
    algorithm_name: str,
    top_features: List[Any],
    method: str,
) -> Dict[str, Any]:
    """Run Claude and Ollama in parallel for global narrative. Always returns both."""
    c = _client()

    feat_lines = [
        f"  {i + 1}. {f.name}: điểm quan trọng = {f.score:.4f}"
        for i, f in enumerate(top_features[:10])
    ]

    prompt = f"""Bạn là chuyên gia ML phân tích mô hình phát hiện DDoS.

Thuật toán: {algorithm_name}
Phương pháp tính tầm quan trọng đặc trưng: {method}

Top {len(feat_lines)} đặc trưng quan trọng nhất:
{chr(10).join(feat_lines)}

Viết đúng 4-6 câu tiếng Việt phân tích (không dùng markdown, không dùng số thứ tự):

1. Đặc trưng nào quan trọng nhất và tại sao điều đó hợp lý trong bối cảnh phát hiện DDoS.
2. Nhóm đặc trưng nào chiếm ưu thế (ví dụ: thống kê lưu lượng, cờ TCP, thời gian, v.v.).
3. Phân tích phân phối điểm quan trọng — phẳng hay tập trung vào vài đặc trưng.
4. Khuyến nghị thực tế: nên theo dõi đặc trưng nào khi giám sát mạng.

Viết liền mạch, không ngắt đoạn, phù hợp hiển thị trực tiếp trên dashboard."""

    claude_raw, ollama_raw = _run_parallel("ai_global_narrative_compare", prompt, 512, c)

    return {
        "claude": claude_raw or None,
        "ollama": ollama_raw or None,
        "model_claude": MODEL,
        "model_ollama": OLLAMA_MODEL,
    }


def ai_model_details_compare(
    algorithm: str,
    algorithm_name: str,
    hyperparams: Dict[str, Any],
) -> Dict[str, Any]:
    """Run Claude and Ollama in parallel for model details. Always returns both."""
    c = _client()

    hp_lines = "\n".join(f"  - {k}: {v}" for k, v in hyperparams.items()) if hyperparams else "  (mặc định)"

    prompt = f"""Bạn là chuyên gia ML giải thích mô hình phát hiện DDoS cho kỹ sư mạng Việt Nam.

Thuật toán: {algorithm_name} (mã: {algorithm})
Tham số hiện tại:
{hp_lines}

Trả về JSON hợp lệ (không có markdown, không có text bên ngoài JSON) theo cấu trúc sau:

{{
  "sections": [
    {{
      "heading": "Nguyên lý hoạt động",
      "paragraphs": ["<giải thích 2-3 câu>"],
      "bullets": ["<điểm 1>", "<điểm 2>", "<điểm 3>"]
    }},
    {{
      "heading": "Ưu điểm trong phát hiện DDoS",
      "paragraphs": [],
      "bullets": ["<ưu điểm 1>", "<ưu điểm 2>", "<ưu điểm 3>"]
    }},
    {{
      "heading": "Phân tích cấu hình hiện tại",
      "paragraphs": ["<nhận xét tham số>"],
      "bullets": []
    }}
  ],
  "how_used_in_pipeline": ["<bước 1>", "<bước 2>", "<bước 3>", "<bước 4>"],
  "limitations_for_ddos": ["<hạn chế 1>", "<hạn chế 2>"],
  "hyperparams_meanings": {{"<tên>": "<giải thích 1 câu>"}}
}}

Điền nội dung thực tế cho {algorithm_name}, không dùng placeholder."""

    def _parse(raw: Optional[str]) -> Optional[Dict]:
        if not raw:
            return None
        raw = raw.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        try:
            return json.loads(raw.strip())
        except Exception:
            return None

    claude_raw, ollama_raw = _run_parallel("ai_model_details_compare", prompt, 2048, c)

    return {
        "claude": _parse(claude_raw),
        "ollama": _parse(ollama_raw),
        "model_claude": MODEL,
        "model_ollama": OLLAMA_MODEL,
    }


# ── Fallback templates ────────────────────────────────────────────────────────

def _fallback_local(
    pred_label: str,
    probability: Optional[float],
    top_contributions: List[Any],
    ddos_label: Optional[str],
    perturb_info: List[Dict[str, Any]],
) -> List[str]:
    """Minimal template used when all AI (Claude + Ollama) is unavailable."""
    lines: List[str] = []
    prob_str = f" (xác suất: {probability * 100:.1f}%)" if probability is not None else ""
    if ddos_label and pred_label == ddos_label:
        lines.append(f"Mô hình phát hiện lưu lượng này là TẤN CÔNG DDOS{prob_str}.")
    elif pred_label.lower() in {"0", "benign", "normal", "bình thường"}:
        lines.append(f"Mô hình phân loại lưu lượng này là BÌNH THƯỜNG{prob_str}.")
    else:
        lines.append(f"Kết quả phân loại: {pred_label}{prob_str}.")
    if top_contributions:
        lines.append("Các đặc trưng ảnh hưởng nhất:")
        for i, c in enumerate(top_contributions[:5], 1):
            pi = perturb_info[i - 1] if i - 1 < len(perturb_info) else {}
            pct = pi.get("prob_delta_pct")
            suffix = f" (thay đổi xác suất {pct:+.1f}%)" if pct is not None else ""
            lines.append(f"  {i}. {c.feature_vi} = {c.input_value} → {c.direction}, impact={c.impact:.4f}{suffix}")
    return lines
