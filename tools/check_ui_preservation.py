"""Verify the visual upgrade preserves the astra content/behavior baseline.

One-off release guard, not a replacement for browser interaction checks.
Run from any directory: python tools/check_ui_preservation.py
"""
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "72b6e22f6f281e5df8be652fba9365459bf381f2"


def original(path):
    return subprocess.check_output(["git", "show", BASE + ":" + path], cwd=ROOT)


class Content(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.text, self.controls = {}, [], []
        self.body = False
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "body":
            self.body = True
        if not self.body:
            return
        if attrs.get("id") == "motionToggle":
            self.skip = 1
            return
        if self.skip:
            self.skip += 1
            return
        if "id" in attrs:
            assert attrs["id"] not in self.ids, "Duplicate ID: " + attrs["id"]
            self.ids[attrs["id"]] = (tag, attrs)
        if tag in ("input", "button", "select", "option", "summary", "details"):
            self.controls.append((tag, attrs))

    def handle_endtag(self, tag):
        if self.skip:
            self.skip -= 1
        if tag == "body":
            self.body = False

    def handle_data(self, data):
        if self.body and not self.skip and data.strip():
            self.text.append(re.sub(r"\s+", " ", data.strip()))


before, after = Content(), Content()
before.feed(original("minitool/index.html").decode("utf-8"))
after.feed((ROOT / "minitool/index.html").read_text(encoding="utf-8"))
assert before.ids == after.ids, "Existing DOM IDs or attributes changed"
assert before.controls == after.controls, "Existing control, value or expansion state changed"
assert before.text == after.text, "Existing page copy changed or was omitted"

# main.js 的字节级基线比对自 2026-11-06 缺陷修复批次起停用：
# 该批次有意修改了 main.js（弹层预览图 bpPreviewImg 接线、出界检测 rcs-mark
# 标签标记对齐 CSS），无法再与 72b6e22 逐字节一致。此处改为记录在案的语义断言；
# data.js 仍保持严格字节比对（数据不得变动）。
for file in ("minitool/assets/data.js",):
    previous = original(file).replace(b"\r\n", b"\n")
    current = (ROOT / file).read_bytes().replace(b"\r\n", b"\n")
    if file == "minitool/assets/data.js":
        image_version = rb'("img":"\./assets/boards/[a-z0-9-]+\.webp\?v=)\d+(")'
        previous = re.sub(image_version, rb'\g<1>CACHE\2', previous)
        current = re.sub(image_version, rb'\g<1>CACHE\2', current)
    assert previous == current, file + " changed"

main_js = (ROOT / "minitool/assets/main.js").read_text(encoding="utf-8")
assert "bpPreviewImg" in main_js, "picker preview image wiring removed"
assert 'className = "rcs-mark" + (pct(s.waist) > 76 ? " is-right" : "")' in main_js, "rcs-mark label markup regressed"
assert "rcs-mark-lbl" not in main_js, "stale rcs-mark-lbl markup re-introduced"
assert "motionToggle" not in main_js and "motion.js" not in main_js, "motion layer should be fully removed"
index_html = (ROOT / "minitool/index.html").read_text(encoding="utf-8")
assert "motion.js" not in index_html and "motionToggle" not in index_html, "motion layer should be fully removed"
css = (ROOT / "minitool/assets/style.css").read_text(encoding="utf-8")
assert ".rcs-meta" in css, "rcs-meta styles removed"
assert "motion-active" not in css and "motion-toggle" not in css, "motion CSS should be fully removed"
print(f"PASS: {len(before.ids)} existing IDs, {len(before.controls)} controls, {len(before.text)} text segments preserved")
print("PASS: complete model/spec data unchanged; documented main.js fixes verified (picker preview, rcs-mark label, motion removal)")
