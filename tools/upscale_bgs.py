# -*- coding: utf-8 -*-
"""根目录三张卡片背景图 -> Real-ESRGAN 4x -> 缩到 2x 卡片尺寸 1500x2360
-> minitool/assets/bg-*.webp（文件名不变，代码无需改动）

源: 均衡.png / 灵活.png / 稳定.png (1001x1572)
依赖 tools/realesrgan/realesrgan-ncnn-vulkan.exe（RTX GPU）
"""
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
X4 = ROOT / "tmp" / "bg_x4"
OUT = ROOT / "minitool" / "assets"
X4.mkdir(parents=True, exist_ok=True)

BG = [("均衡.png", "bg-balanced.webp"),
      ("灵活.png", "bg-flexible.webp"),
      ("稳定.png", "bg-stable.webp")]
TARGET = (1500, 2360)  # 2x 卡片物理尺寸，drawImage 时 1:1 像素映射

for src, dst in BG:
    x4png = X4 / (Path(dst).stem + ".png")
    if not x4png.exists():
        r = subprocess.run(
            [str(EXE), "-i", str(ROOT / src), "-o", str(x4png),
             "-n", "realesrgan-x4plus", "-s", "4", "-f", "png"],
            cwd=EXE.parent, capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit("FAIL " + src + " " + r.stderr[-300:])
    img = Image.open(x4png).convert("RGB")
    img = img.resize(TARGET, Image.LANCZOS)
    img.save(OUT / dst, "WEBP", quality=85, method=6)
    print(f"  {src} -> {dst} {img.size} {(OUT / dst).stat().st_size // 1024}KB")
print("done")
