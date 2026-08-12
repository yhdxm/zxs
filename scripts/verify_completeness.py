import sys, json, re
sys.path.insert(0, 'scripts')
import build_degree_bank_v2 as B

dagang = B.load('dagang')
moni = B.load('moni')

# ---- 大纲：词汇 / 短语 / 口语 / 词缀 / 不规则 ----
vocab_start = B.next_idx(dagang, "复用式掌握的词汇")
vocab_end = B.next_idx(dagang, "附录二", vocab_start)
phrase_start = vocab_end
phrase_end = B.next_idx(dagang, "附录三", phrase_start)
affix_start = phrase_end
affix_end = B.next_idx(dagang, "附录四", affix_start)
irreg_start = affix_end
irreg_end = B.next_idx(dagang, "附录五", irreg_start)
spoken_start = B.next_idx(dagang, "常用口语表达用语", irreg_end)
spoken_end = B.next_idx(dagang, "郑重声明", spoken_start)

words = B.parse_vocab(dagang)
phrases_tbl = B.parse_phrases_table(dagang, phrase_start, phrase_end)
spoken, cats = B.parse_spoken(dagang, spoken_start, spoken_end)
affixes = B.parse_affixes(dagang, affix_start, affix_end)
irregular = B.parse_irregular(dagang, irreg_start, irreg_end)
print("=== 大纲 OCR 应出库（解析器重算）===")
print(f"词汇表: {len(words)}")
print(f"词组表: {len(phrases_tbl)} | 口语: {len(spoken)} (分类{len(cats)}) | 词缀: {len(affixes)} | 不规则: {len(irregular)}")

# ---- 当前入库数量 ----
def count_field(path, field):
    txt = open(path, encoding='utf-8').read()
    return txt.count(field + ':')

cur_words = count_field('src/prep/degreeWords.ts', 'word')
cur_ph = count_field('src/prep/degreePhrases.ts', 'en')  # 每条都有 en
print("\n=== 当前 degreeWords.ts / degreePhrases.ts 入库数 ===")
print(f"degreeWords 条目(word字段): {cur_words}")
print(f"degreePhrases 条目(en字段): {cur_ph}")

# ---- 模拟：题数（启发式：统计 Part 题号）----
moni_full = '\n'.join(p['t'] for p in moni)
q_marks = len(re.findall(r'^\s*\d{1,3}[\.、]', moni_full, re.M))
print("\n=== 模拟 OCR 题号命中（启发式，仅供参照）===")
print(f"模拟卷中 '数字.' 行: {q_marks}")
# degreeQuestions 实际数
qtxt = open('src/prep/degreeQuestions.ts', encoding='utf-8').read()
print(f"degreeQuestions.ts id字段: {qtxt.count('id:')}")

print("\n=== 缺口评估 ===")
print(f"词汇: OCR {len(words)} vs 入库 {cur_words} -> 差 {len(words)-cur_words}")
print(f"短语合计: OCR {len(phrases_tbl)+len(spoken)+len(affixes)+len(irregular)} vs 入库 {cur_ph} -> 差 {(len(phrases_tbl)+len(spoken)+len(affixes)+len(irregular))-cur_ph}")
