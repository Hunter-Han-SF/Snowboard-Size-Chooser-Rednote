# -*- coding: utf-8 -*-
"""与 tools/extract_jones_specs.py 完全相同的提取逻辑，仅改两处：
PDF -> 用户桌面的目录文件；OUT -> tmp/specs_desktop.json（核对用，不动仓库数据）。"""
import json
import re
from pathlib import Path

import fitz

PDF = r"C:\Users\Administrator\Desktop\雪板规格2627 中文Jones Catalog5 .pdf"
OUT = Path("tmp/specs_desktop.json")

# (字段, 列中心 x) —— 单元格居中对齐，按词中心最近匹配，对内容宽度不敏感
CENTERS = [
    ("size", 135), ("rider_weight", 180), ("boot_us", 234), ("boot_eu", 264),
    ("bighorn", 289), ("flex", 314), ("board_weight", 353), ("sidecut_m", 388),
    ("eff_edge_cm", 413), ("waist_cm", 430), ("nose_cm", 450), ("tail_cm", 469),
    ("taper_mm", 490), ("stance_cm", 511), ("stance_in", 528),
    ("skin_precut", 541), ("skin_trim", 554),
]

CATEGORY = {
    "Freecarver 6000s": "自由刻滑", "Freecarver 9000s": "自由刻滑",
    "TwinCraft": "冲浪系列", "Mind Expander 2.0": "冲浪系列",
    "Storm Chaser": "冲浪系列", "Storm Wolf": "冲浪系列",
    "Storm Chaser Split": "冲浪系列", "Ultralight Butterfly Split": "冲浪系列",
    "Men’s Flagship Pro": "全山野雪", "Men’s Flagship": "全山野雪",
    "Men’s Howler": "全山野雪", "Men’s Stratos": "全山野雪",
    "Hovercraft 2.0": "全山野雪", "Men’s Frontier 2.0": "全山野雪",
    "Men’s Ultralight Project X": "全山野雪", "Men’s Ultralight Solution": "全山野雪",
    "Ultralight Hovercraft 2.0 Split": "全山野雪", "Men’s Howler Split": "全山野雪",
    "Men’s Solution": "全山野雪", "Men’s Stratos Split": "全山野雪",
    "Hovercraft 2.0 Split": "全山野雪", "Men’s Frontier 2.0 Split": "全山野雪",
    "Women’s Flagship": "全山野雪", "Women’s Howler": "全山野雪",
    "Women’s Stratos": "全山野雪", "Women’s Dream Weaver 2.0": "全山野雪",
    "Women’s Solution": "全山野雪", "Women’s Howler Split": "全山野雪",
    "Women’s Stratos Split": "全山野雪", "Women’s Dream Weaver 2.0 Split": "全山野雪",
    "Flagship Junior": "全山野雪", "Solution Junior": "全山野雪",
    "Men’s Aviator 2.0": "全山", "Men’s Mountain Twin Pro": "全山",
    "Men’s Mountain Twin": "全山", "Men’s Rally Cat": "全山",
    "Women’s Airheart 2.0": "全山", "Women’s Twin Sister": "全山",
    "Women’s Rally Cat": "全山", "Mountain Twin Junior": "全山",
    "Twin Sister Junior": "全山", "Youth Prodigy": "全山",
    "Kids Prodigy Package": "全山",
    "Men’s Tweaker Pro": "全山自由式", "Men’s Tweaker": "全山自由式",
    "Women’s Tweaker": "全山自由式",
}

SIZE_RE = re.compile(r"^(\d{3})([A-Z]{1,2})?$")
NUM = r"(\d+(?:[.,]\d+)?)"


def col_for(xc):
    return min(CENTERS, key=lambda c: abs(c[1] - xc))[0]


def norm(s):
    s = s.replace("ﬂ", "fl").replace("ﬁ", "fi")  # 连字归一化
    return re.sub(r"(\d),(\d)", r"\1.\2", s.strip())


def parse_range(s):
    m = re.match(rf"^{NUM}\s*-\s*{NUM}\s*\+?$", s)
    if m:
        return float(m.group(1)), float(m.group(2)), s.endswith("+")
    m = re.match(rf"^{NUM}\s*\+$", s)
    if m:
        return float(m.group(1)), None, True
    return None


def fnum(s):
    m = re.match(rf"^{NUM}$", s)
    return float(m.group(1)) if m else None


def main():
    doc = fitz.open(PDF)
    models = []
    current = None
    for pno in range(0, len(doc)):  # 桌面 PDF 仅含规格表 5 页
        rows = {}
        for x0, y0, x1, y1, w, *_ in doc[pno].get_text("words"):
            y = round(y0)
            key = min(rows, key=lambda k: abs(k - y)) if rows else None
            if key is not None and abs(key - y) <= 4:
                y = key
            rows.setdefault(y, {})
            if x0 < 120:
                rows[y].setdefault("_model", []).append((x0, w.replace("ﬂ", "fl").replace("ﬁ", "fi")))
                continue
            c = col_for((x0 + x1) / 2)
            if c:
                cell = rows[y].get(c, "")
                rows[y][c] = (cell + " " + norm(w)).strip() if cell else norm(w)
        for y in sorted(rows):
            r = rows[y]
            model_words = r.pop("_model", None)
            if model_words:
                name = " ".join(w for _, w in sorted(model_words))
                if name and name != "雪板规格":
                    current = {"name": name, "sizes": []}
                    models.append(current)
            if not r.get("size") or not current:
                continue
            if not SIZE_RE.match(r["size"]):
                continue
            current["sizes"].append(r)

    merged = []
    for m in models:
        name = re.sub(r"\s*new$", "", m["name"]).strip()
        is_new = name != m["name"] or m["name"] == "new"
        if m["name"] == "new" and merged:
            merged[-1]["sizes"].extend(m["sizes"])
            merged[-1]["is_new"] = True
            continue
        if merged and name == merged[-1]["name"]:
            merged[-1]["sizes"].extend(m["sizes"])
            merged[-1]["is_new"] = merged[-1]["is_new"] or is_new
        else:
            m["name"], m["is_new"] = name, is_new
            merged.append(m)

    out = []
    for m in merged:
        if not m["sizes"]:
            continue
        sizes = []
        for s in m["sizes"]:
            size_m = SIZE_RE.match(s["size"])
            row = {
                "size": s["size"],
                "length_cm": int(size_m.group(1)),
                "variant": size_m.group(2) or "",
                "rider_weight": s.get("rider_weight", ""),
                "boot_us": s.get("boot_us", ""),
                "boot_eu": s.get("boot_eu", ""),
                "big_horn": s.get("bighorn") == "✓",
                "flex": s.get("flex", ""),
                "board_weight": s.get("board_weight", ""),
                "sidecut_m": s.get("sidecut_m", ""),
                "eff_edge_cm": fnum(s.get("eff_edge_cm", "")),
                "waist_cm": fnum(s.get("waist_cm", "")),
                "nose_cm": fnum(s.get("nose_cm", "")),
                "tail_cm": fnum(s.get("tail_cm", "")),
                "taper_mm": fnum(s.get("taper_mm", "")),
                "stance_cm": fnum(s.get("stance_cm", "")),
                "stance_in": fnum(s.get("stance_in", "")),
            }
            wm = re.search(rf"{NUM}\s*-\s*{NUM}\+?\s*kg", s.get("rider_weight", ""))
            if wm:
                row["weight_kg_min"] = float(wm.group(1))
                row["weight_kg_max"] = float(wm.group(2))
                row["weight_kg_open"] = "+" in wm.group(0)
            else:
                row["weight_kg_min"] = row["weight_kg_max"] = None
            pr = parse_range(s.get("boot_us", ""))
            row["boot_us_min"], row["boot_us_max"], row["boot_us_open"] = pr or (None, None, False)
            pr = parse_range(s.get("boot_eu", ""))
            row["boot_eu_min"], row["boot_eu_max"], row["boot_eu_open"] = pr or (None, None, False)
            bw = re.match(rf"^{NUM}kg", s.get("board_weight", ""))
            row["board_weight_kg"] = float(bw.group(1)) if bw else None
            sizes.append(row)
        name = m["name"]
        low = name.lower()
        audience = ("儿童" if any(k in low for k in ("junior", "youth", "kids", "prodigy"))
                    else "女款" if name.startswith("Women")
                    else "男款" if name.startswith("Men")
                    else "通用")
        out.append({
            "name": name,
            "audience": audience,
            "category": CATEGORY.get(name, ""),
            "is_split": "Split" in name or name.endswith("Solution"),
            "is_new": m.get("is_new", False),
            "size_count": len(sizes),
            "sizes": sizes,
        })

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(m["size_count"] for m in out)
    print(f"models: {len(out)}, size rows: {total} -> {OUT}")
    bad = [m["name"] for m in out if not m["category"]]
    print("models without category:", bad or "none")


if __name__ == "__main__":
    main()
