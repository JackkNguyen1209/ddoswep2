#!/usr/bin/env python3
"""
Xem và so sánh kết quả Claude vs Ollama từ file log AI_COMPARE_LOG.

Cách dùng:
  python compare_results.py                    # đọc /tmp/ai_compare.jsonl
  python compare_results.py my_log.jsonl       # đọc file tùy chỉnh
  python compare_results.py --func local       # chỉ xem ai_local_explain
  python compare_results.py --last 5           # 5 record gần nhất
  python compare_results.py --stats            # thống kê tổng hợp
"""
import json
import sys
import os
from typing import Optional


DEFAULT_LOG = os.environ.get("AI_COMPARE_LOG", "/tmp/ai_compare.jsonl")


def load_records(path: str):
    if not os.path.exists(path):
        print(f"[!] File không tồn tại: {path}")
        return []
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return records


def fmt_value(v, indent=4) -> str:
    if v is None:
        return "  (none)"
    if isinstance(v, list):
        return "\n".join(f"{' ' * indent}• {ln}" for ln in v)
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False, indent=2)
    return str(v)


def print_record(rec: dict, idx: int):
    sep = "─" * 70
    print(f"\n{'═' * 70}")
    print(f"  #{idx:03d}  {rec.get('ts', '')}  [{rec.get('function', '?')}]")
    print(f"{'═' * 70}")
    print(f"  Claude ({rec.get('model_claude', '?')}):")
    print(fmt_value(rec.get("claude")))
    print(f"\n{sep}")
    print(f"  Ollama ({rec.get('model_ollama', '?')}):")
    print(fmt_value(rec.get("ollama")))

    # Highlight length difference
    c_len = len(str(rec.get("claude") or ""))
    o_len = len(str(rec.get("ollama") or ""))
    print(f"\n  [chars] Claude={c_len}  Ollama={o_len}  diff={c_len - o_len:+d}")


def print_stats(records):
    from collections import defaultdict, Counter
    by_func = defaultdict(list)
    for r in records:
        by_func[r.get("function", "?")].append(r)

    print(f"\n{'═' * 70}")
    print(f"  THỐNG KÊ ({len(records)} records)")
    print(f"{'═' * 70}")
    for func, recs in sorted(by_func.items()):
        claude_ok = sum(1 for r in recs if r.get("claude"))
        ollama_ok = sum(1 for r in recs if r.get("ollama"))
        c_lens = [len(str(r.get("claude") or "")) for r in recs if r.get("claude")]
        o_lens = [len(str(r.get("ollama") or "")) for r in recs if r.get("ollama")]
        avg_c = sum(c_lens) / len(c_lens) if c_lens else 0
        avg_o = sum(o_lens) / len(o_lens) if o_lens else 0
        print(f"\n  {func}  ({len(recs)} lần)")
        print(f"    Claude OK: {claude_ok}/{len(recs)}  avg chars: {avg_c:.0f}")
        print(f"    Ollama OK: {ollama_ok}/{len(recs)}  avg chars: {avg_o:.0f}")


def main():
    args = sys.argv[1:]

    log_path = DEFAULT_LOG
    filter_func: Optional[str] = None
    last_n: Optional[int] = None
    show_stats = False

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--func" and i + 1 < len(args):
            filter_func = args[i + 1]; i += 2
        elif a == "--last" and i + 1 < len(args):
            last_n = int(args[i + 1]); i += 2
        elif a == "--stats":
            show_stats = True; i += 1
        elif not a.startswith("--"):
            log_path = a; i += 1
        else:
            i += 1

    records = load_records(log_path)
    if not records:
        print("Không có record nào.")
        return

    if filter_func:
        records = [r for r in records if filter_func in r.get("function", "")]

    if last_n:
        records = records[-last_n:]

    if show_stats:
        print_stats(records)
        return

    for idx, rec in enumerate(records, 1):
        print_record(rec, idx)

    print(f"\n\nTổng: {len(records)} records  |  log: {log_path}")


if __name__ == "__main__":
    main()
