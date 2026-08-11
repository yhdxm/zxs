# -*- coding: utf-8 -*-
"""
学位英语 OCR · 单本并行 worker
用法：python scripts/ocr_one.py <dagang|zhinan|moni>
- 通过 ~/.EasyOCR/model/_ready 哨兵串行化模型下载（仅首个 worker 下载，其余等待），避免多进程抢 temp.zip。
- 逐页 OCR，每 10 页增量落盘 {key}_ocr.json（断点可续）。
- 批量推理（batch）减少调用开销，提速。
依赖 scripts/ocr_all_pdfs.py 中定义的 PDF 路径与文件名。
"""
import os, sys, json, time, threading

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE, "public", "pdfs", "degree")
OUT = os.path.join(BASE, "scripts", "ocr_out")
os.makedirs(OUT, exist_ok=True)
MODEL_DIR = os.path.join(os.path.expanduser("~"), ".EasyOCR", "model")
READY = os.path.join(MODEL_DIR, "_ready")
LOCK = os.path.join(MODEL_DIR, "_lock")

PDFS = {
    "dagang": "dagang.pdf",
    "zhinan": "zhinan.pdf",
    "moni": "moni.pdf",
}

DPI = int(os.environ.get("OCR_DPI", "150"))          # 可调：降 DPI 可再提速（精度略降）
BATCH = int(os.environ.get("OCR_BATCH", "8"))        # 批量推理大小
SAVE_EVERY = 10


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] [{KEY}] {msg}"
    print(line, flush=True)


def ensure_models():
    """串行化 easyocr 模型下载：仅一个进程下载，其余等待 _ready 哨兵。"""
    if os.path.exists(READY):
        return
    # 尝试加锁
    me = threading.get_ident()
    acquired = False
    try:
        fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_RDWR)
        os.close(fd)
        acquired = True
    except FileExistsError:
        acquired = False
    if acquired:
        log("本进程负责下载 easyocr 模型（首次较慢）…")
        import easyocr
        t0 = time.time()
        reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
        open(READY, "w").close()
        log(f"模型就绪，耗时 {time.time()-t0:.1f}s")
        return reader
    else:
        # 等待下载者完成
        log("等待其他进程完成模型下载…")
        for _ in range(600):
            if os.path.exists(READY):
                break
            time.sleep(3)
        return None


def main():
    global KEY
    KEY = sys.argv[1] if len(sys.argv) > 1 else "dagang"
    if KEY not in PDFS:
        print("unknown key", KEY); sys.exit(1)

    import fitz, numpy as np, easyocr

    # 获取 reader（已就绪则直接加载缓存，很快）
    if not os.path.exists(READY):
        reader = ensure_models()
        if reader is None:
            reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
    else:
        reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)

    path = os.path.join(PDF_DIR, PDFS[KEY])
    doc = fitz.open(path)
    n = doc.page_count
    out_path = os.path.join(OUT, f"{KEY}_ocr.json")

    data = []
    if os.path.exists(out_path):
        try:
            data = json.load(open(out_path, encoding="utf-8"))
            if len(data) == n:
                log(f"已完成 {n} 页，跳过")
                return
            log(f"断点续跑：已有 {len(data)}/{n} 页")
        except Exception:
            data = []
    start = len(data)

    t0 = time.time()
    # 批量推理：一次送 BATCH 张图
    i = start
    pending_imgs = []
    pending_idx = []
    while i < n:
        pg = doc[i]
        pix = pg.get_pixmap(dpi=DPI)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            arr = arr[:, :, :3]
        pending_imgs.append(arr)
        pending_idx.append(i)
        i += 1
        if len(pending_imgs) >= BATCH or i >= n:
            try:
                res = reader.readtext(pending_imgs, detail=0, paragraph=True)
            except Exception as e:
                res = [f"<OCR_ERR:{e}>"] * len(pending_imgs)
            for idx, r in zip(pending_idx, res):
                txt = r if isinstance(r, str) else "\n".join(r)
                data.append({"p": idx + 1, "t": txt})
            pending_imgs = []
            pending_idx = []
            if len(data) % SAVE_EVERY == 0:
                json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
                log(f"{len(data)}/{n} 已存（{(time.time()-t0)/max(1,len(data)-start):.1f}s/页）")
    json.dump(data, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    doc.close()
    log(f"DONE {KEY} pages={n} -> {out_path} 总耗时 {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
