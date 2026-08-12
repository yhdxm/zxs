# -*- coding: utf-8 -*-
"""
学位英语备考台 · 数据重建器 v2
基于现有 OCR 文本（scripts/ocr_out/{dagang,zhinan,moni}_ocr.json，DPI120 已产出，
本沙箱无法重跑 OCR）重新解析，修正双列词表错位与续行归属。

产出：
  src/prep/degreeWords.ts     词汇表（来自《考试大纲》附录一 词汇表，带 * = 复用式）
  src/prep/degreePhrases.ts   语句/词组数据（词组表 + 常用口语表达 + 常用词缀 + 不规则动词）

区域切分：以相邻附录链式定位（词汇表结束=词组表开始…），避免误命中目录页。
依赖：仅标准库（json/re/os），以及 ocr_out 下已有的 JSON。
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR_DIR = os.path.join(ROOT, "scripts", "ocr_out")
OUT_TS = os.path.join(ROOT, "src", "prep")

POS = re.compile(
    r"^(n\.|v\.|a\.|art\.|prep\.|conj\.|pron\.|num\.|int\.|ad\.|adv\.|vt\.|vi\.|adj\.|abbr\.|aux\.|sb\.|sth\.|pl\.|esp\.|usu\.|inf\.|AmE\.|BrE\.|[a-z]{1,4}\.)\s*[一-鿿（(]"
)
SECTION = re.compile(r"(附录[一二三四五六七八]|词汇表|词组表|词缀表|缩略语|地名|口语|国家|不规则|样卷|考试|目录|出版社|CIP|郑重声明|防伪)")


def load(book):
    p = os.path.join(OCR_DIR, f"{book}_ocr.json")
    if not os.path.exists(p):
        print(f"[warn] 未找到 {p}")
        return []
    return json.load(open(p, encoding="utf-8"))


def next_idx(data, kw, after=0):
    for i in range(after, len(data)):
        if kw in data[i]["t"]:
            return i
    return len(data)


def is_word_line(s):
    if not s or len(s) < 2:
        return False
    if SECTION.search(s):
        return False
    if re.search(r"[一-鿿]", s):
        return False
    if POS.match(s):
        return False
    return bool(re.match(r"^[A-Za-z][A-Za-z\-/\(\)\*\= ]{0,40}$", s))


# ---------------- 词汇表 ----------------
def parse_vocab(data):
    start = next_idx(data, "复用式掌握的词汇")          # 附录一真实表头页
    end = next_idx(data, "附录二", start)               # 词组表起 = 词汇表止
    entries, def_q = [], []
    for x in data[start:end]:
        for line in x["t"].split("\n"):
            s = line.strip()
            if not s:
                continue
            if is_word_line(s):
                entries.append({"w": s, "d": ""})
                def_q = []
            elif POS.match(s):
                for j, e in enumerate(entries):
                    if e["d"] == "":
                        e["d"] = s
                        def_q.append(j)
                        break
            elif re.search(r"[一-鿿]", s):
                for j in def_q:
                    if entries[j]["d"] and entries[j]["d"][-1] not in "。！？”）]）":
                        entries[j]["d"] += s
                        break
                else:
                    for e in reversed(entries):
                        if e["d"]:
                            e["d"] += s
                            break
    out = []
    for e in entries:
        w = e["w"].rstrip("*").strip()
        if not w or not e["d"] or not POS.match(e["d"]):
            continue
        out.append({"word": w.lower(), "definition": e["d"].strip(),
                    "productive": e["w"].endswith("*")})
    seen = set(); dedup = []
    for o in out:
        if o["word"] in seen:
            continue
        seen.add(o["word"]); dedup.append(o)
    return dedup


# ---------------- 词组表 ----------------
def parse_phrases_table(data, start, end):
    items, waiting = [], []
    for x in data[start:end]:
        for line in x["t"].split("\n"):
            s = line.strip()
            if not s:
                continue
            if SECTION.search(s) and ("词组表" in s or "附录二" in s or "复用式" in s):
                continue
            has_cn = bool(re.search(r"[一-鿿]", s))
            has_en = bool(re.search(r"[A-Za-z]", s))
            if has_en and not has_cn:
                items.append({"en": s.rstrip("*").strip(), "zh": "", "productive": s.endswith("*")})
                waiting.append(len(items) - 1)
            elif has_cn and not has_en:
                for j in waiting:
                    if items[j]["zh"] == "":
                        items[j]["zh"] = s
                        break
                else:
                    if items:
                        items[-1]["zh"] += s
    return [i for i in items if i["en"] and i["zh"]]


# ---------------- 常用口语表达 ----------------
def parse_spoken(data, start, end):
    cats, cur, items = {}, None, []
    for x in data[start:end]:
        for line in x["t"].split("\n"):
            s = line.strip()
            if not s:
                continue
            m = re.match(r"^\d+[\.、]\s*([A-Za-z][A-Za-z ]{1,30})$", s)
            if m and not re.search(r"[一-鿿]", s):
                cur = m.group(1).strip()
                cats.setdefault(cur, 0)
                continue
            m2 = re.match(r"^\d+[lI1]?\s*[)）]\s*(.+)$", s)
            if m2 and re.search(r"[A-Za-z]", s):
                en = m2.group(1).strip()
                if cur:
                    cats[cur] += 1
                    items.append({"cat": cur, "en": en})
    return items, cats


# ---------------- 常用词缀 ----------------
def parse_affixes(data, start, end):
    items, buf = [], None
    for x in data[start:end]:
        for line in x["t"].split("\n"):
            s = line.strip()
            if not s:
                continue
            if SECTION.search(s) and ("词缀" in s or "附录三" in s):
                continue
            if re.match(r"^[a-z\-]+\-", s) and re.search(r"[一-鿿]", s):
                if buf:
                    items.append(buf)
                ci = re.search(r"[一-鿿]", s).start()
                buf = {"affix": s[:ci].strip(), "zh": s[ci:].strip(), "examples": ""}
            else:
                if buf is not None and re.search(r"[A-Za-z]", s):
                    buf["examples"] += (" " + s if buf["examples"] else s)
    if buf:
        items.append(buf)
    return [i for i in items if i["affix"]]


# ---------------- 不规则动词 ----------------
def parse_irregular(data, start, end):
    lines = []
    for x in data[start:end]:
        for line in x["t"].split("\n"):
            s = line.strip()
            if not s or SECTION.search(s) or re.fullmatch(r"[一-鿿]+", s) or re.search(r"[一-鿿]", s):
                continue
            lines.append(s)
    out = []
    for i in range(0, len(lines) - 2, 3):
        b, p, pp = lines[i], lines[i + 1], lines[i + 2]
        if re.search(r"[A-Za-z]", b) and re.search(r"[A-Za-z]", p) and re.search(r"[A-Za-z]", pp):
            out.append({"base": b, "past": p, "pp": pp})
    return out


# ---------------- 写出 TS ----------------
def ts_str(s):
    return (s or "").replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")


def scan_source_books(words, zhinan, moni):
    """词表只出自《考试大纲》词汇表；扫描《复习指南》《模拟试卷》正文，词在其中出现则追加来源标签。"""
    zh_txt = "\n".join(p["t"] for p in zhinan).lower()
    mo_txt = "\n".join(p["t"] for p in moni).lower()
    def in_text(w, txt):
        for pt in re.split(r"[/.]", w):
            pt = pt.strip()
            if len(pt) < 2:
                continue
            if re.search(r"(?<![a-z])" + re.escape(pt) + r"(?![a-z])", txt):
                return True
        return False
    src = {}
    for w in words:
        books = ["考试大纲"]
        if in_text(w["word"], zh_txt):
            books.append("复习指南")
        if in_text(w["word"], mo_txt):
            books.append("模拟试卷")
        src[w["word"]] = books
    return src


def write_words(words, src_map):
    L = ["// 自动生成，请勿手改。来源：《学位英语水平考试大纲》附录一 词汇表（OCR 重解析 v2，带 * 为复用式掌握）。",
         "import type { DegreeWord, SourceBook } from './degreeTypes'", "", "export const degreeWords: DegreeWord[] = ["]
    for w in words:
        books = src_map.get(w["word"], ["考试大纲"])
        books_ts = "[" + ", ".join("'%s'" % b for b in books) + "]"
        L.append("  { word: '%s', phonetic: '', definition: '%s', productive: %s, sourceBooks: %s }," %
                 (ts_str(w["word"]), ts_str(w["definition"]), "true" if w["productive"] else "false", books_ts))
    L.append("]")
    L.append("")
    open(os.path.join(OUT_TS, "degreeWords.ts"), "w", encoding="utf-8").write("\n".join(L))
    return len(words)


def write_phrases(phrases_tbl, spoken, affixes, irregular):
    all_e = []
    n = 0
    for p in phrases_tbl:
        all_e.append("  { id: 'ph%05d', category: 'phrase', en: '%s', zh: '%s', extra: '', productive: %s }," %
                     (n, ts_str(p["en"]), ts_str(p["zh"]), "true" if p.get("productive") else "false"))
        n += 1
    for s in spoken:
        all_e.append("  { id: 'sp%05d', category: 'spoken', en: '%s', zh: '', extra: '%s', productive: false }," %
                     (n, ts_str(s["en"]), ts_str(s["cat"])))
        n += 1
    for a in affixes:
        all_e.append("  { id: 'af%05d', category: 'affix', en: '%s', zh: '%s', extra: '%s', productive: false }," %
                     (n, ts_str(a["affix"]), ts_str(a["zh"]), ts_str(a["examples"])))
        n += 1
    for v in irregular:
        all_e.append("  { id: 'iv%05d', category: 'irregular', en: '%s', zh: '%s', extra: '%s', productive: false }," %
                     (n, ts_str(v["base"]), ts_str(v["past"]), ts_str(v["pp"])))
        n += 1
    # 分块写入，避免单个大数组字面量触发 TS2590（联合类型过于复杂）
    CHUNK = 200
    L = ["// 自动生成，请勿手改。来源：《学位英语水平考试大纲》附录二(词组表)/附录三(词缀)/附录四(不规则动词)/附录八(口语表达) OCR 重解析 v2。",
         "import type { DegreePhrase } from './degreeTypes'", ""]
    chunks = [all_e[i:i + CHUNK] for i in range(0, len(all_e), CHUNK)]
    for ci, c in enumerate(chunks):
        L.append(f"const _ph{ci}: DegreePhrase[] = [")
        L.extend(c)
        L.append("]")
        L.append("")
    L.append("export const degreePhrases: DegreePhrase[] = [")
    L.append(", ".join(f"..._ph{ci}" for ci in range(len(chunks))))
    L.append("]")
    L.append("")
    open(os.path.join(OUT_TS, "degreePhrases.ts"), "w", encoding="utf-8").write("\n".join(L))
    return len(phrases_tbl), len(spoken), len(affixes), len(irregular)


def main():
    dagang = load("dagang")
    zhinan = load("zhinan")
    moni = load("moni")
    # 链式边界：词汇表结束=词组表开始，词组表结束=词缀开始，依次类推
    vocab_start = next_idx(dagang, "复用式掌握的词汇")
    vocab_end = next_idx(dagang, "附录二", vocab_start)
    phrase_start = vocab_end
    phrase_end = next_idx(dagang, "附录三", phrase_start)
    affix_start = phrase_end
    affix_end = next_idx(dagang, "附录四", affix_start)
    irreg_start = affix_end
    irreg_end = next_idx(dagang, "附录五", irreg_start)
    spoken_start = next_idx(dagang, "常用口语表达用语", irreg_end)
    spoken_end = next_idx(dagang, "郑重声明", spoken_start)
    print(f"[region] vocab {dagang[vocab_start]['p']}-{dagang[vocab_end-1]['p']} | 词组 {dagang[phrase_start]['p']}-{dagang[phrase_end-1]['p']} | 词缀 {dagang[affix_start]['p']}-{dagang[affix_end-1]['p']} | 不规则 {dagang[irreg_start]['p']}-{dagang[irreg_end-1]['p']} | 口语 {dagang[spoken_start]['p']}-{dagang[spoken_end-1]['p']}")
    words = parse_vocab(dagang)
    print(f"[vocab] 大纲词汇表 {len(words)} 条")
    phrases_tbl = parse_phrases_table(dagang, phrase_start, phrase_end)
    spoken, cats = parse_spoken(dagang, spoken_start, spoken_end)
    affixes = parse_affixes(dagang, affix_start, affix_end)
    irregular = parse_irregular(dagang, irreg_start, irreg_end)
    print(f"[phrase] 词组表 {len(phrases_tbl)} | 口语 {len(spoken)} (分类 {len(cats)}) | 词缀 {len(affixes)} | 不规则动词 {len(irregular)}")
    src_map = scan_source_books(words, zhinan, moni)
    from collections import Counter
    dist = Counter(tuple(v) for v in src_map.values())
    print("[source] 来源分布:", dict(dist))
    nw = write_words(words, src_map)
    np_, ns, na, ni = write_phrases(phrases_tbl, spoken, affixes, irregular)
    print(f"已写出 degreeWords.ts({nw}) 与 degreePhrases.ts(短语{np_}+口语{ns}+词缀{na}+不规则{ni})")


if __name__ == "__main__":
    main()
