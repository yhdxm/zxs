"""
本地 OCR 进度实时看板服务（仅本机访问）。
GET /           -> 进度看板 HTML（每 2 秒自动刷新）
GET /progress   -> JSON 进度数据
读取 scripts/ocr_out/{key}_ocr.json 的页数。
"""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "scripts", "ocr_out")
PDFS = {
    "dagang": ("大纲 dagang", 236),
    "zhinan": ("指南 zhinan", 162),
    "moni":   ("模拟 moni", 138),
}
TOTAL_PAGES = sum(v[1] for v in PDFS.values())

# 速率滑动窗口
_hist = []  # (ts, done_total)


def _count(key):
    f = os.path.join(OUT, f"{key}_ocr.json")
    if not os.path.exists(f):
        return 0
    try:
        with open(f, encoding="utf-8") as fh:
            return len(json.load(fh))
    except Exception:
        return 0


def get_progress():
    now = time.time()
    per = {}
    done_total = 0
    for k, (name, total) in PDFS.items():
        d = _count(k)
        done_total += d
        per[k] = {"name": name, "done": d, "total": total,
                  "pct": round(d / total * 100, 1) if total else 0}
    remaining = TOTAL_PAGES - done_total

    _hist.append((now, done_total))
    _hist[:] = [h for h in _hist if now - h[0] <= 60]
    rate = 0.0
    if len(_hist) >= 2:
        dt = _hist[-1][0] - _hist[0][0]
        dd = _hist[-1][1] - _hist[0][1]
        if dt > 0:
            rate = dd / dt
    eta = int(remaining / rate) if rate > 0 else None
    return {
        "per": per,
        "done_total": done_total,
        "total_pages": TOTAL_PAGES,
        "remaining": remaining,
        "overall_pct": round(done_total / TOTAL_PAGES * 100, 1),
        "rate": round(rate, 3),
        "eta_sec": eta,
        "ts": int(now),
    }


HTML = """<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OCR 实时进度</title>
<style>
:root{--primary:#6a5acd;--bg:#f5f6fa;--card:#fff;--text:#2c2f36;--muted:#8a90a0;}
*{box-sizing:border-box;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
body{margin:0;background:var(--bg);color:var(--text);padding:18px}
h1{font-size:20px;margin:0 0 4px}
.sub{color:var(--muted);font-size:13px;margin-bottom:16px}
.card{background:var(--card);border-radius:14px;padding:16px 18px;box-shadow:0 2px 10px rgba(0,0,0,.05);margin-bottom:14px}
.big{font-size:30px;font-weight:700;color:var(--primary)}
.row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.name{font-weight:600}
.meta{color:var(--muted);font-size:13px}
.bar{height:14px;background:#eceef3;border-radius:8px;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#7b6cf6,#9b8cff);border-radius:8px;transition:width .4s ease}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:6px}
.stat{background:#f0f1f6;border-radius:10px;padding:10px 12px}
.stat .k{color:var(--muted);font-size:12px}
.stat .v{font-size:18px;font-weight:700;margin-top:2px}
.refresh{color:var(--muted);font-size:12px;margin-top:10px}
</style></head><body>
<h1>📄 学位英语三本 PDF · OCR 实时进度</h1>
<div class="sub" id="sub">加载中…</div>
<div class="card">
  <div class="row"><span class="name">总进度</span><span class="meta" id="ovmeta"></span></div>
  <div class="bar"><div class="fill" id="ovfill" style="width:0%"></div></div>
  <div class="stats">
    <div class="stat"><div class="k">已完成</div><div class="v" id="done">-</div></div>
    <div class="stat"><div class="k">剩余</div><div class="v" id="rem">-</div></div>
    <div class="stat"><div class="k">实时速率</div><div class="v" id="rate">-</div></div>
    <div class="stat"><div class="k">预计剩余</div><div class="v" id="eta">-</div></div>
  </div>
</div>
<div id="cards"></div>
<div class="refresh" id="refresh"></div>
<script>
function fmtETA(s){if(s==null)return '计算中';if(s<60)return s+' 秒';m=Math.floor(s/60);r=s%60;return m+' 分 '+(r?r+' 秒':'')}
function fmtRate(r){if(!r)return '0 页/秒';return r.toFixed(2)+' 页/秒'}
async function tick(){
  try{
    const r=await fetch('/progress');const d=await r.json();
    document.getElementById('sub').textContent='最后更新 '+new Date(d.ts*1000).toLocaleTimeString();
    document.getElementById('ovfill').style.width=d.overall_pct+'%';
    document.getElementById('ovmeta').textContent=d.overall_pct+'%';
    document.getElementById('done').textContent=d.done_total+' / '+d.total_pages;
    document.getElementById('rem').textContent=d.remaining;
    document.getElementById('rate').textContent=fmtRate(d.rate);
    document.getElementById('eta').textContent=fmtETA(d.eta_sec);
    let html='';
    for(const k in d.per){const p=d.per[k];
      html+='<div class="card"><div class="row"><span class="name">'+p.name+'</span><span class="meta">'+p.done+' / '+p.total+' 页</span></div>'+
      '<div class="bar"><div class="fill" style="width:'+p.pct+'%"></div></div></div>';
    }
    document.getElementById('cards').innerHTML=html;
    document.getElementById('refresh').textContent='每 2 秒自动刷新';
  }catch(e){document.getElementById('refresh').textContent='连接中… '+e;}
}
tick();setInterval(tick,2000);
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/progress"):
            body = json.dumps(get_progress()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            body = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PROG_PORT", "8765"))
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"OCR progress dashboard on http://localhost:{port}")
    srv.serve_forever()
