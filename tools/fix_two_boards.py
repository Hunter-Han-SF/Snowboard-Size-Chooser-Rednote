# -*- coding: utf-8 -*-
"""定点重修 mens-mountain-twin 与 freecarver-9000s（只处理这两张）。

- 9000s: 精确还原第一版通过配方 —— 完整半幅 -> 4x -> u2net
- MT:    u2net(4x 完整半幅, 有黑色板体但缺左上角) ∪
         isnet(源尺寸完整半幅, 有左上角但缺黑色板体)
         两个遮罩并集互补成完整板。
"""
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "boards_raw"
HD = ROOT / "data" / "boards_raw_hd"
X4 = ROOT / "tmp" / "boards_fix_x4"
OUT = ROOT / "minitool" / "assets" / "boards"
EXE = ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
OUT_LONG_EDGE = 1200
X4.mkdir(parents=True, exist_ok=True)

U2NET = new_session("u2net")
ISNET = new_session("isnet-general-use")


def upscale(src: Image.Image, dst: Path) -> Image.Image:
    if not dst.exists():
        tmp = dst.with_suffix(".tmp.png")
        src.save(tmp)
        r = subprocess.run(
            [str(EXE), "-i", str(tmp), "-o", str(dst),
             "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"],
            cwd=EXE.parent, capture_output=True, text=True)
        tmp.unlink(missing_ok=True)
        if r.returncode != 0:
            raise SystemExit("FAIL upscale " + r.stderr[-200:])
    return Image.open(dst).convert("RGB")


def postprocess(hard: np.ndarray, img: Image.Image) -> Image.Image:
    """保留最大板形连通域 -> 填孔 -> 收边 -> 羽化 -> 裁剪。"""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(hard, 8)
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
    pad = 16
    x0, x1 = max(0, xs.min() - pad), min(img.size[0], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(img.size[1], ys.max() + pad + 1)
    return Image.fromarray(rgba[y0:y1, x0:x1])


def finish(slug, cut):
    w, h = cut.size
    scale = OUT_LONG_EDGE / max(w, h)
    if scale < 1:
        cut = cut.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dst = OUT / (slug + ".webp")
    cut.save(dst, "WEBP", quality=80, method=6)
    print(f"  {slug:22s} cut={cut.size} {dst.stat().st_size // 1024}KB", flush=True)


for slug in ["mens-mountain-twin", "freecarver-9000s"]:
    full = Image.open(RAW / (slug + ".webp")).convert("RGB")
    w, h = full.size
    half = full.crop((w // 2, 0, w, h))  # 右板（板底）
    img = upscale(half, X4 / f"{slug}_R_full.png")  # 完整半幅 4x

    # 主遮罩：u2net 在 4x 完整半幅上（第一版通过配方）
    out_u = remove(img, session=U2NET)
    hard = np.where(np.array(out_u.getchannel("A")) > 150, 255, 0).astype(np.uint8)

    if slug == "mens-mountain-twin":
        # 补遮罩：isnet 在源尺寸完整半幅上（左上角完整），放大后并入。
        # 阈值实测 160 最优：并上补角的同时不带入软 alpha 晕线（60/110 有边缘晕线）
        small = remove(half, session=ISNET)
        a_i = np.array(small.getchannel("A").resize(img.size, Image.LANCZOS))
        hard = cv2.bitwise_or(hard, np.where(a_i > 160, 255, 0).astype(np.uint8))

    img.save(HD / (slug + ".webp"), "WEBP", quality=88, method=6)
    finish(slug, postprocess(hard, img))
print("done")
