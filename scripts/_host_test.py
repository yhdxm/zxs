import urllib.request, time, os, sys

LOG = "D:/代码/zxs-main/scripts/ocr_out/_dl_debug.log"
def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        f.flush()

hosts = {
    "github_asset": "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip",
    "raw_github": "https://raw.githubusercontent.com/JaidedAI/EasyOCR/master/README.md",
    "huggingface": "https://huggingface.co/resolve/main/README.md",
    "pypi": "https://pypi.org/simple/lodash/",
}

for name, url in hosts.items():
    log(f"=== TEST {name}: {url}")
    out = f"D:/代码/zxs-main/scripts/ocr_out/_t_{name}.bin"
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=25) as r:
            log(f"  connected, status={r.status}")
            total = 0
            with open(out, "wb") as f:
                while True:
                    c = r.read(1<<20)
                    if not c: break
                    f.write(c); total += len(c)
            dt = time.time()-t0
            log(f"  DONE {total}B ({total/1024/1024:.2f}MB) {dt:.1f}s {total/dt/1024:.1f}KB/s")
    except Exception as e:
        dt = time.time()-t0 if 't0' in dir() else 0
        log(f"  FAIL after {dt:.0f}s: {repr(e)[:160]}")
    log("")
log("ALL HOST TESTS DONE")
