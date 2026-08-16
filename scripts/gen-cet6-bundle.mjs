// 从 scripts/cet6_words.csv 生成 src/prep/cet6WordsBundle.ts（内置全量六级词库）
// 用途：与四级 masterWordsBundle 一致，作为离线/免费兜底词库。
// CSV 列：word,phonetic,pos,definition,collocation（音标/词性/搭配可留空）。
// 若使用纯「单词<TAB>释义」格式，也可直接另存为 csv（其余列留空）后运行本脚本。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const csvPath = path.join(root, 'scripts/cet6_words.csv')
if (!fs.existsSync(csvPath)) {
  console.error('未找到 scripts/cet6_words.csv，请先放入免费六级词表后再运行。')
  process.exit(1)
}
const csv = fs.readFileSync(csvPath, 'utf-8')
const text = csv.charCodeAt(0) === 0xFEFF ? csv.slice(1) : csv

// RFC4180 引号感知解析（兼容音标/释义中含半角逗号、双引号转义）
function parseCSV(s) {
  const rows = []
  let i = 0
  const n = s.length
  while (i < n) {
    while (i < n && (s[i] === '\n' || s[i] === '\r')) i++
    if (i >= n) break
    const row = []
    while (true) {
      let field = ''
      if (s[i] === '"') {
        i++
        while (i < n) {
          if (s[i] === '"') {
            if (s[i + 1] === '"') { field += '"'; i += 2; continue }
            i++; break
          }
          field += s[i++]
        }
      } else {
        while (i < n && s[i] !== '\n' && s[i] !== '\r' && s[i] !== ',') field += s[i++]
      }
      row.push(field)
      if (i >= n || s[i] === '\n' || s[i] === '\r') {
        if (s[i] === '\r' && s[i + 1] === '\n') i += 2
        else if (s[i] === '\n' || s[i] === '\r') i++
        break
      }
      if (s[i] === ',') { i++; continue }
    }
    rows.push(row)
  }
  return rows
}

// 支持逗号 CSV 或制表符分隔（单词<TAB>释义）
const rows = parseCSV(text)
const data = []
for (const r of rows) {
  let w, ph = '', pos = '', def = '', col = ''
  if (r.length >= 5) {
    ;[w, ph, pos, def, col] = r
  } else if (r.length === 1 && r[0].includes('\t')) {
    const t = r[0].split('\t')
    w = t[0]; def = t[1] || ''
  } else if (r.length >= 2) {
    ;[w, def] = r
  }
  w = (w || '').trim()
  if (w) data.push([w, (ph || '').trim(), (pos || '').trim(), (def || '').trim(), (col || '').trim()])
}

const out = data.map((r) =>
  `  [${JSON.stringify(r[0])}, ${JSON.stringify(r[1])}, ${JSON.stringify(r[2])}, ${JSON.stringify(r[3])}, ${JSON.stringify(r[4])}]`
)

const file =
`// 自动生成，请勿手改。来源：scripts/cet6_words.csv（${data.length} 个六级单词）
// 作为数据库主词表拉取失败/为空时的内置兜底，确保任何部署/设备都至少有完整六级词库（离线/免费）。
import type { PrepWord } from '../services/cetPrepService'

export const CET6_WORDS_BUNDLE: PrepWord[] = [
${out.join(',\n')}
]
`

fs.writeFileSync(path.join(root, 'src/prep/cet6WordsBundle.ts'), file, 'utf-8')
console.log('generated', data.length, 'words -> src/prep/cet6WordsBundle.ts')
