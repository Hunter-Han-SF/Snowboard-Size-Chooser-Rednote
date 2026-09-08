# -*- coding: utf-8 -*-
"""boards_raw (PDF 内嵌 ~481px 白底图) -> AI 超分 4x -> boards_raw_hd 白底高清版
                                        -> rembg 去背 -> boards_hd 透明底版(长边 1200)

依赖 tools/realesrgan/realesrgan-ncnn-vulkan.exe（RTX GPU, Vulkan）。
流程同 remove_bg.py，仅在超分后的图上执行，形态学参数按 4x 缩放。
"""
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "boards_raw"
HD = ROOT / "data" / "boards_raw_hd"
X4 = ROOT / "tmp" / "boards_x4"
OUT = ROOT / "minitool" / "assets" / "boards_hd"
EXE = ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
MODEL = "realesrgan-x4plus"
OUT_LONG_EDGE = 1200

for d in (HD, X4, OUT):
    d.mkdir(parents=True, exist_ok=True)

session = new_session("u2net")

files = sorted(RAW.glob("*.webp"))
if len(sys.argv) > 1:  # 只处理指定文件，便于单张测试
    files = [f for f in files if f.stem in sys.argv[1:]]

total = 0
for f in files:
    # ---- 1) GPU 超分 4x ----
    x4png = X4 / (f.stem + ".png")
    if not x4png.exists():
        r = subprocess.run(
            [str(EXE), "-i", str(f), "-o", str(x4png), "-n", MODEL, "-s", "4", "-f", "png"],
            cwd=EXE.parent, capture_output=True, text=True)
        if r.returncode != 0:
            print("FAIL upscale:", f.name, r.stderr[-300:])
            continue
    img = Image.open(x4png).convert("RGB")

    # 白底高清版归档（仅压缩，不再缩放）
    hd = HD / f.name
    img.save(hd, "WEBP", quality=88, method=6)

    # ---- 2) rembg 去背（同 remove_bg.py，形态学按 4x 缩放）----
    out = remove(img, session=session)
    a = np.array(out.getchannel("A"))
    hard = np.where(a > 150, 255, 0).astype(np.uint8)

    n, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
    if n > 1:
        best, best_area = 0, 0
        for i in range(1, n):
            x, y, cw, ch, area = stats[i]
            if area < 0.05 * hard.size or ch / max(cw, 1) < 1.5:
                continue
            if area > best_area:
                best, best_area = i, area
        if best:
            hard = np.where(labels == best, 255, 0).astype(np.uint8)

    ff = hard.copy()
    fmask = np.zeros((hard.shape[0] + 2, hard.shape[1] + 2), np.uint8)
    cv2.floodFill(ff, fmask, (0, 0), 255)
    hard = cv2.bitwise_or(hard, cv2.bitwise_not(ff))
    hard = cv2.erode(hard, np.ones((5, 5), np.uint8), 1)
    hard = cv2.GaussianBlur(hard, (5, 5), 0)

    rgba = np.dstack([np.array(img), hard])
    ys, xs = np.nonzero(hard)
    if len(xs) == 0:
        print("EMPTY:", f.name)
        continue
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = 16
    out_im = Image.fromarray(rgba[max(0, y0 - pad):y1 + pad + 1, max(0, x0 - pad):x1 + pad + 1])
    w, h = out_im.size
    scale = OUT_LONG_EDGE / max(w, h)
    if scale < 1:
        out_im = out_im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dst = OUT / f.name
    out_im.save(dst, "WEBP", quality=80, method=6)
    total += dst.stat().st_size
    print(f"  {f.name:40s} hd={hd.stat().st_size // 1024:4d}KB cut={dst.stat().st_size // 1024:4d}KB {out_im.size}", flush=True)

print("TOTAL cut", total // 1024, "KB")
