# -*- coding: utf-8 -*-
"""用单独拉出的官方规格页 PDF 重新提取雪板规格，与现有 jones-specs.json 逐行 diff。

复用 extract_jones_specs.py 的列锚点与清洗函数（不 exec 动态代码），
按原 main() 流程静态重跑：词->行聚合 -> 型号合并 -> 数值解析 -> 分类标注。
"""
import importlib.util
import json
import re
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF_NEW = "C:/Users/Administrator/Desktop/雪板规格2627 中文Jones Catalog5 .pdf"
OUT_TMP = ROOT / "data" / "jones-specs-recheck.json"

_spec = importlib.util.spec_from_file_location("ext", ROOT / "tools" / "extract_jones_specs.py")
ext = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ext)

SIZE_RE = ext.SIZE_RE
NUM = ext.NUM
CATEGORY = ext.CATEGORY
col_for = ext.col_for
norm = ext.norm
parse_range = ext.parse_range
fnum = ext.fnum


def extract(doc):
    models = []
    current = None
    for pno in range(0, len(doc)):
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
            sizes.append(row)
        name2 = m["name"]
        low = name2.lower()
        audience = ("儿童" if any(k in low for k in ("junior", "youth", "kids", "prodigy"))
                    else "女款" if name2.startswith("Women")
                    else "男款" if name2.startswith("Men")
                    else "通用")
        out.append({
            "name": name2,
            "audience": audience,
            "category": CATEGORY.get(name2, ""),
            "is_split": "Split" in name2 or name2.endswith("Solution"),
            "is_new": m.get("is_new", False),
            "sizes": sizes,
        })
    return out


def main():
    doc = fitz.open(PDF_NEW)
    new = extract(doc)
    OUT_TMP.write_text(json.dumps(new, ensure_ascii=False, indent=1), encoding="utf-8")

    old = json.loads((ROOT / "data" / "jones-specs.json").read_text(encoding="utf-8"))
    FIELDS = ["size", "length_cm", "variant", "rider_weight", "boot_us", "boot_eu", "big_horn",
              "flex", "eff_edge_cm", "waist_cm", "nose_cm", "tail_cm", "taper_mm",
              "stance_cm", "stance_in", "weight_kg_min", "weight_kg_max",
              "boot_eu_min", "boot_eu_max", "big_horn"]
    old_map = {m["name"]: m for m in old}
    new_names = {m["name"] for m in new}
    diffs = []
    for m in new:
        o = old_map.get(m["name"])
        if not o:
            diffs.append(["MODEL_MISSING_IN_OLD", m["name"]])
            continue
        o_sizes = {s["size"]: s for s in o["sizes"]}
        for s in m["sizes"]:
            os_ = o_sizes.get(s["size"])
            if not os_:
                diffs.append(["SIZE_MISSING", m["name"], s["size"]])
                continue
            for f in FIELDS:
                if s.get(f) != os_.get(f):
                    diffs.append(["FIELD", m["name"], s["size"], f,
                                  "pdf=" + str(s.get(f)), "data=" + str(os_.get(f))])
    for m in old:
        if m["name"] not in new_names:
            diffs.append(["MODEL_MISSING_IN_NEW_PDF", m["name"]])

    print("re-extracted: %d models / %d rows" % (len(new), sum(len(m["sizes"]) for m in new)))
    print("existing    : %d models / %d rows" % (len(old), sum(len(m["sizes"]) for m in old)))
    print("DIFFS:", len(diffs))
    for d in diffs[:60]:
        print(" ", d)


if __name__ == "__main__":
    main()
