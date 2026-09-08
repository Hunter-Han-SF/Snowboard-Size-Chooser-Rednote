# -*- coding: utf-8 -*-
"""打包 minitool -> dist/jones-26-27-size-helper.zip

包含: index.html + assets/{data,main,style} + assets/bg-*.webp + assets/boards/*.webp
不含: card_test.html（本地调试页）
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "minitool"
OUT = ROOT / "dist" / "jones-26-27-size-helper.zip"

files = [
    SRC / "index.html",
    SRC / "assets" / "data.js",
    SRC / "assets" / "main.js",
    SRC / "assets" / "style.css",
]
files += sorted((SRC / "assets").glob("bg-*.webp"))
files += sorted((SRC / "assets" / "boards").glob("*.webp"))

missing = [f for f in files if not f.exists()]
if missing:
    raise SystemExit("missing: " + ", ".join(map(str, missing)))

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for f in files:
        z.write(f, str(f.relative_to(SRC)))
print("zip:", OUT.stat().st_size // 1024, "KB,", len(files), "files")
