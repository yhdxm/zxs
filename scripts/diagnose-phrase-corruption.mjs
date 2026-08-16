import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())

function readPhrases(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf-8')
  // 匹配 en/zh/extra 字段，允许单双引号及转义引号
  const regex = /\{ id: '([^']+)', category: '([^']+)', en: (['"])((?:[^'"\\]|\\.)*)\3, zh: (['"])((?:[^'"\\]|\\.)*)\5, extra: (['"])((?:[^'"\\]|\\.)*)\7(?:, productive: (true|false))? \}/g
  const entries = []
  let m
  while ((m = regex.exec(text))) {
    entries.push({
      id: m[1],
      category: m[2],
      en: m[4].replace(/\\'/g, "'").replace(/\\"/g, '"'),
      zh: m[6].replace(/\\'/g, "'").replace(/\\"/g, '"'),
      extra: m[8].replace(/\\'/g, "'").replace(/\\"/g, '"'),
      productive: m[10] === 'true'
    })
  }
  return entries
}

const phraseFiles = ['src/prep/degreePhrases.ts', 'src/prep/degreePhrasesExtra.ts']
const allEntries = []
for (const f of phraseFiles) {
  allEntries.push(...readPhrases(f).map(e => ({ ...e, file: f })))
}

console.log('总词组/语句数:', allEntries.length)

const empty = allEntries.filter(e => !e.zh.trim())
const long = allEntries.filter(e => e.zh.length > 25)
const multiClause = allEntries.filter(e => (e.zh.match(/[；。]/g) || []).length >= 2)
const suspicious = allEntries.filter(e => {
  // 英文短语与中文释义明显不搭：中文里出现与英文关键词无关的语义块（粗略）
  const zh = e.zh
  // 包含明显属于其他短语的片段（如 "等等" 出现在非 and so 类短语）
  return false
})

console.log('zh 为空:', empty.length)
console.log('zh 过长 (>25):', long.length)
console.log('zh 含多个分句:', multiClause.length)

console.log('\n=== zh 为空（前 30）===')
for (const e of empty.slice(0, 30)) console.log(`- ${e.en}`)

console.log('\n=== zh 过长（前 50）===')
for (const e of long.slice(0, 50)) console.log(`- ${e.en}: ${e.zh.substring(0, 70)}`)

console.log('\n=== zh 多分句疑似拼接（前 80）===')
for (const e of multiClause.slice(0, 80)) console.log(`- ${e.en}: ${e.zh.substring(0, 90)}`)
