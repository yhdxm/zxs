// 从 scripts/cet4_words.csv 生成 src/prep/masterWordsBundle.ts（内置全量四级词库）
// 用途：数据库主词表拉取失败/为空时的内置兜底，确保任何部署/设备都至少有完整词库，绝不再退回 97 个演示词。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const csvPath = path.join(root, 'scripts/cet4_words.csv')
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

const rows = parseCSV(text)
const data = rows.slice(1).filter((r) => r[0] && r[0].trim())
const out = data.map((r) => {
  const w = (r[0] || '').trim()
  const ph = (r[1] || '').trim()
  const pos = (r[2] || '').trim()
  const def = (r[3] || '').trim()
  const col = (r[4] || '').trim()
  return `  [${JSON.stringify(w)}, ${JSON.stringify(ph)}, ${JSON.stringify(pos)}, ${JSON.stringify(def)}, ${JSON.stringify(col)}]`
})

const file =
`// 自动生成，请勿手改。来源：scripts/cet4_words.csv（${data.length} 个四级单词）
// 作为数据库主词表拉取失败/为空时的内置兜底，确保任何部署/设备都至少有完整四级词库，绝不再退回 97 个演示词。
// 用户学习进度（背词/错本/签到/设置）仍按你的要求全部存于 Supabase 数据库。
import type { PrepWord } from '../services/cetPrepService'

export const MASTER_WORDS_BUNDLE: PrepWord[] = [
${out.join(',\n')}
]
`

fs.writeFileSync(path.join(root, 'src/prep/masterWordsBundle.ts'), file, 'utf-8')
console.log('generated', data.length, 'words -> src/prep/masterWordsBundle.ts')
