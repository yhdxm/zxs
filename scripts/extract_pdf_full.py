import sys, os, json
import fitz  # pymupdf

SRC = [
    ("大纲", r"D:/桌面/学位英语/学位英语水平考试大纲.pdf"),
    ("指南", r"D:/桌面/学位英语/学位英语水平考试复习指南.pdf"),
    ("模拟", r"D:/桌面/学位英语/学位英语水平考试全真模拟试卷及考点点睛.pdf"),
]
OUT_DIR = r"D:/代码/zxs-main/scripts/pdf_text"
os.makedirs(OUT_DIR, exist_ok=True)

summary = {}
for key, path in SRC:
    doc = fitz.open(path)
    n = doc.page_count
    # TOC / bookmarks
    toc = doc.get_toc()
    # text length per page (to detect scanned pages)
    page_text_len = []
    total_chars = 0
    for i in range(n):
        t = doc[i].get_text()
        page_text_len.append(len(t))
        total_chars += len(t)
    avg = total_chars / n if n else 0
    summary[key] = {
        "path": path,
        "pages": n,
        "total_chars": total_chars,
        "avg_chars_per_page": round(avg, 1),
        "toc_count": len(toc),
        "toc_sample": toc[:60],
        "first30_text_lens": page_text_len[:30],
    }
    # dump full text
    with open(os.path.join(OUT_DIR, f"{key}_full.txt"), "w", encoding="utf-8") as f:
        for i in range(n):
            f.write(f"\n===== PAGE {i+1} =====\n")
            f.write(doc[i].get_text())
    doc.close()

with open(os.path.join(OUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

for k, v in summary.items():
    print(f"[{k}] pages={v['pages']} total_chars={v['total_chars']} avg={v['avg_chars_per_page']} toc={v['toc_count']}")
print("DONE")
