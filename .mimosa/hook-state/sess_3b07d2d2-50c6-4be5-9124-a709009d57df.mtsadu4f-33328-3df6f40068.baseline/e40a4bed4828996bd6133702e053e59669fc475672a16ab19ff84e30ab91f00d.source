# -*- coding: utf-8 -*-
"""最终版：boards_raw -> boards 透明底单板图

rembg(U2Net) 分割 -> alpha 硬阈值 -> 保留最大板形连通域（正面/背面取其一）
-> 填内部孔洞 -> 裁剪 -> 长边 560 WebP。
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "boards_raw"
OUT = ROOT / "minitool" / "assets" / "boards"
OUT.mkdir(parents=True, exist_ok=True)

session = new_session("u2net")

total = 0
for f in sorted(RAW.glob("*.webp")):
    img = Image.open(f).convert("RGB")
    out = remove(img, session=session)
    a = np.array(out.getchannel("A"))
    hard = np.where(a > 150, 255, 0).astype(np.uint8)

    # 保留最大板形连通域
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

    # 填孔 + 收边 1px
    ff = hard.copy()
    fmask = np.zeros((hard.shape[0] + 2, hard.shape[1] + 2), np.uint8)
    cv2.floodFill(ff, fmask, (0, 0), 255)
    hard = cv2.bitwise_or(hard, cv2.bitwise_not(ff))
    hard = cv2.erode(hard, np.ones((2, 2), np.uint8), 1)
    hard = cv2.GaussianBlur(hard, (3, 3), 0)

    rgba = np.dstack([np.array(img), hard])
    ys, xs = np.nonzero(hard)
    if len(xs) == 0:
        print("EMPTY:", f.name)
        continue
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = 4
    out = Image.fromarray(rgba[max(0, y0 - pad):y1 + pad + 1, max(0, x0 - pad):x1 + pad + 1])
    w, h = out.size
    scale = 560 / max(w, h)
    if scale < 1:
        out = out.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dst = OUT / f.name
    out.save(dst, "WEBP", quality=72, method=6)
    total += dst.stat().st_size
    print(f"  {f.name:40s} {dst.stat().st_size // 1024:4d}KB {out.size}")
print("TOTAL", total // 1024, "KB")
