# -*- coding: utf-8 -*-
"""学位英语备考台 · 资料库正文提取器
把《复习指南》《考试大纲》的讲解/说明正文（非词表、非题）按章节切分为可读文章，
写入 src/prep/degreeGuide.ts / degreeSyllabusProse.ts，供「资料库」tab 浏览（确保三本 PDF 内容不遗漏）。
依赖：仅标准库 + ocr_out 下已有 JSON。
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR_DIR = os.path.join(ROOT, "scripts", "ocr_out")
OUT_TS = os.path.join(ROOT, "src", "prep")

HEAD = re.compile(r"^(第[一二三四五六七八九十百]+章|第[一二三四五六七八九十]+节|[一二三四五六七八九十]+、)")
PAGE_FOOT = re.compile(r"^\.?\s*\d{1,3}\s*:?\s*$")  # OCR 页脚 ". 24 :" / "24."
TOC_LINE = re.compile(r"^\s*(附录[一二三四五六七八]|目录|前言|出版|ISBN|CIP|防伪|定价)\b")

def load(book):
    return json.load(open(os.path.join(OCR_DIR, f"{book}_ocr.json"), encoding="utf-8"))

def clean_lines(text):
    out = []
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            continue
        if PAGE_FOOT.match(s):
            continue
        out.append(s)
    return out

def split_articles(pages, book_label, max_idx=None):
    arts = []
    cur_title = None
    cur_lines = []
    n = 0
    def flush():
        nonlocal cur_title, cur_lines
        if cur_title is None:
            cur_title = f"{book_label}·正文"
        content = "\n".join(cur_lines).strip()
        if len(content) >= 20:
            arts.append({"title": cur_title, "content": content})
        cur_title, cur_lines = None, []
    for p in pages[:max_idx] if max_idx else pages:
        for s in clean_lines(p["t"]):
            if HEAD.match(s):
                flush()
                cur_title = s
                cur_lines = []
            else:
                if TOC_LINE.match(s):
                    continue
                cur_lines.append(s)
    flush()
    return arts

def ts_str(s):
    return (s or "").replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")

def write_ts(path, var, book, arts):
    L = ["// 自动生成，请勿手改。来源：《%s》OCR 正文切分（章节级），供「资料库」浏览。" % book,
         "export interface DegreeArticle {",
         "  id: string",
         "  book: string",
         "  title: string",
         "  content: string",
         "}",
         "export const %s: DegreeArticle[] = [" % var]
    for i, a in enumerate(arts):
        L.append("  { id: '%s%03d', book: '%s', title: '%s', content: '%s' }," %
                 (var[:2], i, book, ts_str(a["title"]), ts_str(a["content"])))
    L.append("]")
    L.append("")
    open(path, "w", encoding="utf-8").write("\n".join(L))
    return len(arts)

# ---- 指南：整本 ----
zhinan = load("zhinan")
zg = split_articles(zhinan, "复习指南")
ng = write_ts(os.path.join(OUT_TS, "degreeGuide.ts"), "guideArticles", "复习指南", zg)
print(f"[指南] 切分 {ng} 篇文章，正文约 {sum(len(a['content']) for a in zg)} 字")

# ---- 大纲：考前说明（词汇表之前的部分，p<30） ----
dagang = load("dagang")
vocab_idx = None
for i, p in enumerate(dagang):
    if "复用式掌握的词汇" in p["t"]:
        vocab_idx = i
        break
dg_pre = split_articles(dagang[:vocab_idx], "考试大纲")
# 去掉纯封面/前言噪音（标题含 前言/出版 的归并到首篇）
nd = write_ts(os.path.join(OUT_TS, "degreeSyllabusProse.ts"), "syllabusProse", "考试大纲", dg_pre)
print(f"[大纲说明] 切分 {nd} 篇（词汇表之前），正文约 {sum(len(a['content']) for a in dg_pre)} 字")
