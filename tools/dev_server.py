# -*- coding: utf-8 -*-
"""开发服务器：静态文件 + 改动自动刷新（仅本地开发用，不打包进 zip）

- 服务 minitool/ 目录（http://127.0.0.1:8734/）
- HTML 响应自动注入一段脚本，与 /__reload 建立 SSE 连接
- 任何文件变动 -> 浏览器自动刷新页面
"""
import http.server
import socketserver
import time
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent / "minitool"
PORT = 8734

INJECT = b"""
<script>
(function () {
  try {
    var es = new EventSource('/__reload');
    es.onmessage = function () { location.reload(); };
  } catch (e) {}
})();
</script>
"""


def snapshot():
    sts = []
    for p in sorted(ROOT.rglob("*")):
        if p.is_file():
            sts.append((str(p.relative_to(ROOT)), p.stat().st_mtime))
    return sts


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass  # 安静模式

    def do_GET(self):
        if self.path == "/__reload":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            last = snapshot()
            try:
                while True:
                    time.sleep(0.5)
                    if snapshot() != last:
                        self.wfile.write(b"data: reload\n\n")
                        self.wfile.flush()
                        last = snapshot()
                    else:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except Exception:
                pass  # 连接断开
            return

        path = unquote(self.path.split("?")[0])
        if path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            html = (ROOT / "index.html").read_bytes().replace(b"</body>", INJECT + b"</body>")
            self.wfile.write(html)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # 开发期禁缓存
        super().end_headers()


class DevServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    print(f"[dev] serving {ROOT} -> http://127.0.0.1:{PORT}/ (live reload on)")
    with DevServer(("127.0.0.1", PORT), DevHandler) as httpd:
        httpd.serve_forever()
