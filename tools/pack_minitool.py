# -*- coding: utf-8 -*-
"""打包 minitool -> dist/jones-26-27-size-helper.zip

包含: index.html + assets/{data,main,style} + assets/hero-*.webp + assets/bg-*.webp + assets/boards/*.webp
不含: card_test.html（本地调试页）；motion.js 已于 2026-11-06 移除
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
files += [SRC / "assets" / ("hero-" + color + ".webp") for color in ("blue", "green", "red")]
files += sorted((SRC / "assets").glob("bg-*.webp"))
files += sorted((SRC / "assets" / "boards").glob("*.webp"))

missing = [f for f in files if not f.exists()]
if missing:
    raise SystemExit("missing: " + ", ".join(map(str, missing)))

# 仓库 core.autocrlf=true：Windows 工作区文本为 CRLF，而历史 zip 内为 LF。
# 文本条目统一归一为 LF 再入包，避免每次本机重打包产生无意义的 EOL 差异。
TEXT_EXT = {".html", ".css", ".js", ".json"}

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for f in files:
        arc = str(f.relative_to(SRC))
        if f.suffix.lower() in TEXT_EXT:
            data = f.read_bytes().replace(b"\r\n", b"\n")
            z.writestr(arc, data)
        else:
            z.write(f, arc)
print("zip:", OUT.stat().st_size // 1024, "KB,", len(files), "files")
