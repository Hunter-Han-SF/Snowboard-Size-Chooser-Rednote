# -*- coding: utf-8 -*-
"""从 Jones 目录 PDF 提取每个型号的雪板产品图 -> minitool/assets/boards/<slug>.webp

版面规律（实测，目录 p35-91 为产品区）：
- 每个产品占对开页的一半：顶部大字标题 + 493x493 板照（白底、板子斜放）
- 分离板产品页 p81-88（标题如 "Storm Chaser分离板"），儿童款 p76-78
- p92 起是软商品（板名命名的服装系列），必须排除

策略：
1) 分离板/儿童款用 HARDWARE 精确映射（页码 + 方块 x 坐标）
2) 实心板在 p35-79 自动匹配：标题(页顶大字)水平距离最近的达标大图
3) 全局按图片 xref 去重，硬编码优先占位
"""
import io
import json
import re
from pathlib import Path

import fitz
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
PDF = r"C:\Users\Administrator\Downloads\2627 中文Jones Catalog5 .pdf"
OUT = ROOT / "minitool" / "assets" / "boards"
OUT.mkdir(parents=True, exist_ok=True)

data = json.loads((ROOT / "data" / "jones-specs.json").read_text(encoding="utf-8"))

# 精确映射：型号 -> (0基页码, 方块 bbox x0)。坐标均经实测核对。
HARDCODE = {
    "Ultralight Butterfly Split":        (80, 40),
    "Ultralight Hovercraft 2.0 Split":   (80, 309),
    "Men’s Solution":                    (81, 309),
    "Men’s Ultralight Solution":         (81, 40),
    "Youth Prodigy":                     (77, 40),
    "Men’s Howler Split":                (82, 40),
    "Men’s Stratos Split":               (82, 309),
    "Storm Chaser Split":                (83, 40),
    "Hovercraft 2.0 Split":              (83, 309),
    "Men’s Frontier 2.0 Split":          (84, 40),
    "Women’s Solution":                  (85, 40),
    "Women’s Howler Split":              (85, 309),
    "Women’s Stratos Split":             (86, 40),
    "Women’s Dream Weaver 2.0 Split":    (86, 309),
    "Solution Junior":                   (87, 40),
    "Flagship Junior":                   (75, 40),
    "Mountain Twin Junior":              (75, 309),
    "Twin Sister Junior":                (76, 40),
    "Kids Prodigy Package":              (77, 315),
}

SOLID_RANGE = range(34, 79)   # 0 基：p35-79 实心板产品区
MIN_DIM = 180
MIN_AREA = 90000

def slug(name):
    s = name.replace("’", "").replace("'", "")
    return re.sub(r"[^0-9A-Za-z]+", "-", s).strip("-").lower()

def name_variants(name):
    vs = [name]
    if name.startswith(("Men’s ", "Women’s ")):
        vs.append(name.split(" ", 1)[1])
    return vs

doc = fitz.open(PDF)

def page_squares(page):
    """达标大方块图：[(xref, pix, cx, cy)]，排除满页背景"""
    pw, ph = page.rect.width, page.rect.height
    out = []
    for info in page.get_image_info(xrefs=True):
        w, h = info["width"], info["height"]
        if min(w, h) < MIN_DIM or w * h < MIN_AREA:
            continue
        bb = info["bbox"]
        if (bb[2] - bb[0]) * (bb[3] - bb[1]) > 0.8 * pw * ph:
            continue
        xref = info["xref"]
        try:
            pix = fitz.Pixmap(doc, xref)
        except Exception:
            continue
        out.append((xref, pix, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, bb[0]))
    return out

def trim_white(img, tol=12):
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img.convert("RGB"), bg)
    diff = ImageChops.add(diff, diff, 2.0, -tol)
    bbox = diff.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    pad = 6
    x0, y0 = max(0, x0 + pad), max(0, y0 + pad)
    x1, y1 = min(img.width, x1 - pad), min(img.height, y1 - pad)
    if x1 - x0 < 60 or y1 - y0 < 60:
        return img
    return img.crop((x0, y0, x1, y1))

def save_webp(pix, path):
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    img = trim_white(img)
    w, h = img.size
    scale = 560 / max(w, h)
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    img.save(path, "WEBP", quality=72, method=6)
    return path.stat().st_size

used_xrefs = set()
report, missing = [], []

def extract(model_name, pix, xref, src):
    used_xrefs.add(xref)
    out_path = OUT / (slug(model_name) + ".webp")
    size = save_webp(pix, out_path)
    report.append((model_name, out_path.name, size, src))

# ---- 1. 硬编码映射（分离板 + 儿童款）----
for name, (pno, want_x) in HARDCODE.items():
    sqs = [s for s in page_squares(doc[pno]) if abs(s[4] - want_x) < 25 and s[0] not in used_xrefs]
    if sqs:
        sqs.sort(key=lambda s: abs(s[4] - want_x))
        extract(name, sqs[0][1], sqs[0][0], f"p{pno+1}")
    else:
        missing.append(name)

# ---- 2. 实心板自动匹配 ----
for m in data:
    name = m["name"]
    if name in HARDCODE:
        continue
    out_path = OUT / (slug(name) + ".webp")
    if out_path.exists():
        report.append((name, out_path.name, out_path.stat().st_size, "cached"))
        continue
    variants = name_variants(name)
    best = None
    for pno in SOLID_RANGE:
        page = doc[pno]
        texts = []
        for v in variants:
            for r in page.search_for(v):
                if r.y0 < 300:
                    texts.append(r)
        if not texts:
            continue
        for xref, pix, cx, cy, bx0 in page_squares(page):
            if xref in used_xrefs:
                continue
            for tr in texts:
                tcx = (tr.x0 + tr.x1) / 2
                score = abs(cx - tcx) * 2 + abs(cy - tr.y0)
                if best is None or score < best[0]:
                    best = (score, pix, xref, pno)
    if best is None:
        missing.append(name)
    else:
        extract(name, best[1], best[2], f"p{best[3]+1}")

total = sum(r[2] for r in report)
print(f"extracted: {len(report)}, missing: {len(missing)}, total: {total/1024:.0f} KB")

# 人工校对修正：男女款同名板（Stratos / Rally Cat）的标题文字相同，
# 自动匹配会互相选错页面，提取后强制交换
for a, b in [("mens-stratos", "womens-stratos"), ("mens-rally-cat", "womens-rally-cat")]:
    fa = OUT / (a + ".webp")
    fb = OUT / (b + ".webp")
    if fa.exists() and fb.exists():
        tmp = OUT / "_swap_tmp.webp"
        fa.rename(tmp); fb.rename(fa); tmp.rename(fb)
        print(f"swapped (manual fix): {a} <-> {b}")
for name, fn, size, src in sorted(report, key=lambda r: r[1]):
    print(f"  {fn:38s} {size/1024:6.1f} KB  ({src})  {name}")
if missing:
    print("MISSING:", ", ".join(missing))
