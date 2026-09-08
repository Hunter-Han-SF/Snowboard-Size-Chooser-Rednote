# -*- coding: utf-8 -*-
"""修复问题板图：源图为黑底摄影、含板底+板面双板（或匹配错板）。
按半宽切出指定单板 -> Real-ESRGAN 4x -> 去背 -> 替换
boards_raw_hd/ 与 minitool/assets/boards/。

engine 选择（实测结论）:
- u2net    浅色板在黑底上对比充分，默认引擎即可
- isnet    板体含大片真黑区域的深色板（青绿渐变淡出成黑、黑板底），
           u2net 会把板体暗部当背景切掉，必须用 isnet-general-use
不要用"黑底刷白"方案：板体真黑区域与背景同值且渐变连通，
flood-fill 会沿渐变渗入板体内部，把黑色板体一起刷掉。
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
X4 = ROOT / "tmp" / "boards_fix_x4"
OUT = ROOT / "minitool" / "assets" / "boards"
EXE = ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
OUT_LONG_EDGE = 1200
BG_THRESHOLD = 5  # 源图背景 0-4，板体暗部 5+

# slug -> (保留侧, 去背引擎)
# u2net 必须喂"完整半幅"（含黑边距）——紧裁剪会改变取景导致咬边/变形
FIX = {
    "womens-stratos": ("L", "u2net"),
    "mens-mountain-twin": ("L", "u2net"),
    "mens-mountain-twin-pro": ("R", "isnet"),
    "womens-twin-sister": ("R", "u2net"),
    "mens-tweaker": ("R", "isnet"),
    "freecarver-9000s": ("R", "u2net"),
    "twin-sister-junior": ("R", "u2net"),
}

X4.mkdir(parents=True, exist_ok=True)
_sessions = {}


def get_session(name):
    if name not in _sessions:
        _sessions[name] = new_session("isnet-general-use" if name == "isnet" else "u2net")
    return _sessions[name]


def crop_side(img: Image.Image, side: str):
    """按半宽切分并按内容裁边（黑底阈值），只留单板。
    返回 (裁剪后的单板图, 相对完整半幅的裁剪框)。"""
    w, h = img.size
    half = img.crop((0, 0, w // 2, h) if side == "L" else (w // 2, 0, w, h))
    a = np.array(half.convert("L"))
    ys, xs = np.nonzero(a > BG_THRESHOLD)
    if len(xs) == 0:
        return half, (0, 0, half.size[0], half.size[1])
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(half.size[0], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(half.size[1], ys.max() + pad + 1)
    return half.crop((x0, y0, x1, y1)), (x0, y0, x1, y1)


def cutout(img: Image.Image, engine: str, half: Image.Image):
    """去背 + 保留最大板形连通域 + 填孔收边。

    u2net 跑在 4x 完整半幅上；isnet 在 4x 大图上 alpha 会塌陷且对窄条
    取景敏感，必须跑在源尺寸完整半幅上，软 alpha 放大后使用。
    """
    if engine == "isnet":
        small = remove(half, session=get_session(engine))
        alpha = np.array(small.getchannel("A").resize(img.size, Image.LANCZOS))
    else:
        out = remove(img, session=get_session(engine))
        alpha = np.array(out.getchannel("A"))
    # isnet 对板体暗部的 alpha 是渐变的，阈值过高会把暗缘裁进板内
    thr = 64 if engine == "isnet" else 150
    hard = np.where(alpha > thr, 255, 0).astype(np.uint8)
    if engine == "isnet":
        # isnet 会把源图里板缘微弱反光线一并带出，开运算去除细线残影
        hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))

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
        return None
    pad = 16
    x0, x1 = max(0, xs.min() - pad), min(img.size[0], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(img.size[1], ys.max() + pad + 1)
    return Image.fromarray(rgba[y0:y1, x0:x1])


targets = sys.argv[1:] or list(FIX)
for slug in targets:
    side, engine = FIX[slug]
    src = RAW / (slug + ".webp")
    full = Image.open(src).convert("RGB")
    fw, fh = full.size
    half = full.crop((0, 0, fw // 2, fh) if side == "L" else (fw // 2, 0, fw, fh))

    x4png = X4 / f"{slug}_{side}_full.png"
    if not x4png.exists():
        tmp_in = X4 / f"_{slug}_{side}_full.png"
        half.save(tmp_in)
        r = subprocess.run(
            [str(EXE), "-i", str(tmp_in), "-o", str(x4png),
             "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"],
            cwd=EXE.parent, capture_output=True, text=True)
        tmp_in.unlink(missing_ok=True)
        if r.returncode != 0:
            print("FAIL upscale:", slug, r.stderr[-200:])
            continue
    img = Image.open(x4png).convert("RGB")
    img.save(HD / (slug + ".webp"), "WEBP", quality=88, method=6)

    cut = cutout(img, engine, half)
    if cut is None:
        print("EMPTY cutout:", slug)
        continue
    w, h = cut.size
    scale = OUT_LONG_EDGE / max(w, h)
    if scale < 1:
        cut = cut.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dst = OUT / (slug + ".webp")
    cut.save(dst, "WEBP", quality=80, method=6)
    print(f"  {slug:26s} {side} {engine:6s} cut={cut.size} {dst.stat().st_size // 1024}KB")
print("done")
