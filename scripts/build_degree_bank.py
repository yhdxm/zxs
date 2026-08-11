# -*- coding: utf-8 -*-
"""
学位英语备考台 · 题库生成器（v2，依据三本 PDF 真实 OCR 文本）
产出内置种子：
  src/prep/degreeWords.ts    词汇表（来自《考试大纲》附录一 词汇表，带 * = 复用式）
  src/prep/degreeQuestions.ts 题库（三本 PDF 原题 + 依据大纲生成，每题带来源标注）

来源标注规则：
  - 大纲词汇表条目   -> book=考试大纲, generated=False（词汇本身，词库用）
  - 三本 PDF 原题     -> generated=False, basis="{book} 原题 (第N套/第N节)"
  - 依据大纲词汇生成  -> generated=True,  basis="依据大纲词汇表生成"
  - 依据大纲语法生成  -> generated=True,  basis="依据大纲语法项目生成"

运行：python scripts/build_degree_bank.py
依赖：scripts/ocr_out/{dagang,zhinan,moni}_ocr.json （由 scripts/ocr_one_rapid.py 产出，格式 [{t,p}]）
"""
import json
import os
import re
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR_DIR = os.path.join(ROOT, "scripts", "ocr_out")
OUT_TS = os.path.join(ROOT, "src", "prep")

SOURCE_BOOKS = {
    "dagang": "考试大纲",
    "zhinan": "复习指南",
    "moni": "模拟试卷",
}

# 词性缩写（用于判定词条边界；moni 高频词汇里 vt./vi. 常被 OCR 成 t./wi.，下面也容错）
POS = r"(?:n\.|v\.|a\.|art\.|ad\.|adv\.|prep\.|conj\.|pron\.|num\.|int\.|vt\.|vi\.|adj\.|abbr\.|[a-z]{1,3}\.)"
# 词条：英文词 + 可选* + 词性 + 中文释义（释义遇到下一个英文/行尾结束）
VOCAB_ENTRY = re.compile(
    r"([A-Za-z][A-Za-z\-]{1,20})\s*(\*?)\s*" + POS + r"\s*([一-鿿][一-鿿，；、，。：:（）()\s]{1,40}?)"
    r"(?=[A-Za-z\n]|$)"
)
STOP_WORDS = {"the", "and", "or", "to", "of", "in", "is", "are", "be", "as", "for", "with",
              "a", "an", "that", "this", "it", "he", "she", "we", "you", "they", "i", "not"}


def load(book):
    p = os.path.join(OCR_DIR, f"{book}_ocr.json")
    if not os.path.exists(p):
        print(f"[warn] 未找到 {p}")
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def all_text(data):
    return "\n".join(d.get("t", "") for d in data)


# ---------------- 词汇表解析（来自大纲 附录一 词汇表） ----------------
def find_vocab_region(data):
    """定位大纲词汇表区间：从含“附录一 词汇表/带*者”的页 到 含“附录二/词组表”的页之前。"""
    start = None
    end = None
    for i, d in enumerate(data):
        t = d.get("t", "")
        if start is None:
            if "词汇表" in t and ("附录一" in t or "带*者" in t or "复用式" in t or "领会式" in t):
                start = i
        else:
            if "附录二" in t or "词组表" in t:
                end = i
                break
    if start is None:
        start = 0
    if end is None:
        end = len(data)
    return start, end


def parse_vocab(data):
    """从大纲词汇表区间抽取词条（word + 复用式标记 + 词性 + 中文释义）。"""
    start, end = find_vocab_region(data)
    words = {}
    for d in data[start:end]:
        t = d.get("t", "")
        for m in VOCAB_ENTRY.finditer(t):
            word = m.group(1).lower()
            if len(word) < 2 or word in STOP_WORDS:
                continue
            prod = m.group(2) == "*"
            definition = m.group(3).strip().rstrip("，。；、 ")
            if not definition or len(definition) > 60:
                continue
            if word not in words:
                words[word] = {
                    "word": word,
                    "phonetic": "",
                    "definition": definition,
                    "productive": prod,
                    "sourcePage": d.get("p"),
                }
    return list(words.values())


# ---------------- 原题解析（三本 PDF，两遍法） ----------------
SECTION_TYPE = {
    "完成对话": "dialogue",
    "阅读理解": "reading",
    "词汇": "vocab_grammar",
    "语法": "vocab_grammar",
    "英译汉": "translation",
    "翻译": "translation",
    "短文写作": "writing",
    "写作": "writing",
    "样卷": "vocab_grammar",
}


def detect_type(text_window):
    for k, v in SECTION_TYPE.items():
        if k in text_window:
            return v
    return "vocab_grammar"


# 套/Part 边界（题号会重置），用于分作用独立编号域，避免不同套同号题互相覆盖
# 注意：不要把“样卷参考答案”等答案密钥区误判为边界（否则会清空尚未匹配答案的题目）
SCOPE_RE = re.compile(
    r"(模拟试卷\s*[（(]?[一二三四五六七八]?[)）]?|试卷[一二三四五六七八]|"
    r"Part\s+[IVXLCDM]+|第[一二三四五六七八]部分|Section\s+[A-Z]|"
    r"试题[一二三四五六]|练习[一二三四五六])"
)


def parse_originals(data, book_label):
    """分作用独立题号域抽取选择题。题目与答案均带 scope_id 全局累积，
    文档末尾的集中答案密钥也能匹配；最后统一定稿（scope 内去重）。"""
    out = []
    seen = set()
    scope_id = 0
    answers = {}        # (scope_id, num) -> letter（分作用，优先）
    global_answers = {} # num -> letter（末尾集中密钥的兜底，最后出现者胜）
    questions = []      # {scope_id, num, stem, options, type, page}
    cur = None
    cur_type = "vocab_grammar"
    section_window = ""

    for d in data:
        t = d.get("t", "")
        section_window = (section_window + "\n" + t)[-1500:]
        cur_type = detect_type(section_window)
        for line in t.split("\n"):
            s = line.strip()
            if not s:
                continue
            # 套/Part 边界 -> 仅切换作用域编号，不丢弃任何题目/答案
            if SCOPE_RE.search(s[:40]):
                scope_id += 1
                cur = None
                continue
            for k, v in SECTION_TYPE.items():
                if re.match(rf"^\s*{k}", s) or k in s[:25]:
                    cur_type = v
            # 内联答案： 39. C 【参考译文】 / 39.C（...
            ma = re.match(r"^(\d{1,3})\s*[\.、)]\s*([A-D])\s*(?:【|\(|（|解析|参考|译文|答案|\))", s)
            if ma:
                n = int(ma.group(1))
                answers[(scope_id, n)] = ma.group(2)
                global_answers[n] = ma.group(2)
                continue
            # 集中答案密钥： 14. A / 14 A / 14-A
            for mn in re.finditer(r"(\d{1,3})\s*[\.、:：\-]?\s*([A-D])\b", s):
                n = int(mn.group(1))
                answers[(scope_id, n)] = mn.group(2)
                global_answers[n] = mn.group(2)
            # 选项行
            mo = re.match(r"^([A-D])\s*[\.、)]\s*(.+)$", s)
            if mo and cur is not None:
                cur["options"].append(mo.group(2).strip())
                continue
            # 题干：数字 + 英文单词开头
            mq = re.match(r"^(\d{1,3})\s*[\.、)]\s*([A-Za-z].{2,})$", s)
            if mq:
                if cur is not None and cur.get("stem"):
                    questions.append(cur)
                cur = {"scope_id": scope_id, "num": int(mq.group(1)),
                       "stem": mq.group(2).strip(), "options": [], "type": cur_type,
                       "page": d.get("p")}
                continue
            # 题干续行（无编号、非选项、非题型）
            if cur is not None and len(s) > 3 and not re.match(r"^([A-D\d])", s):
                if not any(k in s[:15] for k in SECTION_TYPE):
                    cur["stem"] += " " + s
    if cur is not None and cur.get("stem"):
        questions.append(cur)

    # 定稿：优先 (scope_id, num)，兜底全局 num；scope 内去重
    for q in questions:
        ans = answers.get((q["scope_id"], q["num"])) or global_answers.get(q["num"], "")
        if len(q["options"]) < 2 or not ans:
            continue
        key = (book_label, q["scope_id"], q["num"])
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "num": q["num"], "stem": q["stem"].strip(), "options": q["options"],
            "answer": ans, "page": q.get("page"), "type": q["type"], "book": book_label,
        })
    return out


# ---------------- 依据大纲生成（词义选择题，题量最大） ----------------
def gen_vocab_questions(words, n_sample=None):
    qs = []
    pool = words[:]
    defs = [w["definition"] for w in pool if w["definition"]]
    random.seed(20260811)
    for w in pool:
        if n_sample and len(qs) >= n_sample:
            break
        if not w["definition"]:
            continue
        others = [x for x in defs if x != w["definition"]]
        if len(others) < 3:
            continue
        opts = random.sample(others, 3) + [w["definition"]]
        random.shuffle(opts)
        qs.append({
            "stem": f"“{w['word']}” 在学位英语大纲中的意思是？",
            "options": opts,
            "answer": w["definition"],
            "page": w.get("sourcePage"),
            "type": "vocab_grammar",
            "book": "考试大纲",
            "explanation": f"“{w['word']}” 的释义为：{w['definition']}。" + (f"（复用式掌握，大纲带 *）" if w["productive"] else ""),
            "generated": True,
            "basis": "依据大纲词汇表生成",
        })
    return qs


GRAMMAR_SAMPLES = [
    ("名词、代词的数和格", "There ___ a book and two pens on the desk.", ["is", "are", "be", "been"], "is",
     "there be 句型遵循“就近原则”，最近主语 a book 为单数，用 is。"),
    ("动词的基本时态、语态", "He ___ to Beijing last week.", ["go", "goes", "went", "going"], "went",
     "last week 表示过去，谓语动词用一般过去时 went。"),
    ("形容词、副词的比较级和最高级", "This book is ___ than that one.", ["interesting", "more interesting", "most interesting", "interestinger"], "more interesting",
     "多音节形容词比较级用 more + 原级，interesting 为多音节。"),
    ("常用连接词、冠词", "___ sun rises in the east.", ["A", "An", "The", "/"], "The",
     "世界上独一无二的事物（sun）前用定冠词 the。"),
    ("非谓语动词", "It is easy ___ (do) this.", ["do", "to do", "doing", "done"], "to do",
     "固定句型 it is + adj. + to do，用不定式。"),
    ("虚拟语气", "If I ___ you, I would go.", ["am", "was", "were", "be"], "were",
     "虚拟语气中 be 动词一律用 were（无论人称）。"),
    ("各类从句", "I know ___ he is late.", ["that", "what", "which", "who"], "that",
     "宾语从句陈述事实，用连接词 that 引导。"),
    ("基本句型", "She ___ me a gift.", ["gave", "give", "giving", "to give"], "gave",
     "主谓双宾句型：give sb. sth.，过去动作用 gave。"),
    ("强调句型", "It was yesterday ___ he left.", ["which", "that", "when", "what"], "that",
     "强调句型结构为 it is/was + 被强调部分 + that + 其余。"),
    ("倒装句", "Never ___ such a place.", ["I saw", "saw I", "have I seen", "I have seen"], "have I seen",
     "否定副词 never 置于句首，句子需部分倒装。"),
]


def gen_grammar_questions():
    qs = []
    for topic, stem, opts, ans, exp in GRAMMAR_SAMPLES:
        qs.append({
            "stem": stem,
            "options": opts,
            "answer": ans,
            "page": None,
            "type": "vocab_grammar",
            "book": "考试大纲",
            "explanation": exp,
            "generated": True,
            "basis": f"依据大纲语法项目生成（{topic}）",
        })
    return qs


# ---------------- 写出 TS ----------------
def ts_string(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")


def write_words(words):
    lines = ["// 自动生成，请勿手改。来源：《学位英语水平考试大纲》附录一 词汇表 OCR（带 * 为复用式掌握）。",
             "import type { DegreeWord } from './degreeTypes'",
             "",
             "export const degreeWords: DegreeWord[] = ["]
    for w in words:
        lines.append(
            "  { word: '%s', phonetic: '%s', definition: '%s', productive: %s%s },"
            % (ts_string(w["word"]), ts_string(w.get("phonetic", "")), ts_string(w["definition"]),
               "true" if w["productive"] else "false",
               (", sourcePage: %s" % w["sourcePage"]) if w.get("sourcePage") else "")
        )
    lines.append("]")
    lines.append("")
    with open(os.path.join(OUT_TS, "degreeWords.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return len(words)


def write_questions(qs):
    lines = ["// 自动生成，请勿手改。来源：三本 PDF 原题（generated=false）+ 依据大纲生成（generated=true），每题带来源标注。",
             "import type { DegreeQuestion } from './degreeTypes'",
             "",
             "export const degreeQuestions: DegreeQuestion[] = ["]
    for i, q in enumerate(qs):
        opts = q.get("options")
        opt_str = "[" + ", ".join("'%s'" % ts_string(o) for o in opts) + "]" if opts else "undefined"
        src = q.get("source", {})
        if not src:
            src = {
                "book": q.get("book", "考试大纲"),
                "page": q.get("page") or 0,
                "section": "词汇表" if q.get("generated") else "原题",
                "generated": bool(q.get("generated")),
                "basis": q.get("basis", "原题"),
            }
        lines.append("  {")
        lines.append("    id: 'dq%05d'," % i)
        lines.append("    type: '%s'," % q["type"])
        lines.append("    stem: '%s'," % ts_string(q["stem"]))
        if q.get("passage"):
            lines.append("    passage: '%s'," % ts_string(q["passage"]))
        lines.append("    options: %s," % opt_str)
        lines.append("    answer: '%s'," % ts_string(str(q.get("answer", ""))))
        lines.append("    explanation: '%s'," % ts_string(q.get("explanation", src["basis"])))
        lines.append("    source: { book: '%s', page: %s, section: '%s', generated: %s, basis: '%s' }"
                     % (ts_string(src["book"]), src["page"] or 0, ts_string(src["section"]),
                        "true" if src["generated"] else "false", ts_string(src["basis"])))
        lines.append("  },")
    lines.append("]")
    lines.append("")
    with open(os.path.join(OUT_TS, "degreeQuestions.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return len(qs)


def main():
    dagang = load("dagang")
    zhinan = load("zhinan")
    moni = load("moni")

    words = parse_vocab(dagang)
    print(f"[vocab] 大纲词汇表抽取 {len(words)} 条（含复用式 * ）")

    # 原题：三本全部纳入（考试大纲样卷 + 复习指南 + 模拟试卷）
    originals = []
    originals += parse_originals(dagang, "考试大纲")
    originals += parse_originals(zhinan, "复习指南")
    originals += parse_originals(moni, "模拟试卷")
    print(f"[original] 抽取原题 {len(originals)} 道")

    gen_v = gen_vocab_questions(words)
    gen_g = gen_grammar_questions()
    print(f"[generated] 词汇生成题 {len(gen_v)} + 语法生成题 {len(gen_g)}")

    all_q = originals + gen_v + gen_g
    for q in originals:
        q["source"] = {
            "book": q["book"],
            "page": q.get("page") or 0,
            "section": "原题",
            "generated": False,
            "basis": f"{q['book']} 原题",
        }
        q.pop("book", None)
        q.pop("page", None)
        q.pop("num", None)

    nw = write_words(words)
    nq = write_questions(all_q)
    print(f"已写出 degreeWords.ts ({nw} 词) 与 degreeQuestions.ts ({nq} 题)")


if __name__ == "__main__":
    main()
