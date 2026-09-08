# -*- coding: utf-8 -*-
"""由 data/jones-specs.json 生成人类可读的尺码总览 data/jones-specs.md"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "data" / "jones-specs.json").read_text(encoding="utf-8"))

CAT_ORDER = ["全山野雪", "全山", "全山自由式", "自由刻滑", "冲浪系列"]
AUD_ORDER = ["男款", "通用", "女款", "儿童"]

def model_row(m):
    sizes = m["sizes"]
    wmin = min(s["weight_kg_min"] for s in sizes if s["weight_kg_min"])
    wmax = max(s["weight_kg_max"] for s in sizes if s["weight_kg_max"])
    wstr = f"{wmin:.0f}–{wmax:.0f}" + ("+" if any(s["weight_kg_open"] for s in sizes) else "")
    bh = [s["size"] for s in sizes if s["big_horn"]]
    flex = "/".join(sorted({s["flex"] for s in sizes}))
    news = " 🆕" if m["is_new"] else ""
    split = " · 分离板" if m["is_split"] else ""
    return (f"| {m['name']}{news} | {m['audience']}{split} | "
            f"{', '.join(s['size'] for s in sizes)} | {wstr} | {flex} | "
            f"{', '.join(bh) if bh else '—'} |")

lines = [
    "# Jones 2026-27 雪板尺码总览",
    "",
    "> 数据来源：《2627 中文 Jones Catalog》p134–138 雪板规格表（PDF 提取）。",
    "> 完整逐尺码数据（体重区间、鞋码、边刃、板宽、站姿等）见 `data/jones-specs.json`。",
    "",
    "- 型号数：**46**（男款 15 / 通用 11 / 女款 12 / 儿童 8），尺码行 **270**",
    "- 后缀含义：`W`=加宽、`UW`=超宽、`N`=窄版；🆕 = 2026-27 新品",
    "- **Big Horn（大角系列）**：腰宽 ≥ 26.3cm 的大脚专属尺码，US 11 码以上优先选择",
    "",
]
for cat in CAT_ORDER:
    models = [m for m in data if m["category"] == cat]
    if not models:
        continue
    lines += [f"## {cat}", "",
              "| 型号 | 人群 | 尺码 (cm) | 体重覆盖 (kg) | 硬度 | Big Horn 尺码 |",
              "| --- | --- | --- | --- | --- | --- |"]
    for aud in AUD_ORDER:
        for m in sorted([x for x in models if x["audience"] == aud], key=lambda x: x["name"]):
            lines.append(model_row(m))
    lines.append("")

(ROOT / "data" / "jones-specs.md").write_text("\n".join(lines), encoding="utf-8")
print(f"-> data/jones-specs.md ({len(lines)} lines)")
