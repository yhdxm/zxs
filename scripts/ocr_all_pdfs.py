import fitz, os, json, numpy as np, easyocr, time, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE, "public", "pdfs", "degree")
OUT = os.path.join(BASE, "scripts", "ocr_out")
os.makedirs(OUT, exist_ok=True)
LOG = os.path.join(OUT, "ocr_progress.log")

pdfs = [
    ("dagang", "dagang.pdf"),
    ("zhinan", "zhinan.pdf"),
    ("moni",   "moni.pdf"),
]

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

log("loading easyocr Reader(ch_sim,en) ...")
t0 = time.time()
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
log(f"reader loaded in {time.time()-t0:.1f}s")

SAVE_EVERY = 10

for key, fname in pdfs:
    path = os.path.join(PDF_DIR, fname)
    doc = fitz.open(path)
    n = doc.page_count
    out_path = os.path.join(OUT, f"{key}_ocr.json")
    # resume if partial exists
    data = []
    if os.path.exists(out_path):
        try:
            data = json.load(open(out_path, encoding="utf-8"))
            log(f"resume {key}: {len(data)}/{n} pages already done")
        except Exception:
            data = []
    start = len(data)
    for i in range(start, n):
        pg = doc[i]
        pix = pg.get_pixmap(dpi=150)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        try:
            txts = reader.readtext(arr, detail=0, paragraph=True)
        except Exception as e:
            txts = [f"<OCR_ERR:{e}>"]
        data.append({"p": i + 1, "t": "\n".join(txts)})
        if (i + 1) % SAVE_EVERY == 0:
            json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
            log(f"{key} {i+1}/{n} saved")
    json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    doc.close()
    log(f"DONE {key} pages={n} -> {out_path}")

log("ALL_OCR_DONE")
