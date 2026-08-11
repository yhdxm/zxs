import urllib.request, time, os, sys, zipfile

MODEL_DIR = os.path.expanduser("~/.EasyOCR/model")
os.makedirs(MODEL_DIR, exist_ok=True)

MODELS = [
    ("craft_mlt_25k.pth", "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip"),
    ("zh_sim_g2.pth",     "https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/zh_sim_g2.zip"),
    ("english_g2.pth",    "https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english_g2.zip"),
]

def download(url, out, timeout=240):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        with open(out, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)

for fname, url in MODELS:
    dst = os.path.join(MODEL_DIR, fname)
    if os.path.exists(dst) and os.path.getsize(dst) > 1_000_000:
        print(f"[skip] {fname} already present")
        continue
    zip_path = os.path.join(MODEL_DIR, fname + ".zip")
    print(f"[get ] {fname} <- {url}", flush=True)
    t0 = time.time()
    ok = False
    for attempt in range(10):
        try:
            if os.path.exists(zip_path):
                os.remove(zip_path)
            download(url, zip_path, timeout=240)
            ok = True
            break
        except Exception as e:
            print(f"   attempt {attempt+1} failed: {repr(e)[:120]} ({(time.time()-t0):.0f}s)", flush=True)
            time.sleep(5)
    if not ok:
        print(f"[FAIL] {fname} could not download", flush=True)
        continue
    dt = time.time() - t0
    sz = os.path.getsize(zip_path)
    print(f"   downloaded {sz/1024/1024:.1f}MB in {dt:.0f}s ({sz/dt/1024:.1f}KB/s)", flush=True)
    # extract the .pth
    try:
        with zipfile.ZipFile(zip_path) as z:
            z.extract(fname, MODEL_DIR)
        os.remove(zip_path)
        print(f"[done] {fname} extracted", flush=True)
    except Exception as e:
        print(f"[FAIL extract] {fname}: {repr(e)[:120]}", flush=True)

print("ALL MODELS DONE", flush=True)
