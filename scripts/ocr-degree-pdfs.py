import pdfplumber
import easyocr
from pathlib import Path
import json

PDF_DIR = Path("D:/桌面/学位英语")
PDFS = [
    "学位英语水平考试大纲.pdf",
    "学位英语水平考试复习指南.pdf",
    "学位英语水平考试全真模拟试卷及考点点睛.pdf",
]
OUT = Path("D:/代码/zxs-main/scripts/degree-pdf-ocr.json")

print("初始化 EasyOCR（中文+英文）...")
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)

def ocr_page(pdf_path, page_num, dpi=200):
    """对单页进行 OCR"""
    from pdf2image import convert_from_path
    images = convert_from_path(str(pdf_path), first_page=page_num, last_page=page_num, dpi=dpi)
    if not images:
        return ""
    img = images[0]
    results = reader.readtext(img, detail=0, paragraph=True)
    return "\n".join(results)

result = {}
for name in PDFS:
    path = PDF_DIR / name
    print(f"\n=== OCR: {name} ===")
    if not path.exists():
        result[name] = {"exists": False}
        continue
    with pdfplumber.open(path) as pdf:
        total = len(pdf.pages)
    # 只 OCR 前 8 页（通常包含封面、目录、前言）
    pages_to_ocr = list(range(1, min(9, total+1)))
    pages = []
    for p in pages_to_ocr:
        print(f"  OCR page {p}/{total}...")
        try:
            text = ocr_page(path, p)
        except Exception as e:
            text = f"[OCR ERROR: {e}]"
        pages.append({"page": p, "text": text.strip()})
    result[name] = {
        "exists": True,
        "total_pages": total,
        "pages": pages
    }

OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n已保存 OCR 结果: {OUT}")
