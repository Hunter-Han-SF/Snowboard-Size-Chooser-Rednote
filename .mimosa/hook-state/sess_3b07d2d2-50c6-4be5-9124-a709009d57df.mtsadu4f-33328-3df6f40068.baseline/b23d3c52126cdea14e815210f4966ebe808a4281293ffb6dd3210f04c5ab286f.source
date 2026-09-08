# -*- coding: utf-8 -*-
"""jones-specs.json 数据质量校验"""
import json

data = json.load(open("data/jones-specs.json", encoding="utf-8"))
errors = []

need_fields = ["length_cm", "waist_cm", "eff_edge_cm", "nose_cm", "tail_cm",
               "taper_mm", "stance_cm", "flex", "rider_weight", "boot_eu",
               "weight_kg_min", "weight_kg_max"]
for m in data:
    if not m["category"]:
        errors.append(f"{m['name']}: 无分类")
    for s in m["sizes"]:
        for k in need_fields:
            if s.get(k) is None or s.get(k) == "":
                errors.append(f"{m['name']} {s['size']}: 缺 {k}")
        if s["weight_kg_min"] and s["weight_kg_max"] and s["weight_kg_min"] > s["weight_kg_max"]:
            errors.append(f"{m['name']} {s['size']}: 体重区间倒置")
        if s["nose_cm"] and s["tail_cm"] and s["waist_cm"]:
            if not (s["waist_cm"] < s["nose_cm"] and s["waist_cm"] < s["tail_cm"]):
                errors.append(f"{m['name']} {s['size']}: 板腰应最窄")
            taper_calc = round((s["nose_cm"] - s["tail_cm"]) * 10, 1)
            if abs(taper_calc - s["taper_mm"]) > 1.1:  # 板宽取整到 1mm 的目录舍入噪声
                errors.append(f"{m['name']} {s['size']}: taper 不一致 "
                              f"({s['taper_mm']} vs 计算 {taper_calc})")
        if s["big_horn"] and s["waist_cm"] and s["waist_cm"] < 26.3:
            # 目录自身存在个别不一致（如 Rally Cat 154/155W），仅提示
            print(f"[warn] {m['name']} {s['size']}: Big Horn ✓ 但腰宽 {s['waist_cm']} < 26.3（目录原文如此）")

bh = sum(1 for m in data for s in m["sizes"] if s["big_horn"])
print(f"models: {len(data)}, rows: {sum(m['size_count'] for m in data)}, big_horn rows: {bh}")
print("\n".join(errors) if errors else "ALL CHECKS PASSED")
