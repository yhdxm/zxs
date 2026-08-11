import pdfplumber
import json
import os
from pathlib import Path

PDF_DIR = Path("D:/桌面/学位英语")
PDFS = [
    "学位英语水平考试大纲.pdf",
    "学位英语水平考试复习指南.pdf",
    "学位英语水平考试全真模拟试卷及考点点睛.pdf",
]

def extract_outline(pdf_path):
    """提取目录/书签"""
    try:
        import pypdfium2 as pdfium
        doc = pdfium.PdfDocument(str(pdf_path))
        toc = doc.get_toc()
        outline = []
        def walk(items, depth=0):
            for item in items:
                title = item.title.strip() if hasattr(item, 'title') else str(item)
                page = item.page_index + 1 if hasattr(item, 'page_index') else None
                outline.append({"title": title, "page": page, "depth": depth})
                if hasattr(item, 'children') and item.children:
                    walk(item.children, depth+1)
        walk(toc)
        return outline
    except Exception as e:
        return [{"error": str(e)}]

def extract_pages(pdf_path, max_pages=15):
    """提取前 N 页文本"""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages]):
            text = page.extract_text()
            pages.append({"page": i+1, "text": (text or "").strip()})
    return pages

def count_pages(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        return len(pdf.pages)

result = {}
for name in PDFS:
    path = PDF_DIR / name
    print(f"\n=== 处理: {name} ===")
    if not path.exists():
        result[name] = {"exists": False}
        continue
    outline = extract_outline(path)
    pages = extract_pages(path, max_pages=15)
    total = count_pages(path)
    result[name] = {
        "exists": True,
        "total_pages": total,
        "outline": outline[:60],  # 最多60条目录
        "sample_pages": pages
    }
    print(f"总页数: {total}, 目录条数: {len(outline)}")
    print("目录预览:")
    for o in outline[:25]:
        print("  " * o.get("depth",0) + f"- {o.get('title','')} (p{o.get('page','?')})")

out_path = Path("D:/代码/zxs-main/scripts/degree-pdf-preview.json")
out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n已保存: {out_path}")
