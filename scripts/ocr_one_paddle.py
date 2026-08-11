"""
PaddleOCR 版 OCR：单实例处理三本 PDF（大纲/指南/模拟），
输出 scripts/ocr_out/{dagang,zhinan,moni}_ocr.json，结构与 easyocr 版一致：
  [ {"t": "页面全文(按行\\n连接)", "p": 页码}, ... ]
- 模型自动从 bcebos 下载（本环境可达；GitHub 被墙故不用 easyocr）。
- 断点续跑：已落盘的页跳过。
- 每 10 页增量写盘。
- 批量推理：一次送 BATCH 页，提速。
"""
import os, sys, json, time, fitz, numpy as np

# 禁用 oneDNN：paddlepaddle 3.3.1 的 onednn 路径不支持 PP-OCRv6 的个别算子，回退原生 CPU 内核
os.environ["PADDLE_DISABLE_ONEDNN"] = "1"
os.environ["FLAGS_use_onednn"] = "0"
# 切回旧执行器，绕过 new_executor 的 onednn_instruction bug
os.environ["PADDLE_USE_NEW_EXECUTOR"] = "0"
# 彻底禁用 PIR，退回旧 program 路径，避开 pir::ArrayAttribute 转换 bug
os.environ["PADDLE_DISABLE_PIR"] = "1"
os.environ["FLAGS_enable_pir_in_executor"] = "0"

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "ocr_out")
os.makedirs(OUT, exist_ok=True)
PDF_DIR = os.path.join(os.path.dirname(BASE), "public", "pdfs", "degree")

PDFS = {
    "dagang": "dagang.pdf",   # 大纲 236
    "zhinan": "zhinan.pdf",   # 指南 162
    "moni":   "moni.pdf",     # 模拟 138
}
DPI = 150
BATCH = 6

def log(m):
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {m}"
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
    # RGB -> BGR (paddleocr/cv2 习惯)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 3:
        arr = arr[:, :, ::-1].copy()
    elif pix.n == 1:
        arr = np.stack([arr[:, :, 0]] * 3, axis=-1)  # 灰度转 3 通道
    return arr

def main():
    from paddleocr import PaddleOCR
    import paddle
    try:
        paddle.set_flags({'FLAGS_use_onednn': False})
    except Exception:
        pass
    log("instantiating PaddleOCR (首次会从 bcebos 下载模型)…")
    t0 = time.time()
    ocr = PaddleOCR(use_textline_orientation=True, lang="ch")
    log(f"PaddleOCR ready in {time.time()-t0:.0f}s")

    total_pages = 0
    total_out = 0
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
        total_pages += n
        if not pending:
            log(f"  {key} 已全部完成，跳过")
            doc.close()
            continue
        # 批量处理
        batch_imgs, batch_idx = [], []
        saved_since = 0
        for i in pending:
            img = render_page(doc, i)
            batch_imgs.append(img)
            batch_idx.append(i)
            if len(batch_imgs) >= BATCH:
                results = ocr.ocr(batch_imgs)
                for bi, res in enumerate(results):
                    pno = batch_idx[bi] + 1
                    txt = "\n".join([line[1][0] for line in (res or [])]) if res else ""
                    data.append({"t": txt, "p": pno})
                total_out += len(batch_imgs)
                batch_imgs, batch_idx = [], []
                saved_since += BATCH
                if saved_since >= 10:
                    save(key, data); saved_since = 0
                    log(f"  {key} 进度 {len(data)}/{n}  累计已处理 {total_out}")
        # 收尾批次
        if batch_imgs:
            results = ocr.ocr(batch_imgs)
            for bi, res in enumerate(results):
                pno = batch_idx[bi] + 1
                txt = "\n".join([line[1][0] for line in (res or [])]) if res else ""
                data.append({"t": txt, "p": pno})
            total_out += len(batch_imgs)
        save(key, data)
        log(f"  {key} 完成 {len(data)}/{n}")
        doc.close()
    log(f"ALL DONE. 总页数={total_pages}, 本次新增={total_out}")

if __name__ == "__main__":
    main()
