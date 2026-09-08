# -*- coding: utf-8 -*-
"""从 26-27 中文 Catalog 产品介绍摘录 PDF 提取每块板的官方文案。

每页两块板（左/右两栏），模板字段：
  名称(y<25) → 标语+一句话(y 44-98) → 介绍段(y 335-385) → 3 条特性(y 390-438)
  → 地形三维打分(y 465-492: 标签@x, 数值@x+63) → 板型/轮廓/个性硬度(y 536-580)

输出 data/jones-copy.json: { dataKey: {tag, pitch, intro, bullets[], scores[{l,v}], shape, profile, character} }
"""
import fitz
import json
import re
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Desktop\2627 中文Jones Catalog5 .pdf")
OUT = Path(__file__).resolve().parent.parent / "data" / "jones-copy.json"

# 中文标题 → data.js 型号名（’ 为 U+2019）
NAME_MAP = {
    "男款 Ultralight Project X": "Men’s Ultralight Project X",
    "男款 Flagship Pro": "Men’s Flagship Pro",
    "男款 Flagship": "Men’s Flagship",
    "男款 Howler": "Men’s Howler",
    "男款 Stratos": "Men’s Stratos",
    "男款 Frontier 2.0": "Men’s Frontier 2.0",
    "男款 Mountain Twin Pro": "Men’s Mountain Twin Pro",
    "男款 Mountain Twin": "Men’s Mountain Twin",
    "男款 Aviator 2.0": "Men’s Aviator 2.0",
    "男款 Rally Cat": "Men’s Rally Cat",
    "男款 Tweaker Pro 2.0": "Men’s Tweaker Pro",
    "男款 Tweaker 2.0": "Men’s Tweaker",
    "女款 Flagship": "Women’s Flagship",
    "女款 Howler": "Women’s Howler",
    "女款 Stratos": "Women’s Stratos",
    "女款 Dream Weaver 2.0": "Women’s Dream Weaver 2.0",
    "女款 Twin Sister": "Women’s Twin Sister",
    "女款 Airheart 2.0": "Women’s Airheart 2.0",
    "女款 Rally Cat": "Women’s Rally Cat",
    "女款 Tweaker 2.0": "Women’s Tweaker",
    "TwinCraft": "TwinCraft",
    "Mind Expander 2.0": "Mind Expander 2.0",
    "Storm Chaser": "Storm Chaser",
    "Storm Wolf": "Storm Wolf",
    "Freecarver 6000s": "Freecarver 6000s",
    "Freecarver 9000s": "Freecarver 9000s",
    "Hovercraft 2.0": "Hovercraft 2.0",
    # 分离板（data 里命名不统一，逐一映射）
    "男款 Ultralight Solution 分离板": "Men’s Ultralight Solution",
    "男款 Solution 分离板": "Men’s Solution",
    "男款 Howler 分离板": "Men’s Howler Split",
    "男款 Stratos 分离板": "Men’s Stratos Split",
    "男款 Frontier 2.0 分离板": "Men’s Frontier 2.0 Split",
    "Storm Chaser分离板": "Storm Chaser Split",
    "Hovercraft 2.0 分离板": "Hovercraft 2.0 Split",
    "Ultralight Hovercraft 2.0分离板": "Ultralight Hovercraft 2.0 Split",
    "Ultralight Butterfly 分离板": "Ultralight Butterfly Split",
    "女款 Solution 分离板": "Women’s Solution",
    "女款 Howler 分离板": "Women’s Howler Split",
    "女款 Stratos 分离板": "Women’s Stratos Split",
    "女款 Dream Weaver 2.0 分离板": "Women’s Dream Weaver 2.0 Split",
    # 青少年 / 少儿
    "青少年 Flagship": "Flagship Junior",
    "青少年 Mountain Twin": "Mountain Twin Junior",
    "青少年 Twin Sister": "Twin Sister Junior",
    "少儿 Prodigy": "Youth Prodigy",
    "少儿 Prodigy 套装": "Kids Prodigy Package",
}

SKIP_TITLES = {"分离板", "青少年系列视觉总览", "Mountain Surfer", "儿童 Happy Mountain", "青少年 Solution 分离板"}
LABEL_WORDS = {"全山", "粉雪", "自由式", "深粉", "登滑表现", "陡坡"}


def clean(s):
    return re.sub(r"\s+", " ", s.replace("\u00a0", " ")).strip()


def cjk_join(lines):
    """按行拼接：中文边界不加空格（目录换行不断词），西文/数字边界加空格。"""
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if not out:
            out = ln
            continue
        a, b = out[-1], ln[0]
        both_cjk = re.match(r"[\u4e00-\u9fff，。、；：！？（）》]", a) and re.match(r"[\u4e00-\u9fff，。、；：！？（》《]", b)
        out += ("" if both_cjk else " ") + ln
    return clean(out)


def extract_half(page, x_lo, x_hi):
    """提取半页里的一个板块文案，返回 dict 或 None。"""
    blocks = [b for b in page.get_text("blocks") if x_lo <= b[0] < x_hi]
    words = [w for w in page.get_text("words") if x_lo <= w[0] < x_hi]

    # 名称
    name = None
    for b in blocks:
        t = b[4].strip()
        if b[1] < 25 and t and len(t) < 40:
            name = t
            break
    if not name:
        return None

    # 标语 + 一句话定位（y 44-98，排除徽标/搭配文字）
    copy_lines = []
    for b in sorted(blocks, key=lambda b: (round(b[1]), b[0])):
        if 44 <= b[1] <= 98 and b[4].strip():
            if re.search(r"最佳搭配|NEW|CARRY|UNISEX|updated|®", b[4]):
                continue
            for ln in b[4].split("\n"):
                ln = ln.strip()
                if ln and not re.match(r"^(NEW|CARRY|UNISEX)", ln):
                    copy_lines.append(ln)
    tag = copy_lines[0] if copy_lines else ""
    pitch = cjk_join(copy_lines[1:])

    # 介绍段（y 335-385，可能拆成两个块）
    intro_parts = []
    for b in sorted(blocks, key=lambda b: (round(b[1]), b[0])):
        t = b[4].strip()
        if 335 <= b[1] <= 385 and len(t) > 12 and "最佳搭配" not in t:
            intro_parts.extend(t.split("\n"))
    intro = cjk_join(intro_parts)

    # 特性条目（行级 y 390-438，去掉 ! / → 前缀）
    bullets = []
    d = page.get_text("dict")
    for blk in d["blocks"]:
        if blk.get("type") != 0:
            continue
        for line in blk["lines"]:
            x0, y0 = line["bbox"][0], line["bbox"][1]
            if not (x_lo <= x0 < x_hi and 390 <= y0 <= 438):
                continue
            txt = clean("".join(sp["text"] for sp in line["spans"]))
            txt = re.sub(r"^[!→]+\s*", "", txt)
            if txt and txt not in ("!", "→") and len(txt) > 3:
                bullets.append(txt)

    # 地形三维打分：标签@x → 数值行@x+63（数值通常同行；个别页第三列错位到下方，
    # 用“全数字行”按 x/y 综合最近原则归属，避免与三连标签的 4/5 混淆）
    band = sorted([w for w in words if 460 <= w[1] <= 500], key=lambda w: w[0])
    anchors = []
    for w in band:
        t = w[4]
        if t.startswith("陡坡"):
            anchors.append((w[0], "陡坡/峡湾"))
        elif t in LABEL_WORDS:
            anchors.append((w[0], t))
    # 全数字行（y 455-575）
    digit_lines = []
    d2 = page.get_text("dict")
    for blk in d2["blocks"]:
        if blk.get("type") != 0:
            continue
        for line in blk["lines"]:
            x0, y0 = line["bbox"][0], line["bbox"][1]
            if not (x_lo <= x0 < x_hi and 455 <= y0 <= 575):
                continue
            txts = [sp["text"] for sp in line["spans"]]
            if txts and all(re.match(r"^[\d/]+$", t) for t in txts):
                digit_lines.append({"x": x0, "y": y0, "s": "".join(txts)})
    scores = []
    for ax, lab in anchors:
        best, best_d = None, None
        for dl in digit_lines:
            if not (ax + 25 <= dl["x"] < ax + 95):
                continue
            dist = abs(dl["x"] - (ax + 63)) + abs(dl["y"] - 475) * 0.4
            if best_d is None or dist < best_d:
                best, best_d = dl, dist
        if not best:
            # 兜底：标签与数值同行被合并成一个 dict line 时，退回词级抓取
            frags = [w[4] for w in words
                     if ax + 25 <= w[0] < ax + 95 and 460 <= w[1] <= 500 and re.match(r"^[\d/]+$", w[4])]
            if frags:
                best = {"s": "".join(frags)}
        if best:
            m = re.match(r"^(\d+)", best["s"])
            if m:
                scores.append({"l": lab, "v": int(m.group(1))})

    # 板型 / 轮廓 / 个性硬度（y 536-585，按标签 x 分段归属）
    trio_band = sorted([w for w in words if 536 <= w[1] <= 585], key=lambda w: (round(w[1]), w[0]))
    trio_anchors = []
    for w in trio_band:
        t = w[4]
        if t.startswith("个性"):
            trio_anchors.append((w[0], "个性/硬度"))
        elif t in ("板型", "版型", "轮廓"):   # 目录个别页把"板型"排成"版型"
            trio_anchors.append((w[0], "板型" if t == "版型" else t))
    trio_anchors.sort(key=lambda a: a[0])
    vals = {"板型": [], "轮廓": [], "个性/硬度": []}
    for w in trio_band:
        t = w[4]
        if t.startswith("个性") or t in ("板型", "版型", "轮廓"):
            continue
        if t == "硬度":   # "个性/" + "硬度" 拆词的残留，属标签一部分
            continue
        owner = None
        for ax, an in trio_anchors:
            if w[0] >= ax - 2:
                owner = an
        if owner and t.strip():
            vals[owner].append(t)
    def join_vals(arr):
        s = cjk_join(arr)
        s = re.sub(r"\s*-\s*", " - ", s)
        s = re.sub(r"\s*&\s*", " & ", s)
        s = re.sub(r"(\d)\s*/\s*(5|10)", r"\1/\2", s)
        return s
    shape = join_vals(vals["板型"])
    profile = join_vals(vals["轮廓"])
    character = join_vals(vals["个性/硬度"])

    return {
        "name": name,
        "tag": tag, "pitch": pitch, "intro": intro, "bullets": bullets,
        "scores": scores, "shape": shape, "profile": profile, "character": character,
    }


def main():
    doc = fitz.open(PDF)
    out = {}
    skipped, dups = [], []
    for pno, page in enumerate(doc, 1):
        for half, (lo, hi) in ((("L", (0, 290))), (("R", (290, 600)))):
            r = extract_half(page, lo, hi)
            if not r:
                continue
            key = NAME_MAP.get(r.pop("name"))
            if not key:
                # 名称在 NAME_MAP 之外但看起来是板（y<25 标题）
                skipped.append((pno, half))
                continue
            if key in out:
                dups.append((pno, half, key))
                continue
            out[key] = r

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("boards:", len(out))
    print("skipped titles:", skipped)
    print("dups:", dups)
    h = out.get("Men’s Howler", {})
    print("--- Howler sample ---")
    for k in ("tag", "pitch", "intro", "bullets", "scores", "shape", "profile", "character"):
        print(k, "=", h.get(k))


if __name__ == "__main__":
    main()
