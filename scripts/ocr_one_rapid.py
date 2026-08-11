"""
RapidOCR 版 OCR（PP-OCRv4 ONNX 权重，随 pip 包内置，无需外部下载；
onnxruntime 在 Windows CPU 上稳定，无 paddle 的 onednn/PIR bug）。
单进程顺序处理三本 PDF，断点续跑 + 每 10 页增量落盘。
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
DPI = int(os.environ.get("OCR_DPI", "120"))

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
        arr = arr[:, :, ::-1].copy()          # RGB -> BGR (OpenCV/RapidOCR 期望)
    elif pix.n == 1:
        arr = np.stack([arr[:, :, 0]] * 3, axis=-1)
    return arr

def main():
    from rapidocr_onnxruntime import RapidOCR
    # 可选参数：只处理指定 key（如 `python ocr_one_rapid.py dagang` 或 `zhinan moni`）
    args = [a for a in sys.argv[1:] if a in PDFS]
    targets = {k: PDFS[k] for k in args} if args else PDFS
    log(f"目标 PDF: {list(targets.keys())} | DPI={DPI}")

    log("初始化 RapidOCR（模型已随包内置）…")
    t0 = time.time()
    engine = RapidOCR()
    log(f"RapidOCR ready in {time.time()-t0:.0f}s")

    overall_start = time.time()
    processed_total = 0

    for key, fname in targets.items():
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
        t_pdf = time.time()
        last_save = len(data)
        for cnt, i in enumerate(pending, 1):
            img = render_page(doc, i)
            result, _ = engine(img)
            txt = "\n".join([item[1] for item in (result or [])]) if result else ""
            data.append({"t": txt, "p": i + 1})
            processed_total += 1
            if len(data) - last_save >= 10:
                save(key, data); last_save = len(data)
                el = time.time() - t_pdf
                rate = (len(data) - (len(done_pages))) / el if el > 0 else 0
                log(f"  {key} 进度 {len(data)}/{n} | 本PDF速率 {rate:.2f} 页/秒")
        save(key, data)
        el = time.time() - t_pdf
        rate = (len(data) - len(done_pages)) / el if el > 0 else 0
        log(f"  {key} 完成 {len(data)}/{n} | 用时 {el:.0f}s | 速率 {rate:.2f} 页/秒")
        doc.close()

    total_el = time.time() - overall_start
    rate_all = processed_total / total_el if total_el > 0 else 0
    log(f"ALL DONE. 本次新增 {processed_total} 页 | 总用时 {total_el:.0f}s | 平均 {rate_all:.2f} 页/秒")

if __name__ == "__main__":
    main()
