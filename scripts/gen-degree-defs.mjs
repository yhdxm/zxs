// 生成 src/data/degreeWordDefs.ts
// 来源：
//   1) ECDICT 全量 CSV（离线英文释义 + 音标，权威、意思正确）
//   2) degreeQuestions.ts 题库真实真题句（严格过滤后作例句，离线、意思正确）
// 输出结构：Record<小写词, { phonetic?, enDef?, example? }>
// 仅覆盖学位英语单词 + 词组；例句宁可缺失也不给残缺句（用户要求"意思正确"）。

import fs from 'fs'

const ECDICT = 'D:/tmp/ecdict.csv'
const WORDS_FILE = 'src/prep/degreeWords.ts'
const PHRASE_FILES = ['src/prep/degreePhrases.ts', 'src/prep/degreePhrasesExtra.ts']
const Q_FILE = 'src/prep/degreeQuestions.ts'
const OUT = 'src/data/degreeWordDefs.ts'

// ---------- 1. 读取学位英语词表（含词组） ----------
function extractWords(file, re) {
  if (!fs.existsSync(file)) return []
  const src = fs.readFileSync(file, 'utf8')
  const out = []
  for (const m of src.matchAll(re)) {
    const w = m[1].toLowerCase().trim()
    if (w && !out.includes(w)) out.push(w)
  }
  return out
}
const words = extractWords(WORDS_FILE, /\{\s*word:\s*'([^']+)'/g)
const phrases = []
for (const f of PHRASE_FILES) {
  for (const w of extractWords(f, /\ben:\s*'([^']+)'/g)) phrases.push(w)
}
const allKeys = [...new Set([...words, ...phrases])]
console.log('单词数:', words.length, '| 词组数:', phrases.length, '| 合计:', allKeys.length)

// ---------- 2. quote-aware 解析 ECDICT ----------
function* parseEcdict(filePath) {
  const buf = fs.readFileSync(filePath, 'utf8')
  let i = 0, field = '', rec = [], inQ = false
  const n = buf.length
  while (i < n) {
    const c = buf[i]
    if (inQ) {
      if (c === '"') {
        if (buf[i + 1] === '"') { field += '"'; i += 2; continue }
        inQ = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQ = true; i++; continue }
    if (c === ',') { rec.push(field); field = ''; i++; continue }
    if (c === '\n') { rec.push(field); yield rec; rec = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field !== '' || rec.length) { rec.push(field); yield rec }
}

const ecdict = new Map()
let header = true
let cnt = 0
for (const rec of parseEcdict(ECDICT)) {
  if (header) { header = false; continue } // 跳过表头
  const word = (rec[0] || '').toLowerCase().trim()
  if (!word) continue
  // 仅存我们需要的字段；同词多次出现保留首个有效条
  if (!ecdict.has(word)) {
    ecdict.set(word, {
      phonetic: (rec[1] || '').trim(),
      enDef: (rec[2] || '').trim(),
      zh: (rec[3] || '').trim()
    })
  }
  cnt++
}
console.log('ECDICT 记录数:', cnt, '| 进入 map:', ecdict.size)

// ---------- 3. 题库例句：因 OCR 严重缺词，离线例句不可靠，统一不放 ----------
// （宁可例句为空，也不给残缺句误导用户"意思正确"底线）
// 保留字段占位，避免后续二次接入时改结构。

// ---------- 4. 组装并写出 ----------
function cleanEnDef(raw) {
  if (!raw) return ''
  const senses = raw.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  let d = senses.slice(0, 2).join(' ').trim()
  d = d.replace(/\[[^\]]*\]/g, '').trim() // 去 [网络]/[医] 等标签
  if (d.length > 280) d = d.slice(0, 280).replace(/\s+\S*$/, '') + '…'
  return d
}

const out = {}
let hitDef = 0, hitPhon = 0
for (const key of allKeys) {
  const e = ecdict.get(key)
  const enDef = e ? cleanEnDef(e.enDef) : ''
  const phonetic = e ? e.phonetic : ''
  if (enDef) hitDef++
  if (phonetic) hitPhon++
  // 只写非空字段，省体积
  const obj = {}
  if (phonetic) obj.phonetic = phonetic
  if (enDef) obj.enDef = enDef
  if (Object.keys(obj).length) out[key] = obj
}
console.log('命中英文释义:', hitDef, '| 命中音标:', hitPhon)

// ---------- 5. 写出 TS ----------
const lines = []
lines.push('// 学位英语离线词库（英文释义 + 音标）')
lines.push('// 自动生成，请勿手改。来源：ECDICT（离线权威英文释义/音标）。')
lines.push('// 用途：dictionaryapi.dev 当前 90%+ 返回 522，本文件作离线兜底，保证"必有数据"。')
lines.push("export interface OfflineWordDef { phonetic?: string; enDef?: string; example?: string }")
lines.push('export const DEGREE_OFFLINE_DEFS: Record<string, OfflineWordDef> = {')
for (const key of Object.keys(out)) {
  const o = out[key]
  const parts = []
  if (o.phonetic) parts.push(`phonetic: ${JSON.stringify(o.phonetic)}`)
  if (o.enDef) parts.push(`enDef: ${JSON.stringify(o.enDef)}`)
  if (o.example) parts.push(`example: ${JSON.stringify(o.example)}`)
  lines.push(`  ${JSON.stringify(key)}: { ${parts.join(', ')} },`)
}
lines.push('}')
lines.push("export function getOfflineWordDef(w: string): OfflineWordDef | undefined {")
lines.push("  return DEGREE_OFFLINE_DEFS[(w || '').toLowerCase().trim()]")
lines.push('}')
fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')
const mb = (fs.statSync(OUT).size / 1048576).toFixed(2)
console.log('已写出:', OUT, mb, 'MB', '| 词条:', Object.keys(out).length)
