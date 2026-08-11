"""
PaddleOCR 2.x 版 OCR（经典预测器，PP-OCRv4，不用 paddlex，
避开 paddleocr 3.x / paddle 3.3.1 在 Windows CPU 上的 onednn PIR bug）。
单实例顺序处理三本 PDF，批量推理提速，断点续跑 + 每 10 页增量落盘。
输出 scripts/ocr_out/{dagang,zhinan,moni}_ocr.json： [{"t":文本,"p":页码}]。
"""
import os, sys, json, time, fitz, numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "ocr_out")
os.makedirs(OUT, exist_ok=True)
PDF_DIR = os.path.join(os.path.dirname(BASE), "public", "pdfs", "degree")

PDFS = {
    "dagang": "dagang.pdf",
    "zhinan": "zhinan.pdf",
    "moni":   "moni.pdf",
}
DPI = 150
BATCH = 6

def log(m):
    line = f"[{time.strftime('%H:%M:%S')}] {m}"
    print(line, flush=True)

def load_done(key):
    jf = os.path.join(OUT, f"{key}_ocr.json")
    if os.path.exists(jf):
        try:
            data = json.load(open(jf, encoding="utf-8"))
            done = set(d["p"] for d in data)
            return data, done
        except Exception:
            pass
    return [], set()

def save(key, data):
    jf = os.path.join(OUT, f"{key}_ocr.json")
    tmp = jf + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
    os.replace(tmp, jf)

def render_page(doc, i, dpi=DPI):
    page = doc[i]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 3:
        arr = arr[:, :, ::-1].copy()
    elif pix.n == 1:
        arr = np.stack([arr[:, :, 0]] * 3, axis=-1)
    return arr

def main():
    from paddleocr import PaddleOCR
    log("instantiating PaddleOCR 2.x (首次从 bcebos 下载 PP-OCRv4 模型)…")
    t0 = time.time()
    ocr = PaddleOCR(lang="ch", use_gpu=False, show_log=False)
    log(f"PaddleOCR ready in {time.time()-t0:.0f}s")

    for key, fname in PDFS.items():
        pdf_path = os.path.join(PDF_DIR, fname)
        if not os.path.exists(pdf_path):
            log(f"[skip] {key}: {pdf_path} 不存在")
            continue
        data, done_pages = load_done(key)
        doc = fitz.open(pdf_path)
        n = doc.page_count
        log(f"=== {key}: {n} 页, 已完成 {len(done_pages)} 页 ===")
        pending = [i for i in range(n) if (i + 1) not in done_pages]
        if not pending:
            log(f"  {key} 已全部完成，跳过")
            doc.close()
            continue
        batch_imgs, batch_idx, saved_since = [], [], 0
        total_out = 0
        for i in pending:
            batch_imgs.append(render_page(doc, i))
            batch_idx.append(i)
            if len(batch_imgs) >= BATCH:
                results = ocr.ocr(batch_imgs, cls=True)
                for bi, res in enumerate(results):
                    pno = batch_idx[bi] + 1
                    txt = "\n".join([line[1][0] for line in (res or [])]) if res else ""
                    data.append({"t": txt, "p": pno})
                total_out += len(batch_imgs)
                batch_imgs, batch_idx = [], []
                saved_since += BATCH
                if saved_since >= 10:
                    save(key, data); saved_since = 0
                    log(f"  {key} 进度 {len(data)}/{n}")
        if batch_imgs:
            results = ocr.ocr(batch_imgs, cls=True)
            for bi, res in enumerate(results):
                pno = batch_idx[bi] + 1
                txt = "\n".join([line[1][0] for line in (res or [])]) if res else ""
                data.append({"t": txt, "p": pno})
            total_out += len(batch_imgs)
        save(key, data)
        log(f"  {key} 完成 {len(data)}/{n}")
        doc.close()
    log("ALL DONE.")

if __name__ == "__main__":
    main()
