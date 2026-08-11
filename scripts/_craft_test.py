import urllib.request, os
url = "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip"
out = "D:/代码/zxs-main/scripts/ocr_out/_craft_test2.zip"
t0 = __import__('time').time()
try:
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        total = 0
        with open(out, "wb") as f:
            while True:
                c = r.read(1<<20)
                if not c: break
                f.write(c); total += len(c)
    dt = __import__('time').time()-t0
    print(f"OK {total}B ({total/1024/1024:.1f}MB) {dt:.0f}s {total/dt/1024:.1f}KB/s")
except Exception as e:
    dt = __import__('time').time()-t0
    print(f"FAIL after {dt:.0f}s: {repr(e)[:150]}")
    if os.path.exists(out): print("partial", os.path.getsize(out))
